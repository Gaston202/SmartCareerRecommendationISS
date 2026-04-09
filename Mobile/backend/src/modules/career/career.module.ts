import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CareerService } from './career.service';
import { CareerController } from './career.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { AiOrchestratorModule } from '../../core/ai-orchestrator/ai-orchestrator.module';
import { CacheModule } from '../../core/cache/cache.module';

@Module({
  imports: [DatabaseModule, ConfigModule, AiOrchestratorModule, CacheModule],
  providers: [CareerService],
  controllers: [CareerController],
  exports: [CareerService],
})
export class CareerModule {}
