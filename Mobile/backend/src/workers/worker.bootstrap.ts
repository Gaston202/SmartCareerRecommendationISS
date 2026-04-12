import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { QueueService } from '../core/queue/queue.service';
import { AiOrchestratorService } from '../core/ai-orchestrator/ai-orchestrator.service';
import { CvAnalysisWorker } from './cv.analysis.worker';
import { AiProcessingWorker } from './ai.processing.worker';

const logger = new Logger('WorkerBootstrap');

export async function bootstrap() {
  logger.log('Initializing background workers...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const queueService = app.get(QueueService);
  const aiOrchestrator = app.get(AiOrchestratorService);

  try {
    // CV Analysis Worker
    const cvWorker = new CvAnalysisWorker(configService, queueService);
    logger.log('CV Analysis Worker started');

    // AI Processing Worker (for heavy tasks)
    const aiWorker = new AiProcessingWorker(configService, aiOrchestrator, queueService);
    logger.log('AI Processing Worker started');

    logger.log('All workers initialized successfully');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.log('SIGTERM received, shutting down workers...');
      void app.close();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.log('SIGINT received, shutting down workers...');
      void app.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to initialize workers', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
