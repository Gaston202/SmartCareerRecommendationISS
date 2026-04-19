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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LearningRoadmapService } from './learning-roadmap.service';
import type { Request } from 'express';

interface GenerateLearningRoadmapRequest {
  career_id: string;
  career_title: string;
  career_description: string;
  user_profile?: {
    skills?: string[];
    novaProfile?: any;
    cvSummary?: string;
  };
}

@ApiTags('Learning Roadmap')
@ApiBearerAuth()
@Controller('learning-roadmap')
@UseGuards(JwtAuthGuard)
export class LearningRoadmapController {
  constructor(private learningRoadmapService: LearningRoadmapService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a skill-based learning roadmap' })
  async generateLearningRoadmap(
    @Req() req: Request,
    @Body() body: GenerateLearningRoadmapRequest,
  ) {
    const userId = (req as any).user?.id;

    const roadmap = await this.learningRoadmapService.generateLearningRoadmap(
      userId,
      body.career_id,
      body.career_title,
      body.career_description,
      body.user_profile,
    );

    return {
      success: true,
      data: roadmap,
    };
  }

  @Post('save')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save a learning roadmap' })
  async saveLearningRoadmap(
    @Req() req: Request,
    @Body()
    body: {
      career_id: string;
      career_title: string;
      roadmap_data: any;
    },
  ) {
    const userId = (req as any).user?.id;

    const saved = await this.learningRoadmapService.saveLearningRoadmap(
      userId,
      body.career_id,
      body.career_title,
      body.roadmap_data,
    );

    return {
      success: true,
      data: saved,
    };
  }

  @Get('list')
  @ApiOperation({ summary: 'Get all saved learning roadmaps for user' })
  async getLearningRoadmaps(@Req() req: Request) {
    const userId = (req as any).user?.id;

    const roadmaps = await this.learningRoadmapService.getUserLearningRoadmaps(userId);

    return {
      success: true,
      data: roadmaps,
    };
  }

  @Get('career/:careerId')
  @ApiOperation({ summary: 'Get learning roadmap for specific career' })
  @ApiParam({ name: 'careerId', description: 'Career ID' })
  async getLearningRoadmapForCareer(
    @Req() req: Request,
    @Param('careerId') careerId: string,
  ) {
    const userId = (req as any).user?.id;

    const roadmap = await this.learningRoadmapService.generateLearningRoadmap(
      userId,
      careerId,
      'Career',
      'Career Description',
    );

    return {
      success: true,
      data: roadmap,
    };
  }

  @Get('skills/career/:careerId')
  @ApiOperation({ summary: 'Get all skills for a career' })
  @ApiParam({ name: 'careerId', description: 'Career ID' })
  async getSkillsForCareer(@Param('careerId') careerId: string) {
    const skills = await this.learningRoadmapService.getSkillsForCareer(careerId);

    return {
      success: true,
      data: skills,
    };
  }

  @Get('courses/:skillId')
  @ApiOperation({ summary: 'Get courses for a skill' })
  @ApiParam({ name: 'skillId', description: 'Skill ID' })
  async getCoursesForSkill(@Param('skillId') skillId: string) {
    const courses = await this.learningRoadmapService.getCoursesForSkill(skillId);

    return {
      success: true,
      data: courses,
    };
  }
}
