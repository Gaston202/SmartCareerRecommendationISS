import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AiOrchestratorService } from '../../core/ai-orchestrator/ai-orchestrator.service';
import { CacheService } from '../../core/cache/cache.service';

export const QUIZ_TOTAL_QUESTIONS = 10;

export interface QuizSession {
  id: string;
  user_id: string;
  quiz_id: string;
  status: 'in_progress' | 'completed';
  current_question: number;
  answers: { question_number: number; answer: string }[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizAnswer {
  session_id: string;
  question_number: number;
  question: string;
  selected_option: string;
  all_options: string[];
}

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private db: DatabaseService,
    private aiOrchestrator: AiOrchestratorService,
    private cacheService: CacheService,
  ) {}

  async startQuiz(userId: string): Promise<{ session: QuizSession; question: any }> {
    try {
      // Create new session
      const { data: session, error: sessionError } = await this.db.supabase
        .from('user_quiz_sessions')
        .insert([
          {
            user_id: userId,
            quiz_id: 'career-fit-quiz',
            status: 'in_progress',
            current_question: 1,
            answers: [],
          },
        ])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Generate first question (no answers yet)
      const question = await this.aiOrchestrator.generateQuizNext([], 1);

      // Cache session state
      const cacheKey = `quiz:session:${session.id}`;
      await this.cacheService.set(cacheKey, session, 3600);

      return { session, question };
    } catch (error) {
      this.logger.error('Failed to start quiz', error);
      throw new BadRequestException('Failed to start quiz');
    }
  }

  async submitAnswer(
    userId: string,
    sessionId: string,
    answer: string,
    questionNumber?: number,
  ): Promise<{ question?: any; results?: any }> {
    try {
      // Fetch session
      const { data: session, error: sessionError } = await this.db.supabase
        .from('user_quiz_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (sessionError || !session) {
        throw new NotFoundException('Quiz session not found');
      }

      // Use session's current question if not provided
      const qNum = questionNumber ?? session.current_question;
      if (questionNumber !== undefined && questionNumber !== session.current_question) {
        throw new BadRequestException('Invalid question sequence');
      }

      // Save answer to user_quiz_responses
      const { error: answerError } = await this.db.supabase
        .from('user_quiz_responses')
        .insert({
          session_id: sessionId,
          question_number: qNum,
          question: '', // We'll fill this from the question object
          selected_option: answer,
          all_options: [],
        });

      if (answerError) throw answerError;

      // Update session with answers array and current_question
      const answers = [...(session.answers || []), { question_number: qNum, answer }];
      const nextQuestionNumber = qNum + 1;

      if (nextQuestionNumber > QUIZ_TOTAL_QUESTIONS) {
        // Quiz complete - generate results
        const results = await this.aiOrchestrator.generateQuizResults(answers.map((a) => a.answer));

        const { data: updatedSession, error: updateError } = await this.db.supabase
          .from('user_quiz_sessions')
          .update({
            status: 'completed',
            current_question: nextQuestionNumber,
            answers,
            completed_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Cache results
        const resultsCacheKey = `quiz:results:${userId}:${sessionId}`;
        await this.cacheService.set(resultsCacheKey, results, 86400);

        return { results };
      } else {
        // Get next question
        const question = await this.aiOrchestrator.generateQuizNext(answers.map((a) => a.answer), nextQuestionNumber);

        const { data: updatedSession, error: updateError } = await this.db.supabase
          .from('user_quiz_sessions')
          .update({
            current_question: nextQuestionNumber,
            answers,
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Cache
        const cacheKey = `quiz:session:${sessionId}`;
        await this.cacheService.set(cacheKey, updatedSession, 3600);

        return { question };
      }
    } catch (error) {
      this.logger.error('Failed to submit answer', error);
      throw error;
    }
  }

  async getQuizResult(userId: string, sessionId: string): Promise<any> {
    try {
      const cacheKey = `quiz:results:${userId}:${sessionId}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) return cached;

      const { data: session, error } = await this.db.supabase
        .from('user_quiz_sessions')
        .select(`
          *,
          user_quiz_responses (*)
        `)
        .eq('id', sessionId)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .single();

      if (error || !session) {
        throw new NotFoundException('Quiz results not found');
      }

      // Regenerate results if missing
      const answers = session.user_quiz_responses
        .sort((a, b) => a.question_number - b.question_number)
        .map((a) => a.selected_option);

      const results = await this.aiOrchestrator.generateQuizResults(answers);

      await this.cacheService.set(cacheKey, results, 86400);
      return results;
    } catch (error) {
      this.logger.error('Failed to get quiz results', error);
      throw error;
    }
  }

  async getQuizHistory(userId: string): Promise<QuizSession[]> {
    const { data, error } = await this.db.supabase
      .from('user_quiz_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    if (error) {
      this.logger.error('Failed to fetch quiz history', error);
      return [];
    }

    return data as QuizSession[];
  }
}
