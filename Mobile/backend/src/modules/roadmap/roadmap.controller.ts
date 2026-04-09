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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoadmapService } from './roadmap.service';
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
@UseGuards(JwtAuthGuard)
export class RoadmapController {
  constructor(private roadmapService: RoadmapService) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Generate a personalized career roadmap' })
  async generateRoadmap(@Req() req: Request, @Body() body: GenerateRoadmapRequest) {
    const userId = (req as any).user?.id;

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
  @ApiOperation({ summary: 'Check async roadmap generation job status' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.roadmapService.getRoadmapJobStatus(jobId);
    return {
      success: true,
      data: status,
    };
  }
}
