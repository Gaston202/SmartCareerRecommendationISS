/**
 * Quiz API – Backend-Only Implementation
 * 
 * NO fallback to OpenRouter. NO hardcoded responses.
 * All quiz generation goes through backend ai_v2 agents.
 * If backend is unavailable, the app shows a clear error.
 */
import type { QuizNextResponse } from './types';
import { generateQuizNext as generateQuizNextBackend } from '../../api/ai-backend.service';

export interface QuizNextRequest {
  answers: string[];
}

/**
 * Get the next quiz step: first question, next question, or results (after 5 answers).
 * 
 * Backend-only: Calls backend ai_v2 pipeline exclusively.
 * NO fallback to OpenRouter. NO hardcoded responses.
 * If backend fails, the error is propagated to the UI for clear user feedback.
 */
export async function fetchQuizNext(request: QuizNextRequest): Promise<QuizNextResponse> {
  return generateQuizNextBackend(request.answers);
}
