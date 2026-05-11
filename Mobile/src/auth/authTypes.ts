/**
 * Represents a Supabase Session
 * Type-safe wrapper for Supabase auth session
 */

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  fullName?: string | null;
  role?: 'user' | 'mentor';
  mentorSpecialty?: string;
  avatar?: string | null;
}

export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
}

export interface SignUpMetadata {
  fullName?: string;
  phone?: string;
  role?: 'user' | 'mentor';
  mentorSpecialty?: string;
  mentorCompany?: string;
  mentorCvUrl?: string;
}

export interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, metadata?: SignUpMetadata): Promise<void>;
  signOut(): Promise<void>;
}
