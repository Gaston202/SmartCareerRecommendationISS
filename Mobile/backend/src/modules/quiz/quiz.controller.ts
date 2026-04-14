import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { DatabaseService } from '../../core/database/database.service';
import type { Request } from 'express';

interface StartQuizRequest {
  // empty for now
}

interface SubmitAnswerRequest {
  answer: string;
  question?: string;
  options?: string[];
}

@ApiTags('Quiz')
@ApiBearerAuth()
@Controller('quiz')
export class QuizController {
  private readonly logger = new Logger(QuizController.name);

  constructor(
    private quizService: QuizService,
    private db: DatabaseService,
  ) {}

  private async getUserIdFromAuthHeader(req: Request): Promise<string> {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    this.logger.debug(`[Quiz] Auth header: "${authHeader.substring(0, 50)}${authHeader.length > 50 ? '...' : ''}"`);
    this.logger.debug(`[Quiz] Token extracted (length: ${token.length})`);

    if (!token) {
      this.logger.warn('[Quiz] No token provided in Authorization header');
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      this.logger.debug('[Quiz] Validating token with Supabase...');
      const { data: { user }, error } = await this.db.supabaseAnon.auth.getUser(token);

      if (error) {
        this.logger.error('[Quiz] Supabase validation error:', {
          message: error.message,
          status: error.status,
          code: error.code,
        });
        throw new UnauthorizedException(`Invalid or expired token: ${error.message}`);
      }

      if (!user) {
        this.logger.warn('[Quiz] No user returned from Supabase');
        throw new UnauthorizedException('Invalid or expired token: no user found');
      }

      this.logger.log(`[Quiz] Token valid. User ID: ${user.id}, Email: ${user.email}`);
      return user.id;
    } catch (error: any) {
      this.logger.error('[Quiz] Token validation exception:', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @Post('start')
  @ApiOperation({ summary: 'Start a new quiz session' })
  @ApiResponse({ status: 200, description: 'Quiz session created with first question' })
  async startQuiz(@Req() req: Request) {
    const userId = await this.getUserIdFromAuthHeader(req);
    const result = await this.quizService.startQuiz(userId);
    return {
      success: true,
      data: result,
    };
  }

  @Post('answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an answer and get next question or results' })
  @ApiResponse({ status: 200, description: 'Next question or final results' })
  async submitAnswer(
    @Req() req: Request,
    @Body() body: SubmitAnswerRequest,
  ) {
    const userId = await this.getUserIdFromAuthHeader(req);
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      throw new Error('X-Session-Id header required');
    }

    const session = await this.quizService.submitAnswer(
      userId,
      sessionId,
      body.answer,
      undefined,
      body.question,
      body.options,
    );
    return {
      success: true,
      data: session,
    };
  }

  @Get('result/:sessionId')
  @ApiOperation({ summary: 'Get quiz results for a completed session' })
  @ApiResponse({ status: 200, description: 'Quiz results with Nova profile and careers' })
  async getResult(@Req() req: Request, @Param('sessionId') sessionId: string) {
    const userId = await this.getUserIdFromAuthHeader(req);
    const results = await this.quizService.getQuizResult(userId, sessionId);
    return {
      success: true,
      data: results,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get quiz history for the user' })
  async getHistory(@Req() req: Request) {
    const userId = await this.getUserIdFromAuthHeader(req);
    const history = await this.quizService.getQuizHistory(userId);
    return {
      success: true,
      data: history,
    };
  }
}
