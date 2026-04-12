import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AiOrchestratorService } from '../../core/ai-orchestrator/ai-orchestrator.service';
import { QueueService, CV_ANALYSIS_QUEUE } from '../../core/queue/queue.service';
import { CacheService } from '../../core/cache/cache.service';
import { readFile } from 'node:fs/promises';
import pdfParse from 'pdf-parse';

export enum CvAnalysisStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);
  private readonly MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly CV_BUCKET = 'cv-uploads';

  constructor(
    private db: DatabaseService,
    private aiOrchestrator: AiOrchestratorService,
    private queueService: QueueService,
    private cacheService: CacheService,
  ) {}

  async uploadCv(userId: string, file: Express.Multer.File | any): Promise<{ analysisId: string; status: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.size > this.MAX_PDF_SIZE) {
      throw new BadRequestException('File too large. Maximum 5MB allowed.');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    try {
      await this.ensureCvBucketExists();

      // Upload to Supabase Storage
      const fileExt = this.getFileExtension(file.originalname);
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
      const filePath = fileName;
      const fileBuffer: Buffer =
        file?.buffer instanceof Buffer
          ? file.buffer
          : file?.path
            ? await readFile(file.path)
            : Buffer.alloc(0);

      if (!fileBuffer.length) {
        throw new BadRequestException('Uploaded file is empty or unreadable');
      }

      const { data: uploadData, error: uploadError } = await this.db.supabase.storage
        .from(this.CV_BUCKET)
        .upload(filePath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        throw new BadRequestException(`Failed to upload CV to storage: ${uploadError.message}`);
      }

      // Get URL for downstream processing
      const { data: urlData } = this.db.supabase.storage
        .from(this.CV_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Create source CV row first, then reference it from cv_analysis.
      const { data: cvUpload, error: cvUploadError } = await this.db.supabase
        .from('cvs')
        .insert([
          {
            user_id: userId,
            storage_path: filePath,
            filename: file.originalname,
            mime_type: file.mimetype,
            status: 'uploaded',
          },
        ])
        .select()
        .single();

      if (cvUploadError || !cvUpload) {
        throw cvUploadError || new BadRequestException('Failed to create CV upload record');
      }

      // Create analysis record in cv_analysis (your existing table)
      const { data: analysis, error: analysisError } = await this.db.supabase
        .from('cv_analysis')
        .insert([
          {
            user_id: userId,
            cv_upload_id: cvUpload.id,
            pdf_url: publicUrl,
            status: CvAnalysisStatus.PENDING,
            extracted_skills: [],
            extracted_interests: [],
            ats_score: null,
            ats_issues: [],
            suggested_improvements: [],
          },
        ])
        .select()
        .single();

      if (analysisError) throw analysisError;

      // Update status to processing
      await this.db.supabase
        .from('cv_analysis')
        .update({ status: CvAnalysisStatus.PROCESSING })
        .eq('id', analysis.id);

      // Run analysis in-process so uploads can complete even when external workers are not running.
      setImmediate(() => {
        void this.processExtractionFromBuffer(userId, analysis.id, fileBuffer);
      });

      return { analysisId: analysis.id, status: CvAnalysisStatus.PROCESSING };
    } catch (error) {
      this.logger.error('CV upload failed', error);
      throw error;
    }
  }

  private async ensureCvBucketExists(): Promise<void> {
    const { data, error } = await this.db.supabase.storage.getBucket(this.CV_BUCKET);
    if (!error && data) {
      return;
    }

    const { error: createError } = await this.db.supabase.storage.createBucket(this.CV_BUCKET, {
      public: false,
      fileSizeLimit: `${this.MAX_PDF_SIZE}`,
      allowedMimeTypes: ['application/pdf'],
    });

    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw new BadRequestException(`Storage bucket setup failed: ${createError.message}`);
    }
  }

  async getAnalysis(userId: string, analysisId: string): Promise<any> {
    const { data: analysis, error } = await this.db.supabase
      .from('cv_analysis')
      .select('*')
      .eq('id', analysisId)
      .eq('user_id', userId)
      .single();

    if (error || !analysis) {
      throw new NotFoundException('Analysis not found');
    }

    return {
      ...analysis,
      // Map to expected API response format
      extracted_data: {
        skills: analysis.extracted_skills || [],
        interests: analysis.extracted_interests || [],
        // Add other fields as needed
      },
    };
  }

  async getLatestAnalysis(userId: string): Promise<any> {
    const { data, error } = await this.db.supabase
      .from('cv_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    const analysis = data[0];
    return {
      ...analysis,
      extracted_data: {
        skills: analysis.extracted_skills || [],
        interests: analysis.extracted_interests || [],
      },
    };
  }

  // This method will be called by the CV worker
  async processExtraction(userId: string, cvAnalysisId: string, pdfUrl: string): Promise<void> {
    this.logger.log(`Processing CV extraction: ${cvAnalysisId}`);

    try {
      // Download PDF (in production, use signed URL)
      const pdfBuffer = await this.downloadPdf(pdfUrl);

      // Extract text (placeholder - implement with pdfjs-dist)
      const text = await this.extractTextFromPdf(pdfBuffer);

      // Analyze with AI
      const extractedData = await this.aiOrchestrator.analyzeCv(text);
      const atsScore = this.calculateAtsScore(text, extractedData);
      const suggestions = await this.aiOrchestrator.generateCvSuggestions(text, atsScore);

      // Update cv_analysis record
      await this.db.supabase
        .from('cv_analysis')
        .update({
          extracted_text: text,
          extracted_skills: extractedData.skills || [],
          extracted_interests: extractedData.interests || [],
          ats_score: atsScore,
          ats_issues: suggestions.ats_issues || [],
          suggested_improvements: suggestions.suggested_improvements || [],
          status: CvAnalysisStatus.COMPLETED,
          completed_at: new Date().toISOString(),
        })
        .eq('id', cvAnalysisId);

      // Invalidate cache
      const userCacheKey = `cv:analysis:${userId}`;
      await this.cacheService.del(userCacheKey);

      this.logger.log(`CV analysis completed: ${cvAnalysisId}`);
    } catch (error) {
      this.logger.error(`CV extraction failed: ${cvAnalysisId}`, error);
      await this.db.supabase
        .from('cv_analysis')
        .update({
          status: CvAnalysisStatus.FAILED,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', cvAnalysisId);
      throw error;
    }
  }

  private async processExtractionFromBuffer(
    userId: string,
    cvAnalysisId: string,
    pdfBuffer: Buffer,
  ): Promise<void> {
    this.logger.log(`Processing CV extraction in-process: ${cvAnalysisId}`);

    try {
      const text = await this.extractTextFromPdf(pdfBuffer);

      const extractedData = await this.aiOrchestrator.analyzeCv(text);
      const atsScore = this.calculateAtsScore(text, extractedData);
      const suggestions = await this.aiOrchestrator.generateCvSuggestions(text, atsScore);

      await this.db.supabase
        .from('cv_analysis')
        .update({
          extracted_text: text,
          extracted_skills: extractedData.skills || [],
          extracted_interests: extractedData.interests || [],
          ats_score: atsScore,
          ats_issues: suggestions.ats_issues || [],
          suggested_improvements: suggestions.suggested_improvements || [],
          status: CvAnalysisStatus.COMPLETED,
          completed_at: new Date().toISOString(),
        })
        .eq('id', cvAnalysisId);

      const userCacheKey = `cv:analysis:${userId}`;
      await this.cacheService.del(userCacheKey);

      this.logger.log(`CV analysis completed in-process: ${cvAnalysisId}`);
    } catch (error) {
      this.logger.error(`In-process CV extraction failed: ${cvAnalysisId}`, error);
      await this.db.supabase
        .from('cv_analysis')
        .update({
          status: CvAnalysisStatus.FAILED,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', cvAnalysisId);
    }
  }

  private async downloadPdf(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(`Failed to download PDF from ${url}`, error);
      throw error;
    }
  }

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
      const parsed = await pdfParse(buffer);
      const cleaned = (parsed.text || '')
        .replace(/\u0000/g, ' ')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!cleaned) {
        throw new Error('PDF text extraction returned empty text');
      }

      return cleaned;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PDF parsing error';
      this.logger.error(`PDF text extraction failed: ${message}`);
      throw new BadRequestException(`Failed to extract text from PDF: ${message}`);
    }
  }

  private calculateAtsScore(text: string, extractedData: any): number {
    let score = 50; // Base score

    // Check for common sections
    const hasSummary = extractedData.summary || /summary|profile|objective/i.test(text);
    const hasExperience = extractedData.experience && extractedData.experience.length > 0;
    const hasEducation = extractedData.education && extractedData.education.length > 0;
    const hasSkills = extractedData.skills && extractedData.skills.length > 0;

    if (hasSummary) score += 10;
    if (hasExperience) score += 20;
    if (hasEducation) score += 10;
    if (hasSkills) score += 10;

    // Penalty for missing contact info
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
    const hasPhone = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
    if (!hasEmail) score -= 10;
    if (!hasPhone) score -= 10;

    return Math.min(100, Math.max(0, score));
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filename.substring(lastDot);
  }
}
