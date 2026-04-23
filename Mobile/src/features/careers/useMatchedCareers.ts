/**
 * Matched Careers Hook
 * Fetches career recommendations from backend API (deterministic matching + AI explanations)
 */

import { useQuery } from '@tanstack/react-query';
import { useCvAnalysis } from '../cv';
import { getLatestQuizSessionId } from '../quiz/storage';
import { recommendCareers } from './api';
import type { CareerMatch } from './matching';

export function useMatchedCareers() {
  const { data: cvAnalysis, isLoading: cvLoading, error: cvError } = useCvAnalysis();

  return useQuery({
    queryKey: [
      'matched-careers',
      cvAnalysis?.id,
    ],
    queryFn: async (): Promise<CareerMatch[]> => {
      const quizSessionId = await getLatestQuizSessionId();

      // REQUIREMENT CHECK: User must have completed the quiz
      if (!quizSessionId) {
        console.log('[useMatchedCareers] ⏭️ Skipping: Quiz not completed yet');
        return [];
      }

      // CV analysis is optional but preferred.
      // If it is still processing or failed, we fall back to quiz-only matching.
      const cvAnalysisId = cvAnalysis?.id;

      if (cvAnalysisId) {
        console.log('[useMatchedCareers] ✅ Fetching career recommendations from backend', {
          quizSessionId,
          cvAnalysisId,
        });
      } else {
        console.log('[useMatchedCareers] ℹ️ Fetching quiz-only career recommendations', {
          quizSessionId,
          cvAnalysisError: cvError instanceof Error ? cvError.message : null,
        });
      }

      // Call backend API for deterministic matching + AI explanations
      const matches = await recommendCareers(quizSessionId, cvAnalysisId);

      // Return top 5 (backend already returns top 5)
      return matches;
    },
    enabled: !cvLoading,
  });
}
