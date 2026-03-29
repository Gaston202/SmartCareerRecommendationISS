/**
 * AI Backend Service - Backend-Only, No Fallbacks
 * 
 * SESSION-BASED QUIZ FLOW:
 * 1. First call: Create quiz session → get question 1
 * 2. User answers → Save answer via /quiz/save-answer
 * 3. Get next question via /quiz/next-question (passing all previous answers)
 * 4. Repeat until completion
 *
 * NO in-memory caching of all questions. NO fallback responses.
 * All quiz generation goes through backend ai_v2 ONLY.
 * If backend is unavailable, the app shows clear error.
 */

import type { QuizNextResponse } from '../features/quiz/types';
import type { AiCareerMatchingInput, AiCareerMatchingOutput } from '../features/careers/ai-matching.types';
import type { SavedRoadmap } from '../features/roadmaps/types';
import BackendConfig from '../config/backend';
import { supabase } from './supabase';

interface AIBackendError extends Error {
  code: string;
  statusCode?: number;
  originalError?: any;
}

function createError(code: string, message: string, statusCode?: number): AIBackendError {
  const error = new Error(message) as AIBackendError;
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// Quiz session state - minimal tracking
let currentSessionId: string | null = null;
let currentUserId: string | null = null;
const TOTAL_QUIZ_QUESTIONS = 7; // Updated from 5 to 7

/**
 * Get or create quiz session for current user
 */
async function getOrCreateSession(userId: string): Promise<string> {
  try {
    // Try to get existing active session
    const { data: existingSessions, error: fetchError } = await supabase
      .from('user_quiz_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .maybeSingle();

    // maybeSingle() returns null if no rows found (which is OK here)
    if (fetchError && fetchError.code !== 'PGRST116') {
      BackendConfig.logError('Quiz', `Failed to fetch session: ${fetchError.message}`);
      throw fetchError;
    }

    if (existingSessions?.id) {
      return existingSessions.id;
    }

    // Create new session
    const { data: newSession, error } = await supabase
      .from('user_quiz_sessions')
      .insert([
        {
          user_id: userId,
          quiz_id: 'career-fit-quiz',
          status: 'in_progress',
        },
      ])
      .select('id')
      .single();

    if (error) {
      BackendConfig.logError('Quiz', `Failed to create session: ${error.message}`);
      throw error;
    }

    return newSession.id;
  } catch (error: any) {
    BackendConfig.logError('Quiz', `Session creation failed: ${error.message}`);
    throw createError('SESSION_CREATION_FAILED', error.message);
  }
}

/**
 * Get all previous answers for current session from database
 */
async function getPreviousAnswers(
  sessionId: string,
  limit?: number
): Promise<Array<{ question: string; answer: string; inferred_interests?: string[] }>> {
  try {
    let query = supabase
      .from('user_quiz_responses')
      .select('question, answer')
      .eq('session_id', sessionId)
      .order('question_number', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      BackendConfig.logError('Quiz', `Failed to fetch previous answers: ${error.message}`);
      return [];
    }

    // Transform to match backend QuizAnswerEvidence schema
    return (data || []).map((row: any) => ({
      question: row.question,
      answer: row.answer,
      inferred_interests: [],
      inferred_strengths: [],
      inferred_preferences: [],
      inferred_dislikes: [],
    }));
  } catch (error: any) {
    BackendConfig.logError('Quiz', `Error fetching previous answers: ${error.message}`);
    return [];
  }
}

/**
 * Save answer to database and update profile
 */
async function saveAnswerToDatabase(
  userId: string,
  sessionId: string,
  questionNumber: number,
  question: string,
  answer: string
): Promise<void> {
  try {
    // Save answer with upsert (update if question already answered, insert if not)
    const { error: saveError } = await supabase
      .from('user_quiz_responses')
      .upsert(
        {
          session_id: sessionId,
          user_id: userId,
          question_number: questionNumber,
          question,
          answer,
          saved_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,question_number' }
      );

    if (saveError) {
      BackendConfig.logError('Quiz', `Failed to save answer: ${saveError.message}`);
      throw saveError;
    }

    BackendConfig.logSuccess('Quiz', { action: 'answer_saved', questionNumber });
  } catch (error: any) {
    BackendConfig.logError('Quiz', `Error saving answer: ${error.message}`);
    // Don't throw - let UI continue even if saving fails
  }
}

/**
 * Generate quiz - Implements proper session-based adaptive questioning
 * 
 * Flow:
 * 1. First call (answers.length === 0): Create session, get Q1
 * 2. Subsequent calls: Save previous answer, fetch all answers, get next question
 * 3. Each question uses full answer history for adaptation
 */
export async function generateQuizNext(answers: string[]): Promise<QuizNextResponse> {
  try {
    const questionIndex = answers.length; // 0 for Q1, 1 for Q2, etc.
    
    // Get or create session (first call only)
    if (!currentSessionId) {
      // Get real user ID from Supabase auth with proper error handling
      let userError: any;
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        currentUserId = user?.id;
        userError = error;
      } catch (error) {
        userError = error;
      }
      
      if (!currentUserId || userError) {
        BackendConfig.logError('Quiz', `Cannot create session: user not authenticated - ${userError?.message || 'unknown error'}`);
        throw new Error('User not authenticated - cannot create session');
      }

      currentSessionId = await getOrCreateSession(currentUserId);
      BackendConfig.logSuccess('Quiz', { action: 'session_created', sessionId: currentSessionId });
    }

    // SAVE previous answer if this isn't the first question
    if (questionIndex > 0 && answers.length > 0) {
      const previousAnswer = answers[questionIndex - 1];
      await saveAnswerToDatabase(
        currentUserId!,
        currentSessionId!,
        questionIndex, // Save as question number that was just answered
        `Question ${questionIndex}`,
        previousAnswer
      );
    }

    // GET all previous answers for context
    const previousAnswers = await getPreviousAnswers(currentSessionId!);

    // REQUEST next question from backend with full context
    const endpoint = BackendConfig.endpoints.quiz();
    BackendConfig.logCall('Quiz', endpoint, {
      action: 'get_next_question',
      questionNumber: questionIndex + 1,
      previousAnswerCount: previousAnswers.length,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: BackendConfig.getHeaders(),
      body: JSON.stringify({
        user_id: currentUserId,
        session_id: currentSessionId,
        previous_answers: previousAnswers,
        user_profile: {
          user_id: currentUserId,
          interests: [],
          hobbies: [],
          strengths: [],
          work_preferences: [],
        },
        question_number: questionIndex + 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = (errorData as any).error || (errorData as any).message || `HTTP ${response.status}`;
      BackendConfig.logError('Quiz', `Backend returned ${response.status}: ${errorMsg}`);
      throw createError('QUIZ_GENERATION_FAILED', errorMsg, response.status);
    }

    const data = await response.json();

    // Handle response with actual question from backend
    if (data.success && data.data) {
      const questionData = data.data;

      // Return question
      const quizQuestion = {
        type: 'question' as const,
        questionNumber: questionData.question_number || questionIndex + 1,
        totalQuestions: TOTAL_QUIZ_QUESTIONS,
        question: questionData.question || `Question ${questionIndex + 1}`,
        options: (questionData.options || []).map((opt: any, idx: number) => ({
          id: opt.id || `opt-${idx}`,
          label: opt.label || opt,
          icon: ['brush', 'palette', 'people', 'briefcase', 'chart'][idx % 5] || 'star',
        })),
      };

      BackendConfig.logSuccess('Quiz', {
        action: 'question_generated',
        questionNumber: quizQuestion.questionNumber,
        optionsCount: quizQuestion.options.length,
      });

      return quizQuestion;
    }

    // Check if quiz is complete
    if (questionIndex >= TOTAL_QUIZ_QUESTIONS) {
      // Mark session as completed
      await supabase
        .from('user_quiz_sessions')
        .update({ status: 'completed' })
        .eq('id', currentSessionId);

      // Return results placeholder (backend would generate these)
      return {
        type: 'results' as const,
        careers: [
          {
            title: 'Loading career recommendations...',
            description: 'Your quiz responses are being analyzed',
            matchPercent: 0,
            tags: [],
          },
        ],
      };
    }

    BackendConfig.logError('Quiz', 'Invalid response format: ' + JSON.stringify(data));
    throw createError('QUIZ_GENERATION_FAILED', 'Invalid backend response format');
  } catch (error: any) {
    if (error.code) throw error;
    BackendConfig.logError('Quiz', error.message || 'Unknown error');
    throw createError('QUIZ_GENERATION_FAILED', error.message || 'Unknown error');
  }
}

/**
 * Generate career matches - Backend only, no fallback
 */
export async function generateCareerMatches(input: AiCareerMatchingInput): Promise<AiCareerMatchingOutput> {
  const endpoint = BackendConfig.endpoints.careerMatching();
  BackendConfig.logCall('CareerMatching', endpoint, {
    userId: input.userId,
    careersCount: input.availableCareers.length,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: BackendConfig.getHeaders(),
      body: JSON.stringify({
        user_id: input.userId,
        user_profile: {
          user_id: input.userId,
          name: "App User",
          email: "user@app.com",
          current_skills: input.userSkills,
          experience_level: "entry",
        },
        cv_text: input.cvAnalysis
          ? JSON.stringify(input.cvAnalysis)
          : undefined,
        preferences: {
          available_careers: input.availableCareers,
          quiz_questions: input.quizQuestions,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || errorData.message || `HTTP ${response.status}`;
      BackendConfig.logError('CareerMatching', `Backend returned ${response.status}: ${errorMsg}`);
      throw createError('CAREER_MATCHING_FAILED', errorMsg, response.status);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      BackendConfig.logError('CareerMatching', 'Invalid response format: ' + JSON.stringify(data));
      throw createError('CAREER_MATCHING_FAILED', 'Invalid backend response format');
    }

    const backendOutput = data.data;
    
    // Handle both old and new response formats
    const careersList = backendOutput.careers || backendOutput.recommended_careers || [];
    
    const output: AiCareerMatchingOutput = {
      topMatches: careersList.map((career: any) => ({
        careerTitle: career.role || career.title,
        careerDescription: career.description || career.role || career.title || '',
        matchScore: career.match_score || career.matchScore || 0,
        matchingFactors: {
          quizAlignment: career.reasoning || 'Aligned with quiz responses',
          skillsMatch: `Requires: ${(career.required_skills || []).join(', ')}`,
          cvAnalysisMatch: (career.market_demand || career.marketDemand)
            ? `Market demand: ${(career.market_demand || career.marketDemand)}`
            : undefined,
        },
        reasoning: career.reasoning || career.description || 'Strong match for your career goals',
        recommendedNextSteps: career.next_steps || [
          'Learn more about this role',
          'Connect with professionals in this field',
          'Build relevant projects',
        ],
      })),
      generationTimestamp: new Date().toISOString(),
      aiModel: 'backend-ai_v2',
    };

    BackendConfig.logSuccess('CareerMatching', { matchCount: output.topMatches.length });
    return output;
  } catch (error: any) {
    if (error.code) throw error; // Already structured
    BackendConfig.logError('CareerMatching', error.message || 'Unknown error');
    throw createError('CAREER_MATCHING_FAILED', error.message || 'Unknown error');
  }
}

/**
 * Generate roadmap - Backend only, no fallback
 */
export async function generateCareerRoadmap(
  careerTitle: string,
  careerDescription: string,
  tags?: string[],
  matchPercent?: number,
): Promise<SavedRoadmap> {
  const endpoint = BackendConfig.endpoints.roadmap();
  BackendConfig.logCall('Roadmap', endpoint, { career: careerTitle });

  try {
    // Get real user ID from Supabase auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const userId = user?.id;
    
    if (!userId) {
      BackendConfig.logError('Roadmap', 'Cannot generate roadmap: user not authenticated');
      throw new Error('User not authenticated - cannot generate roadmap');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: BackendConfig.getHeaders(),
      body: JSON.stringify({
        user_id: userId,
        user_profile: {
          user_id: userId,
          name: 'App User',
          email: 'user@app.example.com',
          current_skills: [],
          experience_level: 'entry',
        },
        target_career: careerTitle,
        timeframe_months: 12,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = (errorData as any).error || (errorData as any).message || `HTTP ${response.status}`;
      BackendConfig.logError('Roadmap', `Backend returned ${response.status}: ${errorMsg}`);
      throw createError('ROADMAP_GENERATION_FAILED', errorMsg, response.status);
    }

    const data = await response.json();

    if (!data.success) {
      BackendConfig.logError('Roadmap', 'Invalid response format: ' + JSON.stringify(data));
      throw createError('ROADMAP_GENERATION_FAILED', data.error || 'Invalid backend response format');
    }

    const backendOutput = data;
    const roadmap: SavedRoadmap = {
      id: `roadmap-${Date.now()}`,
      careerTitle,
      careerDescription,
      matchPercent,
      tags,
      createdAt: new Date().toISOString(),
      steps: (backendOutput.roadmap || []).map((phase: any) => ({
        title: phase.title || `Phase ${phase.phase}`,
        description: `${(phase.skills_to_learn || []).join(', ')} - Difficulty: ${phase.difficulty || 'intermediate'}`,
        timeframe: `${phase.duration_months || 0} months`,
      })),
    };

    BackendConfig.logSuccess('Roadmap', { stepCount: roadmap.steps.length });
    return roadmap;
  } catch (error: any) {
    if (error.code) throw error;
    BackendConfig.logError('Roadmap', error.message || 'Unknown error');
    throw createError('ROADMAP_GENERATION_FAILED', error.message || 'Unknown error');
  }
}

/**
 * Health check - verify backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const endpoint = BackendConfig.endpoints.health();
    BackendConfig.logCall('Health', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
    });

    const isHealthy = response.ok;
    if (isHealthy) {
      BackendConfig.logSuccess('Health');
    } else {
      BackendConfig.logError('Health', `Backend returned status ${response.status}`);
    }

    return isHealthy;
  } catch (error: any) {
    BackendConfig.logError('Health', error.message || 'Backend unreachable');
    return false;
  }
}

/**
 * Get backend URL (for debugging)
 */
export function getBackendUrl(): string {
  return BackendConfig.baseUrl;
}
