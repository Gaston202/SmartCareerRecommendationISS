// ProfileScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  StatusBar,
  Modal,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller, FieldPath, type Control } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../auth/AuthProvider";
import { getMyUserRow, updateMyUserRow } from "../api/profile";
import { supabase } from "../api/supabase";
import { useCvAnalysis } from "../features/cv";

// ✅ Option A (NO QR CODE): Uses Expo Print + Sharing
// Make sure you installed:
// 1) npx expo install expo-print expo-sharing
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// ------------------- Home Theme -------------------
import { homeColors } from "./homeTheme";
const HOME = homeColors;

const COLORS = {
  bgStart: HOME.backgroundStart,
  bgEnd: HOME.backgroundEnd,
  bgMuted: HOME.backgroundMuted,

  surface: HOME.cardBg,
  card: HOME.cardBg,
  card2: HOME.cardBg,
  border: HOME.cardBorder,

  text: HOME.textDark,
  sub: HOME.textMuted,
  muted: HOME.textLight,

  primary: HOME.primary,
  primary2: HOME.primaryLight,
  primaryDark: HOME.primaryDark,

  danger: "#DC2626",
  warning: "#FFB020",
  success: "#34D399",

  inputBg: "#FFFFFF",
  chipBg: "rgba(124,77,255,0.10)",
  chipBorder: "rgba(124,77,255,0.22)",
};

// ------------------- Schema -------------------
const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  email: z.string().trim().email("Please enter a valid email"),
  educationLevel: z.string().trim().optional().or(z.literal("")),
  fieldOfStudy: z.string().trim().optional().or(z.literal("")),
  skills: z.string().trim().optional(),
  careerGoal: z.string().trim().optional(),
  bio: z.string().trim().max(220, "Bio is too long (max 220 chars)").optional(),
  photoUrl: z
    .string()
    .trim()
    .url("Photo must be a valid URL (https://...)")
    .optional()
    .or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type FieldName = FieldPath<ProfileFormData>;

type InputConfig = {
  name: FieldPath<ProfileFormData>;
  label: string;
  placeholder?: string;
  readOnly?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "url";
  autoCapitalize?: "none" | "words" | "sentences";
  helper?: string;
  textContentType?:
    | "name"
    | "emailAddress"
    | "none"
    | "URL"
    | "nickname"
    | "jobTitle"
    | "organizationName";
  autoComplete?:
    | "name"
    | "email"
    | "off"
    | "nickname"
    | "url"
    | "organization"
    | "job-title";
  icon?: keyof typeof Ionicons.glyphMap | null; // ✅ Ionicon names
};

const INPUTS: InputConfig[] = [
  {
    name: "fullName",
    label: "Full Name",
    placeholder: "Enter your full name",
    autoCapitalize: "words",
    textContentType: "name",
    autoComplete: "name",
    icon: "person-outline",
  },
  {
    name: "email",
    label: "Email",
    placeholder: "name@example.com",
    readOnly: true,
    keyboardType: "email-address",
    autoCapitalize: "none",
    helper: "Email is read-only (change it from account settings).",
    textContentType: "emailAddress",
    autoComplete: "email",
    icon: "mail-outline",
  },
  {
    name: "educationLevel",
    label: "Education Level (optional)",
    placeholder: "e.g., High School, Bachelor, Master",
    autoCapitalize: "words",
    textContentType: "none",
    autoComplete: "off",
    icon: "school-outline",
  },
  {
    name: "fieldOfStudy",
    label: "Field of Study (optional)",
    placeholder: "e.g., Computer Science",
    autoCapitalize: "words",
    textContentType: "none",
    autoComplete: "off",
    icon: "book-outline",
  },
  {
    name: "careerGoal",
    label: "Career Goal (optional)",
    placeholder: "e.g., Cybersecurity Engineer",
    multiline: true,
    autoCapitalize: "sentences",
    textContentType: "jobTitle",
    autoComplete: "job-title",
    icon: "briefcase-outline",
  },
  {
    name: "skills",
    label: "Skills (optional, comma-separated)",
    placeholder: "e.g., Java, Python, React, SQL",
    multiline: true,
    autoCapitalize: "sentences",
    helper: "Tip: write skills separated by commas.",
    textContentType: "none",
    autoComplete: "off",
    icon: "sparkles-outline",
  },
  {
    name: "bio",
    label: "Bio (optional, max 220 chars)",
    placeholder: "Write a short bio",
    multiline: true,
    autoCapitalize: "sentences",
    textContentType: "none",
    autoComplete: "off",
    icon: "document-text-outline",
  },
  {
    name: "photoUrl",
    label: "Photo URL (optional)",
    placeholder: "https://...",
    keyboardType: "url",
    autoCapitalize: "none",
    helper: "Paste an image link (must be valid URL).",
    textContentType: "URL",
    autoComplete: "url",
    icon: "image-outline",
  },
];

// ------------------- Small UI helpers -------------------
const Chip = React.memo(function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
});

const Pill = React.memo(function Pill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
});

const ProgressBar = React.memo(function ProgressBar({
  value01,
}: {
  value01: number;
}) {
  const widthPct = Math.max(0, Math.min(1, value01)) * 100;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${widthPct}%` }]} />
    </View>
  );
});

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

function parseSkills(raw?: string) {
  if (!raw) return [];
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, " "))
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 16);
}

function completeness(data: ProfileFormData) {
  const keys: (keyof ProfileFormData)[] = [
    "fullName",
    "email",
    "educationLevel",
    "fieldOfStudy",
    "careerGoal",
    "skills",
    "bio",
    "photoUrl",
  ];
  const filled = keys.filter((k) => String(data[k] ?? "").trim().length > 0)
    .length;
  return filled / keys.length;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeList(raw?: string) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 18);
}

function FormField({
  control,
  name,
  label,
  placeholder,
  editable,
  readOnly = false,
  multiline = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  helper,
  inputRef,
  onSubmitEditing,
  textContentType,
  autoComplete,
  icon,
}: {
  control: Control<ProfileFormData>;
  name: FieldPath<ProfileFormData>;
  label: string;
  placeholder?: string;
  editable: boolean;
  readOnly?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "url";
  autoCapitalize?: "none" | "words" | "sentences";
  helper?: string;
  inputRef?: (ref: TextInput | null) => void;
  onSubmitEditing?: () => void;
  textContentType?: InputConfig["textContentType"];
  autoComplete?: InputConfig["autoComplete"];
  icon?: keyof typeof Ionicons.glyphMap | null;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => {
        const isEditable = editable && !readOnly;

        const isPrimaryIdentityField = name === "fullName" || name === "email";
        const blurIdentity = isPrimaryIdentityField && !editable;

        return (
          <View style={styles.field}>
            <View style={styles.labelRow}>
              {!!icon ? (
                <Ionicons
                  name={icon}
                  size={16}
                  color={focused && isEditable ? COLORS.primary : COLORS.sub}
                  style={styles.labelIcon}
                />
              ) : null}
              <Text style={styles.label}>{label}</Text>
            </View>

            <View
              style={[
                styles.inputShell,
                focused && isEditable && styles.inputShellFocused,
                !isEditable && styles.inputShellDisabled,
                blurIdentity && styles.inputShellBlurred,
                error && styles.inputShellError,
                multiline && styles.inputShellMultiline,
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  blurIdentity && styles.inputBlurredText,
                  !isEditable && styles.inputDisabledText,
                  multiline && styles.inputMultiline,
                ]}
                value={String(value ?? "")}
                onChangeText={(txt) => onChange(txt)}
                onBlur={() => {
                  setFocused(false);
                  onBlur();
                }}
                onFocus={() => setFocused(true)}
                placeholder={placeholder}
                placeholderTextColor={COLORS.muted}
                editable={isEditable}
                multiline={multiline}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                autoCorrect={!readOnly}
                returnKeyType={!multiline ? "next" : "default"}
                blurOnSubmit={!multiline}
                onSubmitEditing={onSubmitEditing}
                textContentType={textContentType as any}
                autoComplete={autoComplete as any}
                accessibilityLabel={label}
              />
            </View>

            {!!helper && !error?.message && (
              <Text style={styles.helper}>{helper}</Text>
            )}
            {!!error?.message && (
              <Text style={styles.errorText}>{error.message}</Text>
            )}
          </View>
        );
      }}
    />
  );
}

// ------------------- Change Password Modal -------------------
type CPErrorState = Partial<{
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}>;

function ChangePasswordModal({
  visible,
  onClose,
  email,
}: {
  visible: boolean;
  onClose: () => void;
  email: string;
}) {
  const [step, setStep] = useState<"verify" | "update">("verify");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<CPErrorState>({});

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ✅ store typed values WITHOUT controlling the TextInput (fix Android secureTextEntry issues)
  const valuesRef = useRef<{ current: string; next: string; confirm: string }>(
    { current: "", next: "", confirm: "" }
  );

  const currentRef = useRef<TextInput | null>(null);
  const newRef = useRef<TextInput | null>(null);
  const confirmRef = useRef<TextInput | null>(null);

  const clearInputs = () => {
    currentRef.current?.clear?.();
    newRef.current?.clear?.();
    confirmRef.current?.clear?.();
    valuesRef.current = { current: "", next: "", confirm: "" };
  };

  const resetAll = () => {
    setStep("verify");
    setSaving(false);
    setErrors({});
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    clearInputs();
  };

  const close = () => {
    Keyboard.dismiss();
    resetAll();
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      if (step === "verify") currentRef.current?.focus?.();
      if (step === "update") newRef.current?.focus?.();
    }, 180);
    return () => clearTimeout(t);
  }, [visible, step]);

  const validateVerify = () => {
    const e: CPErrorState = {};
    if (!valuesRef.current.current.trim()) {
      e.currentPassword = "Please enter your current password";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateUpdate = () => {
    const e: CPErrorState = {};
    const np = valuesRef.current.next ?? "";
    const cp = valuesRef.current.confirm ?? "";

    if (!np.trim()) e.newPassword = "Please enter a new password";
    else if (np.length < 6)
      e.newPassword = "New password must be at least 6 characters";

    if (!cp.trim()) e.confirmPassword = "Please confirm your new password";
    else if (cp !== np) e.confirmPassword = "Passwords do not match";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const verifyOldPassword = async () => {
    if (!validateVerify()) return;

    setSaving(true);
    try {
      if (!email?.trim()) {
        setErrors({
          currentPassword: "Email not found. Please reload your profile.",
        });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: valuesRef.current.current,
      });

      if (error) {
        setErrors({ currentPassword: "Incorrect password. Please try again." });
        return;
      }

      setErrors({});
      setStep("update");
    } catch {
      setErrors({
        currentPassword: "Could not verify password. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveNewPassword = async () => {
    if (!validateUpdate()) return;

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: valuesRef.current.next,
      });

      if (error) {
        setErrors({ newPassword: error.message || "Could not update password." });
        return;
      }

      Alert.alert("Password updated ✅", "Your password has been changed successfully.");
      close();
    } catch {
      setErrors({ newPassword: "Could not update password. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const clearError = (key: keyof CPErrorState) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const PasswordField = ({
    label,
    error,
    inputRef,
    secure,
    show,
    setShow,
    onChangeValue,
    onSubmitEditing,
    returnKeyType,
    onFocusClearError,
  }: {
    label: string;
    error?: string;
    inputRef?: (r: TextInput | null) => void;
    secure: boolean;
    show: boolean;
    setShow: (v: boolean) => void;
    onChangeValue: (txt: string) => void;
    onSubmitEditing?: () => void;
    returnKeyType?: "done" | "next";
    onFocusClearError?: () => void;
  }) => {
    return (
      <View style={{ marginTop: 12 }}>
        <Text style={styles.modalLabel}>{label}</Text>

        <View
          style={[
            styles.modalInputRow,
            error && { borderColor: "rgba(220,38,38,0.45)" },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={styles.modalInputFlex}
            defaultValue=""
            onChangeText={onChangeValue}
            onFocus={onFocusClearError}
            placeholder="••••••••"
            placeholderTextColor={COLORS.muted}
            secureTextEntry={secure && !show}
            editable={!saving}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            returnKeyType={returnKeyType ?? "done"}
            onSubmitEditing={onSubmitEditing}
            keyboardType="default"
            textContentType="none"
          />

          <Pressable
            style={styles.showBtn}
            onPress={() => setShow(!show)}
            disabled={saving}
          >
            <Text style={styles.showBtnText}>{show ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>

        {!!error && <Text style={styles.modalError}>{error}</Text>}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={close}
    >
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.modalRoot}>
          <View style={styles.modalBackdrop} />
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalCenter}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <Text style={styles.modalSubtitle}>
                  {step === "verify"
                    ? "Enter your current password to continue."
                    : "Choose a strong new password and confirm it."}
                </Text>

                {step === "verify" ? (
                  <>
                    <PasswordField
                      label="Current Password"
                      error={errors.currentPassword}
                      inputRef={(r) => (currentRef.current = r)}
                      secure
                      show={showCurrent}
                      setShow={setShowCurrent}
                      onFocusClearError={() => clearError("currentPassword")}
                      onChangeValue={(t) => {
                        valuesRef.current.current = t;
                      }}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (!saving) verifyOldPassword();
                      }}
                    />

                    <View style={styles.modalActions}>
                      <Pressable
                        style={[styles.modalBtnGhost, saving && styles.btnDisabled]}
                        onPress={close}
                        disabled={saving}
                      >
                        <Text style={styles.modalBtnGhostText}>Cancel</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.modalBtnPrimary, saving && styles.btnDisabled]}
                        onPress={verifyOldPassword}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator />
                        ) : (
                          <Text style={styles.modalBtnPrimaryText}>Continue</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <PasswordField
                      label="New Password"
                      error={errors.newPassword}
                      inputRef={(r) => (newRef.current = r)}
                      secure
                      show={showNew}
                      setShow={setShowNew}
                      onFocusClearError={() => clearError("newPassword")}
                      onChangeValue={(t) => {
                        valuesRef.current.next = t;
                      }}
                      returnKeyType="next"
                      onSubmitEditing={() => confirmRef.current?.focus?.()}
                    />

                    <PasswordField
                      label="Confirm New Password"
                      error={errors.confirmPassword}
                      inputRef={(r) => (confirmRef.current = r)}
                      secure
                      show={showConfirm}
                      setShow={setShowConfirm}
                      onFocusClearError={() => clearError("confirmPassword")}
                      onChangeValue={(t) => {
                        valuesRef.current.confirm = t;
                      }}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (!saving) saveNewPassword();
                      }}
                    />

                    <View style={styles.modalActions}>
                      <Pressable
                        style={[styles.modalBtnGhost, saving && styles.btnDisabled]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setErrors({});
                          setStep("verify");
                          newRef.current?.clear?.();
                          confirmRef.current?.clear?.();
                          valuesRef.current.next = "";
                          valuesRef.current.confirm = "";
                          setTimeout(() => currentRef.current?.focus?.(), 180);
                        }}
                        disabled={saving}
                      >
                        <Text style={styles.modalBtnGhostText}>Back</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.modalBtnPrimary, saving && styles.btnDisabled]}
                        onPress={saveNewPassword}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator />
                        ) : (
                          <Text style={styles.modalBtnPrimaryText}>Save</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ------------------- Main Screen -------------------
export default function ProfileScreen() {
  const { signOut } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [savedProfile, setSavedProfile] = useState<ProfileFormData>({
    fullName: "",
    email: "",
    educationLevel: "",
    fieldOfStudy: "",
    skills: "",
    careerGoal: "",
    bio: "",
    photoUrl: "",
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty, isValid },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: savedProfile,
    mode: "onChange",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const { authEmail, row } = await getMyUserRow();

        const mapped: ProfileFormData = {
          fullName: row?.name ?? "",
          email: authEmail ?? row?.email ?? "",
          educationLevel: row?.education_level ?? "",
          fieldOfStudy: row?.field_of_study ?? "",
          skills: row?.skills ?? "",
          careerGoal: row?.career_goal ?? "",
          bio: row?.bio ?? "",
          photoUrl: row?.photo_url ?? "",
        };

        if (!alive) return;
        setSavedProfile(mapped);
        reset(mapped);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load profile";
        Alert.alert("Error", msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [reset]);

  const watchedValues = watch([
    "fullName",
    "email",
    "educationLevel",
    "fieldOfStudy",
    "careerGoal",
    "skills",
    "bio",
    "photoUrl",
  ]);

  const watched: ProfileFormData = useMemo(
    () => ({
      fullName: watchedValues[0] ?? "",
      email: watchedValues[1] ?? "",
      educationLevel: watchedValues[2] ?? "",
      fieldOfStudy: watchedValues[3] ?? "",
      careerGoal: watchedValues[4] ?? "",
      skills: watchedValues[5] ?? "",
      bio: watchedValues[6] ?? "",
      photoUrl: watchedValues[7] ?? "",
    }),
    [watchedValues]
  );

  const skillsList = useMemo(() => parseSkills(watched.skills), [watched.skills]);
  const { data: cvAnalysis, isLoading: cvAnalysisLoading } = useCvAnalysis();
  const cvExtractedSkills = useMemo(() => {
    const raw = [
      ...(cvAnalysis?.extracted_skills ?? []),
      ...(cvAnalysis?.skills_extracted ?? []),
      ...(cvAnalysis?.skills ?? []),
    ];

    const seen = new Set<string>();
    return raw
      .map((s) => String(s ?? "").trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s+/g, " "))
      .filter((s) => {
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 24);
  }, [cvAnalysis]);
  const progress = useMemo(() => completeness(watched), [watched]);

  const inputRefs = useRef<Partial<Record<FieldName, TextInput | null>>>({});
  const orderedNames = useMemo(() => INPUTS.map((i) => i.name), []);

  const focusNext = (currentName: FieldName) => {
    const idx = orderedNames.indexOf(currentName);
    if (idx === -1) return;

    let j = idx + 1;
    while (j < INPUTS.length && INPUTS[j].readOnly) j++;
    const target = INPUTS[j]?.name;

    if (target && inputRefs.current[target]?.focus) {
      inputRefs.current[target]?.focus();
    }
  };

  const enterEditMode = () => {
    setEditMode(true);
    reset(savedProfile);
  };

  const cancelEdit = () => {
    if (isDirty) {
      Alert.alert("Discard changes?", "Your edits will be lost.", [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setEditMode(false);
            reset(savedProfile);
          },
        },
      ]);
      return;
    }

    setEditMode(false);
    reset(savedProfile);
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setSaving(true);

      // ✅ Save all profile fields to database
      await updateMyUserRow({
        name: data.fullName,
        avatar: data.photoUrl?.trim() ? data.photoUrl : null,
        bio: data.bio?.trim() ? data.bio : null,
        education_level: data.educationLevel?.trim() ? data.educationLevel : null,
        field_of_study: data.fieldOfStudy?.trim() ? data.fieldOfStudy : null,
        skills: data.skills?.trim() ? data.skills : null,
        career_goal: data.careerGoal?.trim() ? data.careerGoal : null,
      });

      setSavedProfile(data);
      reset(data);
      setEditMode(false);
      Alert.alert("Saved", "Your profile has been updated ✅");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save profile";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const pickImageIfAvailable = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow gallery access to pick a profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setValue("photoUrl", uri, { shouldDirty: true, shouldValidate: true });
      }
    } catch {
      Alert.alert(
        "Gallery picker not installed",
        "Install it with: npx expo install expo-image-picker\n(or just paste a Photo URL)."
      );
    }
  };

  const handleLogout = async () => {
    try {
      Alert.alert("Log Out", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              const msg = error instanceof Error ? error.message : "Logout failed";
              Alert.alert("Error", msg);
            }
          },
        },
      ]);
    } catch {
      Alert.alert("Error", "Failed to process logout");
    }
  };

  // ✅ Option A export: generate HTML -> PDF -> share
  const exportProfilePdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // If user is editing, export the "current" watched values
      const p = watched;

      const skillItems = normalizeList(p.skills)
        .map((s) => `<span class="pill">${escapeHtml(s)}</span>`)
        .join("");

      const safeBio = escapeHtml(p.bio || "—");
      const safeGoal = escapeHtml(p.careerGoal || "—");
      const safeName = escapeHtml(p.fullName || "—");
      const safeEmail = escapeHtml(p.email || "—");
      const safeEdu = escapeHtml(p.educationLevel || "—");
      const safeField = escapeHtml(p.fieldOfStudy || "—");

      const strength = Math.round(completeness(p) * 100);

      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root{
    --bg1:${COLORS.bgStart};
    --bg2:${COLORS.bgEnd};
    --card:${COLORS.surface};
    --border:${COLORS.border};
    --text:${COLORS.text};
    --muted:${COLORS.sub};
    --muted2:${COLORS.muted};
    --p:${COLORS.primary};
    --pd:${COLORS.primaryDark};
  }
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;}
  body{
    margin:0;
    padding:0;
    background: linear-gradient(180deg,var(--bg1),var(--bg2));
    color:var(--text);
  }
  .page{
    padding:28px;
  }
  .header{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:16px;
    margin-bottom:14px;
  }
  .title{
    font-size:26px;
    font-weight:900;
    margin:0;
    letter-spacing:.2px;
  }
  .subtitle{
    margin-top:6px;
    color:var(--muted);
    font-size:13px;
    line-height:18px;
    max-width:420px;
  }
  .badge{
    background: rgba(124,77,255,.12);
    border:1px solid rgba(124,77,255,.22);
    padding:10px 12px;
    border-radius:14px;
    text-align:right;
    min-width:160px;
  }
  .badge strong{display:block;font-size:18px;color:var(--pd)}
  .card{
    background: var(--card);
    border:1px solid var(--border);
    border-radius:18px;
    padding:16px;
    margin-top:12px;
  }
  .row{display:flex;gap:14px;align-items:center}
  .avatar{
    width:72px;height:72px;border-radius:18px;
    background: rgba(124,77,255,.14);
    border:1px solid rgba(124,77,255,.18);
    display:flex;align-items:center;justify-content:center;
    font-weight:900;font-size:22px;color:var(--pd);
    flex:0 0 auto;
    overflow:hidden;
  }
  .avatar img{width:100%;height:100%;object-fit:cover}
  .name{font-weight:900;font-size:18px;margin:0}
  .email{margin-top:4px;color:var(--muted);font-size:12.5px}
  .meter{
    margin-top:10px;
  }
  .track{
    height:10px;border-radius:999px;
    background: rgba(31,41,55,.08);
    border:1px solid var(--border);
    overflow:hidden;
  }
  .fill{height:100%;width:${strength}%;background:var(--p);border-radius:999px}
  .kv{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
    margin-top:14px;
  }
  .kvItem{
    background: ${COLORS.bgMuted};
    border:1px solid var(--border);
    border-radius:14px;
    padding:10px;
  }
  .kvItem .k{color:var(--muted2);font-size:11px;font-weight:800}
  .kvItem .v{margin-top:6px;font-weight:900;font-size:12.5px}
  .sectionTitle{
    margin:0 0 10px 0;
    font-size:14px;
    font-weight:900;
  }
  .pill{
    display:inline-block;
    background: rgba(124,77,255,.10);
    border:1px solid rgba(124,77,255,.22);
    color: var(--pd);
    padding:6px 10px;
    border-radius:999px;
    font-weight:900;
    font-size:12px;
    margin:4px 6px 0 0;
    white-space:nowrap;
  }
  .block{
    background: #fff;
    border:1px solid var(--border);
    border-radius:14px;
    padding:12px;
  }
  .block .k{color:var(--muted);font-size:12px;font-weight:900}
  .block .v{margin-top:6px;font-size:13px;line-height:18px}
  .footer{
    margin-top:18px;
    color:var(--muted);
    font-size:11px;
    text-align:center;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <h1 class="title">Profile Export</h1>
        <div class="subtitle">A beautifully formatted snapshot of your MyPath profile.</div>
      </div>
      <div class="badge">
        <div style="color:var(--muted);font-size:12px;font-weight:900;">Profile strength</div>
        <strong>${strength}%</strong>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <div class="avatar">
          ${
            p.photoUrl?.trim()
              ? `<img src="${escapeHtml(p.photoUrl.trim())}" />`
              : `${escapeHtml(initialsFromName(p.fullName || "User"))}`
          }
        </div>
        <div style="flex:1">
          <p class="name">${safeName}</p>
          <div class="email">${safeEmail}</div>

          <div class="meter">
            <div style="color:var(--muted);font-size:12.5px;">
              Profile strength: <span style="color:var(--pd);font-weight:900">${strength}%</span>
            </div>
            <div class="track"><div class="fill"></div></div>
          </div>
        </div>
      </div>

      <div class="kv">
        <div class="kvItem">
          <div class="k">Education</div>
          <div class="v">${safeEdu}</div>
        </div>
        <div class="kvItem">
          <div class="k">Field of Study</div>
          <div class="v">${safeField}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="sectionTitle">Skills</div>
      <div>${skillItems || `<span style="color:var(--muted)">—</span>`}</div>
    </div>

    <div class="card">
      <div class="sectionTitle">Career Goal</div>
      <div class="block">
        <div class="k">Goal</div>
        <div class="v">${safeGoal}</div>
      </div>

      <div style="height:10px"></div>

      <div class="sectionTitle">Bio</div>
      <div class="block">
        <div class="k">About</div>
        <div class="v">${safeBio}</div>
      </div>
    </div>

    <div class="footer">
      Generated from MyPath • ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
      `;

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share your profile PDF",
          UTI: "com.adobe.pdf",
        });
      } else {
        // fallback for environments where Sharing isn't available
        await Share.share({ url: uri, message: "Your profile PDF is ready." });
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Could not export PDF.");
    } finally {
      setExporting(false);
    }
  };

  const avatarUri = watched.photoUrl?.trim();
  const initials = initialsFromName(watched.fullName || "User");

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient
          colors={[COLORS.bgStart, COLORS.bgEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBg}
        >
          <View style={{ padding: 16 }}>
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>
              Loading profile…
            </Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      <LinearGradient
        colors={[COLORS.bgStart, COLORS.bgEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        <ChangePasswordModal
          visible={changePwdOpen}
          onClose={() => setChangePwdOpen(false)}
          email={watched.email || savedProfile.email}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.headerContent}>
                <Text style={styles.pageTitle}>My Profile</Text>
                <Text style={styles.pageSubtitle}>
                  Complete your profile to unlock personalized career insights
                </Text>
              </View>

              {!editMode ? (
                <Pressable style={styles.editBtn} onPress={enterEditMode}>
                  <Ionicons name="create-outline" size={18} color="white" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              ) : (
                <View style={styles.headerActions}>
                  <Pressable
                    style={[
                      styles.saveBtn,
                      (!isDirty || !isValid || saving) && styles.btnDisabled,
                    ]}
                    disabled={!isDirty || !isValid || saving}
                    onPress={handleSubmit(onSubmit)}
                  >
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color="white"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.saveBtnText}>
                      {saving ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.cancelBtn}
                    onPress={cancelEdit}
                    disabled={saving}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Profile Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.profileTop}>
                <View style={styles.avatarWrap}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{watched.fullName || "Your Name"}</Text>
                  <Text style={styles.profileEmail}>{watched.email || "email@example.com"}</Text>

                  {/* Profile Strength */}
                  <View style={styles.strengthSection}>
                    <View style={styles.strengthLabel}>
                      <Text style={styles.strengthLabelText}>Profile strength</Text>
                      <Text style={styles.strengthValue}>
                        {Math.round(progress * 100)}%
                      </Text>
                    </View>
                    <ProgressBar value01={progress} />
                  </View>
                </View>
              </View>

              {/* Profile Info Pills */}
              <View style={styles.infoGrid}>
                <View style={styles.infoPill}>
                  <View style={styles.infoPillIcon}>
                    <Ionicons name="school-outline" size={16} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoPillLabel}>Education</Text>
                    <Text style={styles.infoPillValue} numberOfLines={1}>
                      {watched.educationLevel || "Not set"}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoPill}>
                  <View style={styles.infoPillIcon}>
                    <Ionicons name="book-outline" size={16} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoPillLabel}>Field of Study</Text>
                    <Text style={styles.infoPillValue} numberOfLines={1}>
                      {watched.fieldOfStudy || "Not set"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActionsRow}>
                <Pressable
                  style={[styles.quickActionBtn, !editMode && styles.quickActionBtnDisabled]}
                  disabled={!editMode}
                  onPress={pickImageIfAvailable}
                >
                  <Ionicons
                    name="image-outline"
                    size={18}
                    color={editMode ? COLORS.primary : COLORS.muted}
                  />
                  <Text
                    style={[
                      styles.quickActionText,
                      !editMode && { color: COLORS.muted },
                    ]}
                  >
                    Update Photo
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Skills Section */}
            {!editMode && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.sectionTitle}>Skills</Text>
                </View>

                <View style={styles.skillsSubsection}>
                  <Text style={styles.skillsSubheading}>Extracted from your CV</Text>
                  {cvAnalysisLoading ? (
                    <Text style={styles.skillsSubHint}>Loading CV skills...</Text>
                  ) : cvExtractedSkills.length === 0 ? (
                    <Text style={styles.skillsSubHint}>
                      No CV skills yet. Upload and analyze your CV to see extracted skills here.
                    </Text>
                  ) : (
                    <View style={styles.skillsGrid}>
                      {cvExtractedSkills.map((s) => (
                        <View key={`cv-${s}`} style={styles.cvSkillTag}>
                          <Text style={styles.cvSkillTagText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {skillsList.length > 0 && (
                  <View style={styles.skillsSubsection}>
                    <Text style={styles.skillsSubheading}>Added in profile</Text>
                    <View style={styles.skillsGrid}>
                      {skillsList.map((s) => (
                        <View key={s} style={styles.skillTag}>
                          <Text style={styles.skillTagText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {skillsList.length === 0 && cvExtractedSkills.length === 0 && !cvAnalysisLoading && (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptyText}>Add skills or upload a CV to boost your profile</Text>
                  </View>
                )}
              </View>
            )}

            {/* Form Section */}
            <View style={styles.formCard}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name={editMode ? "create-outline" : "information-outline"}
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.sectionTitle}>Profile Details</Text>
                {!editMode ? (
                  <View style={styles.viewModeBadge}>
                    <Ionicons name="lock-closed-outline" size={12} color={COLORS.muted} />
                    <Text style={styles.viewModeBadgeText}>View</Text>
                  </View>
                ) : (
                  <View style={styles.editModeBadge}>
                    <Ionicons name="pencil-outline" size={12} color={COLORS.primary} />
                    <Text style={styles.editModeBadgeText}>Edit</Text>
                  </View>
                )}
              </View>

              <View style={styles.formFields}>
                {INPUTS.map((cfg) => (
                  <FormField
                    key={cfg.name}
                    control={control}
                    name={cfg.name}
                    label={cfg.label}
                    placeholder={cfg.placeholder}
                    editable={editMode}
                    readOnly={cfg.readOnly}
                    multiline={cfg.multiline}
                    keyboardType={cfg.keyboardType}
                    autoCapitalize={cfg.autoCapitalize}
                    helper={cfg.helper}
                    textContentType={cfg.textContentType}
                    autoComplete={cfg.autoComplete}
                    icon={cfg.icon}
                    inputRef={(ref) => (inputRefs.current[cfg.name] = ref)}
                    onSubmitEditing={cfg.multiline ? undefined : () => focusNext(cfg.name)}
                  />
                ))}
              </View>
            </View>

            {/* Actions Section */}
            <View style={styles.actionsCard}>
              <Text style={styles.sectionTitle}>Account</Text>

              <Pressable style={styles.actionRow} onPress={() => setChangePwdOpen(true)}>
                <View style={styles.actionRowLeft}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.actionRowText}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.sub} />
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={exportProfilePdf}
                disabled={exporting}
              >
                <View style={styles.actionRowLeft}>
                  <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.actionRowText}>
                    Export Profile {exporting ? " (working…)" : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.sub} />
              </Pressable>

              <Pressable
                style={[styles.actionRow, { borderBottomWidth: 0 }]}
                onPress={() => handleLogout()}
              >
                <View style={styles.actionRowLeft}>
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color={COLORS.danger}
                  />
                  <Text style={[styles.actionRowText, { color: COLORS.danger }]}>Log Out</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.danger} />
              </Pressable>
            </View>

            <View style={{ height: 28 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ------------------- Styles -------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgStart },

  // ✅ Gradient background like HomeScreen
  gradientBg: { flex: 1 },

  container: { padding: 16, paddingBottom: 28 },

  // ============ Header Section ============
  headerSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  headerContent: { flex: 1 },
  pageTitle: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    marginTop: 8,
    fontSize: 13.5,
    color: COLORS.sub,
    lineHeight: 18,
  },

  editBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(124,77,255,0.25)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    justifyContent: "center",
  },
  editBtnText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13.5,
  },

  headerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 12,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(124,77,255,0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  },
  saveBtnText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13.5,
  },
  cancelBtn: {
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  cancelBtnText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 13.5,
  },
  btnDisabled: { opacity: 0.55 },

  // ============ Summary Card ============
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },

  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(124,77,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(124,77,255,0.2)",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,77,255,0.14)",
  },
  avatarInitials: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 24,
  },

  profileName: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  profileEmail: {
    color: COLORS.sub,
    marginTop: 4,
    fontSize: 13,
  },

  strengthSection: {
    marginTop: 10,
    gap: 6,
  },
  strengthLabel: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  strengthLabelText: {
    color: COLORS.sub,
    fontSize: 12.5,
    fontWeight: "800",
  },
  strengthValue: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 14,
  },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(31,41,55,0.08)",
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },

  // ============ Info Grid ============
  infoGrid: {
    flexDirection: "column",
    gap: 10,
    marginBottom: 14,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,77,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(124,77,255,0.12)",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  infoPillIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(124,77,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoPillLabel: {
    color: COLORS.sub,
    fontSize: 11.5,
    fontWeight: "800",
  },
  infoPillValue: {
    color: COLORS.text,
    fontSize: 13.5,
    fontWeight: "900",
    marginTop: 3,
  },

  // ============ Quick Actions ============
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
    paddingTop: 14,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(124,77,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(124,77,255,0.15)",
    borderRadius: 14,
  },
  quickActionBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "rgba(107,114,128,0.06)",
    borderColor: COLORS.border,
  },
  quickActionText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 13,
  },

  // ============ Section Card ============
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  viewModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(107,114,128,0.10)",
    borderWidth: 0.5,
    borderColor: "rgba(107,114,128,0.15)",
  },
  viewModeBadgeText: {
    color: COLORS.sub,
    fontWeight: "900",
    fontSize: 11,
  },

  editModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(124,77,255,0.12)",
    borderWidth: 0.5,
    borderColor: "rgba(124,77,255,0.2)",
  },
  editModeBadgeText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 11,
  },

  // ============ Skills ============
  skillsSubsection: {
    marginBottom: 12,
  },
  skillsSubheading: {
    color: COLORS.sub,
    fontSize: 12.5,
    fontWeight: "900",
    marginBottom: 8,
  },
  skillsSubHint: {
    color: COLORS.sub,
    fontSize: 13,
    lineHeight: 18,
  },
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillTag: {
    backgroundColor: "rgba(124,77,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(124,77,255,0.22)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  skillTagText: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 12,
  },
  cvSkillTag: {
    backgroundColor: "rgba(124,77,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(124,77,255,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  cvSkillTagText: {
    color: COLORS.primaryDark,
    fontWeight: "800",
    fontSize: 12,
  },

  emptySection: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.sub,
    fontSize: 13,
  },

  // ============ Form Card ============
  formCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  formFields: {
    gap: 2,
  },

  field: {
    marginTop: 14,
    paddingBottom: 2,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  label: {
    color: COLORS.sub,
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  labelIcon: { marginRight: 2 },

  inputShell: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  inputShellFocused: {
    borderColor: "rgba(124,77,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  inputShellDisabled: { backgroundColor: "rgba(255,255,255,0.75)" },
  inputShellBlurred: {
    backgroundColor: "rgba(234,234,242,0.6)",
    borderColor: "rgba(239,239,241,0.8)",
  },
  inputShellError: { borderColor: "rgba(220,38,38,0.45)" },
  inputShellMultiline: { paddingVertical: 4 },

  input: {
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15.5,
    fontWeight: "500",
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  inputBlurredText: { opacity: 0.55, letterSpacing: 0.4 },
  inputDisabledText: { color: COLORS.text },

  helper: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "900",
  },

  // ============ Actions Card ============
  actionsCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
  },

  actionRow: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  actionRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionRowText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14,
  },

  // ============ Old Styles (kept for compatibility) ============
  header: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 1,
  },
  title: {
    marginTop: 22,
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.sub,
    fontSize: 13,
    maxWidth: 260,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },

  name: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  email: { color: COLORS.sub, marginTop: 2, fontSize: 12.5 },

  progressRow: { marginTop: 10, gap: 8 },
  progressText: { color: COLORS.sub, fontSize: 12.5 },
  progressStrong: { color: COLORS.primaryDark, fontWeight: "900" },

  quickActions: { marginTop: 12, flexDirection: "row", gap: 10 },

  actionBtn: {
    flex: 1,
    backgroundColor: "rgba(124,77,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(124,77,255,0.20)",
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  actionBtnText: { color: COLORS.text, fontWeight: "900" },
  actionBtnDisabled: { opacity: 0.45 },

  actionBtnAlt: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.70)",
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  actionBtnAltText: { color: COLORS.text, fontWeight: "900" },

  pillsRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  pill: {
    flex: 1,
    backgroundColor: COLORS.bgMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 10,
  },
  pillLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "800" },
  pillValue: {
    color: COLORS.text,
    marginTop: 5,
    fontWeight: "900",
    fontSize: 12.5,
  },

  section: { marginTop: 14 },
  chipsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: COLORS.chipBg,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  chipText: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 12 },

  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  detailsHintPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: COLORS.bgMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailsHintPillEdit: {
    backgroundColor: "rgba(124,77,255,0.10)",
    borderColor: "rgba(124,77,255,0.22)",
  },
  detailsHintText: { color: COLORS.sub, fontWeight: "900", fontSize: 12 },

  rowBtn: {
    marginTop: 10,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowBtnText: { color: COLORS.text, fontWeight: "900" },
  rowBtnRight: { color: COLORS.sub, fontWeight: "900", fontSize: 18 },

  // ---------- Modal styles ----------
  modalRoot: { flex: 1, justifyContent: "center", alignItems: "center", padding: 18 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  modalCenter: { width: "100%", alignItems: "center", justifyContent: "center" },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  modalSubtitle: { marginTop: 6, color: COLORS.sub, fontSize: 12.5, lineHeight: 18 },
  modalLabel: { color: COLORS.sub, fontSize: 12.5, fontWeight: "900", marginBottom: 8 },

  modalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  modalInputFlex: { flex: 1, paddingVertical: 11, color: COLORS.text, fontSize: 15.5 },
  showBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(234,234,242,0.75)",
  },
  showBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  modalError: { marginTop: 6, color: COLORS.danger, fontSize: 12, fontWeight: "900" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16, justifyContent: "flex-end" },
  modalBtnPrimary: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(124,77,255,0.22)",
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnPrimaryText: { color: "white", fontWeight: "900" },
  modalBtnGhost: {
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnGhostText: { color: COLORS.text, fontWeight: "900" },
});
