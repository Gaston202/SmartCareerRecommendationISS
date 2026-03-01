import { supabase } from "../../api/supabase";

/**
 * Trigger CV analysis via Edge Function
 * Uses direct fetch for better error visibility
 */
export async function triggerCvAnalysisFetch(cvId: string): Promise<any> {
  console.log(`[cv.service] Starting analysis for CV: ${cvId}`);

  // 1. Verify session exists and token is available
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  console.log(`[cv.service] 📋 Session check:`, {
    hasSession: !!sessionData.session,
    userId: sessionData.session?.user?.id,
    tokenExists: !!sessionData.session?.access_token,
    tokenLength: sessionData.session?.access_token?.length,
    tokenStart: sessionData.session?.access_token?.slice(0, 20),
  });

  if (!sessionData.session || !sessionData.session.access_token) {
    console.error(`[cv.service] ❌ No session or token found`);
    throw new Error("Not authenticated - no session token. Please sign in again.");
  }

  // 2. Refresh token to ensure it's fresh (prevents 401 from expiration)
  console.log(`[cv.service] 🔄 Refreshing session token...`);
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  
  if (refreshError) {
    console.warn(`[cv.service] ⚠️ Refresh error (non-fatal):`, refreshError.message);
  } else if (refreshData.session) {
    console.log(`[cv.service] ✅ Token refreshed successfully`);
  }

  const latestSession = refreshData.session || sessionData.session;
  const userId = latestSession.user?.id;
  const accessToken = latestSession.access_token;
  const refreshToken = latestSession.refresh_token;

  console.log(`[cv.service] 🔐 Token details:`, {
    userId,
    tokenLength: accessToken?.length,
    tokenIsJwt: accessToken?.split(".").length === 3,
    tokenParts: accessToken?.split(".").length,
    accessTokenStart: accessToken?.slice(0, 12),
    refreshTokenStart: refreshToken?.slice(0, 12),
    usingAccessToken: true,
  });

  // 3. Prepare exact headers with correct casing
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // CRITICAL CHECK: Verify we're not accidentally using anon key as access token
  const anonKeyMatchesToken = supabaseAnonKey === accessToken;
  console.log(`[cv.service] ⚠️ Token verification:`, {
    anonKeyMatchesAccessToken: anonKeyMatchesToken,
    anonKeyPreview: supabaseAnonKey?.slice(0, 20),
    accessTokenPreview: accessToken?.slice(0, 20),
  });

  if (anonKeyMatchesToken) {
    console.error(`[cv.service] 🚨 CRITICAL ERROR: Access token equals anon key! Check your .env file.`);
    throw new Error("Configuration error: Access token matches anon key");
  }

  console.log(`[cv.service] 🌐 Environment check:`, {
    supabaseUrl,
    urlMatchesProject: supabaseUrl.includes("tipysihegnyvwxibhbue"),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": supabaseAnonKey,
    "Authorization": `Bearer ${accessToken}`,
  };

  console.log(`[cv.service] 📋 Headers check:`, {
    hasAuth: "Authorization" in headers,
    hasApikey: "apikey" in headers,
    authPreview: headers.Authorization.slice(0, 25),
    apikeyPreview: headers.apikey.slice(0, 20),
  });

  const url = `${supabaseUrl}/functions/v1/analyze-cv`;
  
  const payload = { cvId };
  console.log(`[cv.service] payload`, payload);
  console.log(`[cv.service] 🚀 Calling Edge Function:`, { url, cvId, userId });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers, // Use exact headers object (no spreading)
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    
    console.log(`[cv.service] 📡 Response:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      bodyLength: responseText.length,
      bodyPreview: responseText.slice(0, 200),
    });

    if (!response.ok) {
      console.error(`[cv.service] ❌ Function failed with status ${response.status}:`, responseText);
      throw new Error(`analyze-cv failed ${response.status}: ${responseText}`);
    }

    console.log(`[cv.service] ✅ Analysis completed successfully`);
    return responseText ? JSON.parse(responseText) : null;
  } catch (err: any) {
    console.error(`[cv.service] ❌ Request failed:`, {
      name: err.name,
      message: err.message,
      stack: err.stack?.slice(0, 200),
    });
    throw err;
  }
}