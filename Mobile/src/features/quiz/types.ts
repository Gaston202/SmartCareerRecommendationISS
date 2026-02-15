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

export interface CareerRecommendation {
  title: string;
  description: string;
  matchPercent: number;
  tags: string[];
}

export interface QuizResults {
  type: 'results';
  careers: CareerRecommendation[];
}

export type QuizNextResponse = QuizQuestion | QuizResults;

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  icon?: string; // for user answers, optional icon name
}
