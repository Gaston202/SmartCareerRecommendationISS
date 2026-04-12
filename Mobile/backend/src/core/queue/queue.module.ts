import { Module } from '@nestjs/common';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';
import { QueueService } from './queue.service';
import { CvAnalysisWorker } from '../../workers/cv.analysis.worker';
import { AiProcessingWorker } from '../../workers/ai.processing.worker';

@Module({
  imports: [AiOrchestratorModule],
  providers: [QueueService, CvAnalysisWorker, AiProcessingWorker],
  exports: [QueueService],
})
export class QueueModule {}
