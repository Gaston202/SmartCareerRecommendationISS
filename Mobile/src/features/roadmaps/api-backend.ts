import { supabase } from "../../api/supabase";
import { getBackendApiBaseUrl } from "../../api/backend";

const BACKEND_API_URL = getBackendApiBaseUrl();

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

  const response = await fetch(`${BACKEND_API_URL}/roadmap/generate`, {
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
