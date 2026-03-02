/**
 * Quiz and Career Matching Database Service
 * Handles storing and retrieving quiz sessions, responses, and matching results
 */

import { supabase } from '../api/supabase';
import type { QuestionWithAnswer } from '../features/quiz/types';

export interface QuizSessionData {
  id: string;
  userId: string;
  quizId: string;
  status: 'in_progress' | 'completed';
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizResponseData {
  id: string;
  sessionId: string;
  questionNumber: number;
  question: string;
  selectedOption: string;
  allOptions: string[];
  createdAt: string;
}

export interface CareerMatchResultData {
  id: string;
  userId: string;
  cvAnalysisId: string;
  quizSessionId: string;
  careerId: string;
  matchScore: number;
  matchReasons: string[];
  aiInsights: Record<string, any>;
  ranking: number;
  generatedAt: string;
  createdAt: string;
}

/**
 * Create a new quiz session for the user
 */
export async function createQuizSession(
  userId: string,
  quizId: string = 'career-fit-quiz'
): Promise<QuizSessionData> {
  const { data, error } = await supabase
    .from('user_quiz_sessions')
    .insert([
      {
        user_id: userId,
        quiz_id: quizId,
        status: 'in_progress',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to create quiz session:', error);
    throw error;
  }

  return {
    id: data.id,
    userId: data.user_id,
    quizId: data.quiz_id,
    status: data.status,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Save quiz responses for a session
 */
export async function saveQuizResponses(
  sessionId: string,
  responses: QuestionWithAnswer[]
): Promise<QuizResponseData[]> {
  const insertData = responses.map((response) => ({
    session_id: sessionId,
    question_number: response.questionNumber,
    question: response.question,
    selected_option: response.selectedOption,
    all_options: response.allOptions,
  }));

  const { data, error } = await supabase
    .from('user_quiz_responses')
    .insert(insertData)
    .select();

  if (error) {
    console.error('[DB] Failed to save quiz responses:', error);
    throw error;
  }

  return data.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    questionNumber: r.question_number,
    question: r.question,
    selectedOption: r.selected_option,
    allOptions: r.all_options,
    createdAt: r.created_at,
  }));
}

/**
 * Mark quiz session as completed
 */
export async function completeQuizSession(sessionId: string): Promise<QuizSessionData> {
  const { data, error } = await supabase
    .from('user_quiz_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to complete quiz session:', error);
    throw error;
  }

  return {
    id: data.id,
    userId: data.user_id,
    quizId: data.quiz_id,
    status: data.status,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get latest quiz session for user
 */
export async function getLatestQuizSession(userId: string): Promise<QuizSessionData | null> {
  const { data, error } = await supabase
    .from('user_quiz_sessions')
    .select()
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('[DB] Failed to fetch quiz session:', error);
    throw error;
  }

  return {
    id: data.id,
    userId: data.user_id,
    quizId: data.quiz_id,
    status: data.status,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get quiz responses for a session
 */
export async function getQuizResponses(sessionId: string): Promise<QuestionWithAnswer[]> {
  const { data, error } = await supabase
    .from('user_quiz_responses')
    .select()
    .eq('session_id', sessionId)
    .order('question_number', { ascending: true });

  if (error) {
    console.error('[DB] Failed to fetch quiz responses:', error);
    throw error;
  }

  return data.map((r) => ({
    questionNumber: r.question_number,
    question: r.question,
    selectedOption: r.selected_option,
    allOptions: r.all_options,
  }));
}

/**
 * Save career match results (TOP 5 matches) to database
 */
export async function saveCareerMatchResults(
  userId: string,
  cvAnalysisId: string,
  quizSessionId: string,
  matches: Array<{
    careerId: string;
    matchScore: number;
    matchReasons: string[];
    aiInsights: Record<string, any>;
    ranking: number;
  }>
): Promise<CareerMatchResultData[]> {
  const insertData = matches.map((match) => ({
    user_id: userId,
    cv_analysis_id: cvAnalysisId,
    quiz_session_id: quizSessionId,
    career_id: match.careerId,
    match_score: match.matchScore,
    match_reasons: match.matchReasons,
    ai_insights: match.aiInsights,
    ranking: match.ranking,
    generated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('career_match_results')
    .insert(insertData)
    .select();

  if (error) {
    console.error('[DB] Failed to save career match results:', error);
    throw error;
  }

  return data.map((r) => ({
    id: r.id,
    userId: r.user_id,
    cvAnalysisId: r.cv_analysis_id,
    quizSessionId: r.quiz_session_id,
    careerId: r.career_id,
    matchScore: r.match_score,
    matchReasons: r.match_reasons,
    aiInsights: r.ai_insights,
    ranking: r.ranking,
    generatedAt: r.generated_at,
    createdAt: r.created_at,
  }));
}

/**
 * Get cached career match results for user (if already computed)
 */
export async function getCachedCareerMatches(
  userId: string,
  cvAnalysisId: string,
  quizSessionId: string
): Promise<CareerMatchResultData[]> {
  const { data, error } = await supabase
    .from('career_match_results')
    .select()
    .eq('user_id', userId)
    .eq('cv_analysis_id', cvAnalysisId)
    .eq('quiz_session_id', quizSessionId)
    .order('ranking', { ascending: true });

  if (error) {
    console.error('[DB] Failed to fetch cached matches:', error);
    throw error;
  }

  return data.map((r) => ({
    id: r.id,
    userId: r.user_id,
    cvAnalysisId: r.cv_analysis_id,
    quizSessionId: r.quiz_session_id,
    careerId: r.career_id,
    matchScore: r.match_score,
    matchReasons: r.match_reasons,
    aiInsights: r.ai_insights,
    ranking: r.ranking,
    generatedAt: r.generated_at,
    createdAt: r.created_at,
  }));
}

/**
 * Clear old quiz sessions (keep last 5)
 */
export async function cleanupOldQuizSessions(userId: string): Promise<void> {
  try {
    // Get all sessions for user, ordered by date
    const { data: sessions, error: fetchError } = await supabase
      .from('user_quiz_sessions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) throw fetchError;

    // Keep last 5, delete the rest
    if (sessions && sessions.length > 5) {
      const toDelete = sessions.slice(5).map((s) => s.id);

      const { error: deleteError } = await supabase
        .from('user_quiz_sessions')
        .delete()
        .in('id', toDelete);

      if (deleteError) throw deleteError;

      console.log(`[DB] Cleaned up ${toDelete.length} old quiz sessions`);
    }
  } catch (error) {
    console.error('[DB] Failed to cleanup old quiz sessions:', error);
    // Don't throw - cleanup failure shouldn't break the app
  }
}
