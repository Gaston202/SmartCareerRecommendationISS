import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CvAnalysisWorker } from './cv.analysis.worker';
import { AiProcessingWorker } from './ai.processing.worker';

const logger = new Logger('WorkerBootstrap');

export async function bootstrap() {
  logger.log('Initializing background workers...');

  // Initialize config
  const configService = new ConfigService();

  try {
    // CV Analysis Worker
    const cvWorker = new CvAnalysisWorker(configService, {} as any);
    logger.log('CV Analysis Worker started');

    // AI Processing Worker (for heavy tasks)
    const aiWorker = new AiProcessingWorker(configService, {} as any, {} as any);
    logger.log('AI Processing Worker started');

    logger.log('All workers initialized successfully');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.log('SIGTERM received, shutting down workers...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.log('SIGINT received, shutting down workers...');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to initialize workers', error);
    process.exit(1);
  }
}

bootstrap();
