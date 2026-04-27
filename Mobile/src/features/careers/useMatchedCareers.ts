/**
 * Matched Careers Hook
 * Fetches career recommendations from backend API (deterministic matching + AI explanations)
 */

import { useQuery } from '@tanstack/react-query';
import { useCvAnalysis } from '../cv';
import { getLatestQuizSessionId } from '../quiz/storage';
import { recommendCareers } from './api';
import type { CareerMatch } from './matching';
import { getRoadmapPrereqStatus } from '../roadmaps/prerequisites';

export function useMatchedCareers() {
  const { data: cvAnalysis, isLoading: cvLoading, error: cvError } = useCvAnalysis();

  return useQuery({
    queryKey: [
      'matched-careers',
      cvAnalysis?.id,
    ],
    queryFn: async (): Promise<CareerMatch[]> => {
      // Requirement: user must have completed quiz AND have a completed CV analysis
      const prereqs = await getRoadmapPrereqStatus();
      if (!prereqs.hasCompletedQuiz || !prereqs.hasAnalyzedCv) {
        console.log('[useMatchedCareers] ⏭️ Skipping: prerequisites not met', prereqs);
        return [];
      }

      const quizSessionId = await getLatestQuizSessionId();

      // REQUIREMENT CHECK: User must have completed the quiz
      if (!quizSessionId) {
        console.log('[useMatchedCareers] ⏭️ Skipping: Quiz not completed yet');
        return [];
      }

      // CV analysis is required for automatic recommendations.
      if (!cvAnalysis?.id || cvAnalysis.status !== 'completed') {
        console.log('[useMatchedCareers] ⏭️ Skipping: CV analysis not completed yet', {
          status: cvAnalysis?.status,
          cvAnalysisError: cvError instanceof Error ? cvError.message : null,
        });
        return [];
      }
      const cvAnalysisId = cvAnalysis.id;

      if (cvAnalysisId) {
        console.log('[useMatchedCareers] ✅ Fetching career recommendations from backend', {
          quizSessionId,
          cvAnalysisId,
        });
      }

      // Call backend API for deterministic matching + AI explanations
      const matches = await recommendCareers(quizSessionId, cvAnalysisId);

      // Return top 5 (backend already returns top 5)
      return matches;
    },
    // Don’t auto-fire while CV is loading/processing.
    enabled: !cvLoading && cvAnalysis?.status === 'completed',
  });
}
