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
}

export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
}

export interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}
