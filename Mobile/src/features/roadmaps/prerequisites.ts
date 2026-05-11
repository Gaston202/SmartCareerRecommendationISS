import { getQuizSession } from '../quiz/storage';
import { getLatestCvAnalysisFromBackend } from '../cv/api-backend';

export type RoadmapPrereqStatus = {
  hasCompletedQuiz: boolean;
  hasAnalyzedCv: boolean;
};

export async function getRoadmapPrereqStatus(): Promise<RoadmapPrereqStatus> {
  const [quizSession, cvAnalysis] = await Promise.all([
    getQuizSession().catch(() => null),
    getLatestCvAnalysisFromBackend().catch(() => null),
  ]);

  const hasCompletedQuiz =
    !!quizSession &&
    Array.isArray(quizSession.questionsWithAnswers) &&
    quizSession.questionsWithAnswers.length >= 10 &&
    !!quizSession.results &&
    !!quizSession.results.novaProfile;

  const hasAnalyzedCv =
    !!cvAnalysis &&
    cvAnalysis.status === 'completed' &&
    (Array.isArray(cvAnalysis.extracted_skills) || Array.isArray(cvAnalysis.extracted_interests));

  return { hasCompletedQuiz, hasAnalyzedCv };
}

export async function assertRoadmapPrerequisites(): Promise<void> {
  const status = await getRoadmapPrereqStatus();

  if (!status.hasCompletedQuiz && !status.hasAnalyzedCv) {
    throw new Error('Please complete the quiz and analyze your CV before generating a roadmap.');
  }
  if (!status.hasCompletedQuiz) {
    throw new Error('Please complete the quiz before generating a roadmap.');
  }
  if (!status.hasAnalyzedCv) {
    throw new Error('Please analyze your CV before generating a roadmap.');
  }
}

