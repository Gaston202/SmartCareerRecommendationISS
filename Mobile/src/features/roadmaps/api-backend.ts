import { supabase } from "../../api/supabase";
import { fetchBackend } from "../../api/backend";

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

export interface BackendPlannedRoadmapStep {
  skill_name: string;
  why_it_matters: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_duration_hours: number;
  prerequisites: string[];
  resource_title: string | null;
  provider: string | null;
  source_url: string | null;
  confidence_score: number;
  order_index: number;
}

export interface BackendPlannedRoadmapResponse {
  success: boolean;
  mode: "stored_kb_v1";
  target_role: string;
  career_id: string | null;
  confidence: number;
  weak_evidence: boolean;
  message?: string;
  steps: BackendPlannedRoadmapStep[];
}

export async function fetchRoadmapPlanFromBackend(input: {
  careerId?: string;
  careerTitle: string;
  careerDescription?: string;
  maxSteps?: number;
}): Promise<BackendPlannedRoadmapResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }

  const response = await fetchBackend("/learning-roadmap/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      career_id: input.careerId,
      career_title: input.careerTitle,
      career_description: input.careerDescription,
      max_steps: input.maxSteps ?? 6,
      user_profile: {
        selected_role: input.careerTitle,
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !payload?.data) {
    throw new Error(payload?.message || "Failed to generate roadmap plan from backend.");
  }

  return payload.data as BackendPlannedRoadmapResponse;
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
