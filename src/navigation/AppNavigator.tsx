import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList, MainTabParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

// Import screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/main/DashboardScreen';
import AdminScreen from '../screens/main/AdminScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import BoardScreen from '../screens/main/BoardScreen';
import SnapshotScreen from '../screens/main/SnapshotScreen';
// removed daily auto-finish

const RootStack = createStackNavigator();
const MainTab = createBottomTabNavigator();

function MainTabNavigator() {
  const { t } = useLanguage();
  const { user } = useAuth();
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: 'gray',
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

  // Auto-finish daily at app start (acts as a fallback if cron isn't running)
  // Daily auto-finish removed as per new requirements

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <RootStack.Screen name="Main" component={MainTabNavigator} />
            <RootStack.Screen 
              name="Board" 
              component={BoardScreen} 
              options={{
                headerShown: false,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
              }}
            />
            <RootStack.Screen 
              name="Snapshot" 
              component={SnapshotScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
