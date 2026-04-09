import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AiOrchestratorService } from '../../core/ai-orchestrator/ai-orchestrator.service';
import { QueueService, CV_ANALYSIS_QUEUE } from '../../core/queue/queue.service';
import { CacheService } from '../../core/cache/cache.service';
import { CvAnalysisStatus } from './cv.service';
import * as multer from 'multer';

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);
  private readonly MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB

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
      // Upload to Supabase Storage
      const fileExt = this.getFileExtension(file.originalname);
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
      const filePath = `cv-uploads/${fileName}`;

      const { data: uploadData, error: uploadError } = await this.db.supabase.storage
        .from('cv-uploads')
        .upload(filePath, file.buffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        throw new BadRequestException('Failed to upload CV to storage');
      }

      // Get public URL (or signed URL)
      const { data: urlData } = this.db.supabase.storage
        .from('cv-uploads')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Create analysis record in cv_analysis (your existing table)
      const { data: analysis, error: analysisError } = await this.db.supabase
        .from('cv_analysis')
        .insert([
          {
            user_id: userId,
            cv_upload_id: uploadData.path, // or use the file ID
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

      // Queue processing job
      await this.queueService.addJob(CV_ANALYSIS_QUEUE, 'extract-pdf-text', {
        userId,
        cvAnalysisId: analysis.id,
        pdfUrl: publicUrl,
      });

      // Update status to processing
      await this.db.supabase
        .from('cv_analysis')
        .update({ status: CvAnalysisStatus.PROCESSING })
        .eq('id', analysis.id);

      return { analysisId: analysis.id, status: CvAnalysisStatus.PROCESSING };
    } catch (error) {
      this.logger.error('CV upload failed', error);
      throw error;
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
      const text = this.extractTextFromPdf(pdfBuffer);

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

  private extractTextFromPdf(buffer: Buffer): string {
    // TODO: Implement actual PDF text extraction using pdfjs-dist
    // For now, return placeholder
    this.logger.warn('PDF text extraction not fully implemented - using placeholder');
    return `Extracted text from PDF (${buffer.length} bytes). Full implementation would use pdfjs-dist.`;
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
