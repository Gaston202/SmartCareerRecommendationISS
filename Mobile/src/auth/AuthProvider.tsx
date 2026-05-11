import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../api/supabase';
import type {
  AuthContextValue,
  AuthSession,
  AuthState,
  AuthUser,
  SignUpMetadata,
} from './authTypes';

// Auth is connected to Supabase: signIn/signUp/signOut use supabase.auth.
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    const fetchFullUser = async (baseUser: any): Promise<AuthUser | null> => {
      if (!baseUser) return null;
      let role: 'user' | 'mentor' = 'user';
      let mentorSpecialty: string | undefined = undefined;
      let fullName: string | null = null;
      let avatar: string | null = null;

      try {
        // Fetch user profile including full_name from users table
        const { data: userData } = await supabase
          .from('users')
          .select('full_name, role, avatar')
          .eq('id', baseUser.id)
          .maybeSingle();

        if (userData) {
          fullName = userData.full_name || null;
          avatar = userData.avatar || null;
          if (userData.role === 'mentor') {
            role = 'mentor';
          }
        }

        // Check if this user is a mentor by looking in the mentors table
        const { data: mentorData } = await supabase
          .from('mentors')
          .select('role')
          .eq('user_id', baseUser.id)
          .maybeSingle();

        if (mentorData) {
          role = 'mentor';
          mentorSpecialty = mentorData.role || undefined;
        }
      } catch (e) {
        console.warn('Error fetching full user data:', e);
      }

      return {
        id: baseUser.id,
        email: baseUser.email ?? null,
        fullName,
        role,
        mentorSpecialty,
        avatar,
      };
    };

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

      const user = await fetchFullUser(data.session?.user);

      if (!mounted) return;
      setState({ session, user, isLoading: false });
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
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

      const user = await fetchFullUser(session?.user);

      if (!mounted) return;
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        // Ensure a row exists in public.users (e.g. if they signed up before sync existed). Do not overwrite existing name/role/status.
        if (data.user) {
          const displayName =
            data.user.user_metadata?.full_name ??
            data.user.email?.split('@')[0] ??
            'User';
          await supabase.from('users').upsert(
            {
              id: data.user.id,
              email: data.user.email ?? email,
              name: displayName,
              role: 'user',
              status: 'active',
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        }
      },
      signUp: async (email, password, metadata?: SignUpMetadata) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: metadata
            ? { data: { full_name: metadata.fullName, phone: metadata.phone } }
            : undefined,
        });
        if (error) throw new Error(error.message);
        // Insert into public.users to match your database schema (id, email, name, role, status, phone)
        if (data.user) {
          const role = metadata?.role ?? 'user';

          await supabase.from('users').insert({
            id: data.user.id,
            email: data.user.email ?? email,
            name: metadata?.fullName ?? null,
            role,
            status: 'active',
            phone: metadata?.phone ?? null,
          });

          if (role === 'mentor') {
            const mentorInsert = {
              user_id: data.user.id,
              name: metadata?.fullName ?? (data.user.email ?? email),
              email: data.user.email ?? email,
              company: metadata?.mentorCompany ?? null,
              role: metadata?.mentorSpecialty ?? null,
              cv_url: metadata?.mentorCvUrl ?? null,
            };

            const { error: mentorError } = await supabase.from('mentors').insert(mentorInsert);
            if (mentorError) {
              console.warn('[AuthProvider] Failed to create mentor profile', mentorError);
            }
          }

          // Force an update to the auth state if they were automatically logged in by supabase
          setState((prev) => {
            if (prev.user && prev.user.id === data.user.id) {
              return { ...prev, user: { ...prev.user, role: role as any, mentorSpecialty: metadata?.mentorSpecialty } };
            }
            return prev;
          });
        }
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
