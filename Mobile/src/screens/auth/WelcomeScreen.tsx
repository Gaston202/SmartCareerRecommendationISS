import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authColors } from './authTheme';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export function WelcomeScreen({ navigation }: WelcomeScreenProps): React.ReactElement {
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;
  const float4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (anim: Animated.Value, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ])
      );
    const a1 = loop(float1, 2800, 0);
    const a2 = loop(float2, 3200, 400);
    const a3 = loop(float3, 2600, 800);
    const a4 = loop(float4, 3000, 200);
    a1.start();
    a2.start();
    a3.start();
    a4.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      a4.stop();
    };
  }, [float1, float2, float3, float4]);

  const t1 = (v: Animated.Value, y: number, x: number) => ({
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
    ],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[authColors.gradientStart, authColors.gradientEnd]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.shape, styles.shapePurple, t1(float1, 14, 6)]} />
      <Animated.View style={[styles.shape, styles.shapeOrange, t1(float2, -10, -4)]} />
      <Animated.View style={[styles.shape, styles.shapeTeal, t1(float3, 12, 5)]} />
      <Animated.View style={[styles.shape, styles.shapeBlue, t1(float4, -8, 4)]} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.contentBlock}>
        <View style={styles.logoCircle}>
          <FontAwesome5 name="graduation-cap" size={26} color="#fff" />
        </View>

        <Text style={styles.title}>
          Not sure about your future?{'\n'}
          <Text style={styles.titleHighlight}>Let's figure it out together.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Answer a few questions and discover career paths made for you.
        </Text>

        <View style={styles.featureRow}>
          <View style={styles.featurePill}>
            <Ionicons name="flash" size={18} color={authColors.link} />
            <Text style={styles.featureText}>AI-Powered Matching</Text>
          </View>
          <View style={styles.featurePill}>
            <Ionicons name="trending-up" size={18} color="#0D9488" />
            <Text style={styles.featureText}>Career Roadmaps</Text>
          </View>
        </View>
        <View style={[styles.featureRow, styles.featureRowSingle]}>
          <View style={styles.featurePill}>
            <Ionicons name="people" size={18} color="#059669" />
            <Text style={styles.featureText}>Mentor Connect</Text>
          </View>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Login')}
          style={({ pressed }) => [styles.getStartedWrap, pressed && styles.getStartedPressed]}
        >
          <LinearGradient
            colors={[authColors.buttonStart, authColors.buttonEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.getStartedGradient}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={14} color={authColors.textMuted} />
          <Text style={styles.timeText}>Takes 3-5 minutes</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by AI</Text>
          <Ionicons name="sparkles" size={14} color={authColors.link} style={{ marginLeft: 4 }} />
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    minHeight: '100%',
  },
  contentBlock: {
    alignItems: 'center',
    width: '100%',
  },
  shape: { position: 'absolute', borderRadius: 999 },
  shapePurple: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: authColors.shapePurple,
    top: '8%',
    right: -30,
  },
  shapeOrange: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: authColors.shapeOrange,
    top: '28%',
    left: -20,
  },
  shapeTeal: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: authColors.shapeTeal,
    top: '42%',
    left: -30,
  },
  shapeBlue: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: authColors.shapeBlue,
    bottom: '24%',
    left: -10,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: authColors.logoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: authColors.textDark,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  titleHighlight: {
    color: authColors.link,
  },
  subtitle: {
    fontSize: 15,
    color: authColors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  featureRowSingle: {
    marginBottom: 28,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    color: authColors.textDark,
  },
  getStartedWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  getStartedPressed: { opacity: 0.9 },
  getStartedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  getStartedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 40,
  },
  timeText: {
    fontSize: 13,
    color: authColors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: authColors.textMuted,
  },
});
