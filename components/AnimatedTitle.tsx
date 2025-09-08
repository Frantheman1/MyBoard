import React, { useEffect, useState, useRef } from 'react';
import { Text, Animated, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useFonts, Righteous_400Regular } from '@expo-google-fonts/righteous';

interface AnimatedTitleProps {
  text: string;
  style?: TextStyle | TextStyle[];
  onAnimationComplete?: () => void;
}

export default function AnimatedTitle({ text, style, onAnimationComplete }: AnimatedTitleProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [fontsLoaded] = useFonts({ Righteous_400Regular });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        let currentIndex = 0;
        const letterInterval = setInterval(() => {
          if (currentIndex < text.length) {
            setDisplayedText(text.substring(0, currentIndex + 1));
            currentIndex++;
          } else {
            clearInterval(letterInterval);
            setAnimationComplete(true);
            if (onAnimationComplete) onAnimationComplete();
          }
        }, 100);
      });
    }
  }, [fontsLoaded, text]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Text style={[styles.titleText, style]}>{animationComplete ? text : displayedText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  titleText: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 22,
    color: '#111827',
    letterSpacing: 1,
  },
});


