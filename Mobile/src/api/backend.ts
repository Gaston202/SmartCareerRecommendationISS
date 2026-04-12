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
