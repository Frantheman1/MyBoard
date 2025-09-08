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
      welcome: 'Welcome',
      deleteBoardTitle: 'Delete Board',
      deleteBoardMessage: 'This will remove the board and all its columns and tasks.',
      unableCreateBoard: 'Unable to create board',
    },
    common: {
      cancel: 'Cancel',
      create: 'Create',
      back: 'Back',
      logout: 'Logout',
      settings: 'Settings',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      open: 'Open',
      error: 'Error',
      finished: 'Finished',
      sent: 'Sent',
      actions: 'Actions',
      someone: 'Someone',
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
    },
    // Added keys
    admin: {
      title: 'Admin',
      boards: 'Boards',
      history: 'History',
      noBoards: 'No boards',
      noSnapshots: 'No snapshots yet',
      created: 'Created',
      finish: 'Finish',
      deleteSnapshotTitle: 'Delete snapshot?',
      finishedOn: 'Finished on',
      by: 'By',
      confirmFinishTitle: 'Mark board finished?',
      confirmFinishMessage: 'This will archive',

    },
    board: {
      newColumn: 'New Column',
      columnNamePlaceholder: 'Column name',
      finishAndReset: 'Finish & Reset',
      addTask: 'Add Task',
      sendColumn: 'Send Column',
      noTasks: 'No tasks',
      emptyAdminHint: 'Add a task to get started',
      emptyEmployeeHint: 'Waiting for your admin to add tasks',
      markDone: 'Mark done',
      done: 'Done',
      deleteTaskTitle: 'Delete Task',
      deleteTaskMessage: 'Remove this task?',
      editColumnTitle: 'Edit Column',
      rename: 'Rename',
      resetTasks: 'Reset tasks to not done',
      delete: 'Delete',
      renameBoardTitle: 'Rename Board',
      titleRequiredTitle: 'Title required',
      titleRequiredMessage: 'Please enter a task title',
      modalNewTask: 'New Task',
      modalEditTask: 'Edit Task',
      labelTitle: 'Title',
      labelDescription: 'Description (optional)',
      labelDate: 'Date (optional)',
      labelTime: 'Time (optional)',
      sendBoard: 'Send Board',
      columnSent: 'Column snapshot sent',
      boardFinished: 'Board snapshot taken and tasks reset',
      unableSnapshotColumn: 'Unable to snapshot column',
      unableFinishReset: 'Unable to finish & reset',
      unableSendBoard: 'Unable to send board snapshot',
      doneBy: 'Done by',
      at: 'at',
      actions: 'Actions',
      titlePlaceholder: 'Title',
      descriptionPlaceholder: 'Description (optional)',
    },
    snapshot: {
      noTasksInSnapshot: 'No tasks in snapshot',
      todo: 'Todo',
      doneBy: 'Done by',
      at: 'at',
    },
    login: {
      subtitle: 'Modern task management for teams',
      emailPlaceholder: 'Enter your email',
      passwordPlaceholder: 'Enter your password',
      fillAllFields: 'Please fill in all fields',
      accountsManaged: 'Accounts are created in MyTime',
    },
    profile: {
      inviteCode: 'Invite Code',
      permissionNeededTitle: 'Permission needed',
      permissionNeededMessage: 'We need access to your photos to set a profile picture',
      organizationMembers: 'Organization Members',
      loading: 'Loading…',
      noMembersYet: 'No members yet',
      logoutConfirmMessage: 'Are you sure you want to sign out?',
      selectedFileEmpty: 'Selected file is empty',
      unableUpdateProfilePicture: 'Unable to update profile picture',
      version: 'Version',
    },
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
    notifications: {
      title: 'Varsler',
      noNotifications: 'Ingen varsler ennå',
    },
    settings: {
      title: 'Innstillinger',
      language: 'Språk',
      english: 'Engelsk',
      norwegian: 'Norsk',
    },
    // Added keys
    admin: {
      title: 'Admin',
      boards: 'Tavler',
      history: 'Historikk',
      noBoards: 'Ingen tavler',
      noSnapshots: 'Ingen snapshots ennå',
      created: 'Opprettet',
      finish: 'Fullfør',
      deleteSnapshotTitle: 'Slette snapshot?',
      finishedOn: 'Ferdigstilt',
      by: 'Av',
      confirmFinishTitle: 'Marker tavle som fullført?',
      confirmFinishMessage: 'Dette vil arkivere',
    },
    board: {
      newColumn: 'Ny kolonne',
      columnNamePlaceholder: 'Kolonnenavn',
      finishAndReset: 'Fullfør og nullstill',
      addTask: 'Legg til oppgave',
      sendColumn: 'Send kolonne',
      noTasks: 'Ingen oppgaver',
      emptyAdminHint: 'Legg til en oppgave for å komme i gang',
      emptyEmployeeHint: 'Venter på at admin legger til oppgaver',
      markDone: 'Marker ferdig',
      done: 'Ferdig',
      deleteTaskTitle: 'Slett oppgave',
      deleteTaskMessage: 'Fjerne denne oppgaven?',
      editColumnTitle: 'Rediger kolonne',
      rename: 'Gi nytt navn',
      resetTasks: 'Nullstill oppgaver til ikke ferdig',
      delete: 'Slett',
      renameBoardTitle: 'Gi tavle nytt navn',
      titleRequiredTitle: 'Tittel kreves',
      titleRequiredMessage: 'Skriv inn en oppgavetittel',
      modalNewTask: 'Ny oppgave',
      modalEditTask: 'Rediger oppgave',
      labelTitle: 'Tittel',
      labelDescription: 'Beskrivelse (valgfritt)',
      labelDate: 'Dato (valgfritt)',
      labelTime: 'Tid (valgfritt)',
      sendBoard: 'Send tavle',
      columnSent: 'Kolonne sendt',
      boardFinished: 'Tavle sendt og oppgaver nullstilt',
      unableSnapshotColumn: 'Kunne ikke sende kolonne',
      unableFinishReset: 'Kunne ikke fullføre og nullstille',
      unableSendBoard: 'Kunne ikke sende tavle',
      doneBy: 'Utført av',
      at: 'kl.',
      actions: 'Handlinger',
      titlePlaceholder: 'Tittel',
      descriptionPlaceholder: 'Beskrivelse (valgfritt)',
    },
    snapshot: {
      noTasksInSnapshot: 'Ingen oppgaver i snapshot',
      todo: 'Å gjøre',
      doneBy: 'Utført av',
      at: 'kl.',
    },
    login: {
      subtitle: 'Moderne oppgavehåndtering for team',
      emailPlaceholder: 'Skriv inn e-posten din',
      passwordPlaceholder: 'Skriv inn passordet ditt',
      fillAllFields: 'Fyll ut alle felt',
      accountsManaged: 'Kontoer opprettes i MyTime',
    },
    profile: {
      inviteCode: 'Invitasjonskode',
      permissionNeededTitle: 'Tillatelse nødvendig',
      permissionNeededMessage: 'Vi trenger tilgang til bildene dine for å sette profilbilde',
      organizationMembers: 'Organisasjonsmedlemmer',
      loading: 'Laster…',
      noMembersYet: 'Ingen medlemmer ennå',
      logoutConfirmMessage: 'Er du sikker på at du vil logge ut?',
      selectedFileEmpty: 'Valgt fil er tom',
      unableUpdateProfilePicture: 'Kunne ikke oppdatere profilbilde',
      version: 'Versjon',
    },
    dashboard: {
      title: 'MyBoard',
      yourBoards: 'Dine tavler',
      createBoard: 'Opprett tavle',
      noBoardsYet: 'Ingen tavler ennå',
      noBoardsAdmin: 'Opprett din første tavle for å organisere oppgaver',
      teamBoard: 'Teamtavle',
      created: 'Opprettet',
      welcome: 'Velkommen',
      deleteBoardTitle: 'Slett tavle',
      deleteBoardMessage: 'Dette vil fjerne tavlen og alle kolonner og oppgaver.',
      unableCreateBoard: 'Kunne ikke opprette tavle',
    },
    common: {
      cancel: 'Avbryt',
      create: 'Opprett',
      back: 'Tilbake',
      logout: 'Logg ut',
      settings: 'Innstillinger',
      save: 'Lagre',
      edit: 'Rediger',
      delete: 'Slett',
      open: 'Åpne',
      error: 'Feil',
      finished: 'Fullført',
      sent: 'Sendt',
      actions: 'Handlinger',
      someone: 'Noen',
    },
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
