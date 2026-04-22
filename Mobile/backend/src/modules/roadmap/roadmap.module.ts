import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RoadmapService } from './roadmap.service';
import { RoadmapController } from './roadmap.controller';
import { RoadmapRetrievalService } from './roadmap-retrieval.service';
import { RoadmapPlannerService } from './roadmap-planner.service';
import { RoadmapRefreshService } from './roadmap-refresh.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AiOrchestratorModule } from '../../core/ai-orchestrator/ai-orchestrator.module';
import { QueueModule } from '../../core/queue/queue.module';
import { CacheModule } from '../../core/cache/cache.module';

@Module({
  imports: [DatabaseModule, ConfigModule, AiOrchestratorModule, QueueModule, CacheModule],
  providers: [
    RoadmapService,
    RoadmapRetrievalService,
    RoadmapPlannerService,
    RoadmapRefreshService,
  ],
  controllers: [RoadmapController],
  exports: [RoadmapService, RoadmapRetrievalService, RoadmapPlannerService],
})
export class RoadmapModule {}
