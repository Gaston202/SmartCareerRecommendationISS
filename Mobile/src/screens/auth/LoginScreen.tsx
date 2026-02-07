import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';
import { authColors as colors } from './authTheme';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

type LoginScreenProps = {
  navigation: LoginScreenNavigationProp;
};

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const parseAuthError = (error: unknown): string => {
  if (error instanceof Error) return error.message ?? 'An unexpected error occurred';
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if ('message' in errObj && typeof errObj.message === 'string') return errObj.message;
  }
  if (typeof error === 'string') return error;
  return 'An error occurred during login. Please try again.';
};

export function LoginScreen({ navigation }: LoginScreenProps): React.ReactElement {
  const { signIn, state } = useAuth();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Floating animation values for background shapes (different phases/durations)
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createFloatLoop = (animValue: Animated.Value, duration: number, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ])
      );
    };
    const a1 = createFloatLoop(float1, 2800, 0);
    const a2 = createFloatLoop(float2, 3200, 400);
    const a3 = createFloatLoop(float3, 2600, 800);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [float1, float2, float3]);

  const floatY1 = float1.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const floatX1 = float1.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const floatY2 = float2.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const floatX2 = float2.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const floatY3 = float3.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });
  const floatX3 = float3.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      setGeneralError(null);
      if (!data?.email || !data?.password) {
        setGeneralError('Email and password are required');
        return;
      }
      await signIn(data.email.trim(), data.password);
    } catch (error: unknown) {
      setGeneralError(parseAuthError(error));
    }
  };

  const busy = (state?.isLoading ?? false) || isSubmitting;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFill}
      />
      {/* Decorative shapes with floating animation */}
      <Animated.View
        style={[
          styles.shape,
          styles.shapeCircle,
          { transform: [{ translateY: floatY1 }, { translateX: floatX1 }] },
        ]}
      />
      <Animated.View
        style={[
          styles.shape,
          styles.shapeSquare1,
          { transform: [{ translateY: floatY2 }, { translateX: floatX2 }] },
        ]}
      />
      <Animated.View
        style={[
          styles.shape,
          styles.shapeSquare2,
          { transform: [{ translateY: floatY3 }, { translateX: floatX3 }] },
        ]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Logo */}
            <View style={styles.logoCircle}>
              <FontAwesome5 name="graduation-cap" size={26} color="#fff" />
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your career journey</Text>

            {generalError ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>{generalError}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={value ?? ''}
                      onChangeText={onChange}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!busy}
                      testID="email-input"
                    />
                  )}
                />
              </View>
              {errors.email?.message ? (
                <Text style={styles.fieldError}>{errors.email.message}</Text>
              ) : null}
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>Password</Text>
                <Pressable hitSlop={8}>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </Pressable>
              </View>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      style={[styles.input, styles.inputRight]}
                      placeholder="Enter your password"
                      placeholderTextColor={colors.textMuted}
                      value={value ?? ''}
                      onChangeText={onChange}
                      secureTextEntry={!showPassword}
                      editable={!busy}
                      testID="password-input"
                    />
                  )}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeIcon}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              {errors.password?.message ? (
                <Text style={styles.fieldError}>{errors.password.message}</Text>
              ) : null}
            </View>

            {/* Sign In button */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={busy}
              style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}
              testID="login-button"
            >
              <LinearGradient
                colors={[colors.buttonStart, colors.buttonEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>{busy ? 'Signing in…' : 'Sign In'}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>

            {/* OR */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            {/* Sign up link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupPrompt}>Don't have an account? </Text>
              <Pressable
                onPress={() => navigation?.navigate?.('Signup')}
                disabled={busy}
                hitSlop={8}
                testID="signup-link"
              >
                <Text style={styles.signupLink}>Sign Up</Text>
              </Pressable>
            </View>

            <Text style={styles.terms}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  shape: {
    position: 'absolute',
    borderRadius: 999,
  },
  shapeCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.shapeTeal,
    top: '18%',
    left: -60,
  },
  shapeSquare1: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: colors.shapePurple,
    top: '8%',
    right: -30,
  },
  shapeSquare2: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: colors.shapeTeal,
    bottom: '22%',
    left: -20,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: 28,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.logoBg,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorWrap: {
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
  },
  fieldWrap: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotLink: {
    fontSize: 13,
    color: colors.link,
    fontWeight: '500',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
    paddingVertical: 12,
    paddingRight: 8,
  },
  inputRight: {
    paddingRight: 36,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
  },
  fieldError: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  buttonWrap: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: 12,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  signupPrompt: {
    fontSize: 14,
    color: colors.textDark,
  },
  signupLink: {
    fontSize: 14,
    color: colors.link,
    fontWeight: '600',
  },
  terms: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 8,
  },
});
