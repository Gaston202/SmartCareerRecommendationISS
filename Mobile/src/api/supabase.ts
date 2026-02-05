import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('SUPABASE URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);

  // Don't crash builds; just warn.
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
