import 'react-native-url-polyfill/auto';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Expo loads .env and exposes EXPO_PUBLIC_* vars at build time
const SUPABASE_URL = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env. Copy .env.example to .env and add your Supabase project URL and anon key.'
  );
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);