import React, { useEffect, useRef } from 'react';
import { DefaultTheme, DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, Text, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList, MainTabParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { ensureDailySnapshotsForOrganization } from '../utils/storage';

// Import screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/main/DashboardScreen';
import AdminScreen from '../screens/main/AdminScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import BoardScreen from '../screens/main/BoardScreen';
import SnapshotScreen from '../screens/main/SnapshotScreen';
import UserHelpScreen from '../screens/help/UserHelpScreen';
import AdminHelpScreen from '../screens/help/AdminHelpScreen';
// removed daily auto-finish

const RootStack = createStackNavigator();
const MainTab = createBottomTabNavigator();

function MainTabNavigator() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          position: 'absolute',
          left: 16,
          right: 16,
          borderRadius: 16,
          paddingBottom: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 6,
        },
        tabBarIconStyle: {
          marginTop: 6,
        },
      }}
    >
      <MainTab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarLabel: t.dashboard.title,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={size} color={color} />
          )
        }}
      />
      {user?.role === 'admin' && (
      <MainTab.Screen 
        name="Admin" 
        component={AdminScreen}
        options={{
          tabBarLabel: t.admin.title,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? 'shield' : 'shield-outline'} size={size} color={color} />
          )
          }}
        />
      )}
      <MainTab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: t.settings.title,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          )
        }}
      />
    </MainTab.Navigator>
  );
}

function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#6b7280' }}>{t.common.loading}</Text>
    </View>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuth();
  const { theme, isDark } = useTheme();
  const lastRunDateRef = useRef<string | null>(null);

  // Auto-send at end of day (local day) – run once per day when app becomes active
  useEffect(() => {
    if (!user || user.role !== 'admin' || !user.organizationId) return;

    const checkAndSendEOD = async () => {
      try {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const localDate = `${y}-${m}-${d}`;
        
        if (lastRunDateRef.current === localDate) return;
        
        // Check org settings to see if auto-send is enabled
        const { getOrganizationSettings } = await import('../utils/storage');
        const settings = await getOrganizationSettings(user.organizationId);
        
        if (settings.autoSendEndOfDay) {
          // Check if we need to send for previous day(s)
          if (lastRunDateRef.current && lastRunDateRef.current < localDate) {
            // Send for the previous day first
            const prevDate = new Date(now);
            prevDate.setDate(prevDate.getDate() - 1);
            const py = prevDate.getFullYear();
            const pm = String(prevDate.getMonth() + 1).padStart(2, '0');
            const pd = String(prevDate.getDate()).padStart(2, '0');
            const previousDate = `${py}-${pm}-${pd}`;
            await ensureDailySnapshotsForOrganization(user.organizationId, previousDate);
          }
          // Then ensure today's is ready (in case we're doing it at end of day)
          await ensureDailySnapshotsForOrganization(user.organizationId, localDate);
        }
        lastRunDateRef.current = localDate;
      } catch (error) {
        console.error('[AutoSendEOD] Error:', error);
      }
    };

    // Run check immediately on mount
    checkAndSendEOD();

    // Also run when app becomes active
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state !== 'active') return;
      await checkAndSendEOD();
    });
    return () => sub.remove();
  }, [user?.id, user?.role, user?.organizationId]);

  if (isLoading) return <LoadingScreen />;

  const baseNavTheme = isDark ? DarkTheme : DefaultTheme;
  const fonts = (baseNavTheme as any).fonts || {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium:  { fontFamily: 'System', fontWeight: '500' as const },
    bold:    { fontFamily: 'System', fontWeight: '700' as const },
  };
  const navTheme = {
    ...baseNavTheme,
    colors: {
      ...baseNavTheme.colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
    },
    fonts,
  } as const;

  return (
    <NavigationContainer theme={navTheme as any} key={user ? 'app' : 'auth'}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <RootStack.Screen name="Main" component={MainTabNavigator} />
            <RootStack.Screen name="Board" component={BoardScreen} />
            <RootStack.Screen name="Snapshot" component={SnapshotScreen} />
            <RootStack.Screen name="UserHelp" component={UserHelpScreen} />
            <RootStack.Screen name="AdminHelp" component={AdminHelpScreen} />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
