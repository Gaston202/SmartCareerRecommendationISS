/**
 * AI Career Matching Types
 * Types for AI-driven career recommendation engine
 */

export interface QuizQuestionSnapshot {
  questionNumber: number;
  question: string;
  selectedOption: string; // User's answer
  allOptions: string[];
}

export interface CvAnalysisSnapshot {
  atsScore: number;
  extractedSkills: string[];
  extractedInterests: string[];
  careerSuggestions: Array<{
    title: string;
    match_score: number;
  }>;
}

export interface AiCareerMatchingInput {
  userId: string;
  userSkills: string[];
  quizQuestions: QuizQuestionSnapshot[];
  cvAnalysis?: CvAnalysisSnapshot;
  availableCareers: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    required_skills: string[];
    average_salary?: number;
    growth_rate?: number;
    demand_level?: string;
  }>;
}

export interface AiCareerMatchResult {
  careerTitle: string;
  careerDescription: string;
  matchScore: number; // 0-100
  matchingFactors: {
    quizAlignment: string;
    skillsMatch: string;
    cvAnalysisMatch?: string;
  };
  reasoning: string;
  recommendedNextSteps: string[];
}

export interface AiCareerMatchingOutput {
  topMatches: AiCareerMatchResult[];
  generationTimestamp: string;
  aiModel: string;
}
