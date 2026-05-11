import { Platform } from "react-native";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getBackendApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  // Expo/Android emulator cannot reach host localhost directly.
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000/api/v1";
  }

  return "http://localhost:8000/api/v1";
}

function buildBackendUrl(path: string): string {
  const baseUrl = getBackendApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function isConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("network request timed out") ||
    message.includes("failed to fetch")
  );
}

function getBackendReachabilityMessage(url: string): string {
  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  })();

  const hostname = parsed?.hostname ?? null;
  const port = parsed?.port ? `:${parsed.port}` : "";

  const hostHint =
    hostname === "localhost"
      ? "localhost only works on the iOS simulator, not on a physical phone."
      : hostname === "10.0.2.2"
        ? "10.0.2.2 only works on the Android emulator."
        : `Make sure your phone/simulator can reach that host and the backend is running on ${hostname}${port}. If testing on a physical phone, use the same Wi-Fi network and allow inbound TCP on that port in Windows Firewall.`;

  return `Cannot reach backend at ${url}. ${hostHint}`;
}

function getBackendTimeoutMessage(url: string, timeoutMs: number): string {
  return (
    `Request timed out after ${timeoutMs / 1000}s while waiting for ${url}. ` +
    `The backend may be slow, unavailable, or configured on a different port. ` +
    `If you are using the FastAPI backend in this repo, it runs on :8000 by default.`
  );
}

// Quiz result generation can take longer than the normal API flow because the backend
// waits on AI generation before returning the final Nova report.
const FETCH_TIMEOUT_MS = 300000; // 300 seconds

export async function fetchBackend(path: string, init?: RequestInit): Promise<Response> {
  const url = buildBackendUrl(path);
  console.log(`[fetchBackend] ${init?.method || 'GET'} ${url}`);

  // Add timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log(`[fetchBackend] Response: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      const text = await response.clone().text();
      console.log(`[fetchBackend] Error body:`, text.slice(0, 500));
    }
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(getBackendTimeoutMessage(url, FETCH_TIMEOUT_MS));
    }

    if (isConnectivityError(error)) {
      throw new Error(getBackendReachabilityMessage(url));
    }

    throw error;
  }
}
