/**
 * React Query hooks for CV and Skills features
 * Manages data fetching, caching, and mutations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../api/supabase";
import type { UserSkill, CvAnalysis, CvUpload, SkillsUpdatePayload } from "./types";
import { getCachedExtractedFields } from "./cv-analysis.service";

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
  const { data: latestUpload } = useLatestCvUpload();

  return useQuery({
    queryKey: latestUpload
      ? cvQueryKeys.analysis(latestUpload.id)
      : [...cvQueryKeys.analyses(), "latest-none"],
    queryFn: async () => {
      if (!latestUpload) throw new Error("No CV upload found");

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      if (!userId) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("cv_analysis")
        .select("*")
        .eq("cv_upload_id", latestUpload.id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      const analysis = (data as CvAnalysis) || null;
      if (!analysis) return null;

      const cachedExtracted = await getCachedExtractedFields(latestUpload.id);
      if (!cachedExtracted) return analysis;

      const hasSkills =
        (analysis.extracted_skills && analysis.extracted_skills.length > 0) ||
        (analysis.skills_extracted && analysis.skills_extracted.length > 0) ||
        (analysis.skills && analysis.skills.length > 0);
      const hasInterests =
        (analysis.extracted_interests && analysis.extracted_interests.length > 0) ||
        (analysis.interests_extracted && analysis.interests_extracted.length > 0) ||
        (analysis.interests && analysis.interests.length > 0);

      if (hasSkills && hasInterests) {
        return analysis;
      }

      return {
        ...analysis,
        extracted_skills: hasSkills
          ? analysis.extracted_skills
          : cachedExtracted.extracted_skills,
        extracted_interests: hasInterests
          ? analysis.extracted_interests
          : cachedExtracted.extracted_interests,
      };
    },
    enabled: !!latestUpload,
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
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      if (!userId) throw new Error("Not logged in");

      // Read file as ArrayBuffer (this works in React Native)
      const response = await fetch(file.uri);
      
      if (!response.ok) {
        throw new Error(`Failed to read file: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();

      const path = `${userId}/${Date.now()}_${file.name}`;

      // Upload to Storage
      const uploadRes = await supabase.storage.from("cvs_debug").upload(path, arrayBuffer, {
        contentType: file.mimeType ?? "application/pdf",
        upsert: false,
      });

      if (uploadRes.error) {
        throw new Error(`Upload failed: ${uploadRes.error.message}`);
      }

      // Create DB record
      const insertRes = await supabase
        .from("cvs")
        .insert({
          user_id: userId,
          storage_path: path,
          filename: file.name,
          mime_type: file.mimeType,
          status: "uploaded",
        })
        .select("*")
        .single();

      if (insertRes.error) {
        // Clean up uploaded file if DB insert fails
        await supabase.storage.from("cvs_debug").remove([path]);
        throw new Error(`Database error: ${insertRes.error.message}`);
      }

      return insertRes.data as CvUpload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.uploads() });
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
        .from("cvs_debug")
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
