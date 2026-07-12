import * as React from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { apiClient } from '@/lib/apiClient';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { UserProfile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadProfile = React.useCallback(async () => {
    try {
      const { data } = await apiClient.get<UserProfile>('/auth/me');
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        connectSocket(data.session.access_token);
        await loadProfile();
      }
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        connectSocket(newSession.access_token);
        await loadProfile();
      } else {
        disconnectSocket();
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    disconnectSocket();
  }, []);

  const value = React.useMemo(
    () => ({ session, profile, loading, signIn, signOut, refreshProfile: loadProfile }),
    [session, profile, loading, signIn, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
