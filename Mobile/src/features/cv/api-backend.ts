import { supabase } from "../../api/supabase";
import type { CvAnalysis } from "./types";
import { fetchBackend } from "../../api/backend";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

type UploadPayload = {
  uri: string;
  name: string;
  mimeType: string | null;
};

async function resolveUploadUri(file: UploadPayload): Promise<string> {
  const inputUri = file.uri;

  // Android can return content:// URIs that fail when sent directly in FormData.
  // Copying into app cache provides a stable file:// URI for multipart upload.
  if (Platform.OS === "android" && inputUri.startsWith("content://")) {
    const safeName = (file.name || `cv-${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const target = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;
    await FileSystem.copyAsync({ from: inputUri, to: target });
    return target;
  }

  if (Platform.OS === "android" && !inputUri.startsWith("file://") && !inputUri.startsWith("content://")) {
    return `file://${inputUri}`;
  }

  return inputUri;
}

function normalizeAnalysis(raw: any): CvAnalysis {
  const extractedSkills = raw?.extracted_data?.skills ?? raw?.extracted_skills ?? [];
  const extractedInterests = raw?.extracted_data?.interests ?? raw?.extracted_interests ?? [];

  return {
    ...raw,
    ats_score: typeof raw?.ats_score === "number" ? raw.ats_score : 0,
    ats_issues: Array.isArray(raw?.ats_issues) ? raw.ats_issues : [],
    suggested_improvements: Array.isArray(raw?.suggested_improvements)
      ? raw.suggested_improvements
      : [],
    career_suggestions: Array.isArray(raw?.career_suggestions) ? raw.career_suggestions : [],
    extracted_skills: Array.isArray(extractedSkills) ? extractedSkills : [],
    extracted_interests: Array.isArray(extractedInterests) ? extractedInterests : [],
    status: typeof raw?.status === "string" ? raw.status : undefined,
    error_message: typeof raw?.error_message === "string" ? raw.error_message : null,
  } as CvAnalysis;
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

export async function uploadCvToBackend(file: UploadPayload): Promise<{ analysisId: string; status: string }> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }

  const uploadUri = await resolveUploadUri(file);
  const uploadName = (file.name || "cv.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");

  const formData = new FormData();
  formData.append("file", {
    uri: uploadUri,
    name: uploadName,
    type: file.mimeType ?? "application/pdf",
  } as any);

  const response = await fetchBackend("/cv/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to upload CV.");
  }

  return payload.data;
}

export async function getLatestCvAnalysisFromBackend(): Promise<CvAnalysis | null> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }

  const response = await fetchBackend("/cv/result/latest", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to fetch CV analysis.");
  }

  if (!payload.data) {
    return null;
  }

  return normalizeAnalysis(payload.data);
}

export async function getCvAnalysisStatusFromBackend(
  analysisId: string
): Promise<{ status: string; progress: number; error_message?: string } | null> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }

  const response = await fetchBackend(`/cv/status/${analysisId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to fetch CV analysis status.");
  }

  return payload.data || null;
}
