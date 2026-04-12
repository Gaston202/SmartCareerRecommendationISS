import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { PromptRegistry } from './prompt.registry';
import { OpenRouterService } from './providers/openrouter.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule, ConfigModule, HttpModule],
  providers: [PromptRegistry, OpenRouterService, AiOrchestratorService],
  exports: [AiOrchestratorService],
})
export class AiOrchestratorModule {}
