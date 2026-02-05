import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../api/supabase';
import type { AuthContextValue, AuthSession, AuthState, AuthUser } from './authTypes';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) console.warn('getSession error:', error.message);

      const session = data.session
        ? ({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_in: data.session.expires_in,
            expires_at: data.session.expires_at,
            token_type: data.session.token_type,
          } as AuthSession)
        : null;

      const user: AuthUser | null = data.session?.user
        ? { id: data.session.user.id, email: data.session.user.email ?? null }
        : null;

      setState({ session, user, isLoading: false });
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const sessionData: AuthSession | null = session
        ? ({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
            token_type: session.token_type,
          } as AuthSession)
        : null;

      const user: AuthUser | null = session?.user
        ? { id: session.user.id, email: session.user.email ?? null }
        : null;

      setState({ session: sessionData, user, isLoading: false });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
      },
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
