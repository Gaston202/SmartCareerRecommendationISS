import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';
import { authColors } from './authTheme';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../api/supabase';
import { AppLogo } from '../../ui/AppLogo';

type AuthStackParamList = {
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
  const [isMentor, setIsMentor] = useState(false);
  const [mentorSpecialty, setMentorSpecialty] = useState('');
  const [mentorCompany, setMentorCompany] = useState('');
  const [mentorCvPath, setMentorCvPath] = useState<string | null>(null);

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
        role: isMentor ? 'mentor' : 'user',
        mentorSpecialty: isMentor ? mentorSpecialty.trim() || undefined : undefined,
        mentorCompany: isMentor ? mentorCompany.trim() || undefined : undefined,
        mentorCvUrl: isMentor ? mentorCvPath || undefined : undefined,
      });
      navigation.navigate('Login');
    } catch (error: unknown) {
      setGeneralError(error instanceof Error ? error.message : 'An error occurred during sign up');
    }
  };

  const busy = (state?.isLoading ?? false) || isSubmitting;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.mobileBrandWrap}>
              <AppLogo size={28} />
              <Text style={styles.mobileBrandText}>MyPath</Text>
            </View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Build your AI-powered career path from day one.</Text>

            <Text style={styles.roleLabel}>Choose your journey</Text>
            <View style={styles.roleGrid}>
              <Pressable
                onPress={() => setIsMentor(false)}
                style={[styles.roleCard, !isMentor && styles.roleCardActive]}
              >
                <View style={[styles.roleIcon, !isMentor && styles.roleIconActive]}>
                  <Ionicons name="school-outline" size={24} color={!isMentor ? '#fff' : authColors.textMuted} />
                </View>
                <Text style={[styles.roleTitle, !isMentor && styles.roleTitleActive]}>Student</Text>
                <Text style={styles.roleCaption}>Seeking Growth</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsMentor(true)}
                style={[styles.roleCard, isMentor && styles.roleCardActive]}
              >
                <View style={[styles.roleIcon, isMentor && styles.roleIconActive]}>
                  <Ionicons name="people-outline" size={24} color={isMentor ? '#fff' : authColors.textMuted} />
                </View>
                <Text style={[styles.roleTitle, isMentor && styles.roleTitleActive]}>Mentor</Text>
                <Text style={styles.roleCaption}>Guiding Others</Text>
              </Pressable>
            </View>

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

            {/* Mentor-only fields */}
            {isMentor && (
              <>
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Speciality</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons
                      name="briefcase-outline"
                      size={20}
                      color={authColors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. AI/Machine Learning"
                      placeholderTextColor={authColors.textMuted}
                      value={mentorSpecialty}
                      onChangeText={setMentorSpecialty}
                      editable={!busy}
                    />
                  </View>
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Where do you work currently?</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons
                      name="business-outline"
                      size={20}
                      color={authColors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Company or organization"
                      placeholderTextColor={authColors.textMuted}
                      value={mentorCompany}
                      onChangeText={setMentorCompany}
                      editable={!busy}
                    />
                  </View>
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Attach your CV (PDF)</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.inputWrap,
                      styles.cvUploadRow,
                      pressed && styles.buttonPressed,
                    ]}
                    disabled={busy}
                    onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: 'application/pdf',
                          multiple: false,
                          copyToCacheDirectory: true,
                        });
                        if (result.canceled) return;
                        const file = result.assets[0];
                        const path = `mentor-cvs/${Date.now()}-${file.name}`;
                        const { error } = await supabase.storage
                          .from('mentor_cvs')
                          .upload(path, {
                            uri: file.uri,
                            name: file.name,
                            type: file.mimeType || 'application/pdf',
                          } as any);
                        if (error) {
                          console.warn('[SignupScreen] CV upload failed', error);
                          return;
                        }
                        setMentorCvPath(path);
                      } catch (err) {
                        console.warn('[SignupScreen] CV pick error', err);
                      }
                    }}
                  >
                    <Text style={styles.cvUploadText}>
                      {mentorCvPath ? 'CV attached' : 'Tap to upload CV'}
                    </Text>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={20}
                      color={authColors.textMuted}
                    />
                  </Pressable>
                </View>
              </>
            )}

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
  container: { flex: 1, backgroundColor: authColors.pageBg },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  panel: {
    borderRadius: 28,
    backgroundColor: authColors.cardBg,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    shadowColor: authColors.cardShadowColor,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 6,
  },
  mobileBrandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 8,
  },
  mobileBrandText: {
    fontSize: 24,
    fontWeight: '900',
    color: authColors.buttonStart,
    letterSpacing: -0.7,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: authColors.textDark,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: authColors.textMuted,
    lineHeight: 22,
    marginBottom: 20,
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: authColors.textMuted,
    marginBottom: 12,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  roleCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: authColors.border,
  },
  roleCardActive: {
    backgroundColor: '#EDE9FE',
    borderColor: authColors.buttonStart,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: authColors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: authColors.cardShadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  roleIconActive: {
    backgroundColor: authColors.buttonStart,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: authColors.textDark,
    marginBottom: 2,
  },
  roleTitleActive: {
    color: authColors.buttonStart,
  },
  roleCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: authColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorWrap: { marginBottom: 12 },
  errorText: { fontSize: 13, color: '#DC2626' },
  fieldWrap: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: authColors.textDark,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.cardBg,
    borderWidth: 1.5,
    borderColor: authColors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
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
  buttonWrap: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  buttonPressed: { opacity: 0.9 },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: authColors.border },
  orText: { fontSize: 11, color: authColors.textMuted, marginHorizontal: 12, fontWeight: '700', letterSpacing: 1 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  signupPrompt: { fontSize: 14, color: authColors.textDark },
  signupLink: { fontSize: 14, color: authColors.link, fontWeight: '700' },
  terms: {
    fontSize: 12,
    color: authColors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 6,
  },
  cvUploadRow: {
    justifyContent: 'space-between',
  },
  cvUploadText: {
    flex: 1,
    fontSize: 14,
    color: authColors.textMuted,
    marginRight: 8,
  },
});
