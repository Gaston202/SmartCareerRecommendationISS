import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoadmapService } from './roadmap.service';
import { RoadmapPlannerService } from './roadmap-planner.service';
import { RoadmapRetrievalService } from './roadmap-retrieval.service';
import { RoadmapRefreshService } from './roadmap-refresh.service';
import type {
  PlanRoadmapDto,
  RefreshProviderDto,
  SearchResourcesDto,
} from './roadmap-rag.types';
import type { Request } from 'express';

interface GenerateRoadmapRequest {
  career_id: string;
  use_async?: boolean;
  user_profile?: {
    skills?: string[];
    novaProfile?: any;
    cvSummary?: string;
  };
}

@ApiTags('Roadmap')
@ApiBearerAuth()
@Controller('roadmap')
export class RoadmapController {
  private readonly logger = new Logger(RoadmapController.name);

  constructor(
    private roadmapService: RoadmapService,
    private roadmapPlannerService: RoadmapPlannerService,
    private roadmapRetrievalService: RoadmapRetrievalService,
    private roadmapRefreshService: RoadmapRefreshService,
  ) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Generate a personalized career roadmap' })
  async generateRoadmap(@Req() req: Request, @Body() body: GenerateRoadmapRequest) {
    const userId = (req as any).user?.id;
    this.logger.log(
      `[Roadmap Path] /roadmap/generate invoked for user=${userId} career_id=${body.career_id} use_async=${Boolean(body.use_async)} mode=legacy_non_rag`,
    );

    if (body.use_async) {
      const job = await this.roadmapService.generateRoadmapAsync(userId, body.career_id, body.user_profile);
      return {
        success: true,
        data: job,
        message: 'Roadmap generation queued',
      };
    } else {
      const roadmap = await this.roadmapService.getOrGenerateRoadmap(
        userId,
        body.career_id,
        body.user_profile,
      );
      return {
        success: true,
        data: roadmap,
      };
    }
  }

  @Get('career/:careerId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get roadmap for a specific career' })
  @ApiParam({ name: 'careerId', description: 'Career ID' })
  async getRoadmap(@Req() req: Request, @Param('careerId') careerId: string) {
    const userId = (req as any).user?.id;
    const roadmap = await this.roadmapService.getOrGenerateRoadmap(userId, careerId);
    return {
      success: true,
      data: roadmap,
    };
  }

  @Get('status/:jobId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check async roadmap generation job status' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.roadmapService.getRoadmapJobStatus(jobId);
    return {
      success: true,
      data: status,
    };
  }

  @Post('plan')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a modular hybrid-RAG learning roadmap plan' })
  async planRoadmap(@Req() req: Request, @Body() body: PlanRoadmapDto) {
    const userId = (req as any).user?.id;
    this.logger.log(
      `[Roadmap Path] /roadmap/plan invoked for user=${userId} career_id=${body.career_id || 'n/a'} target_role=${body.target_role || 'n/a'} mode=modular_rag`,
    );
    const planned = await this.roadmapPlannerService.planRoadmap(userId, body);
    return {
      success: true,
      data: planned,
    };
  }

  @Post('resources/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hybrid retrieval across roadmap resources (filters + keyword + semantic)' })
  async searchRoadmapResources(@Body() body: SearchResourcesDto) {
    this.logger.log(
      `[Roadmap Path] /roadmap/resources/search invoked query="${body.query}" top_k=${body.top_k || 10} mode=rag_retrieval_only`,
    );
    const result = await this.roadmapRetrievalService.searchResources(body);
    return {
      success: true,
      data: result,
    };
  }

  @Post('refresh-provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request ingestion refresh for a specific trusted provider' })
  async refreshProvider(@Req() req: Request, @Body() body: RefreshProviderDto) {
    const userId = (req as any).user?.id;
    const result = await this.roadmapRefreshService.requestProviderRefresh(userId, body);
    return {
      success: true,
      data: result,
      message: 'Refresh request queued',
    };
  }
}
