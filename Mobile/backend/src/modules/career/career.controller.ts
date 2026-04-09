import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CareerService } from './career.service';
import type { Request } from 'express';

interface RecommendCareersRequest {
  quiz_session_id: string;
  cv_analysis_id?: string;
}

@ApiTags('Career')
@ApiBearerAuth()
@Controller('career')
@UseGuards(JwtAuthGuard)
export class CareerController {
  constructor(private careerService: CareerService) {}

  @Post('recommend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get personalized career recommendations based on quiz + CV' })
  @ApiResponse({ status: 200, description: 'Top 5 career matches with explanations' })
  async recommendCareers(@Req() req: Request, @Body() body: RecommendCareersRequest) {
    const userId = (req as any).user?.id;
    const matches = await this.careerService.getCareerRecommendations(
      userId,
      body.quiz_session_id,
      body.cv_analysis_id,
    );
    return {
      success: true,
      data: matches,
    };
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all available careers (reference data)' })
  async getAllCareers() {
    const careers = await this.careerService.getAllCareers();
    return {
      success: true,
      data: careers,
    };
  }
}
