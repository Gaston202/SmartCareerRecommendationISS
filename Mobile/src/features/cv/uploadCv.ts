/**
 * CV upload utility
 * Handles file picking and uploading to Supabase Storage
 */

import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../../api/supabase";
import type { CvUpload } from "./types";

export async function pickAndUploadCv(): Promise<{ cvUploadId: string; storagePath: string } | null> {
  try {
    // Pick PDF file
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled) return null;

    const file = picked.assets[0];

    // Get current user
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data.user?.id;

    if (!userId) {
      throw new Error("Not logged in");
    }

    // Read file as ArrayBuffer (this works in React Native)
    const response = await fetch(file.uri);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();

    // Generate unique path
    const path = `${userId}/${Date.now()}_${file.name}`;

    // Upload to Supabase Storage
    const uploadRes = await supabase.storage.from("cvs_debug").upload(path, arrayBuffer, {
      contentType: file.mimeType ?? "application/pdf",
      upsert: false,
    });

    if (uploadRes.error) {
      throw new Error(`Upload failed: ${uploadRes.error.message}`);
    }

    // Create record in cvs table
    const insertRes = await supabase
      .from("cvs")
      .insert({
        user_id: userId,
        storage_path: path,
        filename: file.name,
        mime_type: file.mimeType,
        status: "uploaded",
      })
      .select("id")
      .single();

    if (insertRes.error) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from("cvs_debug").remove([path]);
      throw new Error(`Database error: ${insertRes.error.message}`);
    }

    return {
      cvUploadId: insertRes.data.id,
      storagePath: path,
    };
  } catch (error) {
    console.error("CV upload error:", error);
    throw error;
  }
}

/**
 * Trigger CV analysis via Edge Function
 * Call this after upload is successful
 */
export async function triggerCvAnalysis(cvUploadId: string): Promise<void> {
  try {
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data.user?.id;

    if (!userId) {
      throw new Error("Not logged in");
    }

    // Call Supabase Edge Function
    const response = await supabase.functions.invoke("analyze-cv", {
      body: { cvUploadId, userId },
    });

    if (response.error) {
      throw response.error;
    }
  } catch (error) {
    console.error("CV analysis trigger error:", error);
    throw error;
  }
}
