export interface RoadmapStep {
  title: string;
  description: string;
  timeframe?: string;
}

export interface SavedRoadmap {
  id: string;
  careerTitle: string;
  careerDescription: string;
  matchPercent?: number;
  tags?: string[];
  createdAt: string;
  steps: RoadmapStep[];
}

export interface SavedAiCareer {
  id: string;
  careerTitle: string;
  careerDescription: string;
  matchPercent?: number;
  tags?: string[];
  createdAt: string;
}

