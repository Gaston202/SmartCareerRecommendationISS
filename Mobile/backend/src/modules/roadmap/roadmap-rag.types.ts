export type RoadmapLevel = 'beginner' | 'intermediate' | 'advanced';
export type FreeOrPaid = 'free' | 'paid' | 'mixed';
export type RoadmapBudget = 'free' | 'low' | 'medium' | 'high';

export interface RoadmapResourceFilters {
  level?: RoadmapLevel;
  free_or_paid?: FreeOrPaid;
  language?: string;
  duration_max?: number;
  duration_min?: number;
  resource_type?: string;
  certificate?: boolean;
  provider?: string;
  target_role?: string;
  skill_tags?: string[];
}

export interface RoadmapUserPreferences {
  language?: string;
  budget?: RoadmapBudget;
  time_per_week_hours?: number;
}

export interface RoadmapSequenceConstraint {
  before: string;
  after: string;
}

export interface PlanningContext {
  careerId: string | null;
  targetRole: string;
  userSkills: string[];
  preferences: RoadmapUserPreferences;
  maxSteps: number;
  language: string | null;
  budget: RoadmapBudget | null;
}

export interface SkillGap {
  skillName: string;
  canonicalName: string;
  difficulty: RoadmapLevel;
  estimatedHours: number;
  prerequisites: string[];
  priority: number;
}

export interface ResourceEvidence {
  resourceId: string;
  title: string;
  matchedBy: string[];
  keywordScore: number;
  semanticScore: number;
  skillLinkScore: number;
  finalScore: number;
  whySelected: string;
}

export interface EvidenceBundle {
  skillName: string;
  resources: ResourceEvidence[];
  coverageScore: number;
  hasWeakEvidence: boolean;
  webSearchUsed?: boolean;
}

export interface RetrievalDiagnostics {
  totalCandidates: number;
  poolSize: number;
  coverageBySkill: Record<string, number>;
}

export interface PlanStepEvidence {
  stepId: string;
  primaryResource: ResourceEvidence | null;
  backupResources: ResourceEvidence[];
  evidenceBundle: EvidenceBundle;
}

export interface PlanRoadmapDto {
  query?: string;
  career_id?: string;
  target_role?: string;
  max_steps?: number;
  filters?: RoadmapResourceFilters;
  sequence_constraints?: RoadmapSequenceConstraint[];
  user_profile?: {
    selected_role?: string;
    declared_skills?: string[];
    quiz_nova_profile?: unknown;
    cv_extracted_skills?: string[];
    cv_extracted_interests?: string[];
    preferences?: RoadmapUserPreferences;
  };
}

export interface SearchResourcesDto {
  query: string;
  top_k?: number;
  filters?: RoadmapResourceFilters;
  required_skills?: string[];
}

export interface RefreshProviderDto {
  provider: string;
  mode?: 'monthly_refresh' | 'on_demand_refresh' | 'backfill';
  filters?: Record<string, unknown>;
  reason?: string;
}

export interface RetrievedResource {
  resource_id: string;
  resource_title: string;
  resource_type: string;
  free_or_paid: FreeOrPaid;
  language: string;
  level: RoadmapLevel | null;
  provider: string;
  source_url: string;
  score: number;
  keyword_score?: number;
  semantic_score?: number;
  structured_score?: number;
  rerank_score?: number;
  matched_skill_tags?: string[];
}

export interface RetrievalResponse {
  resources: RetrievedResource[];
  confidence: number;
  weakEvidence: boolean;
  reason?: string;
}

export interface RoadmapStep {
  skill_name: string;
  why_it_matters: string;
  difficulty: RoadmapLevel;
  estimated_duration_hours: number;
  prerequisites: string[];
  resource_id: string | null;
  resource_title: string | null;
  resource_type: string | null;
  free_or_paid: FreeOrPaid | null;
  language: string | null;
  level: RoadmapLevel | null;
  provider: string | null;
  source_url: string | null;
  confidence_score: number;
  order_index: number;
  primary_resource?: ResourceEvidence | null;
  backup_resources?: ResourceEvidence[];
  evidence_reasons?: string[];
}

export interface PlannedRoadmapResponse {
  success: boolean;
  mode: 'stored_kb_v1';
  target_role: string;
  career_id: string | null;
  confidence: number;
  weak_evidence: boolean;
  message?: string;
  steps: RoadmapStep[];
  diagnostics?: RetrievalDiagnostics;
  metadata: {
    required_skills: string[];
    existing_skills: string[];
    missing_skills: string[];
    evidence_summary: {
      strong_steps: number;
      weak_steps: number;
      source_count: number;
    };
  };
}
