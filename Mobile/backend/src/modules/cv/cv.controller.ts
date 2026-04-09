import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CvService, CvAnalysisStatus } from './cv.service';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('CV Analysis')
@ApiBearerAuth()
@Controller('cv')
@UseGuards(JwtAuthGuard)
export class CvController {
  constructor(private cvService: CvService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload CV PDF for analysis' })
  @ApiResponse({ status: 201, description: 'CV uploaded successfully, processing started' })
  async uploadCv(@Req() req: Request, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const userId = (req as any).user?.id;
    const result = await this.cvService.uploadCv(userId, file);
    return {
      success: true,
      data: result,
    };
  }

  @Get('result/:analysisId')
  @ApiOperation({ summary: 'Get CV analysis result by ID' })
  @ApiResponse({ status: 200, description: 'CV analysis result' })
  async getResult(@Req() req: Request, @Param('analysisId') analysisId: string) {
    const userId = (req as any).user?.id;
    const analysis = await this.cvService.getAnalysis(userId, analysisId);
    return {
      success: true,
      data: analysis,
    };
  }

  @Get('result/latest')
  @ApiOperation({ summary: 'Get latest CV analysis for user' })
  async getLatestResult(@Req() req: Request) {
    const userId = (req as any).user?.id;
    const analysis = await this.cvService.getLatestAnalysis(userId);

    if (!analysis) {
      return {
        success: true,
        data: null,
        message: 'No CV analysis found',
      };
    }

    return {
      success: true,
      data: analysis,
    };
  }

  @Get('status/:analysisId')
  @ApiOperation({ summary: 'Get CV analysis processing status' })
  async getStatus(@Req() req: Request, @Param('analysisId') analysisId: string) {
    const userId = (req as any).user?.id;
    const analysis = await this.cvService.getAnalysis(userId, analysisId);

    return {
      success: true,
      data: {
        id: analysis.id,
        status: analysis.status,
        progress: this.getProgressFromStatus(analysis.status),
        created_at: analysis.created_at,
        updated_at: analysis.updated_at,
        error_message: analysis.error_message,
      },
    };
  }

  private getProgressFromStatus(status: CvAnalysisStatus): number {
    switch (status) {
      case CvAnalysisStatus.PENDING:
        return 10;
      case CvAnalysisStatus.PROCESSING:
        return 50;
      case CvAnalysisStatus.COMPLETED:
        return 100;
      case CvAnalysisStatus.FAILED:
        return 0;
      default:
        return 0;
    }
  }
}
