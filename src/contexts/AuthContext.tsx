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

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (!error && profile) {
            const mapped: User = {
              id: profile.id,
              name: profile.name ?? profile.email,
              email: profile.email,
              role: profile.is_admin ? 'admin' : 'employee',
              organizationId: profile.organization_id ?? '',
              createdAt: profile.created_at ?? new Date().toISOString(),
            };
            setUser(mapped);
            await AsyncStorage.setItem('myboard_user', JSON.stringify(mapped));
          }
        } else {
          const cached = await AsyncStorage.getItem('myboard_user');
          if (cached) setUser(JSON.parse(cached));
        }
      } catch (e) {
        console.error('Auth restore error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const loginWithPassword = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('No user');
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (pErr) throw pErr;
      if (!profile.is_admin && !profile.organization_id) {
        throw new Error('Organization not set. Ask your admin to create it in MyTime.');
      }
      const mapped: User = {
        id: profile.id,
        name: profile.name ?? profile.email,
        email: profile.email,
        role: profile.is_admin ? 'admin' : 'employee',
        organizationId: profile.organization_id ?? '',
        createdAt: profile.created_at ?? new Date().toISOString(),
      };
      setUser(mapped);
      await AsyncStorage.setItem('myboard_user', JSON.stringify(mapped));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setUser(null);
    await AsyncStorage.removeItem('myboard_user');
  };

  return (
    <AuthContext.Provider value={{ user, loginWithPassword, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
