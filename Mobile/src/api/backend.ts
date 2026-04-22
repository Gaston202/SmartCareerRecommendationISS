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
    return "http://10.0.2.2:3000/api/v1";
  }

  return "http://localhost:3000/api/v1";
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
    message.includes("timed out") ||
    message.includes("failed to fetch")
  );
}

function getBackendReachabilityMessage(url: string): string {
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  })();

  const hostHint =
    hostname === "localhost"
      ? "localhost only works on the iOS simulator, not on a physical phone."
      : hostname === "10.0.2.2"
        ? "10.0.2.2 only works on the Android emulator."
        : "Make sure your phone/simulator can reach that host and the backend is running on port 3000.";

  return `Cannot reach backend at ${url}. ${hostHint}`;
}

export async function fetchBackend(path: string, init?: RequestInit): Promise<Response> {
  const url = buildBackendUrl(path);

  try {
    return await fetch(url, init);
  } catch (error) {
    if (isConnectivityError(error)) {
      throw new Error(getBackendReachabilityMessage(url));
    }

    throw error;
  }
}
