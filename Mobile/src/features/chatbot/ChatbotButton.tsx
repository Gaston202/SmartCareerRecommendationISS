import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeColors } from '../../screens/homeTheme';

interface ChatbotButtonProps {
  onPress: () => void;
}

export function ChatbotButton({ onPress }: ChatbotButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel="Open chat with Career Assistant"
    >
      <View style={styles.inner}>
        <Ionicons name="chatbubble" size={28} color={homeColors.onPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    zIndex: 50,
    elevation: 6,
    shadowColor: homeColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  inner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: homeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
