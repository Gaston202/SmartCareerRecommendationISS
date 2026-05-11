/**
 * Quiz API – Calls backend API instead of OpenRouter directly
 * Uses stateful session management with session_id tracking
 */

import type { QuizNextResponse, QuizQuestion, QuizResults } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchBackend, getBackendApiBaseUrl } from '../../api/backend';

const BACKEND_API_URL = getBackendApiBaseUrl();
const SESSION_ID_KEY = 'quiz_backend_session_id';

console.log('[Quiz API] BACKEND_API_URL:', BACKEND_API_URL);

export interface QuizStartResponse {
  session: {
    id: string;
    user_id: string;
    status: 'in_progress' | 'completed';
    current_question: number;
    created_at: string;
  };
  question: QuizQuestion;
}

export interface QuizAnswerResponse {
  question?: QuizQuestion;
  results?: QuizNextResponse;
}

export async function regenerateQuizResults(sessionId?: string): Promise<QuizNextResponse> {
  return getQuizResults(sessionId, true);
}

function normalizeQuizQuestion(raw: any): QuizQuestion {
  return {
    type: 'question',
    question: String(raw?.question ?? ''),
    questionNumber: Number(raw?.questionNumber ?? raw?.question_number ?? 1),
    totalQuestions: Number(raw?.totalQuestions ?? raw?.total_questions ?? 10),
    options: Array.isArray(raw?.options) ? raw.options : [],
  };
}

function normalizeQuizResults(raw: any): QuizResults {
  const source = raw?.results ?? raw;
  const careers = Array.isArray(source?.careers)
    ? source.careers.map((c: any) => ({
        title: String(c?.title ?? 'Career'),
        description: String(c?.description ?? ''),
        matchPercent: Number(c?.matchPercent ?? c?.match_percent ?? c?.match_score ?? c?.score ?? 0),
        tags: Array.isArray(c?.tags) ? c.tags.filter(Boolean) : [],
      }))
    : [];

  const novaProfile = source?.novaProfile ?? source?.nova_profile;

  return {
    type: 'results',
    careers,
    novaProfile,
  };
}

async function parseBackendError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
    if (Array.isArray(payload?.message) && payload.message.length > 0) {
      return String(payload.message[0]);
    }
  } catch {
    // Ignore parse errors and use fallback
  }
  return `${fallback} (HTTP ${response.status})`;
}

/**
 * Get the current quiz session ID
 */
export async function getSessionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_ID_KEY);
  } catch (error) {
    console.error('[Quiz] Failed to get session ID:', error);
    return null;
  }
}

/**
 * Set the current quiz session ID
 */
export async function setSessionId(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
  } catch (error) {
    console.error('[Quiz] Failed to set session ID:', error);
    throw error;
  }
}

/**
 * Clear the current quiz session ID
 */
export async function clearSessionId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_ID_KEY);
  } catch (error) {
    console.error('[Quiz] Failed to clear session ID:', error);
  }
}

/**
 * Start a new quiz session via backend
 */
export async function startQuiz(): Promise<QuizStartResponse> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }

    const response = await fetchBackend('/quiz/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await clearSessionId();
      }
      const errorMessage = await parseBackendError(response, 'Failed to start quiz');
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Invalid response from server');
    }

    // Save session ID for subsequent requests
    await setSessionId(data.data.session.id);

    return {
      session: data.data.session,
      question: normalizeQuizQuestion(data.data.question),
    };
  } catch (error: any) {
    console.error('[Quiz] Failed to start quiz:', error);
    throw error;
  }
}

/**
 * Submit an answer and get next question or results
 */
export async function submitAnswer(
  answer: string,
  currentQuestion?: { question: string; options: string[]; questionNumber?: number },
): Promise<QuizAnswerResponse> {
  try {
    const token = await getAuthToken();
    const sessionId = await getSessionId();

    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }
    if (!sessionId) {
      throw new Error('No active quiz session. Please start a new quiz.');
    }

    const response = await fetchBackend('/quiz/answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify({
        answer,
        questionNumber: currentQuestion?.questionNumber,
        question: currentQuestion?.question,
        options: currentQuestion?.options,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await clearSessionId();
      }
      const errorMessage = await parseBackendError(response, 'Failed to submit answer');
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Invalid response from server');
    }

    // Keep the session ID so the completed report can be regenerated without restarting the quiz
    if (data.data.results) {
      return {
        results: normalizeQuizResults(data.data.results),
      };
    }

    return {
      question: normalizeQuizQuestion(data.data.question),
    };
  } catch (error: any) {
    console.error('[Quiz] Failed to submit answer:', error);
    throw error;
  }
}

/**
 * Get quiz results for a completed session
 */
export async function getQuizResults(sessionId?: string, refresh = false): Promise<QuizNextResponse> {
  try {
    const token = await getAuthToken();
    const id = sessionId || (await getSessionId());

    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }
    if (!id) {
      throw new Error('No quiz session ID provided');
    }

    const response = await fetchBackend(`/quiz/result/${id}${refresh ? '?refresh=true' : ''}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorMessage = await parseBackendError(response, 'Failed to fetch quiz results');
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Invalid response from server');
    }

    return normalizeQuizResults(data.data);
  } catch (error: any) {
    console.error('[Quiz] Failed to get quiz results:', error);
    throw error;
  }
}

/**
 * Get quiz history for the user
 */
export async function getQuizHistory(): Promise<any[]> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }

    const response = await fetchBackend('/quiz/history', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorMessage = await parseBackendError(response, 'Failed to fetch quiz history');
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Invalid response from server');
    }

    return data.data;
  } catch (error: any) {
    console.error('[Quiz] Failed to get quiz history:', error);
    return [];
  }
}

/**
 * Get the current session from storage to resume
 */
export async function getCurrentSession(): Promise<{
  session: QuizStartResponse['session'];
  question: QuizQuestion | null;
} | null> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return null;
  }

  try {
    await getQuizResults(sessionId);
    return {
      session: { id: sessionId, user_id: '', status: 'completed', current_question: 10, created_at: '' },
      question: null,
    };
  } catch (error) {
    // Session might be invalid or incomplete
    return null;
  }
}

import { supabase } from '../../api/supabase';

/**
 * Helper: Get a valid auth token from Supabase, refreshing if needed
 */
async function getAuthToken(): Promise<string | null> {
  try {
    // Try to get the current session
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[Quiz] Session error:', error.message);
      return null;
    }

    // If we have a session, check if it's expired
    if (data.session?.access_token && data.session.expires_at) {
      const expiresAt = data.session.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();

      // If token expires in less than 5 minutes, refresh it proactively
      if (expiresAt - now < 5 * 60 * 1000) {
        console.log('[Quiz] Token expiring soon, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session?.access_token) {
          return refreshData.session.access_token;
        }
      }

      // Token is still valid
      return data.session.access_token;
    }

    // No session or no expires_at, try to refresh
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshData.session?.access_token) {
      return refreshData.session.access_token;
    }

    // As last resort, check if user exists and try one more refresh
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: finalRefresh } = await supabase.auth.refreshSession();
      if (finalRefresh.session?.access_token) {
        return finalRefresh.session.access_token;
      }
    }

    return null;
  } catch (error) {
    console.error('[Quiz] Failed to get auth token:', error);
    return null;
  }
}
