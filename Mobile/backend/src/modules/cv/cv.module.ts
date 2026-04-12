import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CvService } from './cv.service';
import { CvController } from './cv.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { AiOrchestratorModule } from '../../core/ai-orchestrator/ai-orchestrator.module';
import { QueueModule } from '../../core/queue/queue.module';
import { CacheModule } from '../../core/cache/cache.module';

@Module({
  imports: [DatabaseModule, ConfigModule, AiOrchestratorModule, QueueModule, CacheModule],
  providers: [CvService],
  controllers: [CvController],
  exports: [CvService],
})
export class CvModule {}
