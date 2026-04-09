/**
 * Quiz Results Storage
 * Save and retrieve quiz results from AsyncStorage + database
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuizResults, QuizSession, QuestionWithAnswer } from './types';
import { supabase } from '../../api/supabase';
import {
  createQuizSession,
  saveQuizResponses,
  completeQuizSession,
  getLatestQuizSession,
  getQuizResponses,
  cleanupOldQuizSessions,
} from '../../database/quiz-matching.service';

const QUIZ_RESULTS_KEY = 'quiz_results_latest';
const QUIZ_SESSION_KEY = 'quiz_session_latest';
const QUIZ_QUESTIONS_KEY = 'quiz_questions_latest';

function normalizeQuizSession(raw: QuizSession): QuizSession {
  return {
    ...raw,
    completedAt: raw.completedAt ?? new Date().toISOString(),
  };
}

export async function saveQuizResults(results: QuizResults): Promise<void> {
  try {
    await AsyncStorage.setItem(QUIZ_RESULTS_KEY, JSON.stringify(results));
  } catch (err) {
    console.warn('[quiz] Failed to save quiz results:', err);
  }
}

export async function getQuizResults(): Promise<QuizResults | null> {
  try {
    const stored = await AsyncStorage.getItem(QUIZ_RESULTS_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as QuizResults;
    return parsed;
  } catch (err) {
    console.warn('[quiz] Failed to retrieve quiz results:', err);
    return null;
  }
}

export async function clearQuizResults(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUIZ_RESULTS_KEY);
  } catch (err) {
    console.warn('[quiz] Failed to clear quiz results:', err);
  }
}

/**
 * Save questions with answers for comprehensive AI analysis
 */
export async function saveQuizQuestionsWithAnswers(
  questions: QuestionWithAnswer[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(QUIZ_QUESTIONS_KEY, JSON.stringify(questions));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const session = await createQuizSession(user.id);
      await saveQuizResponses(session.id, questions);
      await completeQuizSession(session.id);
      await cleanupOldQuizSessions(user.id);
    }
  } catch (err) {
    console.warn('[quiz] Failed to save quiz questions:', err);
  }
}

/**
 * Retrieve questions with answers
 */
export async function getQuizQuestionsWithAnswers(): Promise<QuestionWithAnswer[] | null> {
  try {
    const stored = await AsyncStorage.getItem(QUIZ_QUESTIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as QuestionWithAnswer[];
      return parsed;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const latestSession = await getLatestQuizSession(user.id);
    if (!latestSession) return null;

    const responses = await getQuizResponses(latestSession.id);
    if (!responses || responses.length === 0) return null;

    await AsyncStorage.setItem(QUIZ_QUESTIONS_KEY, JSON.stringify(responses));
    return responses;
  } catch (err) {
    console.warn('[quiz] Failed to retrieve quiz questions:', err);
    return null;
  }
}

/**
 * Save complete quiz session (questions with answers + results)
 */
export async function saveQuizSession(session: QuizSession): Promise<void> {
  try {
    await AsyncStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify(session));

    // Save results only if they exist
    if (session.results) {
      await saveQuizResults(session.results);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && session.questionsWithAnswers && session.questionsWithAnswers.length > 0) {
      const dbSession = await createQuizSession(user.id);
      await saveQuizResponses(dbSession.id, session.questionsWithAnswers);
      await completeQuizSession(dbSession.id);
      await cleanupOldQuizSessions(user.id);
    }

    // Save questions only if they exist
    if (session.questionsWithAnswers && session.questionsWithAnswers.length > 0) {
      await AsyncStorage.setItem(
        QUIZ_QUESTIONS_KEY,
        JSON.stringify(session.questionsWithAnswers)
      );
    }
  } catch (err) {
    console.warn('[quiz] Failed to save quiz session:', err);
  }
}

/**
 * Retrieve complete quiz session
 */
export async function getQuizSession(): Promise<QuizSession | null> {
  try {
    const stored = await AsyncStorage.getItem(QUIZ_SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as QuizSession;
      return normalizeQuizSession(parsed);
    }

    const questionsWithAnswers = await getQuizQuestionsWithAnswers();
    const results = await getQuizResults();

    if (!questionsWithAnswers || !results) {
      return null;
    }

    const rebuiltSession: QuizSession = {
      questionsWithAnswers,
      results,
      completedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify(rebuiltSession));
    return rebuiltSession;
  } catch (err) {
    console.warn('[quiz] Failed to retrieve quiz session:', err);
    return null;
  }
}

export async function getLatestQuizSessionId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const latestSession = await getLatestQuizSession(user.id);
    return latestSession?.id ?? null;
  } catch (err) {
    console.warn('[quiz] Failed to retrieve latest quiz session id:', err);
    return null;
  }
}

export async function clearQuizSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      QUIZ_SESSION_KEY,
      QUIZ_QUESTIONS_KEY,
      QUIZ_RESULTS_KEY,
      'quiz_backend_session_id',
    ]);
  } catch (err) {
    console.warn('[quiz] Failed to clear quiz session:', err);
  }
}

/**
 * Backend session ID management
 */
export async function getBackendSessionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('quiz_backend_session_id');
  } catch (err) {
    console.warn('[quiz] Failed to get backend session id:', err);
    return null;
  }
}

export async function setBackendSessionId(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.setItem('quiz_backend_session_id', sessionId);
  } catch (err) {
    console.warn('[quiz] Failed to set backend session id:', err);
  }
}

export async function clearBackendSessionId(): Promise<void> {
  try {
    await AsyncStorage.removeItem('quiz_backend_session_id');
  } catch (err) {
    console.warn('[quiz] Failed to clear backend session id:', err);
  }
}

/**
 * Get or create a backend quiz session
 * Returns the session ID to use with API calls
 */
export async function ensureBackendSession(): Promise<string> {
  const existing = await getBackendSessionId();
  if (existing) {
    return existing;
  }

  // Create a new session via API
  try {
    const { startQuiz } = await import('../features/quiz/api-backend');
    const result = await startQuiz();
    return result.session.id;
  } catch (error) {
    console.error('[quiz] Failed to ensure backend session:', error);
    throw error;
  }
}


