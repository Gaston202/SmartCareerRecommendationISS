/**
 * React Query hooks for CV and Skills features
 * Manages data fetching, caching, and mutations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../api/supabase";
import type { UserSkill, CvAnalysis, CvUpload, SkillsUpdatePayload } from "./types";
import {
  getLatestCvAnalysisFromBackend,
  uploadCvToBackend,
} from "./api-backend";

// Query keys
export const cvQueryKeys = {
  all: ["cv"] as const,
  uploads: () => [...cvQueryKeys.all, "uploads"] as const,
  upload: (id: string) => [...cvQueryKeys.uploads(), id] as const,
  analyses: () => [...cvQueryKeys.all, "analyses"] as const,
  analysis: (id: string) => [...cvQueryKeys.analyses(), id] as const,
  skills: () => [...cvQueryKeys.all, "skills"] as const,
  skill: (id: string) => [...cvQueryKeys.skills(), id] as const,
};

/**
 * Fetch current user's skills
 * Excludes removed skills
 */
export function useUserSkills() {
  return useQuery({
    queryKey: cvQueryKeys.skills(),
    queryFn: async () => {
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      if (!userId) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("user_skills")
        .select("*")
        .eq("user_id", userId)
        .neq("status", "removed")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data as UserSkill[]) || [];
    },
  });
}

/**
 * Update multiple skills (bulk save)
 * Handles both inserts and updates
 */
export function useUpdateSkills() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SkillsUpdatePayload) => {
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      if (!userId) throw new Error("Not logged in");

      // Insert new skills
      if (payload.toInsert.length > 0) {
        const newSkills = payload.toInsert.map((skill) => ({
          ...skill,
          user_id: userId,
        }));

        const insertRes = await supabase.from("user_skills").insert(newSkills);

        if (insertRes.error) throw insertRes.error;
      }

      // Update existing skills
      if (payload.toUpdate.length > 0) {
        for (const skill of payload.toUpdate) {
          const updateRes = await supabase
            .from("user_skills")
            .update({
              name: skill.name,
              category: skill.category,
              status: skill.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", skill.id)
            .eq("user_id", userId);

          if (updateRes.error) throw updateRes.error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.skills() });
    },
  });
}

/**
 * Fetch latest CV upload for current user
 */
export function useLatestCvUpload() {
  return useQuery({
    queryKey: cvQueryKeys.uploads(),
    queryFn: async () => {
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      if (!userId) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("cvs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      return (data as CvUpload) || null;
    },
  });
}

/**
 * Fetch CV analysis results for latest upload
 */
export function useCvAnalysis() {
  return useQuery({
    queryKey: [...cvQueryKeys.analyses(), "latest"],
    queryFn: async () => {
      const analysis = await getLatestCvAnalysisFromBackend();

      if (!analysis) {
        return null;
      }

      if (analysis.status === "pending" || analysis.status === "processing") {
        throw new Error("Your CV analysis is still processing. Please try again shortly.");
      }

      if (analysis.status === "failed") {
        throw new Error(analysis.error_message || "CV analysis failed on the backend.");
      }

      return analysis;
    },
    retry: 1,
    // ⭐ Client-side analysis is now synchronous, so normal caching works
  });
}

/**
 * Upload CV file
 */
export function useUploadCv() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: { uri: string; name: string; mimeType: string | null }) => {
      await uploadCvToBackend(file);

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      if (!userId) throw new Error("Not logged in");

      const latestCvRes = await supabase
        .from("cvs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestCvRes.error || !latestCvRes.data) {
        throw new Error(
          latestCvRes.error?.message || "CV uploaded but latest upload metadata was not found."
        );
      }

      return latestCvRes.data as CvUpload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.uploads() });
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.analyses() });
    },
  });
}

/**
 * Delete CV upload and associated data
 */
export function useDeleteCv() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cvUpload: CvUpload) => {
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      if (!userId) throw new Error("Not logged in");

      // 1. Get cv_analysis records associated with this CV
      const { data: cvAnalyses, error: analysisQueryError } = await supabase
        .from("cv_analysis")
        .select("id")
        .eq("cv_upload_id", cvUpload.id)
        .eq("user_id", userId);

      if (analysisQueryError) {
        console.warn("Error querying cv_analysis:", analysisQueryError);
      }

      // 2. Delete career_match_results that reference these cv_analysis records
      if (cvAnalyses && cvAnalyses.length > 0) {
        const analysisIds = cvAnalyses.map((a) => a.id);
        const { error: matchResultsError } = await supabase
          .from("career_match_results")
          .delete()
          .in("cv_analysis_id", analysisIds);

        if (matchResultsError) {
          console.warn("Error deleting career_match_results:", matchResultsError);
          // Continue anyway to try cleaning up other records
        }
      }

      // 3. Delete cv_analysis records
      const { error: analysisError } = await supabase
        .from("cv_analysis")
        .delete()
        .eq("cv_upload_id", cvUpload.id)
        .eq("user_id", userId);

      if (analysisError) {
        console.warn("Error deleting cv_analysis:", analysisError);
        // Continue to try deleting the CV record
      }

      // 4. Delete CV record
      const { error: dbError } = await supabase
        .from("cvs")
        .delete()
        .eq("id", cvUpload.id)
        .eq("user_id", userId);

      if (dbError) throw dbError;

      // 5. Delete file from storage (do this last so if DB fails, file remains)
      const { error: storageError } = await supabase.storage
        .from("cv-uploads")
        .remove([cvUpload.storage_path]);

      if (storageError) {
        console.warn("Storage delete warning:", storageError);
        // This is non-critical - file might not exist
      }

      return { success: true };
    },
    onSuccess: () => {
      // Refresh all CV-related queries
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.uploads() });
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.analyses() });
    },
  });
}
