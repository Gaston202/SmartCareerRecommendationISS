/**
 * Roadmap Service – Backend-Only Implementation
 * 
 * NO fallback to OpenRouter. NO hardcoded responses.
 * All roadmap generation goes through backend ai_v2 agents.
 * If backend is unavailable, the app shows a clear error.
 */

import { generateCareerRoadmap as generateCareerRoadmapBackend } from '../../api/ai-backend.service';
import type { SavedRoadmap } from './types';

/**
 * Generate career learning roadmap
 * 
 * Backend-only: Calls backend ai_v2 pipeline exclusively.
 * NO fallback to OpenRouter. NO hardcoded responses.
 * If backend fails, the error is propagated to the UI for clear user feedback.
 */
export async function generateCareerRoadmap(
  careerTitle: string,
  careerDescription: string,
  tags?: string[],
  matchPercent?: number,
): Promise<SavedRoadmap> {
  return generateCareerRoadmapBackend(careerTitle, careerDescription, tags, matchPercent);
}

