/**
 * Matched Careers Hook
 * Combines quiz results, CV analysis, and user skills to provide matched careers
 * Now supports AI-powered matching when full quiz data is available
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useCareersWithSkills } from './hooks';
import { useUserSkills } from '../cv/hooks';
import { useCvAnalysis } from '../cv/hooks';
import { getLatestQuizSessionId, getQuizQuestionsWithAnswers } from '../quiz/storage';
import { 
  calculateCareerMatches, 
  getTopMatchedCareers,
  calculateAiPoweredCareerMatches,
  type CareerMatch,
  type AiPoweredCareerMatch,
} from './matching';
import { supabase } from '../../api/supabase';

export function useMatchedCareers() {
  const { data: allCareers, isLoading: careersLoading } = useCareersWithSkills();
  const { data: userSkills, isLoading: skillsLoading } = useUserSkills();
  const { data: cvAnalysis, isLoading: cvLoading } = useCvAnalysis();
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);

  useEffect(() => {
    getLatestQuizSessionId().then((id) => setQuizSessionId(id));
  }, []);

  return useQuery({
    queryKey: [
      'matched-careers',
      allCareers?.map((c) => c.id).join(','),
      userSkills?.map((s) => s.id).join(','),
      cvAnalysis?.id,
      quizSessionId,
    ],
    queryFn: async (): Promise<(CareerMatch | AiPoweredCareerMatch)[]> => {
      if (!allCareers || allCareers.length === 0) {
        return [];
      }

      // Get quiz questions with answers from storage (full data)
      const quizQuestionsWithAnswers = await getQuizQuestionsWithAnswers();

      // REQUIREMENT CHECK: User must have taken the quiz AND completed CV analysis
      if (!quizQuestionsWithAnswers || quizQuestionsWithAnswers.length === 0) {
        console.log('[useMatchedCareers] ⏭️ Skipping: Quiz not completed yet');
        return [];
      }

      if (!cvAnalysis || !cvAnalysis.id) {
        console.log('[useMatchedCareers] ⏭️ Skipping: CV analysis not completed yet');
        return [];
      }

      console.log('[useMatchedCareers] ✅ All requirements met: Quiz + CV Analysis + Skills ready');

      // Gather user skills: combine confirmed skills + extracted CV skills for comprehensive profile
      const confirmedUserSkills = (userSkills || [])
        .filter(s => s && s.name && typeof s.name === 'string')
        .map((s) => s.name);
      const extractedCvSkills = Array.isArray(cvAnalysis?.extracted_skills)
        ? (cvAnalysis.extracted_skills as string[]).filter(s => typeof s === 'string')
        : [];
      // Deduplicate using array key pattern (not Set) to avoid issues with non-primitive types
      const allUserSkills = Array.from(new Map(
        [...confirmedUserSkills, ...extractedCvSkills].map(skill => [skill, skill])
      ).values());

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'unknown';

      // Call AI-powered matching through backend ai_v2
      console.log('[useMatchedCareers] [AI_ONLY] Calling backend for AI-powered career matching');
      const aiMatches = await calculateAiPoweredCareerMatches(
        userId,
        allCareers,
        quizQuestionsWithAnswers,
        allUserSkills,
        cvAnalysis,
        quizSessionId
      );
      
      // Return top 5 from AI results
      return getTopMatchedCareers(aiMatches, 5);
    },
    enabled: !careersLoading && !skillsLoading && !cvLoading,
  });
}
