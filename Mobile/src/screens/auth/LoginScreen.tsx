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
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';
import { authColors as colors } from './authTheme';
import { supabase } from '../../api/supabase';
import { AppLogo } from '../../ui/AppLogo';

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
  return 'An error occurred. Please try again.';
};

/**
 * Forgot Password modal using EMAIL OTP (6-digit code)
 * Flow:
 * 1) send OTP to email
 * 2) verify OTP
 * 3) update password
 */
function ForgotPasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailRef = useRef<TextInput | null>(null);
  const codeRef = useRef<TextInput | null>(null);

  const resetAll = () => {
    setStep('email');
    setBusy(false);
    setEmail('');
    setCode('');
    setNewPass('');
    setConfirmPass('');
    setShowNew(false);
    setShowConfirm(false);
  };

  const close = () => {
    Keyboard.dismiss();
    resetAll();
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      if (step === 'email') emailRef.current?.focus?.();
      if (step === 'verify') codeRef.current?.focus?.();
    }, 250);
    return () => clearTimeout(t);
  }, [visible, step]);

  const validateEmail = () => {
    const e = email.trim();
    if (!e) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return false;
    }
    // quick check
    if (!e.includes('@') || !e.includes('.')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const validateVerify = () => {
    if (!code.trim() || code.trim().length !== 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code.');
      return false;
    }
    if (!newPass || newPass.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return false;
    }
    if (confirmPass !== newPass) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return false;
    }
    return true;
  };

  const sendCode = async () => {
    if (!validateEmail()) return;

    setBusy(true);
    try {
      /**
       * This triggers Supabase Email OTP if enabled.
       * It may send a 6-digit code, depending on your Supabase Auth email settings.
       */
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false, // don’t create new users
        },
      });

      if (error) {
        Alert.alert('Could not send code', error.message);
        return;
      }

      setStep('verify');
      Alert.alert('Code sent ✅', 'Check your email for the 6-digit code.');
    } catch (e) {
      Alert.alert('Could not send code', parseAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const verifyAndUpdate = async () => {
    if (!validateVerify()) return;

    setBusy(true);
    try {
      /**
       * Verify the 6-digit code.
       * NOTE: Depending on supabase-js version/settings, `type` might need to be:
       * - 'email' (common for Email OTP)
       * - or 'magiclink'
       *
       * If you get "Invalid type" error, change type to 'magiclink'.
       */
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email' as any,
      });

      if (error) {
        Alert.alert('Invalid code', error.message);
        return;
      }

      // Now user is authenticated (session created), we can update password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPass,
      });

      if (updateErr) {
        Alert.alert('Could not update password', updateErr.message);
        return;
      }

      // Optional: sign out so they can log in normally with new password
      await supabase.auth.signOut();

      Alert.alert('Done ✅', 'Password updated. Please sign in with your new password.');
      close();
    } catch (e) {
      Alert.alert('Error', parseAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const onChangeCode = (t: string) => {
    // digits only, max 6
    const digits = t.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={fpStyles.root}>
          <View style={fpStyles.backdrop} />
          <TouchableWithoutFeedback>
            <View style={fpStyles.card}>
              <Text style={fpStyles.title}>Reset password</Text>
              <Text style={fpStyles.sub}>
                {step === 'email'
                  ? 'Enter your email and we’ll send a 6-digit code.'
                  : 'Enter the code and choose a new password.'}
              </Text>

              {step === 'email' ? (
                <>
                  <Text style={fpStyles.label}>Email</Text>
                  <View style={fpStyles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      ref={emailRef}
                      style={fpStyles.input}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!busy}
                      returnKeyType="done"
                      onSubmitEditing={() => !busy && sendCode()}
                    />
                  </View>

                  <View style={fpStyles.actions}>
                    <Pressable
                      style={[fpStyles.btnGhost, busy && fpStyles.disabled]}
                      onPress={close}
                      disabled={busy}
                    >
                      <Text style={fpStyles.btnGhostText}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      style={[fpStyles.btnPrimary, busy && fpStyles.disabled]}
                      onPress={sendCode}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={fpStyles.btnPrimaryText}>Send code</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={fpStyles.label}>6-digit code</Text>
                  <View style={fpStyles.inputWrap}>
                    <Ionicons name="key-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      ref={codeRef}
                      style={fpStyles.input}
                      placeholder="123456"
                      placeholderTextColor={colors.textMuted}
                      value={code}
                      onChangeText={onChangeCode}
                      keyboardType="number-pad"
                      editable={!busy}
                      maxLength={6}
                      returnKeyType="done"
                    />
                  </View>

                  <Text style={[fpStyles.label, { marginTop: 10 }]}>New password</Text>
                  <View style={fpStyles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[fpStyles.input, { paddingRight: 36 }]}
                      placeholder="New password"
                      placeholderTextColor={colors.textMuted}
                      value={newPass}
                      onChangeText={setNewPass}
                      secureTextEntry={!showNew}
                      editable={!busy}
                      autoCapitalize="none"
                    />
                    <Pressable
                      onPress={() => setShowNew((v) => !v)}
                      style={fpStyles.eye}
                      hitSlop={8}
                      disabled={busy}
                    >
                      <Ionicons
                        name={showNew ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>

                  <Text style={[fpStyles.label, { marginTop: 10 }]}>Confirm password</Text>
                  <View style={fpStyles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[fpStyles.input, { paddingRight: 36 }]}
                      placeholder="Confirm password"
                      placeholderTextColor={colors.textMuted}
                      value={confirmPass}
                      onChangeText={setConfirmPass}
                      secureTextEntry={!showConfirm}
                      editable={!busy}
                      autoCapitalize="none"
                    />
                    <Pressable
                      onPress={() => setShowConfirm((v) => !v)}
                      style={fpStyles.eye}
                      hitSlop={8}
                      disabled={busy}
                    >
                      <Ionicons
                        name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>

                  <View style={fpStyles.actions}>
                    <Pressable
                      style={[fpStyles.btnGhost, busy && fpStyles.disabled]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setBusy(false);
                        setStep('email');
                        setCode('');
                        setNewPass('');
                        setConfirmPass('');
                        setTimeout(() => emailRef.current?.focus?.(), 200);
                      }}
                      disabled={busy}
                    >
                      <Text style={fpStyles.btnGhostText}>Back</Text>
                    </Pressable>

                    <Pressable
                      style={[fpStyles.btnPrimary, busy && fpStyles.disabled]}
                      onPress={verifyAndUpdate}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={fpStyles.btnPrimaryText}>Update</Text>
                      )}
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={sendCode}
                    disabled={busy}
                    style={{ marginTop: 10, alignSelf: 'center' }}
                  >
                    <Text style={fpStyles.resend}>Resend code</Text>
                  </Pressable>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export function LoginScreen({ navigation }: LoginScreenProps): React.ReactElement {
  const { signIn, state } = useAuth();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fpOpen, setFpOpen] = useState(false);
  const [role, setRole] = useState<'student' | 'mentor'>('student');
  const [showLoginForm, setShowLoginForm] = useState(false);

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
      <ForgotPasswordModal visible={fpOpen} onClose={() => setFpOpen(false)} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.panel}>
            <View style={styles.mobileBrandWrap}>
              <AppLogo size={28} />
              <Text style={styles.mobileBrandText}>MyPath</Text>
            </View>

            <Text style={styles.title}>Welcome to MyPath</Text>
            <Text style={styles.subtitle}>Your AI-powered career navigator. Start your journey today.</Text>

            <Text style={styles.roleLabel}>Choose your journey</Text>
            <View style={styles.roleGrid}>
              <Pressable
                onPress={() => setRole('student')}
                style={[styles.roleCard, role === 'student' && styles.roleCardActive]}
              >
                <View style={[styles.roleIcon, role === 'student' && styles.roleIconActive]}>
                  <Ionicons name="school-outline" size={24} color={role === 'student' ? '#fff' : '#6B7280'} />
                </View>
                <Text style={[styles.roleTitle, role === 'student' && styles.roleTitleActive]}>Student</Text>
                <Text style={styles.roleCaption}>Seeking Growth</Text>
              </Pressable>

              <Pressable
                onPress={() => setRole('mentor')}
                style={[styles.roleCard, role === 'mentor' && styles.roleCardActive]}
              >
                <View style={[styles.roleIcon, role === 'mentor' && styles.roleIconActive]}>
                  <Ionicons name="people-outline" size={24} color={role === 'mentor' ? '#fff' : '#6B7280'} />
                </View>
                <Text style={[styles.roleTitle, role === 'mentor' && styles.roleTitleActive]}>Mentor</Text>
                <Text style={styles.roleCaption}>Guiding Others</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => navigation.navigate('Signup')}
              style={({ pressed }) => [styles.primaryCtaWrap, pressed && styles.buttonPressed]}
            >
              <LinearGradient
                colors={['#6437db', '#a98fff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryCta}
              >
                <Text style={styles.primaryCtaText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable
              onPress={() => setShowLoginForm((v) => !v)}
              style={({ pressed }) => [styles.secondaryCta, pressed && styles.secondaryCtaPressed]}
            >
              <Text style={styles.secondaryCtaText}>{showLoginForm ? 'Hide Login' : 'Log In'}</Text>
            </Pressable>

            {showLoginForm && (
              <View style={styles.formShell}>
                {generalError ? (
                  <View style={styles.errorWrap}>
                    <Text style={styles.errorText}>{generalError}</Text>
                  </View>
                ) : null}

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
                  {errors.email?.message ? <Text style={styles.fieldError}>{errors.email.message}</Text> : null}
                </View>

                <View style={styles.fieldWrap}>
                  <View style={styles.passwordLabelRow}>
                    <Text style={styles.label}>Password</Text>
                    <Pressable hitSlop={8} onPress={() => setFpOpen(true)} disabled={busy}>
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
                    <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeIcon} hitSlop={8} disabled={busy}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  {errors.password?.message ? <Text style={styles.fieldError}>{errors.password.message}</Text> : null}
                </View>

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
              </View>
            )}

            <Text style={styles.terms}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const fpStyles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,5,40,0.6)' },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.cardBg,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.cardShadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.textDark, letterSpacing: -0.4 },
  sub: { marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  label: { marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: '700', color: colors.textDark },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F5FF',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  input: { flex: 1, fontSize: 15.5, color: colors.textDark, paddingVertical: 12, marginLeft: 10, paddingRight: 8 },
  eye: { position: 'absolute', right: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'flex-end' },
  btnPrimary: {
    backgroundColor: colors.buttonStart,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnGhost: {
    backgroundColor: 'transparent',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { color: colors.textDark, fontWeight: '700', fontSize: 14 },
  resend: { color: colors.link, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.55 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  panel: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    shadowColor: colors.cardShadowColor,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 6,
  },
  mobileBrandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  mobileBrandText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.buttonStart,
    letterSpacing: -0.7,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 20,
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.textMuted,
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
    borderColor: '#EDE9FE',
  },
  roleCardActive: {
    backgroundColor: '#EDE9FE',
    borderColor: colors.buttonStart,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: colors.cardShadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  roleIconActive: {
    backgroundColor: colors.buttonStart,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textDark,
    marginBottom: 2,
  },
  roleTitleActive: {
    color: colors.buttonStart,
  },
  roleCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  primaryCtaWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    gap: 8,
  },
  primaryCtaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  secondaryCta: {
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#D4C5FF',
  },
  secondaryCtaPressed: {
    opacity: 0.85,
  },
  secondaryCtaText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.buttonStart,
    letterSpacing: -0.3,
  },
  formShell: {
    marginTop: 10,
    backgroundColor: '#F7F5FF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  errorWrap: { marginBottom: 12 },
  errorText: { fontSize: 13, color: '#DC2626' },
  fieldWrap: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotLink: { fontSize: 13, color: colors.link, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EDE9FE',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
    paddingVertical: 12,
    paddingRight: 8,
  },
  inputRight: { paddingRight: 36 },
  eyeIcon: { position: 'absolute', right: 14 },
  fieldError: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  buttonWrap: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  buttonPressed: { opacity: 0.9 },
  buttonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 8 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: '#EDE9FE' },
  orText: { fontSize: 11, color: colors.textMuted, marginHorizontal: 12, fontWeight: '700', letterSpacing: 1 },
  terms: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 6,
  },
});
