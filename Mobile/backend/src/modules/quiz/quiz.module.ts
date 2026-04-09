import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { AiOrchestratorModule } from '../../core/ai-orchestrator/ai-orchestrator.module';
import { CacheModule } from '../../core/cache/cache.module';
import { CareerModule } from '../career/career.module';

@Module({
  imports: [DatabaseModule, ConfigModule, AiOrchestratorModule, CacheModule, CareerModule],
  providers: [QuizService],
  controllers: [QuizController],
  exports: [QuizService],
})
export class QuizModule {}
