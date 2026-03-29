/**
 * AI Career Matching Service – Backend-Only Implementation
 * 
 * NO fallback to OpenRouter. NO hardcoded responses.
 * All career matching goes through backend ai_v2 agents.
 * If backend is unavailable, the app shows a clear error.
 */

import { generateCareerMatches as generateCareerMatchesBackend } from "../../api/ai-backend.service";
import type {
  AiCareerMatchingInput,
  AiCareerMatchingOutput,
  AiCareerMatchResult,
} from "./ai-matching.types";

export type { AiCareerMatchingInput, AiCareerMatchingOutput, AiCareerMatchResult };

/**
 * Generate TOP career matches using AI analysis of quiz, CV, and skills data
 * 
 * Backend-only: Calls backend ai_v2 pipeline exclusively.
 * NO fallback to OpenRouter. NO hardcoded responses.
 * If backend fails, the error is propagated to the UI for clear user feedback.
 * 
 * @param input Comprehensive user data including quiz questions/answers, CV analysis, and available careers
 * @returns TOP career recommendations with match scores and reasoning
 */
export async function generateAiCareerMatches(
  input: AiCareerMatchingInput
): Promise<AiCareerMatchingOutput> {
  return generateCareerMatchesBackend(input);
}
