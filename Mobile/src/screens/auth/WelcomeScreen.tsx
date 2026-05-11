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
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authColors } from './authTheme';
import { AppLogo } from '../../ui/AppLogo';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

const FEATURES = [
  { icon: 'flash' as const,      color: '#FFC107', label: 'AI-Powered Matching' },
  { icon: 'trending-up' as const, color: '#5EEAD4', label: 'Career Roadmaps'    },
  { icon: 'people' as const,      color: '#86EFAC', label: 'Mentor Connect'      },
];

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
    return () => { a1.stop(); a2.stop(); a3.stop(); a4.stop(); };
  }, [float1, float2, float3, float4]);

  const t = (v: Animated.Value, y: number, x: number) => ({
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
    ],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[authColors.gradientDeep, authColors.gradientMid, authColors.gradientBright]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient floating blobs */}
      <Animated.View style={[styles.blob, styles.blob1, t(float1, 14, 6)]} />
      <Animated.View style={[styles.blob, styles.blob2, t(float2, -10, -4)]} />
      <Animated.View style={[styles.blob, styles.blob3, t(float3, 12, 5)]} />
      <Animated.View style={[styles.blob, styles.blob4, t(float4, -8, 4)]} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.contentBlock}>
          {/* Logo */}
          <View style={styles.logoCircle}>
            <AppLogo size={42} />
          </View>

          {/* Badge */}
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={12} color="#FFC107" />
            <Text style={styles.badgeText}>AI-POWERED CAREER PLATFORM</Text>
          </View>

          {/* Headline */}
          <Text style={styles.title}>
            Not sure about{'\n'}your future?
          </Text>
          <Text style={styles.titleHighlight}>Let's figure it out.</Text>

          <Text style={styles.subtitle}>
            Answer a few questions and discover career paths made exactly for you.
          </Text>

          {/* Feature pills */}
          <View style={styles.featuresRow}>
            {FEATURES.map(({ icon, color, label }) => (
              <View key={label} style={styles.featurePill}>
                <Ionicons name={icon} size={16} color={color} />
                <Text style={styles.featureText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Primary CTA */}
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
          >
            <View style={styles.ctaBtn}>
              <Text style={styles.ctaText}>Get Started</Text>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={18} color={authColors.gradientMid} />
              </View>
            </View>
          </Pressable>

          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.45)" />
            <Text style={styles.timeText}>Takes 3–5 minutes</Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Powered by AI</Text>
            <Ionicons name="sparkles" size={12} color="rgba(255,255,255,0.35)" style={{ marginLeft: 4 }} />
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
    paddingHorizontal: 28,
    paddingVertical: 40,
    alignItems: 'center',
    minHeight: '100%',
  },

  contentBlock: {
    alignItems: 'center',
    width: '100%',
  },

  // Ambient blobs
  blob: { position: 'absolute', borderRadius: 999 },
  blob1: {
    width: 200,
    height: 200,
    backgroundColor: authColors.shapePurple,
    top: '5%',
    right: -60,
  },
  blob2: {
    width: 120,
    height: 120,
    backgroundColor: authColors.shapeTeal,
    top: '30%',
    left: -40,
  },
  blob3: {
    width: 160,
    height: 160,
    backgroundColor: authColors.shapeBlue,
    top: '50%',
    left: -50,
  },
  blob4: {
    width: 100,
    height: 100,
    backgroundColor: authColors.shapeOrange,
    bottom: '20%',
    right: -20,
  },

  // Logo
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.85)',
  },

  // Headline
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -1,
    marginBottom: 4,
  },
  titleHighlight: {
    fontSize: 30,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  // Feature pills
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  // CTA
  ctaWrap: {
    alignSelf: 'stretch',
    marginBottom: 14,
  },
  ctaPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 17,
    borderRadius: 18,
    gap: 10,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: authColors.gradientMid,
    letterSpacing: -0.3,
  },
  ctaArrow: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: authColors.gradientBright + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hints
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 36,
  },
  timeText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
});
