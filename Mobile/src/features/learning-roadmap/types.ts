export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface LearningSkill {
  id: string;
  name: string;
  description: string;
  level: SkillLevel;
  sourceLevel?: SkillLevel | null;
  confidence_score?: number;
  duration_hours: number;
  prerequisites: string[]; // skill IDs
  category: string; // e.g., "Backend", "Frontend", "DevOps", "Data Science"
  importance: 'critical' | 'important' | 'nice-to-have';
  created_at: string;
}

export interface SkillDependency {
  from_skill_id: string; // prerequisite skill
  to_skill_id: string; // skill that requires the prerequisite
  dependency_type: 'required' | 'recommended';
}

export interface LearningCourse {
  id: string;
  skill_id: string;
  title: string;
  description: string;
  provider: string; // e.g., "Khan Academy", "Udemy", "Coursera", "freeCodeCamp"
  url: string;
  source_resource_id?: string | null;
  confidence_score?: number;
  display_badges?: string[] | null;
  recommendation_reason?: string | null;
  duration_hours: number;
  level: SkillLevel;
  rating: number; // 0-5
  students_count?: number;
  free: boolean;
  course_type: 'video' | 'interactive' | 'text' | 'project-based' | 'live';
  created_at: string;
}

export interface LearningRoadmapResource {
  resource_id: string | null;
  title: string | null;
  provider: string | null;
  source_url: string | null;
  score: number;
  why_selected?: string | null;
  display_badges?: string[] | null;
  recommendation_reason?: string | null;
}

export interface LearningRoadmapNode {
  skill: LearningSkill;
  courses: LearningCourse[];
  dependencies: LearningSkill[];
  primaryResource?: LearningRoadmapResource | null;
  backupResources?: LearningRoadmapResource[] | null;
  evidenceReasons?: string[] | null;
  certifications?: LearningRoadmapResource[] | null; // 🆕 from hybrid RAG
  estimatedCompletionDate?: string;
  userProgress?: {
    started: boolean;
    completedPercentage: number;
    completedCourses: string[]; // course IDs
  };
}

export interface LearningRoadmap {
  id: string;
  user_id: string;
  career_id: string;
  career_title: string;
  title: string;
  description: string;
  confidence?: number;
  weak_evidence?: boolean;
  message?: string | null;
  diagnostics?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  skills: LearningRoadmapNode[];
  total_duration_hours: number;
  estimated_weeks: number;
  skill_count: number;
  created_at: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  level: SkillLevel;
  duration: number;
  isPrerequisite: boolean;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  from: string; // source skill ID
  to: string; // target skill ID
  type: 'required' | 'recommended';
}

export interface LearningRoadmapGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SavedLearningRoadmap {
  id: string;
  user_id: string;
  career_id: string;
  careerTitle: string;
  createdAt: string;
  roadmap: LearningRoadmap;
}
