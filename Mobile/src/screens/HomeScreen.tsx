import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUploadCv, useLatestCvUpload, useDeleteCv, cvQueryKeys } from "../features/cv/hooks";
import type { CvUpload } from "../features/cv/types";
import { analyzeCvWithOpenRouter } from "../features/cv/cv-analysis.service";
import { supabase } from "../api/supabase";
import { homeColors } from "./homeTheme";
import { AppLogo } from "../ui/AppLogo";

// ============================================================================
// STATE MACHINE TYPES
// ============================================================================
type Status = "idle" | "picking" | "uploading" | "deleting" | "changing" | "analyzing" | "error";

type HomeStackParamList = {
  HomeMain: undefined;
  Quiz: undefined;
  SkillsReview: undefined;
  CVAnalysis: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// Spacing scale for consistent rhythm (4dp grid)
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

// Accessibility configuration
const a11y = {
  logo: {
    label: "MyPath app logo",
    hint: "Career recommendation app for students"
  },
  uploadCv: {
    label: "Upload your CV document",
    hint: "Opens file picker to select a PDF file"
  },
  analyzeCv: {
    label: "Analyze CV with AI",
    hint: "Get instant feedback on your resume"
  },
  deleteCv: {
    label: "Delete uploaded CV",
    hint: "Permanently remove your CV from our servers"
  },
  changeCv: {
    label: "Change CV",
    hint: "Replace your current CV with a different file"
  },
  quiz: {
    label: "Take career quiz",
    hint: "Start the AI-powered career discovery quiz"
  },
  starRating: {
    label: "5 star rating",
    hint: "Average user rating"
  },
};

const TESTIMONIALS = [
  { quote: "This helped me choose computer science!", author: "Sarah", age: 18 },
  { quote: "I finally found direction after being confused for years.", author: "Ahmed", age: 20 },
  { quote: "The mentor feature is amazing. Got real advice!", author: "Lina", age: 22 },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Discover",
    description: "Take our smart AI quiz to find careers that match your interests.",
    icon: "bulb" as const,
    color: homeColors.primary,
  },
  {
    step: 2,
    title: "Improve",
    description: "Upload your CV and get instant AI feedback + job suggestions.",
    icon: "document-text" as const,
    color: homeColors.accentTeal,
  },
  {
    step: 3,
    title: "Plan",
    description: "Get a step-by-step roadmap to reach your target career.",
    icon: "map" as const,
    color: homeColors.accentGreen,
  },
  {
    step: 4,
    title: "Connect",
    description: "Talk to real professionals and learn from their experience.",
    icon: "people" as const,
    color: homeColors.accentOrange,
  },
];

function StarRating() {
  return (
    <View
      style={styles.starRow}
      accessible
      accessibilityLabel={a11y.starRating.label}
      accessibilityHint={a11y.starRating.hint}
      accessibilityRole="summary"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name="star"
          size={16}
          color={homeColors.starYellow}
          accessible={false}
          accessibilityRole="image"
        />
      ))}
    </View>
  );
}

export default function HomeScreen(): React.ReactElement {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 380;

  // React Query hooks - fetch latest CV upload
  const { data: latestUpload, refetch: refetchCv } = useLatestCvUpload();
  const { mutate: uploadCv } = useUploadCv();
  const { mutate: deleteCv } = useDeleteCv();

  // ========================================================================
  // STATE MACHINE: Finite State Machine Pattern
  // ========================================================================
  // Single source of truth for CV data (CvUpload from Supabase)
  const [cv, setCv] = useState<CvUpload | null>(null);

  // Status transitions: idle → action → idle/error
  const [status, setStatus] = useState<Status>("idle");

  // Error display
  const [error, setError] = useState<string | null>(null);

  // Sync with React Query data
  React.useEffect(() => {
    if (latestUpload) {
      setCv(latestUpload);
    }
  }, [latestUpload]);

  // Derived states from FSM
  const cvName = cv?.filename || null;
  const hasCv = cv !== null;
  const isProcessing = status !== "idle" && status !== "error";

  const statusTextMap: Partial<Record<Status, string>> = {
    picking: "Opening file picker...",
    uploading: "Uploading your CV...",
    changing: "Replacing your CV...",
    deleting: "Deleting your CV...",
    analyzing: "Analyzing your CV with AI...",
  };
  const currentStatusText = statusTextMap[status];

  // ========================================================================
  // HANDLER 1: UPLOAD CV (with haptic feedback)
  // ========================================================================
  const handleUpload = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatus("picking");
    setError(null);

    try {
      console.log("[HomeScreen] Starting CV pick...");
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        console.log("[HomeScreen] CV pick canceled by user");
        setStatus("idle");
        return;
      }

      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        const err = "Please upload PDF only.";
        setError(err);
        setStatus("error");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Invalid file", err);
        setStatus("idle");
        return;
      }

      setStatus("uploading");
      console.log("[HomeScreen] Uploading CV...", file.name);

      // Use React Query mutation
      uploadCv(
        { uri: file.uri, name: file.name, mimeType: file.mimeType },
        {
          onSuccess: (uploaded) => {
            console.log("[HomeScreen] ✅ CV uploaded successfully!", uploaded);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCv(uploaded);
            setStatus("idle");
            setError(null);
            Alert.alert("Success", "CV uploaded! Tap 'Analyze' to analyze it.");
          },
          onError: (err: any) => {
            console.error("[HomeScreen] ❌ Upload failed:", err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const errorMsg = err?.message || "Could not upload CV.";
            setError(errorMsg);
            setStatus("error");
            Alert.alert("Upload Failed", errorMsg);
          },
        }
      );
    } catch (err: any) {
      console.error("[HomeScreen] Exception during upload:", err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg = err?.message || "Failed to pick file.";
      setError(errorMsg);
      setStatus("error");
      Alert.alert("Error", errorMsg);
    } finally {
      // If error and we're still in picking/uploading, reset to idle
      if (status === "picking" || status === "uploading") {
        setStatus("idle");
      }
    }
  };

  // ========================================================================
  // HANDLER 2: DELETE CV (with haptic feedback)
  // ========================================================================
  const handleDelete = () => {
    if (!cv?.id) {
      console.warn("[HomeScreen] ⚠️ Cannot delete: no CV found");
      return;
    }

    Alert.alert(
      "Delete CV",
      "Are you sure? This will remove your CV and analysis.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setStatus("deleting");
            setError(null);
            console.log("[HomeScreen] User confirmed delete for CV:", cv.id);

            try {
              deleteCv(cv, {
                onSuccess: () => {
                  console.log("[HomeScreen] ✅ CV deleted from storage/DB");
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  // CRITICAL: Reset cv immediately + invalidate queries
                  setCv(null);
                  setStatus("idle");
                  setError(null);

                  // Invalidate all CV-related queries
                  queryClient.invalidateQueries({ queryKey: cvQueryKeys.uploads() });
                  queryClient.invalidateQueries({ queryKey: cvQueryKeys.analyses() });
                  queryClient.invalidateQueries({ queryKey: cvQueryKeys.skills() });
                  refetchCv();

                  console.log("[HomeScreen] ✅ UI reset to 'Upload CV' state");
                  Alert.alert("Success", "CV deleted successfully!");
                },
                onError: (err: any) => {
                  console.error("[HomeScreen] ❌ Delete failed:", err);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  const errorMsg = err?.message || "Could not delete CV.";
                  setError(errorMsg);
                  setStatus("error");
                  Alert.alert("Error", errorMsg);
                },
              });
            } catch (err: any) {
              console.error("[HomeScreen] Exception during delete:", err);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              const errorMsg = err?.message || "Delete operation failed.";
              setError(errorMsg);
              setStatus("error");
              Alert.alert("Error", errorMsg);
            }
          },
        },
      ]
    );
  };

  // ========================================================================
  // HANDLER 3: CHANGE CV (delete old → upload new)
  // ========================================================================
  const handleChange = async () => {
    if (!cv?.id) {
      console.log("[HomeScreen] No existing CV, just uploading");
      await handleUpload();
      return;
    }

    setStatus("changing");
    setError(null);
    console.log("[HomeScreen] 🔄 Change CV: deleting old CV first:", cv.id);

    try {
      // Step 1: Delete old CV and wait for completion
      await new Promise<void>((resolve, reject) => {
        deleteCv(cv, {
          onSuccess: () => {
            console.log("[HomeScreen] ✅ Old CV deleted, state reset");
            setCv(null);
            setStatus("idle");

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: cvQueryKeys.uploads() });
            queryClient.invalidateQueries({ queryKey: cvQueryKeys.analyses() });
            refetchCv();

            resolve();
          },
          onError: (err: any) => {
            console.error("[HomeScreen] ❌ Delete during change failed:", err);
            setStatus("error");
            setError(err?.message || "Delete failed.");
            reject(err);
          },
        });
      });

      // Step 2: Upload new CV (pick file)
      setStatus("picking");
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        console.log("[HomeScreen] New CV pick canceled");
        setStatus("idle");
        return;
      }

      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setStatus("error");
        setError("Please upload PDF only.");
        Alert.alert("Invalid file", "Please upload PDF only.");
        setStatus("idle");
        return;
      }

      setStatus("uploading");
      console.log("[HomeScreen] Uploading new CV...", file.name);

      // Step 3: Upload new CV
      await new Promise<void>((resolve, reject) => {
        uploadCv(
          { uri: file.uri, name: file.name, mimeType: file.mimeType },
          {
            onSuccess: (uploaded) => {
              console.log("[HomeScreen] ✅ New CV uploaded!", uploaded);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setCv(uploaded);
              setStatus("idle");
              setError(null);
              Alert.alert("Success", "CV changed successfully!");
              resolve();
            },
            onError: (err: any) => {
              console.error("[HomeScreen] ❌ New CV upload failed:", err);
              setStatus("error");
              setError(err?.message || "Upload failed.");
              reject(err);
            },
          }
        );
      });
    } catch (err: any) {
      console.error("[HomeScreen] Exception during change flow:", err);
      setStatus("error");
      setError(err?.message || "Change CV failed.");
      Alert.alert("Error", err?.message || "Change CV failed. Try again.");
    }
  };

  // ========================================================================
  // HANDLER 4: ANALYZE CV (with haptic feedback)
  // ========================================================================
  const handleAnalyze = async () => {
    if (!cv?.id) {
      console.warn("[HomeScreen] ⚠️ Cannot analyze: no CV ID");
      setError("No CV found.");
      setStatus("error");
      Alert.alert("No CV", "Please upload a CV first.");
      setStatus("idle");
      return;
    }

    // Verify session exists before attempting analysis
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("[HomeScreen] ❌ No session found. User not authenticated.");
      const errorMsg = "Session expired. Please sign in again.";
      setError(errorMsg);
      setStatus("error");
      Alert.alert("Not Authenticated", errorMsg);
      setStatus("idle");
      return;
    }

    console.log("[HomeScreen] ✅ Session verified", {
      userId: session.user?.id,
      tokenLength: session.access_token?.length,
    });

    setStatus("analyzing");
    setError(null);
    console.log("[HomeScreen] 👉 Starting client-side CV analysis:", cv.id);

    try {
      // ⭐ Client-side analysis with OpenRouter (no Edge Function)
      const result = await analyzeCvWithOpenRouter(
        cv.id,
        cv.storage_path,
        cv.filename
      );

      queryClient.setQueryData(cvQueryKeys.analysis(cv.id), result);

      console.log("[HomeScreen] ✅ CV analysis completed and saved!");

      // Invalidate queries to show new results
      queryClient.invalidateQueries({ queryKey: cvQueryKeys.analyses() });

      setStatus("idle");
      setError(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Analysis Complete", "Your CV has been analyzed!");
      (navigation as any).navigate("CVAnalysis");
    } catch (err: any) {
      console.error("[HomeScreen] ❌ Analysis failed:", err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg = err?.message || "Could not analyze CV.";
      setError(errorMsg);
      setStatus("error");
      Alert.alert("Analysis Failed", errorMsg);
      setStatus("idle");
    }
  };

  // ========================================================================
  // NAVIGATION HANDLERS
  // ========================================================================
  const goToQuiz = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Quiz");
  };

  // ========================================================================
  // RENDER: Build UI based on FSM state
  // ========================================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing['4xl'] + spacing['3xl'] } // Bottom padding for tab bar
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Section */}
        <View style={[styles.hero, { marginBottom: spacing['3xl'] }]}>
          <View style={styles.logoBox}>
            <AppLogo size={40} />
          </View>
          <Text style={styles.heroTitle}>
            Find Your Career Path{"\n"}
            <Text style={styles.heroTitleHighlight}>with AI Guidance</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Take a quiz, scan your CV, explore roadmaps, and connect with real professionals.
          </Text>
        </View>

        {currentStatusText && (
          <View
            style={styles.statusBanner}
            accessibilityRole="progressbar"
            accessibilityLabel={currentStatusText}
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator size="small" color={homeColors.primary} />
            <Text style={styles.statusBannerText}>{currentStatusText}</Text>
          </View>
        )}

        {/* Two CTA Buttons: Quiz + CV */}
        <View
          style={[
            styles.ctaRow,
            isCompactLayout && styles.ctaRowCompact,
            { marginBottom: spacing['3xl'] - 4 },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.ctaQuizWrap, pressed && styles.pressed]}
            onPress={goToQuiz}
            accessibilityRole="button"
            accessibilityLabel={a11y.quiz.label}
            accessibilityHint={a11y.quiz.hint}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <LinearGradient
              colors={[homeColors.primary, homeColors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaQuizGradient}
            >
              <Ionicons name="bulb-outline" size={22} color={homeColors.onPrimary} />
              <Text style={styles.ctaQuizText}>Take Career Quiz</Text>
            </LinearGradient>
          </Pressable>

          {/* CV Card: Shows different UI based on hasCv + status */}
          {hasCv ? (
            <View style={styles.cvUploadedContainer}>
              <View style={styles.cvUploadedContent}>
                <View style={styles.cvUploadedHeader}>
                  <Ionicons
                    name={status === "analyzing" ? "hourglass-outline" : "checkmark-circle"}
                    size={20}
                    color={status === "analyzing" ? homeColors.primary : homeColors.accentGreen}
                    accessibilityLabel={status === "analyzing" ? "Analyzing" : "Complete"}
                    accessibilityRole="image"
                  />
                  <Text style={styles.cvUploadedTitle}>
                    {status === "analyzing" ? "Analyzing..." : "CV Uploaded"}
                  </Text>
                </View>
                <Text
                  style={styles.cvUploadedFilename}
                  numberOfLines={1}
                  accessibilityRole="text"
                >
                  {cvName}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.cvAnalyzeBtn,
                    isProcessing && styles.disabled,
                    pressed && !isProcessing && styles.pressed,
                  ]}
                  onPress={handleAnalyze}
                  disabled={isProcessing}
                  accessibilityRole="button"
                  accessibilityLabel={a11y.analyzeCv.label}
                  accessibilityHint={a11y.analyzeCv.hint}
                  accessibilityState={{ disabled: isProcessing }}
                >
                  {status === "analyzing" ? (
                    <ActivityIndicator size="small" color={homeColors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="analytics-outline" size={16} color={homeColors.onPrimary} />
                      <Text style={styles.cvAnalyzeBtnText}>Analyze CV</Text>
                    </>
                  )}
                </Pressable>
                <View style={styles.cvActionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cvActionBtn,
                      styles.cvChangeBtnStyle,
                      isProcessing && styles.disabled,
                      pressed && !isProcessing && styles.pressed,
                    ]}
                    onPress={handleChange}
                    disabled={isProcessing}
                    accessibilityRole="button"
                    accessibilityLabel={a11y.changeCv.label}
                    accessibilityHint={a11y.changeCv.hint}
                    accessibilityState={{ disabled: isProcessing }}
                  >
                    {status === "changing" ? (
                      <ActivityIndicator size="small" color={homeColors.primary} />
                    ) : (
                      <>
                        <Ionicons name="swap-horizontal-outline" size={16} color={homeColors.primary} />
                        <Text style={styles.cvChangeBtnText}>Change</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cvActionBtn,
                      styles.cvDeleteBtnStyle,
                      isProcessing && styles.disabled,
                      pressed && !isProcessing && styles.pressed,
                    ]}
                    onPress={handleDelete}
                    disabled={isProcessing}
                    accessibilityRole="button"
                    accessibilityLabel={a11y.deleteCv.label}
                    accessibilityHint={a11y.deleteCv.hint}
                    accessibilityState={{ disabled: isProcessing }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {status === "deleting" ? (
                      <ActivityIndicator size="small" color={homeColors.error} />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color={homeColors.error} />
                        <Text style={styles.cvDeleteBtnText}>Delete</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.ctaUploadWrap,
                isProcessing && styles.disabled,
                pressed && !isProcessing && styles.pressed,
              ]}
              onPress={handleUpload}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel={a11y.uploadCv.label}
              accessibilityHint={a11y.uploadCv.hint}
              accessibilityState={{ disabled: isProcessing }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {status === "uploading" ? (
                <ActivityIndicator size="small" color={homeColors.primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={22} color={homeColors.textDark} />
                  <Text style={styles.ctaUploadText}>Upload Your CV</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {/* Error Display */}
        {error && status === "error" && (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle"
              size={16}
              color={homeColors.error}
              accessibilityRole="image"
            />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
              onPress={() => { setError(null); setStatus("idle"); }}
            >
              <Ionicons name="close" size={16} color={homeColors.error} />
            </Pressable>
          </View>
        )}

        {/* How It Works */}
        <Text
          style={styles.sectionTitle}
          accessibilityRole="header"
        >
          How It Works
        </Text>
        <View style={styles.howItWorksGrid}>
          {HOW_IT_WORKS.map((item) => (
            <View key={item.step} style={[styles.howCard, isCompactLayout && styles.howCardCompact]}>
              <View style={[styles.howIconBox, { backgroundColor: item.color + "20" }]}>
                <Ionicons
                  name={item.icon}
                  size={24}
                  color={item.color}
                  accessibilityLabel={`Step ${item.step}: ${item.title}`}
                  accessibilityRole="image"
                />
              </View>
              <Text style={styles.howCardTitle}>{item.step}. {item.title}</Text>
              <Text style={styles.howCardDesc}>{item.description}</Text>
            </View>
          ))}
        </View>

        {/* Trusted by Students */}
        <Text
          style={styles.sectionTitle}
          accessibilityRole="header"
        >
          Trusted by Students
        </Text>
        <View style={styles.trustedSubtitle}>
          <Ionicons
            name="sparkles"
            size={14}
            color={homeColors.primary}
            accessibilityRole="image"
          />
          <Text style={styles.trustedSubtitleText}>AI-powered career matching</Text>
        </View>
        <View style={styles.testimonials}>
          {TESTIMONIALS.map((t, i) => (
            <View key={i} style={styles.testimonialCard}>
              <StarRating />
              <Text style={styles.testimonialQuote}>"{t.quote}"</Text>
              <Text
                style={styles.testimonialAuthor}
                accessibilityLabel={`Testimonial from ${t.author}, age ${t.age}`}
              >
                – {t.author}, {t.age}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA Block: Ready to Build Your Future? */}
        <Pressable
          style={({ pressed }) => [styles.ctaBlockWrap, pressed && styles.pressed]}
          accessibilityRole="summary"
          accessibilityLabel="Call to action section"
        >
          <LinearGradient
            colors={[homeColors.primaryLight, homeColors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.ctaBlockGradient}
          >
            <Text style={styles.ctaBlockTitle}>Ready to Build Your Future?</Text>
            <Text style={styles.ctaBlockSubtitle}>
              Start your journey today and discover the perfect career for you.
            </Text>
            <View style={[styles.ctaBlockButtons, isCompactLayout && styles.ctaBlockButtonsCompact]}>
              <Pressable
                style={({ pressed }) => [
                  styles.ctaBlockBtnWhite,
                  isProcessing && styles.disabled,
                  pressed && !isProcessing && styles.pressed,
                ]}
                onPress={goToQuiz}
                disabled={isProcessing}
                accessibilityRole="button"
                accessibilityLabel="Take the Quiz"
                accessibilityHint="Start the AI-powered career discovery quiz"
                accessibilityState={{ disabled: isProcessing }}
              >
                <Text style={styles.ctaBlockBtnWhiteText}>Take the Quiz</Text>
                <Ionicons name="arrow-forward" size={18} color={homeColors.primary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.ctaBlockBtnPurple,
                  isProcessing && styles.disabled,
                  pressed && !isProcessing && styles.pressed,
                ]}
                onPress={hasCv ? handleAnalyze : handleUpload}
                disabled={isProcessing}
                accessibilityRole="button"
                accessibilityLabel={a11y[hasCv ? 'analyzeCv' : 'uploadCv'].label}
                accessibilityHint={a11y[hasCv ? 'analyzeCv' : 'uploadCv'].hint}
                accessibilityState={{ disabled: isProcessing }}
              >
                {status === "uploading" || status === "analyzing" ? (
                  <ActivityIndicator size="small" color={homeColors.onPrimary} />
                ) : (
                  <>
                    <Ionicons
                      name={hasCv ? "analytics-outline" : "cloud-upload-outline"}
                      size={18}
                      color={homeColors.onPrimary}
                    />
                    <Text style={styles.ctaBlockBtnPurpleText}>
                      {hasCv ? "Analyze CV" : "Upload CV"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Spacing scale (4dp grid) - referenced inside styles
// Define outside StyleSheet to use in component logic

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },

  hero: {
    alignItems: "center",
    marginBottom: 32, // spacing['3xl']
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: homeColors.logoBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16, // spacing['lg']
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: homeColors.textDark,
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 8, // spacing['sm']
  },
  heroTitleHighlight: {
    color: homeColors.primary,
  },
  heroSubtitle: {
    fontSize: 14,
    color: homeColors.onSurfaceVariant, // Use semantic token
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  ctaRow: {
    flexDirection: "row",
    gap: 12, // spacing['md']
    marginBottom: 36, // spacing['3xl'] + adjustment (36 = 32 + 4)
  },
  ctaRowCompact: {
    flexDirection: "column",
  },
  ctaQuizWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    // Ensure minimum touch target
    minHeight: 56, // 44pt + padding
  },
  ctaQuizGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    minHeight: 56,
  },
  ctaQuizText: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.onPrimary, // Semantic token instead of #fff
  },
  ctaUploadWrap: {
    flex: 1,
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    minHeight: 56,
  },
  ctaUploadText: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.onSurface,
  },

  // CV Uploaded State Styles
  cvUploadedContainer: {
    flex: 1,
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.accentGreen,
    padding: 12,
  },
  cvUploadedContent: {
    gap: 8,
  },
  cvUploadedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cvUploadedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.accentGreen,
  },
  cvUploadedFilename: {
    fontSize: 13,
    color: homeColors.onSurface,
    fontWeight: "600",
  },
  cvActionsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  cvAnalyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: homeColors.primary,
    gap: 6,
    marginTop: 2,
  },
  cvAnalyzeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.onPrimary,
  },
  cvActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12, // Increased from 8 for better touch target
    borderRadius: 10,
    gap: 4,
    minHeight: 44, // Ensure minimum touch target
  },
  cvChangeBtnStyle: {
    backgroundColor: homeColors.primary + "15",
    borderWidth: 1,
    borderColor: homeColors.primary + "30",
  },
  cvChangeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: homeColors.primary,
  },
  cvDeleteBtnStyle: {
    backgroundColor: homeColors.errorContainer,
    borderWidth: 1,
    borderColor: homeColors.error + "30",
  },
  cvDeleteBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: homeColors.error,
  },

  // Error Banner
  statusBanner: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 13,
    color: homeColors.onSurface,
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: homeColors.errorContainer,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeColors.error + "30",
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: homeColors.error,
    fontWeight: "500",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.onSurface,
    marginTop: spacing['lg'], // 16
    marginBottom: spacing['lg'], // 16
    textAlign: "center",
  },
  trustedSubtitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  trustedSubtitleText: {
    fontSize: 14,
    color: homeColors.primary,
  },

  howItWorksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 40,
    gap: 14,
  },
  howCard: {
    width: "47.5%",
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  howCardCompact: {
    width: "100%",
  },
  howIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  howCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.onSurface,
    marginBottom: 6,
  },
  howCardDesc: {
    fontSize: 12,
    color: homeColors.onSurfaceVariant,
    lineHeight: 17,
  },

  testimonials: {
    gap: 16,
    marginBottom: 36,
  },
  testimonialCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  starRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 8,
  },
  testimonialQuote: {
    fontSize: 14,
    color: homeColors.onSurface,
    lineHeight: 20,
    marginBottom: 8,
  },
  testimonialAuthor: {
    fontSize: 13,
    color: homeColors.onSurfaceVariant,
  },

  ctaBlockWrap: {
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 8,
  },
  ctaBlockGradient: {
    padding: 24,
  },
  ctaBlockTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: homeColors.onPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  ctaBlockSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 20,
  },
  ctaBlockButtons: {
    flexDirection: "row",
    gap: 12,
  },
  ctaBlockButtonsCompact: {
    flexDirection: "column",
  },
  ctaBlockBtnWhite: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeColors.onPrimary, // Use white from theme
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
    minHeight: 52, // Ensure touch target
  },
  ctaBlockBtnWhiteText: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.primary,
  },
  ctaBlockBtnPurple: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    gap: 6,
    minHeight: 52,
  },
  ctaBlockBtnPurpleText: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.onPrimary,
  },

  bottomSpacer: {
    height: 120, // Increased to account for tab bar + safe area
  },
});
