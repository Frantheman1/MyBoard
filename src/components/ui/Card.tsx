import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../contexts/ThemeContext';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  blur?: boolean;
}

export default function Card({ children, style, blur = false }: CardProps) {
  const { theme, isDark } = useTheme();
  const base = (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, style]}>
      {children}
    </View>
  );

  if (!blur) return base;

  return (
    <BlurView intensity={isDark ? 40 : 20} tint={isDark ? 'dark' : 'light'} style={styles.blurWrapper}>
      {base}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  blurWrapper: {
    borderRadius: 16,
  },
});


