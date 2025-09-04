import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

// Reuse the same Supabase project as MyTime (MyTimeClean)
const supabaseUrl = 'https://mzrxwdncfbrkfgnjjono.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16cnh3ZG5jZmJya2Znbmpqb25vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxNjc2NzUsImV4cCI6MjA1MTc0MzY3NX0.uSwtcf7RE2PRaNryl-ARVdPl_IiHXlLNi26wC1JkXvE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});


