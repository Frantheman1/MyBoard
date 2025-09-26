// contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { User } from '../types';

type AuthContextType = {
  user: User | null;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean; // true until we've processed the first real auth state
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false); // 👈 becomes true after first session resolve

  // Map Supabase profile row -> your app's User
  const mapProfileToUser = (profile: any): User => ({
    id: profile.id,
    name: profile.name ?? profile.email,
    email: profile.email,
    role: profile.is_admin ? 'admin' : 'employee',
    organizationId: profile.organization_id ?? '',
    createdAt: profile.created_at ?? new Date().toISOString(),
  });

  // Persist user whenever it changes (single place)
  useEffect(() => {
    (async () => {
      try {
        if (user) {
          await AsyncStorage.setItem('myboard_user', JSON.stringify(user));
        } else {
          await AsyncStorage.removeItem('myboard_user');
        }
      } catch {}
    })();
  }, [user]);

  useEffect(() => {
    let active = true;

    const applySession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!active) return;

      if (session?.user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!active) return;
        setUser(!error && profile ? mapProfileToUser(profile) : null);
      } else {
        setUser(null);
      }

      if (active) setHydrated(true); // ✅ mark ready after first *real* resolution
    };

    const bootstrap = async () => {
      // Optional: show cached user instantly (for perceived performance)
      try {
        const cached = await AsyncStorage.getItem('myboard_user');
        if (cached && active) setUser(JSON.parse(cached));
      } catch {}

      // 1) Resolve current session once
      const { data: { session } } = await supabase.auth.getSession();
      await applySession(session);

      // 2) Subscribe to live auth changes (single source of truth)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        applySession(nextSession);
      });

      return () => subscription.unsubscribe();
    };

    let cleanup: (() => void) | void;
    bootstrap().then((c) => { cleanup = c; });

    return () => {
      active = false;
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  const loginWithPassword = async (email: string, password: string) => {
    // Let the auth listener populate user; this is just the call.
    await supabase.auth.signInWithPassword({ email, password });
  };

  const logout = async () => {
    // Passive logout: listener will flip user to null.
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithPassword,
        logout,
        isLoading: !hydrated, // expose as “auth not ready yet”
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
