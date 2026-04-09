import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AiOrchestratorService } from '../../core/ai-orchestrator/ai-orchestrator.service';
import { CareerService } from '../career/career.service';
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

/**
 * Static quiz questions (10 questions about work preferences)
 */
const STATIC_QUESTIONS: Array<{
  type: 'question';
  questionNumber: number;
  totalQuestions: number;
  question: string;
  options: Array<{ id: string; label: string; icon: string }>;
}> = [
  {
    type: 'question',
    questionNumber: 1,
    totalQuestions: 10,
    question: 'Do you prefer working independently or as part of a team?',
    options: [
      { id: 'blue', label: 'I do my best work alone, focused and self-directed', icon: 'code' },
      { id: 'green', label: 'I enjoy teamwork but also value some independent tasks', icon: 'people' },
      { id: 'red', label: 'I thrive in teams, especially when leading or competing', icon: 'target' },
      { id: 'yellow', label: 'I prefer spontaneous collaborations over structured teamwork', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    questionNumber: 2,
    totalQuestions: 10,
    question: 'What kind of work environment helps you thrive most?',
    options: [
      { id: 'blue', label: 'A quiet, structured office with clear processes', icon: 'construct' },
      { id: 'green', label: 'A collaborative team space where I can support others', icon: 'handshake' },
      { id: 'red', label: 'A fast-paced, competitive setting with rapid decisions', icon: 'flash' },
      { id: 'yellow', label: 'A flexible, dynamic environment with variety and experimentation', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    questionNumber: 3,
    totalQuestions: 10,
    question: 'What type of problems do you enjoy solving?',
    options: [
      { id: 'blue', label: 'Complex analytical problems that require research and data', icon: 'analytics' },
      { id: 'green', label: 'People problems: conflicts, relationships, team dynamics', icon: 'people' },
      { id: 'red', label: 'Action problems: quick decisions, crisis management, obstacles to overcome', icon: 'business' },
      { id: 'yellow', label: 'Creative problems: designing, innovating, brainstorming new ideas', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    questionNumber: 4,
    totalQuestions: 10,
    question: 'How important is it for your job to directly help or serve others?',
    options: [
      { id: 'blue', label: 'Not important; I prefer technical or analytical work', icon: 'analytics' },
      { id: 'green', label: 'Very important; I want to make a positive difference in people\'s lives', icon: 'people' },
      { id: 'red', label: 'Somewhat important; helping others should align with achieving results', icon: 'target' },
      { id: 'yellow', label: 'It depends; I enjoy inspiring or entertaining others in creative ways', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    questionNumber: 5,
    totalQuestions: 10,
    question: 'Do you prefer clear instructions and structure or freedom to innovate?',
    options: [
      { id: 'blue', label: 'Clear instructions and well-defined processes are essential', icon: 'construct' },
      { id: 'green', label: 'I like some structure but also room to adapt and collaborate', icon: 'handshake' },
      { id: 'red', label: 'I want freedom to make decisions and chart my own course', icon: 'flash' },
      { id: 'yellow', label: 'Give me the vision and let me innovate freely with minimal rules', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    questionNumber: 6,
    totalQuestions: 10,
    question: 'Which of these work activities sounds most appealing to you?',
    options: [
      { id: 'blue', label: 'Analyzing data, writing reports, ensuring quality and accuracy', icon: 'analytics' },
      { id: 'green', label: 'Supporting, mentoring, or caring for people in some way', icon: 'people' },
      { id: 'red', label: 'Leading projects, meeting targets, making strategic decisions', icon: 'business' },
      { id: 'yellow', label: 'Creating designs, developing new concepts, expressing ideas', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    questionNumber: 7,
    totalQuestions: 10,
    question: 'What is your preferred pace of work?',
    options: [
      { id: 'blue', label: 'Steady, methodical pace with time to perfect my work', icon: 'construct' },
      { id: 'green', label: 'Moderate pace that allows for collaboration and relationship-building', icon: 'handshake' },
      { id: 'red', label: 'Fast-paced with quick turnarounds and high energy', icon: 'flash' },
      { id: 'yellow', label: 'Variable pace; sometimes intense bursts, sometimes relaxed exploration', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    questionNumber: 8,
    totalQuestions: 10,
    question: 'When choosing a job, what matters most to you?',
    options: [
      { id: 'blue', label: 'Job security, stability, and clear career progression path', icon: 'ribbon' },
      { id: 'green', label: 'Positive workplace culture and strong relationships with colleagues', icon: 'people' },
      { id: 'red', label: 'High salary, advancement opportunities, and visible recognition', icon: 'trophy' },
      { id: 'yellow', label: 'Creative freedom, variety of tasks, and opportunity to experiment', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    questionNumber: 9,
    totalQuestions: 10,
    question: 'What kind of people do you enjoy working with most?',
    options: [
      { id: 'blue', label: 'Detail-oriented experts who value precision and quality', icon: 'analytics' },
      { id: 'green', label: 'Supportive, empathetic team players who create positive environments', icon: 'people' },
      { id: 'red', label: 'Ambitious, driven go-getters who push for results', icon: 'target' },
      { id: 'yellow', label: 'Creative, energetic innovators who think outside the box', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    questionNumber: 10,
    totalQuestions: 10,
    question: 'How do you like to receive feedback on your work?',
    options: [
      { id: 'blue', label: 'Detailed, specific feedback with clear examples and data', icon: 'analytics' },
      { id: 'green', label: 'Encouraging, supportive feedback that considers my feelings', icon: 'people' },
      { id: 'red', label: 'Direct, concise feedback focused on results and improvement', icon: 'business' },
      { id: 'yellow', label: 'Brainstorming sessions where feedback flows as creative dialogue', icon: 'brush' },
    ],
  },
];

@Injectable()
export class QuizService {
  private static readonly LABEL_TO_DISC: Record<number, Record<string, string>> = {
    1: {
      'I do my best work alone, focused and self-directed': 'blue',
      'I enjoy teamwork but also value some independent tasks': 'green',
      'I thrive in teams, especially when leading or competing': 'red',
      'I prefer spontaneous collaborations over structured teamwork': 'yellow',
    },
    2: {
      'A quiet, structured office with clear processes': 'blue',
      'A collaborative team space where I can support others': 'green',
      'A fast-paced, competitive setting with rapid decisions': 'red',
      'A flexible, dynamic environment with variety and experimentation': 'yellow',
    },
    3: {
      'Complex analytical problems that require research and data': 'blue',
      'People problems: conflicts, relationships, team dynamics': 'green',
      'Action problems: quick decisions, crisis management, obstacles to overcome': 'red',
      'Creative problems: designing, innovating, brainstorming new ideas': 'yellow',
    },
    4: {
      'Not important; I prefer technical or analytical work': 'blue',
      'Very important; I want to make a positive difference in people\'s lives': 'green',
      'Somewhat important; helping others should align with achieving results': 'red',
      'It depends; I enjoy inspiring or entertaining others in creative ways': 'yellow',
    },
    5: {
      'Clear instructions and well-defined processes are essential': 'blue',
      'I like some structure but also room to adapt and collaborate': 'green',
      'I want freedom to make decisions and chart my own course': 'red',
      'Give me the vision and let me innovate freely with minimal rules': 'yellow',
    },
    6: {
      'Analyzing data, writing reports, ensuring quality and accuracy': 'blue',
      'Supporting, mentoring, or caring for people in some way': 'green',
      'Leading projects, meeting targets, making strategic decisions': 'red',
      'Creating designs, developing new concepts, expressing ideas': 'yellow',
    },
    7: {
      'Steady, methodical pace with time to perfect my work': 'blue',
      'Moderate pace that allows for collaboration and relationship-building': 'green',
      'Fast-paced with quick turnarounds and high energy': 'red',
      'Variable pace; sometimes intense bursts, sometimes relaxed exploration': 'yellow',
    },
    8: {
      'Job security, stability, and clear career progression path': 'blue',
      'Positive workplace culture and strong relationships with colleagues': 'green',
      'High salary, advancement opportunities, and visible recognition': 'red',
      'Creative freedom, variety of tasks, and opportunity to experiment': 'yellow',
    },
    9: {
      'Detail-oriented experts who value precision and quality': 'blue',
      'Supportive, empathetic team players who create positive environments': 'green',
      'Ambitious, driven go-getters who push for results': 'red',
      'Creative, energetic innovators who think outside the box': 'yellow',
    },
    10: {
      'Detailed, specific feedback with clear examples and data': 'blue',
      'Encouraging, supportive feedback that considers my feelings': 'green',
      'Direct, concise feedback focused on results and improvement': 'red',
      'Brainstorming sessions where feedback flows as creative dialogue': 'yellow',
    },
  };

  private readonly logger = new Logger(QuizService.name);

  constructor(
    private db: DatabaseService,
    private aiOrchestrator: AiOrchestratorService,
    private cacheService: CacheService,
    private careerService: CareerService,
  ) {
    this.logger.log('✅ QuizService initialized - using hybrid career matching (deterministic + AI)');
  }

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

      this.logger.log(`[Quiz] Started new session ${session.id} for user ${userId}`);

      // Return first static question (deterministic, no AI)
      const question = STATIC_QUESTIONS[0];
      this.logger.log(`[Quiz] Q1: ${question.question}`);

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
      this.logger.log(`[Quiz] submitAnswer: user=${userId}, session=${sessionId}, answer="${answer}", qNum=${questionNumber}`);

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

      // Validate question number if provided
      if (questionNumber !== undefined && questionNumber !== session.current_question) {
        throw new BadRequestException('Invalid question sequence');
      }

      // Use current question from session if not provided
      const qNum = questionNumber ?? session.current_question;

      // Save answer to user_quiz_responses (need question text and options)
      // Find the question text and options from static questions
      const currentQuestionObj = STATIC_QUESTIONS.find(q => q.questionNumber === qNum);
      const questionText = currentQuestionObj?.question || '';
      const allOptions = currentQuestionObj?.options.map(o => o.label) || [];

      const { error: answerError } = await this.db.supabase
        .from('user_quiz_responses')
        .insert({
          session_id: sessionId,
          question_number: qNum,
          question: questionText,
          selected_option: answer,
          all_options: allOptions,
        });

      if (answerError) throw answerError;

      // Update session with answers array and current_question
      const answers = [...(session.answers || []), { question_number: qNum, answer }];
      const nextQuestionNumber = qNum + 1;

      if (nextQuestionNumber > QUIZ_TOTAL_QUESTIONS) {
        this.logger.log('[Quiz] Quiz completed. Generating career recommendations...');

        // Get full answers with selected labels (for DISC calculation)
        const fullAnswers = await this.buildFullAnswersArray(sessionId, userId);

        // Update session to completed
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

        // Compute DISC from full answers
        const discPercentages = this.computeDiscFromAnswers(fullAnswers);

        // Build minimal userProfile for Nova profile generation
        const userProfile = {
          disc: discPercentages,
          skills: [] as any[],
          interests: [] as any[],
        };

        // Get career matches from CareerService (deterministic scoring + AI explanations)
        const matches = await this.careerService.getCareerRecommendations(userId, sessionId);

        // Build results object compatible with frontend
        const results = {
          type: 'results' as const,
          careers: matches.map((m) => ({
            title: m.career.title,
            description: m.career.description,
            matchPercent: m.match_score,
            tags: m.career.tags,
            aiExplanation: m.ai_explanation,
            matchDetails: {}, // Not available from this service
            reasoning: m.match_reasons,
          })),
          novaProfile: this.buildNovaProfileFromDeterministic(userProfile),
        };

        // Cache results
        const resultsCacheKey = `quiz:results:${userId}:${sessionId}`;
        await this.cacheService.set(resultsCacheKey, results, 86400);

        this.logger.log(`[Quiz] Completed. Returning ${matches.length} career matches.`);
        return { results };
      } else {
        // Get next static question
        const nextQuestion = STATIC_QUESTIONS.find(q => q.questionNumber === nextQuestionNumber);
        if (!nextQuestion) {
          throw new BadRequestException(`Question ${nextQuestionNumber} not found`);
        }

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

        this.logger.log(`[Quiz] Q${nextQuestionNumber}: ${nextQuestion.question}`);
        return { question: nextQuestion };
      }
    } catch (error) {
      this.logger.error('Failed to submit answer', error);
      throw error;
    }
  }

  /**
   * Build full answers array with question numbers, labels, and all options
   */
  private async buildFullAnswersArray(
    sessionId: string,
    userId: string
  ): Promise<Array<{ questionNumber: number; selectedLabel: string; allOptions: any[] }>> {
    // Fetch all responses for this session
    const { data: responses, error } = await this.db.supabase
      .from('user_quiz_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_number', { ascending: true });

    if (error || !responses) {
      throw new NotFoundException('Quiz responses not found');
    }

    // Build full answer objects using stored all_options (from static questions)
    const fullAnswers = responses.map(r => ({
      questionNumber: r.question_number,
      selectedLabel: r.selected_option,
      allOptions: r.all_options || [], // These were stored when the answer was submitted
    }));

    return fullAnswers;
  }

  /**
   * Compute DISC percentages from quiz answers
   */
  private computeDiscFromAnswers(
    answers: Array<{ questionNumber: number; selectedLabel: string }>
  ): { red: number; yellow: number; green: number; blue: number; dominant: string } {
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    for (const ans of answers) {
      const disc = QuizService.LABEL_TO_DISC[ans.questionNumber]?.[ans.selectedLabel];
      if (disc) {
        counts[disc] += 1;
      }
    }
    const total = answers.length || 1;
    const red = Math.round((counts.red / total) * 100);
    const blue = Math.round((counts.blue / total) * 100);
    const green = Math.round((counts.green / total) * 100);
    const yellow = Math.round((counts.yellow / total) * 100);
    // Determine dominant
    const entries = [
      { color: 'red', value: red },
      { color: 'blue', value: blue },
      { color: 'green', value: green },
      { color: 'yellow', value: yellow },
    ].sort((a, b) => b.value - a.value);
    const dominant = entries[0].color as any;
    return { red, blue, green, yellow, dominant };
  }

  /**
   * Build a simple NovaProfile-like object from deterministic data
   */
  private buildNovaProfileFromDeterministic(userProfile: any): any {
    const disc = userProfile.disc || { red: 25, blue: 25, green: 25, yellow: 25, dominant: 'blue' as const };
    const topSkills = (userProfile.skills || []).slice(0, 5).map((s: any) => s.name);
    const topInterests = (userProfile.interests || []).slice(0, 5).map((i: any) => i.name);

    return {
      headline: `Your Career Profile (${this.getPrimaryStyleLabel(disc.dominant)})`,
      professionalIdentity: this.inferProfessionalIdentity(disc),
      behavior: {
        primaryStyle: this.getPrimaryStyleLabel(disc.dominant),
        secondaryStyle: undefined,
        traits: this.getTraitsFromDominant(disc.dominant),
        discBlend: `R${disc.red} / Y${disc.yellow} / G${disc.green} / B${disc.blue}`,
        discPercentages: {
          red: disc.red,
          yellow: disc.yellow,
          green: disc.green,
          blue: disc.blue,
        },
      },
      styleComparison: {
        naturalStyleSummary: 'Based on your preferences, you have a unique work style.',
        adaptedStyleSummary: 'You adapt to meet deadlines and team needs.',
        adaptationDrivers: ['Work requirements', 'Team dynamics', 'Personal growth'],
        stressSignals: ['Overcommitting', 'Isolation when overwhelmed', 'Perfectionism'],
      },
      motivations: {
        topMotivators: topInterests.length > 0 ? topInterests : ['Achievement', 'Growth', 'Recognition'],
        demotivators: ['Micromanagement', 'Stagnation', 'Lack of impact'],
        valuesSummary: 'You value meaningful work that leverages your strengths and aligns with your interests.',
      },
      cognition: {
        decisionStyle: disc.blue > 40 ? 'Analytical and data-driven' : disc.red > 40 ? 'Decisive and action-oriented' : disc.green > 40 ? 'Collaborative and consultative' : 'Creative and intuitive',
        thinkingStyle: disc.yellow > 30 ? 'Big-picture and innovative' : disc.blue > 30 ? 'Systematic and detailed' : 'Balanced',
        learningStyle: disc.green > 30 ? 'Learning with others' : disc.blue > 30 ? 'Structured study' : 'Self-directed exploration',
        communicationStyle: disc.green > 30 ? 'Empathetic and supportive' : disc.red > 30 ? 'Direct and concise' : disc.yellow > 30 ? 'Expressive and enthusiastic' : 'Clear and thorough',
      },
      careerProjection: {
        bestFitEnvironments: this.inferBestEnvironments(disc, userProfile),
        leadershipStyle: disc.red > 40 ? 'Direct and results-focused' : disc.green > 40 ? 'Servant leadership' : disc.blue > 40 ? 'Lead by expertise' : 'Visionary and inspiring',
        watchouts: ['Work-life balance', 'Perfectionism', 'Burnout from overcommitment'],
        futureFocus: 'Strong trajectory toward roles that align with your skills, interests, and work style preferences.',
      },
      recommendedDevelopmentAxes: [
        'Continue developing your core competencies',
        'Expand your professional network in your chosen field',
        'Seek mentorship from experienced professionals',
        'Balance your strengths with areas for growth',
      ],
    };
  }

  private inferBestEnvironments(disc: any, userProfile: any): string[] {
    const envs: string[] = [];
    if (disc.green > 30) envs.push('Collaborative team environments');
    if (disc.blue > 30) envs.push('Structured and well-organized workplaces');
    if (disc.red > 30) envs.push('Fast-paced, results-oriented settings');
    if (disc.yellow > 30) envs.push('Flexible and innovative cultures');
    if (envs.length === 0) envs.push('Versatile - adapt to various environments');
    return envs;
  }

  private getPrimaryStyleLabel(dominant: string): string {
    const labels: Record<string, string> = {
      red: 'Dominance (Red)',
      blue: 'Conscientiousness (Blue)',
      green: 'Steadiness (Green)',
      yellow: 'Influence (Yellow)',
    };
    return labels[dominant] || 'Balanced';
  }

  private getTraitsFromDominant(dominant: string): string[] {
    const traits: Record<string, string[]> = {
      red: ['Decisive', 'Results-oriented', 'Competitive'],
      blue: ['Analytical', 'Detail-oriented', 'Systematic'],
      green: ['Supportive', 'Collaborative', 'Patient'],
      yellow: ['Creative', 'Enthusiastic', 'Adaptable'],
    };
    return traits[dominant] || ['Adaptable', 'Growth-minded'];
  }

  private inferProfessionalIdentity(disc: any): string {
    const dominant = disc.dominant;
    const identities: Record<string, string> = {
      red: 'Results-driven leader and strategist',
      blue: 'Detail-oriented analyst and problem-solver',
      green: 'Supportive team player and collaborator',
      yellow: 'Creative innovator and visionary',
    };
    return identities[dominant] || 'Versatile professional';
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

      // Regenerate results if missing (using CareerService)
      const fullAnswers = session.user_quiz_responses
        .sort((a, b) => a.question_number - b.question_number)
        .map((a) => ({
          questionNumber: a.question_number,
          selectedLabel: a.selected_option,
          allOptions: a.all_options || [],
        }));

      // Get career matches from CareerService (deterministic + AI)
      const matches = await this.careerService.getCareerRecommendations(userId, session.id);

      // Compute DISC for Nova profile
      const discPercentages = this.computeDiscFromAnswers(fullAnswers);
      const userProfile = { disc: discPercentages, skills: [], interests: [] };

      const results = {
        type: 'results' as const,
        careers: matches.map((m) => ({
          title: m.career.title,
          description: m.career.description,
          matchPercent: m.match_score,
          tags: m.career.tags,
          aiExplanation: m.ai_explanation,
          matchDetails: {}, // Not provided by this service
          reasoning: m.match_reasons,
        })),
        novaProfile: this.buildNovaProfileFromDeterministic(userProfile),
      };

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
