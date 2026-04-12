import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { CareerModule } from './modules/career/career.module';
import { CvModule } from './modules/cv/cv.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { DatabaseModule } from './core/database/database.module';
import { CacheModule } from './core/cache/cache.module';
import { QueueModule } from './core/queue/queue.module';
import { AiOrchestratorModule } from './core/ai-orchestrator/ai-orchestrator.module';
import { LoggerModule } from './core/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    LoggerModule,
    DatabaseModule,
    CacheModule,
    QueueModule,
    AiOrchestratorModule,
    AuthModule,
    QuizModule,
    CareerModule,
    CvModule,
    RoadmapModule,
  ],
})
export class AppModule {}
