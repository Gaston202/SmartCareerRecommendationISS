import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService, CV_ANALYSIS_QUEUE } from '../core/queue/queue.service';

@Injectable()
export class CvAnalysisWorker {
  private readonly logger = new Logger(CvAnalysisWorker.name);
  private worker: Worker;

  constructor(
    private configService: ConfigService,
    private queueService: QueueService,
  ) {
    const redisUrl = configService.get<string>('REDIS_URL');
    this.worker = new Worker(
      CV_ANALYSIS_QUEUE,
      async (job: Job) => {
        this.logger.debug(`Processing job ${job.id}: ${job.name}`);

        try {
          switch (job.name) {
            case 'extract-pdf-text':
              await this.extractPdfText(job);
              break;
            case 'analyze-cv-content':
              await this.analyzeCvContent(job);
              break;
            case 'generate-cv-suggestions':
              await this.generateCvSuggestions(job);
              break;
            default:
              this.logger.warn(`Unknown job type: ${job.name}`);
          }
        } catch (error) {
          this.logger.error(`Job ${job.id} failed`, error);
          throw error;
        }
      },
      { connection: new Redis(redisUrl, { maxRetriesPerRequest: null }) }
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed: ${job.name}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} failed: ${job.name}`, err);
    });
  }

  private async extractPdfText(job: Job) {
    const { cvAnalysisId, pdfUrl } = job.data;
    this.logger.log(`Extracting text from CV: ${cvAnalysisId}`);

    // PDF text extraction logic will be here
    // For now, job proceeds to next step
    const text = 'Extracted PDF text placeholder';

    // Queue next job
    await this.queueService.addJob(CV_ANALYSIS_QUEUE, 'analyze-cv-content', {
      cvAnalysisId,
      extractedText: text,
      userId: job.data.userId,
    });

    job.updateProgress(50);
  }

  private async analyzeCvContent(job: Job) {
    const { cvAnalysisId, extractedText } = job.data;
    this.logger.log(`Analyzing CV content: ${cvAnalysisId}`);

    // AI processing will happen here via AiOrchestrator
    // For now, return placeholder
    const structuredData = {
      skills: ['JavaScript', 'React', 'Node.js'],
      experience: [],
      education: [],
    };

    job.updateProgress(75);
  }

  private async generateCvSuggestions(job: Job) {
    const { cvAnalysisId, structuredData } = job.data;
    this.logger.log(`Generating suggestions: ${cvAnalysisId}`);

    // AI suggestions generation
    job.updateProgress(100);
  }
}
