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
import {
  getCvAnalysisStatusFromBackend,
  getLatestCvAnalysisFromBackend,
} from "../features/cv/api-backend";
import { homeColors } from "./homeTheme";
import { AppLogo } from "../ui/AppLogo";
import { useAuth } from "../auth/AuthProvider";
import { useMatchedCareers } from "../features/careers/useMatchedCareers";
import {
  getSavedLearningRoadmaps,
  getLearningRoadmapByCareerTitle,
} from "../features/learning-roadmap/storage";
import type { SavedLearningRoadmap } from "../features/learning-roadmap/types";
import { MainTopBar } from "../ui/MainTopBar";
import { ChatbotButton, ChatbotPanel } from "../features/chatbot";

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

  // Auth hook - get user name
  const { state: authState } = useAuth();
  const rawName = authState.user?.fullName || authState.user?.email?.split("@")[0] || "Student";
  const userName = (rawName.split(/[\s.]/)[0] ?? 'Student').replace(/^\w/, c => c.toUpperCase());

  // Careers hook - get top matched career
  const { data: matchedCareers = [] } = useMatchedCareers();
  const topCareer = matchedCareers[0]?.career.title || "your career goals";

  // Learning Roadmap state
  const [roadmapData, setRoadmapData] = useState<SavedLearningRoadmap | null>(null);
  const [careerProgress, setCareerProgress] = useState(0);

  // Chatbot state
  const [chatbotOpen, setChatbotOpen] = useState(false);

  // Fetch roadmap for top matched career
  React.useEffect(() => {
    const fetchRoadmap = async () => {
      if (!authState.user?.id || !topCareer) return;

      try {
        const roadmap = await getLearningRoadmapByCareerTitle(
          authState.user.id,
          topCareer
        );

        if (roadmap) {
          setRoadmapData(roadmap);

          // Calculate overall progress
          const skills = roadmap.roadmap.skills;
          if (skills && skills.length > 0) {
            const avgProgress =
              skills.reduce((sum, skill) => sum + (skill.userProgress?.completedPercentage || 0), 0) /
              skills.length;
            setCareerProgress(Math.round(avgProgress));
          }
        }
      } catch (error) {
        console.warn("[HomeScreen] Failed to fetch roadmap:", error);
      }
    };

    fetchRoadmap();
  }, [authState.user?.id, topCareer]);

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
            Alert.alert(
              "Success",
              "CV uploaded! Analysis has started on the backend. Tap 'Analyze CV' to check progress."
            );
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

    setStatus("analyzing");
    setError(null);
    console.log("[HomeScreen] 👉 Checking backend CV analysis status for upload:", cv.id);

    try {
      const latest = await getLatestCvAnalysisFromBackend();
      if (!latest) {
        setStatus("idle");
        Alert.alert(
          "Analysis in progress",
          "Your CV is still being processed. Please try again in a few seconds."
        );
        return;
      }

      const analysisStatus = latest.status;
      if (analysisStatus === "pending" || analysisStatus === "processing") {
        const statusPayload = await getCvAnalysisStatusFromBackend(latest.id).catch(() => null);
        const progress = statusPayload?.progress ?? 50;
        setStatus("idle");
        Alert.alert(
          "Analysis in progress",
          `Backend is still analyzing your CV (${progress}%). Please retry shortly.`
        );
        return;
      }

      if (analysisStatus === "failed") {
        const statusPayload = await getCvAnalysisStatusFromBackend(latest.id).catch(() => null);
        const backendError =
          statusPayload?.error_message || latest.error_message || "The backend could not analyze this CV.";
        throw new Error(backendError);
      }

      if (analysisStatus && analysisStatus !== "completed") {
        throw new Error(`Unexpected CV analysis status: ${analysisStatus}`);
      }

      console.log("[HomeScreen] ✅ CV analysis available from backend", latest.id);

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
      <MainTopBar onProfilePress={() => navigation.navigate("Profile")} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing['4xl'] + spacing['3xl'] } // Bottom padding for tab bar
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Dashboard Hero Greeting */}
        <View style={styles.dashboardHero}>
          <Text style={styles.dashboardGreeting}>Hello, {userName}!</Text>
          <Text style={styles.dashboardSubtext}>
            You're making steady progress toward becoming a{" "}
            <Text style={{ color: homeColors.primary, fontWeight: "700" }}>
              {topCareer}
            </Text>
            .
          </Text>
          
          {/* Progress Card */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Career Goal Progress</Text>
              <Text style={styles.progressPercent}>{careerProgress}%</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <LinearGradient
                colors={[homeColors.primary, homeColors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${careerProgress}%` }]}
              />
            </View>
          </View>
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

        {/* Action Cards Grid */}
        <View style={styles.actionGrid}>
          {/* Skill Gap Analysis / Quiz Card */}
          <Pressable
            style={({ pressed }) => [
              styles.actionCardLarge,
              pressed && styles.actionCardLargePressed,
            ]}
            onPress={goToQuiz}
            accessibilityRole="button"
            accessibilityLabel={a11y.quiz.label}
            accessibilityHint={a11y.quiz.hint}
          >
            <LinearGradient
              colors={[homeColors.primary, homeColors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionCardGradient}
            >
              {/* Decorative Background Icon */}
              <View style={styles.decorativeIconBg}>
                <Ionicons
                  name="flash"
                  size={180}
                  color={homeColors.onPrimary}
                  style={styles.decorativeIcon}
                />
              </View>

              {/* Content */}
              <View style={styles.actionCardContent}>
                <View>
                  <Text style={styles.actionCardTitle}>Skill Gap Analysis</Text>
                  <Text style={styles.actionCardDescription}>
                    Our new adaptive quiz helps identify exactly which technical skills you need to land your next role.
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionCardButton,
                    pressed && styles.actionCardButtonPressed,
                  ]}
                  onPress={goToQuiz}
                  accessible={false}
                >
                  <Text style={styles.actionCardButtonText}>Start Quiz</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Analyze CV Card */}
          <Pressable
            style={({ pressed }) => [
              styles.actionCardSmall,
              pressed && styles.actionCardPressed,
            ]}
            onPress={hasCv ? handleAnalyze : handleUpload}
            disabled={isProcessing}
            accessibilityRole="button"
            accessibilityLabel={hasCv ? a11y.analyzeCv.label : a11y.uploadCv.label}
            accessibilityHint={hasCv ? a11y.analyzeCv.hint : a11y.uploadCv.hint}
            accessibilityState={{ disabled: isProcessing }}
          >
            <View style={styles.actionCardSmallContent}>
              <View style={styles.actionCardIcon}>
                <Ionicons
                  name="document-text"
                  size={24}
                  color={homeColors.primary}
                />
              </View>
              <Text style={styles.actionCardSmallTitle}>
                {hasCv ? "Analyze CV" : "Upload CV"}
              </Text>
              <Text style={styles.actionCardSmallDescription}>
                {hasCv
                  ? "Get AI-driven feedback on your resume"
                  : "Upload your latest resume for analysis"}
              </Text>
              {hasCv && (
                <Text style={styles.actionCardFileName} numberOfLines={1}>
                  {cvName}
                </Text>
              )}
            </View>
            <Pressable
              style={styles.actionCardSmallButton}
              onPress={hasCv ? handleAnalyze : handleUpload}
              disabled={isProcessing}
              accessible={false}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={homeColors.primary} />
              ) : (
                <Text style={styles.actionCardSmallButtonText}>
                  {hasCv ? "Analyze" : "Upload"}
                </Text>
              )}
            </Pressable>
          </Pressable>
        </View>

        {/* CV Actions (Change/Delete if CV exists) */}
        {hasCv && !isProcessing && (
          <View style={styles.cvQuickActions}>
            <Pressable
              style={({ pressed }) => [
                styles.cvQuickActionBtn,
                styles.cvQuickActionChange,
                pressed && styles.pressed,
              ]}
              onPress={handleChange}
              accessibilityRole="button"
              accessibilityLabel={a11y.changeCv.label}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color={homeColors.primary} />
              <Text style={styles.cvQuickActionText}>Change</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.cvQuickActionBtn,
                styles.cvQuickActionDelete,
                pressed && styles.pressed,
              ]}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={a11y.deleteCv.label}
            >
              <Ionicons name="trash-outline" size={16} color={homeColors.error} />
              <Text style={[styles.cvQuickActionText, { color: homeColors.error }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        )}

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

        {/* My Roadmap: Next Steps Preview */}
        <View style={styles.dashboardSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Roadmap: Next Steps</Text>
            <Pressable
              onPress={() => (navigation as any).navigate("Roadmaps")}
              accessibilityRole="button"
              accessibilityLabel="View full roadmap"
            >
              <View style={styles.viewAllLink}>
                <Text style={styles.viewAllText}>View Full Journey</Text>
                <Ionicons name="arrow-forward" size={14} color={homeColors.primary} />
              </View>
            </Pressable>
          </View>
          
          <View style={styles.roadmapPreview}>
            {roadmapData && roadmapData.roadmap.skills.length > 0 ? (
              <>
                {roadmapData.roadmap.skills.slice(0, 2).map((skillNode, index) => {
                  const isLocked = index > 0 && !roadmapData.roadmap.skills[index - 1].userProgress?.started;
                  const isStarted = skillNode.userProgress?.started || false;
                  const progress = skillNode.userProgress?.completedPercentage || 0;

                  return (
                    <View
                      key={skillNode.skill.id}
                      style={[
                        styles.roadmapStep,
                        isStarted && { backgroundColor: homeColors.primary + "10" }
                      ]}
                    >
                      <View
                        style={[
                          styles.stepNumber,
                          isStarted && { backgroundColor: homeColors.primary }
                        ]}
                      >
                        {progress === 100 ? (
                          <Ionicons name="checkmark" size={16} color={homeColors.onPrimary} />
                        ) : isLocked ? (
                          <Ionicons name="lock-closed" size={14} color={homeColors.textDark} />
                        ) : (
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        )}
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, isLocked && { opacity: 0.6 }]}>
                          {skillNode.skill.name}
                        </Text>
                        <Text style={[styles.stepDescription, isLocked && { opacity: 0.5 }]}>
                          {skillNode.skill.description}
                        </Text>
                        <View style={styles.stepMeta}>
                          {isStarted && (
                            <Text style={styles.stepMetaText}>
                              {progress}% complete
                            </Text>
                          )}
                          {isLocked && (
                            <Text style={styles.stepMetaText}>
                              Available after Step {index}
                            </Text>
                          )}
                          {!isStarted && !isLocked && (
                            <Text style={styles.stepMetaText}>
                              ~{skillNode.skill.duration_hours} hours
                            </Text>
                          )}
                        </View>
                      </View>
                      {isStarted && !isLocked && progress < 100 && (
                        <Pressable
                          style={styles.stepPlayBtn}
                          onPress={() => (navigation as any).navigate("Roadmaps")}
                          accessible={false}
                        >
                          <Ionicons name="play" size={16} color={homeColors.onPrimary} />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyRoadmapCard}>
                <Ionicons name="map-outline" size={32} color={homeColors.primary} />
                <Text style={styles.emptyRoadmapText}>
                  No roadmap created yet. Take the quiz to get started!
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Recommended Mentors Preview */}
        <View style={styles.dashboardSection}>
          <Text style={styles.sectionTitle}>Recommended Mentors</Text>
          
          <Pressable
            style={styles.mentorPreviewContainer}
            onPress={() => (navigation as any).navigate("Mentors")}
            accessibilityRole="button"
            accessibilityLabel="Browse all mentors"
          >
            <View style={styles.mentorCard}>
              <View style={styles.mentorInfo}>
                <View style={styles.mentorInitials}>
                  <Text style={styles.mentorInitialsText}>SJ</Text>
                </View>
                <View style={styles.mentorDetails}>
                  <Text style={styles.mentorName}>Dr. Sarah Jenkins</Text>
                  <Text style={styles.mentorRole}>Lead UX Researcher @ FinTech</Text>
                  <View style={styles.mentorRating}>
                    <Ionicons name="star" size={12} color={homeColors.starYellow} />
                    <Text style={styles.mentorRatingText}>4.9</Text>
                    <Text style={styles.mentorSessions}>120+ sessions</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.mentorCard}>
              <View style={styles.mentorInfo}>
                <View style={styles.mentorInitials}>
                  <Text style={styles.mentorInitialsText}>MT</Text>
                </View>
                <View style={styles.mentorDetails}>
                  <Text style={styles.mentorName}>Marcus Thorne</Text>
                  <Text style={styles.mentorRole}>Product Design Director</Text>
                  <View style={styles.mentorRating}>
                    <Ionicons name="star" size={12} color={homeColors.starYellow} />
                    <Text style={styles.mentorRatingText}>5.0</Text>
                    <Text style={styles.mentorSessions}>85+ sessions</Text>
                  </View>
                </View>
              </View>
            </View>

            <Pressable
              style={styles.mentorBrowseBtn}
              onPress={() => (navigation as any).navigate("Mentors")}
            >
              <Ionicons name="people" size={16} color={homeColors.primary} />
              <Text style={styles.mentorBrowseBtnText}>Browse All Mentors</Text>
            </Pressable>
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Floating Chatbot */}
      <ChatbotButton onPress={() => setChatbotOpen(true)} />
      <ChatbotPanel visible={chatbotOpen} onClose={() => setChatbotOpen(false)} />
    </SafeAreaView>
  );
}

// Spacing scale (4dp grid) - referenced inside styles
// Define outside StyleSheet to use in component logic

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeColors.pageBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
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

  // ========================================================================
  // DASHBOARD STYLES
  // ========================================================================
  dashboardHero: {
    marginBottom: 32,
  },
  dashboardGreeting: {
    fontSize: 32,
    fontWeight: "800",
    color: homeColors.textDark,
    marginBottom: 8,
  },
  dashboardSubtext: {
    fontSize: 16,
    color: homeColors.onSurfaceVariant,
    marginBottom: 24,
    lineHeight: 22,
  },
  progressCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    shadowColor: homeColors.cardShadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: homeColors.onSurfaceVariant,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.primary,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: homeColors.primary + "20",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
  },

  // Action Cards Grid
  actionGrid: {
    gap: 16,
    marginBottom: 28,
  },
  actionCardLarge: {
    borderRadius: 24,
    overflow: "hidden",
  },
  actionCardLargePressed: {
    transform: [{ scale: 1.01 }],
  },
  actionCardSmall: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    padding: 20,
    shadowColor: homeColors.cardShadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  actionCardPressed: {
    opacity: 0.9,
  },
  actionCardGradient: {
    padding: 24,
    justifyContent: "space-between",
    minHeight: 180,
    position: "relative",
  },
  decorativeIconBg: {
    position: "absolute",
    bottom: -20,
    right: -20,
    zIndex: 0,
    opacity: 0.1,
  },
  decorativeIcon: {
    transform: [{ rotate: "12deg" }],
  },
  actionCardContent: {
    zIndex: 10,
    justifyContent: "space-between",
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: homeColors.onPrimary,
    marginBottom: 8,
  },
  actionCardDescription: {
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 21,
  },
  actionCardButton: {
    backgroundColor: homeColors.onPrimary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  actionCardButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  actionCardButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.primary,
  },
  actionCardSmallContent: {
    gap: 12,
  },
  actionCardIcon: {
    width: 48,
    height: 48,
    backgroundColor: homeColors.primary + "15",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCardSmallTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.onSurface,
  },
  actionCardSmallDescription: {
    fontSize: 14,
    color: homeColors.onSurfaceVariant,
    lineHeight: 20,
  },
  actionCardFileName: {
    fontSize: 13,
    color: homeColors.primary,
    fontWeight: "600",
  },
  actionCardSmallButton: {
    backgroundColor: homeColors.primary + "15",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  actionCardSmallButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.primary,
  },

  // CV Quick Actions
  cvQuickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  cvQuickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    minHeight: 44,
  },
  cvQuickActionChange: {
    backgroundColor: homeColors.primary + "15",
    borderWidth: 1,
    borderColor: homeColors.primary + "30",
  },
  cvQuickActionDelete: {
    backgroundColor: homeColors.error + "15",
    borderWidth: 1,
    borderColor: homeColors.error + "30",
  },
  cvQuickActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: homeColors.primary,
  },

  // Dashboard Sections
  dashboardSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  viewAllLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: homeColors.primary,
  },

  // Roadmap Preview
  roadmapPreview: {
    gap: 12,
  },
  roadmapStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: homeColors.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    shadowColor: homeColors.cardShadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  stepNumber: {
    width: 40,
    height: 40,
    backgroundColor: homeColors.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "700",
    color: homeColors.onPrimary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.onSurface,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: homeColors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 8,
  },
  stepMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepMetaText: {
    fontSize: 12,
    color: homeColors.onSurfaceVariant,
    fontWeight: "500",
  },
  stepPlayBtn: {
    width: 40,
    height: 40,
    backgroundColor: homeColors.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Empty Roadmap State
  emptyRoadmapCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    gap: 12,
  },
  emptyRoadmapText: {
    fontSize: 14,
    color: homeColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
  },

  // Mentor Preview
  mentorPreviewContainer: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    overflow: "hidden",
    shadowColor: homeColors.cardShadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  mentorCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: homeColors.cardBorder + "50",
  },
  mentorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mentorInitials: {
    width: 48,
    height: 48,
    backgroundColor: homeColors.primary + "20",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mentorInitialsText: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.primary,
  },
  mentorDetails: {
    flex: 1,
  },
  mentorName: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.onSurface,
    marginBottom: 2,
  },
  mentorRole: {
    fontSize: 12,
    color: homeColors.onSurfaceVariant,
    marginBottom: 6,
  },
  mentorRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mentorRatingText: {
    fontSize: 12,
    fontWeight: "700",
    color: homeColors.onSurface,
  },
  mentorSessions: {
    fontSize: 11,
    color: homeColors.onSurfaceVariant,
    marginLeft: 4,
    fontWeight: "500",
  },
  mentorBrowseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: homeColors.cardBorder,
    backgroundColor: homeColors.cardBg,
  },
  mentorBrowseBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.primary,
  },
});
