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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller, FieldPath, type Control } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authColors } from "./auth/authTheme";
import { getMyUserRow, updateMyUserRow } from "../api/profile"; // adjust path

// ------------------- Theme (shared with auth screens) -------------------
const COLORS = {
  bg: authColors.cardBg,
  surface: authColors.cardBg,
  card: authColors.cardBg,
  card2: authColors.cardBg,
  text: authColors.textDark,
  sub: authColors.textMuted,
  muted: authColors.textMuted,
  border: authColors.border,
  primary: authColors.buttonStart,
  primary2: authColors.buttonEnd,
  danger: "#DC2626",
  warning: "#FFB020",
  success: "#34D399",
  inputBg: "#FFFFFF",
  chipBg: authColors.shapePurple,
  chipBorder: "rgba(139,92,246,0.35)",
};

// ------------------- Schema -------------------
const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  email: z.string().trim().email("Please enter a valid email"),
  educationLevel: z.string().trim().min(2, "Education level is required"),
  fieldOfStudy: z.string().trim().min(2, "Field of study is required"),
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
};

const INPUTS: InputConfig[] = [
  {
    name: "fullName",
    label: "Full Name",
    placeholder: "Enter your full name",
    autoCapitalize: "words",
    textContentType: "name",
    autoComplete: "name",
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
  },
  {
    name: "educationLevel",
    label: "Education Level",
    placeholder: "e.g., High School, Bachelor, Master",
    autoCapitalize: "words",
    textContentType: "none",
    autoComplete: "off",
  },
  {
    name: "fieldOfStudy",
    label: "Field of Study",
    placeholder: "e.g., Computer Science",
    autoCapitalize: "words",
    textContentType: "none",
    autoComplete: "off",
  },
  {
    name: "careerGoal",
    label: "Career Goal",
    placeholder: "e.g., Cybersecurity Engineer",
    multiline: true,
    autoCapitalize: "sentences",
    textContentType: "jobTitle",
    autoComplete: "job-title",
  },
  {
    name: "skills",
    label: "Skills (comma-separated)",
    placeholder: "e.g., Java, Python, React, SQL",
    multiline: true,
    autoCapitalize: "sentences",
    helper: "Tip: write skills separated by commas.",
    textContentType: "none",
    autoComplete: "off",
  },
  {
    name: "bio",
    label: "Bio",
    placeholder: "Write a short bio (max 220 chars)",
    multiline: true,
    autoCapitalize: "sentences",
    textContentType: "none",
    autoComplete: "off",
  },
  {
    name: "photoUrl",
    label: "Photo URL",
    placeholder: "https://...",
    keyboardType: "url",
    autoCapitalize: "none",
    helper: "Paste an image link (works without extra libraries).",
    textContentType: "URL",
    autoComplete: "url",
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
      <Text style={styles.pillValue}>{value}</Text>
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
  const filled = keys.filter(
    (k) => String(data[k] ?? "").trim().length > 0,
  ).length;
  return filled / keys.length;
}

// ------------------- FormField -------------------
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
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { value, onChange, onBlur },
        fieldState: { error },
      }) => {
        const isEditable = editable && !readOnly;

        return (
          <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>

            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                !isEditable && styles.inputDisabled,
                error && styles.inputError,
                multiline && styles.inputMultiline,
              ]}
              value={value ?? ""}
              onChangeText={onChange}
              onBlur={onBlur}
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

// ------------------- Main Screen -------------------
export default function ProfileScreen() {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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
  // ✅ Load from Supabase on mount
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
  // Watch only needed fields (less churn than watching the whole object)
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
    [watchedValues],
  );

  const skillsList = useMemo(
    () => parseSkills(watched.skills),
    [watched.skills],
  );
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

    await updateMyUserRow({
      name: data.fullName,
      education_level: data.educationLevel?.trim() ? data.educationLevel : null,
      field_of_study: data.fieldOfStudy?.trim() ? data.fieldOfStudy : null,
      skills: data.skills?.trim() ? data.skills : null,
      career_goal: data.careerGoal?.trim() ? data.careerGoal : null,
      bio: data.bio?.trim() ? data.bio : null,
      photo_url: data.photoUrl?.trim() ? data.photoUrl : null,
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

  // ✅ Optional (Expo only) pick image from gallery.
  const pickImageIfAvailable = async () => {
    try {
      // dynamic import so app still runs even if not installed
      const ImagePicker = await import("expo-image-picker");

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow gallery access to pick a profile picture.",
        );
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
        // ✅ use setValue instead of reset() to avoid wiping form state
        setValue("photoUrl", uri, { shouldDirty: true, shouldValidate: true });
      }
    } catch {
      Alert.alert(
        "Gallery picker not installed",
        "Install it with: npx expo install expo-image-picker\n(or just paste a Photo URL).",
      );
    }
  };

  const avatarUri = watched.photoUrl?.trim();
  const initials = initialsFromName(watched.fullName || "User");
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={{ padding: 16 }}>
          <Text style={{ color: COLORS.text, fontWeight: "900" }}>
            Loading profile…
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>My Profile</Text>
              <Text style={styles.subtitle}>
                Make your profile strong to get better recommendations.
              </Text>
            </View>

            {!editMode ? (
              <Pressable
                style={styles.btnPrimary}
                onPress={enterEditMode}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Text style={styles.btnPrimaryText}>Edit</Text>
              </Pressable>
            ) : (
              <View style={styles.headerActions}>
                <Pressable
                  style={[
                    styles.btnPrimary,
                    (!isDirty || !isValid || saving) && styles.btnDisabled,
                  ]}
                  disabled={!isDirty || !isValid || saving}
                  onPress={handleSubmit(onSubmit)}
                  accessibilityRole="button"
                  accessibilityLabel="Save profile"
                >
                  <Text style={styles.btnPrimaryText}>
                    {saving ? "Saving..." : "Save"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.btnGhost}
                  onPress={cancelEdit}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing"
                >
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Profile card */}
          <View style={styles.card}>
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
                <Text style={styles.name}>
                  {watched.fullName || "Your Name"}
                </Text>
                <Text style={styles.email}>
                  {watched.email || "email@example.com"}
                </Text>

                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    Profile strength:{" "}
                    <Text style={styles.progressStrong}>
                      {Math.round(progress * 100)}%
                    </Text>
                  </Text>
                  <ProgressBar value01={progress} />
                </View>
              </View>
            </View>

            {/* Quick actions */}
            <View style={styles.quickActions}>
              <Pressable
                style={[
                  styles.actionBtn,
                  !editMode && styles.actionBtnDisabled,
                ]}
                disabled={!editMode}
                onPress={pickImageIfAvailable}
                accessibilityRole="button"
                accessibilityLabel="Pick profile photo"
              >
                <Text style={styles.actionBtnText}>Pick Photo</Text>
              </Pressable>

              <Pressable
                style={styles.actionBtnAlt}
                onPress={() =>
                  Alert.alert(
                    "Feature",
                    "Add navigation to Account Settings here.",
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="Open account settings"
              >
                <Text style={styles.actionBtnAltText}>Account Settings</Text>
              </Pressable>
            </View>

            {/* Pills */}
            <View style={styles.pillsRow}>
              <Pill label="Education" value={watched.educationLevel || "—"} />
              <Pill label="Field" value={watched.fieldOfStudy || "—"} />
            </View>

            {/* Skills */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Skills</Text>
              {skillsList.length === 0 ? (
                <Text style={styles.emptyText}>
                  Add skills to boost your profile.
                </Text>
              ) : (
                <View style={styles.chipsRow}>
                  {skillsList.map((s) => (
                    <Chip key={s} text={s} />
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: COLORS.card2 }]}>
            <Text style={styles.sectionTitle}>Details</Text>

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
                inputRef={(ref) => (inputRefs.current[cfg.name] = ref)}
                onSubmitEditing={
                  cfg.multiline ? undefined : () => focusNext(cfg.name)
                }
              />
            ))}
          </View>

          {/* More */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>More</Text>

            <Pressable
              style={styles.rowBtn}
              onPress={() =>
                Alert.alert(
                  "Security",
                  "Hook this to your Change Password screen.",
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Change password"
            >
              <Text style={styles.rowBtnText}>🔒 Change Password</Text>
              <Text style={styles.rowBtnRight}>›</Text>
            </Pressable>

            <Pressable
              style={styles.rowBtn}
              onPress={() =>
                Alert.alert(
                  "Export",
                  "Hook this to an export/share flow (PDF/JSON).",
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Export profile"
            >
              <Text style={styles.rowBtnText}>📤 Export Profile</Text>
              <Text style={styles.rowBtnRight}>›</Text>
            </Pressable>

            <Pressable
              style={[styles.rowBtn, { borderBottomWidth: 0 }]}
              onPress={() =>
                Alert.alert("Logout", "Hook this to AuthContext logout.")
              }
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <Text style={[styles.rowBtnText, { color: COLORS.danger }]}>
                🚪 Log Out
              </Text>
              <Text style={[styles.rowBtnRight, { color: COLORS.danger }]}>
                ›
              </Text>
            </Pressable>
          </View>

          <View style={{ height: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ------------------- Styles -------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  title: {
    marginTop: 40,
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 4,
    color: COLORS.sub,
    fontSize: 13,
    maxWidth: 260,
  },

  btnPrimary: {
    marginTop: 40,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  btnPrimaryText: {
    color: "white",
    fontWeight: "900",
  },
  btnGhost: {
    marginTop: 40,
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnGhostText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  btnDisabled: { opacity: 0.55 },

  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },

  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,92,255,0.18)",
  },
  avatarInitials: {
    color: "white",
    fontWeight: "900",
    fontSize: 22,
  },

  name: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
  },
  email: {
    color: COLORS.sub,
    marginTop: 2,
    fontSize: 12.5,
  },

  progressRow: {
    marginTop: 10,
    gap: 8,
  },
  progressText: { color: COLORS.sub, fontSize: 12.5 },
  progressStrong: { color: COLORS.primary2, fontWeight: "900" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
  },

  quickActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "rgba(124,92,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.35)",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnText: { color: COLORS.text, fontWeight: "900" },
  actionBtnDisabled: { opacity: 0.45 },

  actionBtnAlt: {
    flex: 1,
    backgroundColor: "rgba(45,212,191,0.14)",
    borderWidth: 1,
    borderColor: "rgba(45,212,191,0.28)",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnAltText: { color: COLORS.text, fontWeight: "900" },

  pillsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  pill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
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
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: "900" },
  emptyText: { marginTop: 8, color: COLORS.muted, fontSize: 12.5 },

  chipsRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: COLORS.chipBg,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  chipText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },

  field: { marginTop: 12 },
  label: {
    color: COLORS.sub,
    fontSize: 12.5,
    fontWeight: "900",
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 15.5,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  // Better than opacity-only (keeps text readable)
  inputDisabled: {
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  inputError: { borderColor: "rgba(255,77,109,0.7)" },
  helper: { marginTop: 6, color: COLORS.muted, fontSize: 12 },
  errorText: {
    marginTop: 6,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "900",
  },

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
});
