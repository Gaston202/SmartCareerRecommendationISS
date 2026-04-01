/**
 * Quiz flow types – questions, options, and results from AI (via Supabase).
 */

export interface QuizOption {
  id: string;
  label: string;
  icon: string; // e.g. 'brush', 'people', 'globe', 'business'
}

export interface QuizQuestion {
  type: 'question';
  question: string;
  questionNumber: number;
  totalQuestions: number;
  options: QuizOption[];
}

export interface QuestionWithAnswer {
  questionNumber: number;
  question: string;
  selectedOption: string;
  allOptions: string[];
}

export interface CareerRecommendation {
  title: string;
  description: string;
  matchPercent: number;
  tags: string[];
}

export interface NovaBehaviorProfile {
  primaryStyle: string;
  secondaryStyle?: string;
  traits: string[];
  discBlend?: string;
  discPercentages?: {
    red: number;
    yellow: number;
    green: number;
    blue: number;
  };
}

export interface NovaStyleComparison {
  naturalStyleSummary: string;
  adaptedStyleSummary: string;
  adaptationDrivers: string[];
  stressSignals: string[];
}

export interface NovaMotivationProfile {
  topMotivators: string[];
  demotivators: string[];
  valuesSummary: string;
}

export interface NovaCognitiveProfile {
  decisionStyle: string;
  thinkingStyle: string;
  learningStyle: string;
  communicationStyle: string;
}

export interface NovaCareerProjection {
  bestFitEnvironments: string[];
  leadershipStyle: string;
  watchouts: string[];
  futureFocus: string;
}

export interface NovaProfileSummary {
  headline: string;
  professionalIdentity: string;
  behavior: NovaBehaviorProfile;
  styleComparison: NovaStyleComparison;
  motivations: NovaMotivationProfile;
  cognition: NovaCognitiveProfile;
  careerProjection: NovaCareerProjection;
  recommendedDevelopmentAxes: string[];
}

export interface QuizResults {
  type: 'results';
  careers: CareerRecommendation[];
  novaProfile?: NovaProfileSummary;
}

export interface QuizSession {
  questionsWithAnswers: QuestionWithAnswer[];
  results: QuizResults;
  completedAt: string;
  assessmentVersion?: string;
  quizModel?: string;
}

export type QuizNextResponse = QuizQuestion | QuizResults;

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  icon?: string; // for user answers, optional icon name
}
