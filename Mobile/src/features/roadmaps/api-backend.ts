import { supabase } from "../../api/supabase";
import { fetchBackend } from "../../api/backend";
import type { SavedLearningRoadmap, LearningRoadmap } from "../learning-roadmap/types";

export interface BackendRoadmapMilestone {
  id: string;
  title: string;
  description: string;
  duration_weeks?: number;
}

export interface BackendRoadmapResponse {
  id: string;
  career_id: string;
  title: string;
  description: string;
  milestones: BackendRoadmapMilestone[];
  total_duration_weeks?: number;
  created_at?: string;
}

export type BackendRoadmapDifficulty = "beginner" | "intermediate" | "advanced";

export interface BackendRoadmapResource {
  resource_id: string | null;
  title: string | null;
  provider: string | null;
  source_url: string | null;
  score: number;
  why_selected?: string | null;
  display_badges?: string[] | null;
  recommendation_reason?: string | null;
}

export interface BackendPlannedRoadmapStep {
  skill_name: string;
  why_it_matters: string;
  difficulty: BackendRoadmapDifficulty;
  estimated_duration_hours: number;
  prerequisites: string[];
  resource_id: string | null;
  resource_title: string | null;
  resource_type: string | null;
  free_or_paid: string | null;
  language: string | null;
  level: BackendRoadmapDifficulty | null;
  provider: string | null;
  source_url: string | null;
  confidence_score: number;
  order_index: number;
  primary_resource: BackendRoadmapResource | null;
  backup_resources: BackendRoadmapResource[] | null;
  evidence_reasons: string[] | null;
  certifications?: BackendRoadmapResource[] | null; // 🆕 hybrid RAG certifications
}

export interface BackendPlannedRoadmapResponse {
  success: boolean;
  mode: "stored_kb_v1" | "hybrid_rag_v1";
  target_role: string;
  career_id: string | null;
  confidence: number;
  weak_evidence: boolean;
  message: string | null;
  steps: BackendPlannedRoadmapStep[];
  diagnostics?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface BackendRefreshProviderResponse {
  success: boolean;
  data: {
    id: string;
    provider: string;
    status: string;
    filters?: Record<string, unknown> | null;
  };
}

export interface BackendIngestionStatusData {
  id: string;
  provider: string;
  job_type: string;
  status: string;
  outcome: "pending" | "running" | "completed" | "partial_success" | "no_changes" | "failed" | "unknown";
  stats: {
    stored_count?: number;
    skipped_count?: number;
    [key: string]: unknown;
  } | null;
  filters: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  queue_state: Record<string, unknown> | null;
  stored_resource: {
    resource_id: string | null;
    title: string | null;
    url: string | null;
    provider: string | null;
    resource_type: string | null;
  } | null;
}

export interface BackendIngestionStatusResponse {
  success: boolean;
  data: BackendIngestionStatusData;
}

export async function fetchRoadmapPlanFromBackend(input: {
  careerId?: string;
  careerTitle: string;
  careerDescription?: string;
  targetRole?: string;
  userSkills?: string[];
  maxSteps?: number;
}): Promise<BackendPlannedRoadmapResponse> {
  const token = await getAuthToken();
  const targetRole = normalizeRoleKey(input.targetRole || input.careerTitle);
  const userSkills = input.userSkills?.map((skill) => skill.trim()).filter(Boolean) || [];

  const response = await fetchBackend("/roadmap/plan", {
    method: "POST",
    headers: buildJsonHeaders(token),
    body: JSON.stringify({
      career_id: input.careerId,
      target_role: targetRole,
      user_skills: userSkills,
      max_steps: input.maxSteps ?? 12,
      user_profile: {
        selected_role: targetRole,
        career_title: input.careerTitle,
        career_description: input.careerDescription,
        skills: userSkills,
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.detail || payload?.message || "Failed to generate roadmap plan from backend.");
  }

  return payload as BackendPlannedRoadmapResponse;
}

export async function refreshRoadmapProvider(input: {
  provider?: string;
  url: string;
  skillName?: string;
  targetRole?: string;
}): Promise<BackendRefreshProviderResponse> {
  const token = await getAuthToken();
  const response = await fetchBackend("/roadmap/refresh-provider", {
    method: "POST",
    headers: buildJsonHeaders(token),
    body: JSON.stringify({
      provider: input.provider || "web",
      url: input.url,
      filters: {
        skill_tags: input.skillName ? [input.skillName] : undefined,
        target_roles: input.targetRole ? [normalizeRoleKey(input.targetRole)] : undefined,
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !payload?.data?.id) {
    throw new Error(payload?.detail || payload?.message || "Failed to refresh roadmap source.");
  }

  return payload as BackendRefreshProviderResponse;
}

export async function fetchIngestionStatus(jobId: string): Promise<BackendIngestionStatusResponse> {
  const token = await getAuthToken();
  const response = await fetchBackend(`/ingest/status/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: buildJsonHeaders(token),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !payload?.data) {
    throw new Error(payload?.detail || payload?.message || "Failed to fetch ingestion status.");
  }

  return payload as BackendIngestionStatusResponse;
}

export async function saveLearningRoadmapToBackend(input: {
  careerId: string;
  careerTitle: string;
  roadmapData: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }

  const response = await fetchBackend("/learning-roadmap/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      career_id: input.careerId,
      career_title: input.careerTitle,
      roadmap_data: input.roadmapData,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.detail || payload?.message || "Failed to save learning roadmap to backend.");
  }

  return payload.data as Record<string, unknown>;
}

export async function updateRoadmapSkillProgressOnBackend(input: {
  roadmapId: string;
  skillId: string;
  started?: boolean;
  completedPercentage?: number;
}): Promise<Record<string, unknown>> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }

  const response = await fetchBackend("/learning-roadmap/progress", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      roadmap_id: input.roadmapId,
      skill_id: input.skillId,
      started: input.started,
      completed_percentage: input.completedPercentage,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.detail || payload?.message || "Failed to update roadmap progress on backend.");
  }

  return payload.data as Record<string, unknown>;
}

export async function fetchLearningRoadmapsFromBackend(): Promise<SavedLearningRoadmap[]> {
  const token = await getAuthToken();
  if (!token) return [];

  const response = await fetchBackend("/learning-roadmap/list", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !Array.isArray(payload?.data)) return [];

  return payload.data.map((row: Record<string, unknown>): SavedLearningRoadmap => ({
    id: row.id as string,
    user_id: row.user_id as string,
    career_id: row.career_id as string,
    careerTitle: row.career_title as string,
    createdAt: row.created_at as string,
    roadmap: {
      id: row.id as string,
      user_id: row.user_id as string,
      career_id: row.career_id as string,
      career_title: row.career_title as string,
      title: row.title as string,
      description: row.description as string,
      skills: (row.skills as LearningRoadmap["skills"]) || [],
      total_duration_hours: (row.total_duration_hours as number) || 0,
      estimated_weeks: (row.estimated_weeks as number) || 0,
      skill_count: (row.skill_count as number) || 0,
      created_at: row.created_at as string,
      updated_at: (row.updated_at as string) || (row.created_at as string),
    },
  }));
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;

    if (data.session?.access_token && data.session.expires_at) {
      const expiresAt = data.session.expires_at * 1000;
      if (expiresAt - Date.now() < 5 * 60 * 1000) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed.session?.access_token) {
          return refreshed.session.access_token;
        }
      }
      return data.session.access_token;
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      return refreshed.session.access_token;
    }

    return null;
  } catch {
    return null;
  }
}

function buildJsonHeaders(token?: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeRoleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function generateRoadmapFromBackend(
  careerId: string,
  userProfile?: {
    skills?: string[];
    novaProfile?: any;
    cvSummary?: string;
  }
): Promise<BackendRoadmapResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }

  const response = await fetchBackend("/roadmap/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      career_id: careerId,
      user_profile: userProfile,
      use_async: false,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to generate roadmap from backend.");
  }

  return payload.data as BackendRoadmapResponse;
}
