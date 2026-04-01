const OPENROUTER_API_KEY_ENV = "EXPO_PUBLIC_OPENROUTER_API_KEY";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function normalizeApiKey(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^['\"]|['\"]$/g, "");
}

export function getOpenRouterApiKey(): string {
  const rawValue = (process.env as Record<string, string | undefined>)[OPENROUTER_API_KEY_ENV];
  const key = normalizeApiKey(rawValue);

  if (!key || !key.startsWith("sk-")) {
    throw new Error(
      `Invalid ${OPENROUTER_API_KEY_ENV}. Add a valid key from https://openrouter.ai/keys to Mobile/.env and restart Expo with cache clear (npx expo start -c).`
    );
  }

  return key;
}

export function buildOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": "https://smartcareer.app",
    "X-Title": "MyPath",
    "Content-Type": "application/json",
  };
}

export function toOpenRouterError(status: number, responseText: string): Error & { status: number } {
  let message = `OpenRouter API failed ${status}: ${responseText.slice(0, 300)}`;

  if (status === 401) {
    const lower = responseText.toLowerCase();
    if (lower.includes("user not found")) {
      message =
        "OpenRouter authentication failed: this API key is tied to a missing/deleted OpenRouter user. Generate a new key at https://openrouter.ai/keys, update Mobile/.env, then restart Expo with cache clear (npx expo start -c).";
    } else {
      message =
        "OpenRouter authentication failed: API key is invalid or expired. Update EXPO_PUBLIC_OPENROUTER_API_KEY and restart Expo with cache clear (npx expo start -c).";
    }
  }

  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}
