import { supabase } from "../../api/supabase";

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

/**
 * Trigger analysis via Edge Function using fetch()
 * Prints STATUS + BODY (no FunctionsHttpError)
 */
export async function triggerCvAnalysisFetch(cvUploadId: string): Promise<void> {
    console.log("SUPABASE URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
    console.log("SUPABASE ANON:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20));
  console.log("✅ triggerCvAnalysisFetch: USING FETCH (not invoke)");

  const supabaseUrl = env("EXPO_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = env("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const url = `${supabaseUrl}/functions/v1/${FUNCTION_NAME}`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ cv_id: cvUploadId }),
  });

  const bodyText = await r.text();
  console.log("ANALYZE-CV STATUS:", r.status);
  console.log("ANALYZE-CV BODY:", bodyText);

  if (!r.ok) {
    throw new Error(`analyze-cv failed ${r.status}: ${bodyText}`);
  }
}