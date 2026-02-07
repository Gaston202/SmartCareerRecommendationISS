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
import { authColors } from './authTheme';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

const signupSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupScreen({ navigation }: SignupScreenProps): React.ReactElement {
  const { signUp, state } = useAuth();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (anim: Animated.Value, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ])
      );
    loop(float1, 2800, 0).start();
    loop(float2, 3200, 400).start();
    loop(float3, 2600, 800).start();
    return () => {};
  }, [float1, float2, float3]);

  const t = (v: Animated.Value, y: number, x: number) => ({
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
    ],
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  });

  const onSubmit = async (data: SignupFormData): Promise<void> => {
    try {
      setGeneralError(null);
      await signUp(data.email.trim(), data.password, {
        fullName: data.fullName?.trim(),
        phone: data.phone?.trim() || undefined,
      });
      navigation.navigate('Login');
    } catch (error: unknown) {
      setGeneralError(error instanceof Error ? error.message : 'An error occurred during sign up');
    }
  };

  const busy = (state?.isLoading ?? false) || isSubmitting;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[authColors.gradientStart, authColors.gradientEnd]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.shape, styles.shapeCircle, t(float1, 14, 6)]} />
      <Animated.View style={[styles.shape, styles.shapeSquare1, t(float2, -12, -5)]} />
      <Animated.View style={[styles.shape, styles.shapeSquare2, t(float3, 10, 4)]} />

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
            <View style={styles.logoCircle}>
              <FontAwesome5 name="graduation-cap" size={26} color="#fff" />
            </View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start your career journey today</Text>

            {/* Upload placeholder - non-functional for now */}
            <Pressable style={styles.uploadArea}>
              <Ionicons name="camera-outline" size={28} color={authColors.textMuted} />
              <Text style={styles.uploadText}>Upload</Text>
            </Pressable>

            {generalError ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>{generalError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color={authColors.textMuted} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="fullName"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      placeholderTextColor={authColors.textMuted}
                      value={value ?? ''}
                      onChangeText={onChange}
                      editable={!busy}
                    />
                  )}
                />
              </View>
              {errors.fullName?.message ? (
                <Text style={styles.fieldError}>{errors.fullName.message}</Text>
              ) : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color={authColors.textMuted} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor={authColors.textMuted}
                      value={value ?? ''}
                      onChangeText={onChange}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!busy}
                    />
                  )}
                />
              </View>
              {errors.email?.message ? (
                <Text style={styles.fieldError}>{errors.email.message}</Text>
              ) : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={20} color={authColors.textMuted} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="phone"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      style={styles.input}
                      placeholder="+1 (555) 000-0000"
                      placeholderTextColor={authColors.textMuted}
                      value={value ?? ''}
                      onChangeText={onChange}
                      keyboardType="phone-pad"
                      editable={!busy}
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={authColors.textMuted} style={styles.inputIcon} />
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      style={[styles.input, styles.inputRight]}
                      placeholder="Enter your password"
                      placeholderTextColor={authColors.textMuted}
                      value={value ?? ''}
                      onChangeText={onChange}
                      secureTextEntry={!showPassword}
                      editable={!busy}
                    />
                  )}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeIcon} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={authColors.textMuted}
                  />
                </Pressable>
              </View>
              {errors.password?.message ? (
                <Text style={styles.fieldError}>{errors.password.message}</Text>
              ) : null}
            </View>

            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={busy}
              style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}
            >
              <LinearGradient
                colors={[authColors.buttonStart, authColors.buttonEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>{busy ? 'Creating account…' : 'Create Account'}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupPrompt}>Already have an account? </Text>
              <Pressable onPress={() => navigation.navigate('Login')} disabled={busy} hitSlop={8}>
                <Text style={styles.signupLink}>Sign In</Text>
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
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  shape: { position: 'absolute', borderRadius: 999 },
  shapeCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: authColors.shapeTeal,
    top: '12%',
    left: -60,
  },
  shapeSquare1: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: authColors.shapePurple,
    top: '6%',
    right: -30,
  },
  shapeSquare2: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: authColors.shapeTeal,
    bottom: '18%',
    left: -20,
  },
  card: {
    backgroundColor: authColors.cardBg,
    borderRadius: 24,
    padding: 28,
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
    backgroundColor: authColors.logoBg,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: authColors.textDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: authColors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadArea: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: authColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  uploadText: {
    fontSize: 12,
    color: authColors.textMuted,
    marginTop: 6,
  },
  errorWrap: { marginBottom: 12 },
  errorText: { fontSize: 13, color: '#DC2626' },
  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: authColors.textDark,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    color: authColors.textDark,
    paddingVertical: 12,
    paddingRight: 8,
  },
  inputRight: { paddingRight: 36 },
  eyeIcon: { position: 'absolute', right: 14 },
  fieldError: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  buttonWrap: { marginTop: 8, marginBottom: 20, borderRadius: 12, overflow: 'hidden' },
  buttonPressed: { opacity: 0.9 },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: authColors.border },
  orText: { fontSize: 12, color: authColors.textMuted, marginHorizontal: 12 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  signupPrompt: { fontSize: 14, color: authColors.textDark },
  signupLink: { fontSize: 14, color: authColors.link, fontWeight: '600' },
  terms: {
    fontSize: 12,
    color: authColors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 8,
  },
});
