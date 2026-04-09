import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RoadmapService } from './roadmap.service';
import { RoadmapController } from './roadmap.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { AiOrchestratorModule } from '../../core/ai-orchestrator/ai-orchestrator.module';
import { QueueModule } from '../../core/queue/queue.module';
import { CacheModule } from '../../core/cache/cache.module';

@Module({
  imports: [DatabaseModule, ConfigModule, AiOrchestratorModule, QueueModule, CacheModule],
  providers: [RoadmapService],
  controllers: [RoadmapController],
  exports: [RoadmapService],
})
export class RoadmapModule {}
