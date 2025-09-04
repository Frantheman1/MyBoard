import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../types';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: any; // Simplified for now
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Simplified translations
const translations = {
  en: {
    auth: {
      signIn: 'Sign In',
      signUp: 'Sign Up',
      email: 'Email',
      password: 'Password',
      fullName: 'Full Name',
      admin: 'Admin',
      employee: 'Employee',
      organizationName: 'Organization Name',
      organizationCode: 'Organization Code',
      createAccount: 'Create Account',
      welcomeBack: 'Welcome back',
      signInToAccount: 'Sign in to your account',
      joinMyBoard: 'Join MyBoard and start managing tasks',
      confirmPassword: 'Confirm Password',
      accountType: 'Account Type',
      invalidCredentials: 'Invalid credentials',
      passwordsDoNotMatch: 'Passwords do not match',
      invalidOrganizationCode: 'Invalid organization code',
    },
    dashboard: {
      title: 'MyBoard',
      yourBoards: 'Your Boards',
      createBoard: 'Create Board',
      noBoardsYet: 'No boards yet',
      noBoardsAdmin: 'Create your first board to start organizing tasks',
      teamBoard: 'Team Board',
      created: 'Created',
    },
    common: {
      cancel: 'Cancel',
      create: 'Create',
      back: 'Back',
      logout: 'Logout',
      settings: 'Settings',
    },
    notifications: {
      title: 'Notifications',
      noNotifications: 'No notifications yet',
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      english: 'English',
      norwegian: 'Norwegian',
    }
  },
  no: {
    auth: {
      signIn: 'Logg inn',
      signUp: 'Registrer deg',
      email: 'E-post',
      password: 'Passord',
      fullName: 'Fullt navn',
      admin: 'Administrator',
      employee: 'Ansatt',
      organizationName: 'Organisasjonsnavn',
      organizationCode: 'Organisasjonskode',
      createAccount: 'Opprett konto',
      welcomeBack: 'Velkommen tilbake',
      signInToAccount: 'Logg inn på kontoen din',
      joinMyBoard: 'Bli med i MyBoard og administrer oppgaver',
      confirmPassword: 'Bekreft passord',
      accountType: 'Kontotype',
      invalidCredentials: 'Ugyldig påloggingsinformasjon',
      passwordsDoNotMatch: 'Passordene stemmer ikke overens',
      invalidOrganizationCode: 'Ugyldig organisasjonskode',
    },
    dashboard: {
      title: 'MyBoard',
      yourBoards: 'Dine tavler',
      createBoard: 'Opprett tavle',
      noBoardsYet: 'Ingen tavler ennå',
      noBoardsAdmin: 'Opprett din første tavle for å organisere oppgaver',
      teamBoard: 'Teamtavle',
      created: 'Opprettet',
    },
    common: {
      cancel: 'Avbryt',
      create: 'Opprett',
      back: 'Tilbake',
      logout: 'Logg ut',
      settings: 'Innstillinger',
    },
    notifications: {
      title: 'Varsler',
      noNotifications: 'Ingen varsler ennå',
    },
    settings: {
      title: 'Innstillinger',
      language: 'Språk',
      english: 'Engelsk',
      norwegian: 'Norsk',
    }
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>('en');
  const [t, setT] = useState(translations.en);

  useEffect(() => {
    // Load saved language from storage
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('myboard_language') as Language;
        if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'no')) {
          setLanguageState(savedLanguage);
          setT(translations[savedLanguage]);
        }
      } catch (error) {
        console.error('Error loading language:', error);
      }
    };
    
    loadLanguage();
  }, []);

  const setLanguage = async (newLanguage: Language) => {
    setLanguageState(newLanguage);
    setT(translations[newLanguage]);
    await AsyncStorage.setItem('myboard_language', newLanguage);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
