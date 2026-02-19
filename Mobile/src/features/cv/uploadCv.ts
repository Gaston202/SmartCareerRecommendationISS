import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../../api/supabase";

const CV_BUCKET = "cvs_debug";
const FUNCTION_NAME = "analyze-cv";

function env(name: string) {
  const v = (process.env as any)[name];
  if (!v) throw new Error(`Missing env var ${name}. Add it to .env and restart Expo.`);
  return String(v);
}

async function getSessionOrThrow() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`getSession error: ${error.message}`);
  if (!data.session) throw new Error("Not logged in (no session). Sign in first.");
  return data.session;
}

async function readAsArrayBuffer(uri: string) {
  const r = await fetch(uri);
  if (!r.ok) throw new Error(`Failed to read picked file. Status=${r.status}`);
  return await r.arrayBuffer();
}

export async function pickAndUploadCv(): Promise<{ cvUploadId: string; storagePath: string } | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled) return null;

  const file = picked.assets[0];
  const session = await getSessionOrThrow();
  const userId = session.user.id;

  const bytes = await readAsArrayBuffer(file.uri);
  const storagePath = `${userId}/${Date.now()}_${file.name}`;

  const up = await supabase.storage.from(CV_BUCKET).upload(storagePath, bytes, {
    contentType: file.mimeType ?? "application/pdf",
    upsert: false,
  });
  if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);

  const ins = await supabase
    .from("cvs")
    .insert({
      user_id: userId,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.mimeType ?? "application/pdf",
      status: "uploaded",
    })
    .select("id")
    .single();

  if (ins.error) {
    await supabase.storage.from(CV_BUCKET).remove([storagePath]);
    throw new Error(`DB insert failed: ${ins.error.message}`);
  }

  return { cvUploadId: ins.data.id, storagePath };
}

export async function triggerCvAnalysis(cvUploadId: string): Promise<void> {
  // GUARD: if you see FunctionsHttpError, you are NOT using this function.
  console.log("✅ triggerCvAnalysis: USING FETCH (final)");

  const session = await getSessionOrThrow();

  const url = `${env("EXPO_PUBLIC_SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`;
  console.log("Function URL:", url);
  console.log("Payload:", { cv_id: cvUploadId });
  console.log("Session user id:", session.user.id);

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ cv_id: cvUploadId }),
  });

  const body = await r.text();
  console.log("ANALYZE-CV STATUS:", r.status);
  console.log("ANALYZE-CV BODY:", body);

  if (!r.ok) {
    throw new Error(`analyze-cv failed ${r.status}: ${body}`);
  }
}

export async function pickUploadAndAnalyzeCv(): Promise<void> {
  const up = await pickAndUploadCv();
  if (!up) return;

  console.log("✅ CV uploaded:", up.cvUploadId);
  await triggerCvAnalysis(up.cvUploadId);
}