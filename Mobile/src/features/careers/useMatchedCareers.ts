/**
 * Matched Careers Hook
 * Fetches career recommendations from backend API (deterministic matching + AI explanations)
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useCareersWithSkills } from './hooks';
import { useCvAnalysis } from '../cv';
import { getLatestQuizSessionId } from '../quiz/storage';
import { recommendCareers, getAllCareers } from './api';
import type { CareerMatch } from './matching';

export function useMatchedCareers() {
  const { data: cvAnalysis, isLoading: cvLoading } = useCvAnalysis();
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);

  useEffect(() => {
    getLatestQuizSessionId().then((id) => setQuizSessionId(id));
  }, []);

  return useQuery({
    queryKey: [
      'matched-careers',
      quizSessionId,
      cvAnalysis?.id,
    ],
    queryFn: async (): Promise<CareerMatch[]> => {
      // REQUIREMENT CHECK: User must have completed the quiz
      if (!quizSessionId) {
        console.log('[useMatchedCareers] ⏭️ Skipping: Quiz not completed yet');
        return [];
      }

      // CV analysis is optional but preferred
      const cvAnalysisId = cvAnalysis?.id;

      console.log('[useMatchedCareers] ✅ Fetching career recommendations from backend', {
        quizSessionId,
        cvAnalysisId,
      });

      // Call backend API for deterministic matching + AI explanations
      const matches = await recommendCareers(quizSessionId, cvAnalysisId);

      // Return top 5 (backend already returns top 5)
      return matches;
    },
    enabled: !cvLoading && !!quizSessionId,
  });
}
