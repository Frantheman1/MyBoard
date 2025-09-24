// AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootedFromCache, setBootedFromCache] = useState(false);

  // Map Supabase session -> your User shape
  const mapProfileToUser = (profile: any): User => ({
    id: profile.id,
    name: profile.name ?? profile.email,
    email: profile.email,
    role: profile.is_admin ? 'admin' : 'employee',
    organizationId: profile.organization_id ?? '',
    createdAt: profile.created_at ?? new Date().toISOString(),
  });

  // 1) Quick boot from cache (if any), so UI has something while we check session
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem('myboard_user');
        if (cached) {
          setUser(JSON.parse(cached));
        }
      } finally {
        setBootedFromCache(true);
      }
    })();
  }, []);

  // 2) Live auth listener is the single source of truth
  useEffect(() => {
    let isActive = true;

    const restoreFromSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isActive) return;

      if (session?.user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!error && profile) setUser(mapProfileToUser(profile));
        else setUser(null);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    // initial restore
    restoreFromSession();

    // subscribe to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isActive) return;

      if (session?.user?.id) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        setUser(!error && profile ? mapProfileToUser(profile) : null);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  // 3) Persist user whenever it changes (single place)
  useEffect(() => {
    (async () => {
      if (user) {
        await AsyncStorage.setItem('myboard_user', JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem('myboard_user');
      }
    })();
  }, [user]);

  const loginWithPassword = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('No user');

      // No setUser here — the auth listener will populate it once session is established.
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Don’t call setUser(null) here — avoid bouncing state.
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loginWithPassword, logout, isLoading: isLoading && !bootedFromCache }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
