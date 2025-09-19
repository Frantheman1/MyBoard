import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeName = 'light' | 'dark';

export interface ThemePalette {
  name: ThemeName;
  colors: {
    background: string;
    surface: string;
    card: string;
    text: string;
    secondaryText: string;
    border: string;
    primary: string;
    primaryAlt: string;
    success: string;
    error: string;
    muted: string;
    tabBar: string;
  };
}

const lightTheme: ThemePalette = {
  name: 'light',
  colors: {
    background: '#f8fafc',
    surface: '#ffffff',
    card: '#ffffff',
    text: '#111827',
    secondaryText: '#6b7280',
    border: '#e5e7eb',
    primary: '#6366f1',
    primaryAlt: '#8b5cf6',
    success: '#10b981',
    error: '#ef4444',
    muted: '#9ca3af',
    tabBar: 'rgba(255,255,255,0.8)'
  }
};

const darkTheme: ThemePalette = {
  name: 'dark',
  colors: {
    background: '#0b1220',
    surface: '#0f172a',
    card: '#111827',
    text: '#e5e7eb',
    secondaryText: '#94a3b8',
    border: '#1f2937',
    primary: '#818cf8',
    primaryAlt: '#a78bfa',
    success: '#34d399',
    error: '#f87171',
    muted: '#64748b',
    tabBar: 'rgba(15,23,42,0.7)'
  }
};

interface ThemeContextValue {
  theme: ThemePalette;
  isDark: boolean;
  setThemeName: (name: ThemeName) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>('light');

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem('theme:name');
        if (stored === 'light' || stored === 'dark') {
          setThemeNameState(stored);
        }
      } catch {}
    };
    load();
  }, []);

  const theme = useMemo(() => (themeName === 'dark' ? darkTheme : lightTheme), [themeName]);

  const setThemeName = async (name: ThemeName) => {
    setThemeNameState(name);
    try {
      await AsyncStorage.setItem('theme:name', name);
    } catch {}
  };

  const toggleTheme = async () => {
    await setThemeName(themeName === 'light' ? 'dark' : 'light');
  };

  const value = useMemo(
    () => ({ theme, isDark: theme.name === 'dark', setThemeName, toggleTheme }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}


