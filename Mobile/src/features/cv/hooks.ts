/**
 * React Query hooks for CV and Skills features
 * Manages data fetching, caching, and mutations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../api/supabase";
import type { UserSkill, CvAnalysis, CvUpload, SkillsUpdatePayload } from "./types";

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
    queryKey: latestUpload ? cvQueryKeys.analysis(latestUpload.id) : [],
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
      return (data as CvAnalysis) || null;
    },
    enabled: !!latestUpload,
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
 * Trigger CV analysis via Edge Function
 */
export function useTriggerCvAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cvUploadId: string) => {
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      if (!userId) throw new Error("Not logged in");

      // Call Edge Function
      const response = await supabase.functions.invoke("analyze-cv", {
        body: { cvUploadId, userId },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      // Refetch analysis and skills
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.analyses() });
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.skills() });
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

      // 1. Delete file from storage
      const { error: storageError } = await supabase.storage
        .from("cvs_debug")
        .remove([cvUpload.storage_path]);

      if (storageError) {
        console.warn("Storage delete warning:", storageError);
        // Continue anyway - file might not exist
      }

      // 2. Delete CV record (will cascade delete cv_analysis due to FK)
      const { error: dbError } = await supabase
        .from("cvs")
        .delete()
        .eq("id", cvUpload.id)
        .eq("user_id", userId);

      if (dbError) throw dbError;

      return { success: true };
    },
    onSuccess: () => {
      // Refresh all CV-related queries
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.uploads() });
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.analyses() });
    },
  });
}
