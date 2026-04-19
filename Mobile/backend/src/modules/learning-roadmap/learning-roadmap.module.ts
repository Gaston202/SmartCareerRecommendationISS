import { Module } from '@nestjs/common';
import { LearningRoadmapController } from './learning-roadmap.controller';
import { LearningRoadmapService } from './learning-roadmap.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AiOrchestratorModule } from '../../core/ai-orchestrator/ai-orchestrator.module';
import { CacheModule } from '../../core/cache/cache.module';

@Module({
  imports: [DatabaseModule, AiOrchestratorModule, CacheModule],
  controllers: [LearningRoadmapController],
  providers: [LearningRoadmapService],
  exports: [LearningRoadmapService],
})
export class LearningRoadmapModule {}
