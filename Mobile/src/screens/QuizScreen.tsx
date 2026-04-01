import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  AccessibilityInfo,
} from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchQuizNext } from "../features/quiz/api";
import { clearQuizSession, getQuizSession, saveQuizSession } from "../features/quiz/storage";
import { AppLogo } from "../ui/AppLogo";
import type {
  QuizQuestion,
  QuizResults,
  QuizOption,
  ChatMessage,
  QuestionWithAnswer,
  NovaProfileSummary,
} from "../features/quiz/types";

const QUIZ_COLORS = {
  backgroundStart: "#F6F3FF",
  backgroundEnd: "#E9E2FF",
  cardBg: "#FFFFFF",
  cardBorder: "#EAE6F5",
  primary: "#6D4CFF",
  textDark: "#1F2937",
  textMuted: "#4B5563",
  tabBarBg: "#FFFFFF",
};

type HomeStackParamList = {
  HomeMain: undefined;
  Quiz: undefined;
  SkillsReview: undefined;
  CVAnalysis: undefined;
};

type QuizScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Quiz'>;

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "ai",
  content:
    "Hi 👋 I will run a short professional Nova profile quiz to understand how you think, act, and stay motivated at work.",
};

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  brush: "brush",
  palette: "color-palette",
  people: "people",
  globe: "globe",
  business: "business",
  ribbon: "ribbon",
  flash: "flash",
  trophy: "trophy",
  construct: "construct",
  target: "locate",
  handshake: "hand-left",
  code: "code",
  analytics: "analytics",
};

const DISC_META = {
  red: {
    label: "Red - Dominance",
    color: "#EF4444",
    description: "Direct, decisive, competitive. Focused on action and results.",
  },
  yellow: {
    label: "Yellow - Influence",
    color: "#EAB308",
    description: "Expressive, persuasive, social. Creates team energy.",
  },
  green: {
    label: "Green - Steadiness",
    color: "#22C55E",
    description: "Patient, reliable, collaborative. Seeks harmony and consistency.",
  },
  blue: {
    label: "Blue - Conscientiousness",
    color: "#3B82F6",
    description: "Analytical, precise, high-standard. Prioritizes quality and accuracy.",
  },
} as const;

function getIcon(name: string): keyof typeof Ionicons.glyphMap {
  return ICON_MAP[name] ?? "ellipse";
}

function ThinkingDots({
  reduceMotion,
  styles,
}: {
  reduceMotion: boolean;
  styles: any;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduceMotion) return; // Skip animation if reduced motion is enabled
    const id = setInterval(() => setN((prev) => (prev + 1) % 4), 400);
    return () => clearInterval(id);
  }, [reduceMotion]);
  // If reduced motion, show all three dots as "on" (static indicator)
  if (reduceMotion) {
    return (
      <View style={styles.thinkingWrap}>
        <View style={[styles.thinkingDot, { backgroundColor: QUIZ_COLORS.primary }]} />
        <View style={[styles.thinkingDot, { backgroundColor: QUIZ_COLORS.primary }]} />
        <View style={[styles.thinkingDot, { backgroundColor: QUIZ_COLORS.primary }]} />
      </View>
    );
  }
  return (
    <View style={styles.thinkingWrap}>
      <View style={[styles.thinkingDot, n > 0 && styles.thinkingDotOn]} />
      <View style={[styles.thinkingDot, n > 1 && styles.thinkingDotOn]} />
      <View style={[styles.thinkingDot, n > 2 && styles.thinkingDotOn]} />
    </View>
  );
}

export default function QuizScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<QuizScreenNavigationProp>();
  const scrollRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [questionsAsked, setQuestionsAsked] = useState<
    Array<{
      questionNumber: number;
      question: string;
      options: string[];
    }>
  >([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Static styles using QUIZ_COLORS
  const styles = StyleSheet.create({
    pressed: { opacity: 0.9 },
    container: {
      flex: 1,
      backgroundColor: QUIZ_COLORS.tabBarBg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: QUIZ_COLORS.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: QUIZ_COLORS.cardBorder,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingRight: 12,
    },
    backText: {
      fontSize: 16,
      color: QUIZ_COLORS.textDark,
      marginLeft: 4,
    },
    headerCenter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
    },
    aiBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: QUIZ_COLORS.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 4,
    },
    aiBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
    },
    progressWrap: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 6,
      backgroundColor: QUIZ_COLORS.cardBg,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: QUIZ_COLORS.cardBorder,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: QUIZ_COLORS.primary,
      borderRadius: 3,
    },
    progressLabel: {
      fontSize: 13,
      color: QUIZ_COLORS.textMuted,
      marginTop: 6,
      textAlign: "center",
    },
    gradient: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    bubbleRowLeft: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: 12,
    },
    bubbleRowRight: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 12,
    },
    avatarAi: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: QUIZ_COLORS.cardBg,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    bubbleAi: {
      maxWidth: "80%",
      backgroundColor: QUIZ_COLORS.cardBg,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    bubbleAiText: {
      fontSize: 15,
      color: QUIZ_COLORS.textDark,
      lineHeight: 22,
    },
    thinkingText: {
      fontSize: 14,
      color: QUIZ_COLORS.textMuted,
      marginBottom: 6,
    },
    thinkingWrap: {
      flexDirection: "row",
      gap: 4,
    },
    thinkingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: QUIZ_COLORS.cardBorder,
    },
    thinkingDotOn: {
      backgroundColor: QUIZ_COLORS.primary,
    },
    bubbleUser: {
      flexDirection: "row",
      alignItems: "center",
      maxWidth: "85%",
      backgroundColor: QUIZ_COLORS.primary,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      gap: 8,
    },
    bubbleUserIcon: {
      marginRight: 2,
    },
    bubbleUserText: {
      fontSize: 15,
      fontWeight: "500",
      color: "#fff",
    },
    chooseLabel: {
      fontSize: 14,
      color: QUIZ_COLORS.textMuted,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 12,
    },
    optionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
      marginBottom: 24,
    },
    optionCard: {
      width: "47%",
      minHeight: 96,
      backgroundColor: "#fff",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: QUIZ_COLORS.cardBorder,
      paddingVertical: 16,
      paddingHorizontal: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    optionCardPressed: {
      opacity: 0.85,
    },
    optionCardSingleColumn: {
      width: "100%",
    },
    optionIcon: {
      marginBottom: 8,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: QUIZ_COLORS.textDark,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
    },
    loadingText: {
      fontSize: 14,
      color: QUIZ_COLORS.textMuted,
    },
    errorBlock: {
      marginTop: 24,
      padding: 20,
      backgroundColor: QUIZ_COLORS.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: QUIZ_COLORS.cardBorder,
    },
    errorText: {
      fontSize: 14,
      color: QUIZ_COLORS.textMuted,
      marginBottom: 16,
      lineHeight: 20,
    },
    retryButton: {
      alignSelf: "flex-start",
      backgroundColor: QUIZ_COLORS.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    retryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
    resultsBlock: {
      gap: 16,
      marginTop: 8,
      marginBottom: 24,
    },
    novaCard: {
      backgroundColor: QUIZ_COLORS.cardBg,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: QUIZ_COLORS.cardBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
      gap: 10,
    },
    novaHeaderRow: {
      gap: 8,
    },
    novaBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: QUIZ_COLORS.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    novaBadgeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
    },
    novaHeadline: {
      fontSize: 16,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
    },
    novaIdentity: {
      fontSize: 14,
      color: QUIZ_COLORS.textMuted,
      lineHeight: 20,
    },
    novaSection: {
      gap: 6,
    },
    novaSectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
    },
    novaSectionText: {
      fontSize: 13,
      color: QUIZ_COLORS.textMuted,
      lineHeight: 18,
    },
    novaSectionHint: {
      fontSize: 12,
      color: QUIZ_COLORS.textMuted,
      lineHeight: 17,
      fontStyle: "italic",
    },
    discRow: {
      marginTop: 6,
      gap: 5,
    },
    discRowHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    discDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },
    discLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
    },
    discPercent: {
      fontSize: 12,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
    },
    discTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: QUIZ_COLORS.cardBorder,
      overflow: "hidden",
    },
    discFill: {
      height: "100%",
      borderRadius: 999,
    },
    discDescription: {
      fontSize: 12,
      color: QUIZ_COLORS.textMuted,
      lineHeight: 17,
    },
    careerCard: {
      backgroundColor: QUIZ_COLORS.cardBg,
      borderRadius: 16,
      padding: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    careerCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    careerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
    },
    matchPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    matchPillGreen: {
      backgroundColor: "#DCFCE7",
    },
    matchPillOrange: {
      backgroundColor: "#FFEDD5",
    },
    matchPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
    },
    careerDesc: {
      fontSize: 14,
      color: QUIZ_COLORS.textMuted,
      lineHeight: 20,
      marginBottom: 12,
    },
    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    tag: {
      backgroundColor: QUIZ_COLORS.primary + "20",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    tagText: {
      fontSize: 12,
      fontWeight: "600",
      color: QUIZ_COLORS.primary,
    },
    roadmapBtn: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: QUIZ_COLORS.primary,
    },
    roadmapBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
    restartButton: {
      alignSelf: "flex-start",
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: QUIZ_COLORS.cardBorder,
      backgroundColor: "#fff",
    },
    restartButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
    },
  });

  const isResults = results !== null;
  const totalQuestions = currentQuestion?.totalQuestions ?? 10;
  const currentStep = answers.length;
  const singleColumnOptions = width < 390;
  const progress = totalQuestions > 0 ? (currentStep / totalQuestions) * 100 : 0;

  const loadNext = async (nextAnswers: string[]) => {
    setLoading(true);
    setError(null);
    if (nextAnswers.length > 0) {
      setMessages((prev) => [
        ...prev,
        { id: `thinking-${Date.now()}`, role: "ai", content: "__THINKING__" },
      ]);
    }
    try {
      const response = await fetchQuizNext({ answers: nextAnswers });
      setMessages((prev) => prev.filter((m) => m.content !== "__THINKING__"));

      if (response.type === "question") {
        setCurrentQuestion(response);
        // Track the question and its options for AI analysis
        setQuestionsAsked((prev) => [
          ...prev,
          {
            questionNumber: response.questionNumber,
            question: response.question,
            options: response.options.map((o) => o.label),
          },
        ]);
        setMessages((prev) => [
          ...prev,
          { id: `q-${response.questionNumber}-${Date.now()}`, role: "ai", content: response.question },
        ]);
      } else {
        setCurrentQuestion(null);
        setResults(response);
        
        // Build complete quiz session with questions and answers
        const questionsWithAnswers: QuestionWithAnswer[] = questionsAsked.map((q, idx) => ({
          questionNumber: q.questionNumber,
          question: q.question,
          selectedOption: nextAnswers[idx] || "",
          allOptions: q.options,
        }));
        
        // Save complete session
        await saveQuizSession({
          questionsWithAnswers,
          results: response,
          completedAt: new Date().toISOString(),
        });
        
        setMessages((prev) => [
          ...prev,
          {
            id: `results-intro-${Date.now()}`,
            role: "ai",
            content:
              "Your Nova report is ready. You can restart the quiz anytime to refresh it.",
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.content !== "__THINKING__"));
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      Alert.alert("Quiz error", msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeQuiz = async () => {
      setLoading(true);
      try {
        const savedSession = await getQuizSession();
        if (!mounted) return;

        if (savedSession?.results?.novaProfile) {
          setResults(savedSession.results);
          setCurrentQuestion(null);
          setAnswers(savedSession.questionsWithAnswers.map((item) => item.selectedOption));
          setQuestionsAsked(
            savedSession.questionsWithAnswers.map((item) => ({
              questionNumber: item.questionNumber,
              question: item.question,
              options: item.allOptions,
            }))
          );
          setMessages([
            WELCOME_MESSAGE,
            {
              id: `saved-session-${Date.now()}`,
              role: "ai",
              content:
                "Welcome back. Your previous Nova report is saved. Tap Restart Quiz if you want a fresh assessment.",
            },
          ]);
          return;
        }

        await loadNext([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeQuiz();

    return () => {
      mounted = false;
    };
  }, []);

  // Reduced motion support
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    // Get initial value
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => subscription?.remove();
  }, []);

  const onSelectOption = async (option: QuizOption) => {
    if (loading || isResults) return;
    // Haptic feedback for tactile response
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAnswers = [...answers, option.label];
    setAnswers(newAnswers);
    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: "user", content: option.label, icon: option.icon },
    ]);
    setCurrentQuestion(null);
    loadNext(newAnswers);
  };

  const scrollToEnd = () => {
    // FlatList scrollToEnd is called via ref
  };
  useEffect(() => {
    // Auto-scroll when new messages are added
    if (messages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen or asks to confirm leaving the quiz"
          hitSlop={8}
          onPress={() => {
            if (isResults) {
              navigation.goBack();
            } else {
              Alert.alert(
                "Leave quiz?",
                "Your progress will be lost.",
                [
                  { text: "Stay", style: "cancel" },
                  { text: "Leave", style: "destructive", onPress: () => navigation.goBack() },
                ]
              );
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color={QUIZ_COLORS.textDark} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <AppLogo size={24} />
          <Text style={styles.headerTitle}>Nova Profile</Text>
        </View>
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={12} color="#fff" />
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {isResults ? "Done" : `Question ${currentStep + 1} of ${totalQuestions}`}
        </Text>
      </View>

      {/* Chat + options or results */}
      <LinearGradient
        colors={[QUIZ_COLORS.backgroundStart, QUIZ_COLORS.backgroundEnd]}
        style={styles.gradient}
      >
        <FlatList
          ref={scrollRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (item.content === "__THINKING__") {
              return (
                <View key={item.id} style={styles.bubbleRowLeft}>
                  <View style={styles.avatarAi}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={QUIZ_COLORS.primary} />
                  </View>
                  <View style={styles.bubbleAi}>
                    <Text style={styles.thinkingText}>Analyzing your profile</Text>
                    <ThinkingDots reduceMotion={reduceMotion} styles={styles} />
                  </View>
                </View>
              );
            }
            if (item.role === "ai") {
              return (
                <View key={item.id} style={styles.bubbleRowLeft}>
                  <View style={styles.avatarAi}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={QUIZ_COLORS.primary} />
                  </View>
                  <View style={styles.bubbleAi}>
                    <Text style={styles.bubbleAiText}>{item.content}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={item.id} style={styles.bubbleRowRight}>
                <View style={styles.bubbleUser}>
                  {item.icon ? (
                    <Ionicons
                      name={getIcon(item.icon)}
                      size={18}
                      color="#fff"
                      style={styles.bubbleUserIcon}
                    />
                  ) : null}
                  <Text style={styles.bubbleUserText}>{item.content}</Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <>
              {/* Results: career cards */}
              {isResults && results && (
                <View style={styles.resultsBlock}>
                  {results.novaProfile ? <NovaProfileCard profile={results.novaProfile} styles={styles} /> : null}
                  <Pressable
                    style={({ pressed }) => [styles.restartButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Restart quiz"
                    accessibilityHint="Clears current saved quiz and starts a new Nova assessment"
                    onPress={() => {
                      Alert.alert(
                        "Restart quiz?",
                        "This will clear your saved quiz session and Nova report from this device.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Restart",
                            style: "destructive",
                            onPress: async () => {
                              await clearQuizSession();
                              setResults(null);
                              setAnswers([]);
                              setQuestionsAsked([]);
                              setCurrentQuestion(null);
                              setMessages([WELCOME_MESSAGE]);
                              setError(null);
                              await loadNext([]);
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="refresh" size={16} color={QUIZ_COLORS.textDark} />
                    <Text style={styles.restartButtonText}>Restart Quiz</Text>
                  </Pressable>
                </View>
              )}

              {/* Current question options */}
              {!isResults && currentQuestion && !loading && (
                <>
                  <Text style={styles.chooseLabel}>Choose the answer that fits you best</Text>
                  <View style={styles.optionsGrid}>
                    {currentQuestion.options.map((opt) => (
                      <Pressable
                        key={opt.id}
                        style={({ pressed }) => [
                          styles.optionCard,
                          singleColumnOptions && styles.optionCardSingleColumn,
                          pressed && styles.optionCardPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Answer option: ${opt.label}`}
                        accessibilityHint="Selects this option and moves to the next question"
                        disabled={loading}
                        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                        onPress={() => onSelectOption(opt)}
                      >
                        <Ionicons
                          name={getIcon(opt.icon)}
                          size={24}
                          color={QUIZ_COLORS.primary}
                          style={styles.optionIcon}
                        />
                        <Text style={styles.optionLabel}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {loading && !messages.some((m) => m.content === "__THINKING__") && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={QUIZ_COLORS.primary} />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              )}

              {/* Error state: show message and Retry */}
              {error && !loading && !currentQuestion && !isResults && (
                <View style={styles.errorBlock}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Retry quiz"
                    accessibilityHint="Attempts to load the quiz again"
                    onPress={() => {
                      setError(null);
                      loadNext([]);
                    }}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              )}
            </>
          }
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            // Auto-scroll to bottom when content changes
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
          }}
        />
      </LinearGradient>
    </View>
  );
}

function NovaProfileCard({
  profile,
  styles,
}: {
  profile: NovaProfileSummary;
  styles: any;
}) {
  const disc = profile.behavior.discPercentages ?? {
    red: 25,
    yellow: 25,
    green: 25,
    blue: 25,
  };

  const dominantDisc =
    (Object.entries(disc).sort((a, b) => b[1] - a[1])[0]?.[0] as
      | "red"
      | "yellow"
      | "green"
      | "blue"
      | undefined) ?? "blue";

  return (
    <View style={styles.novaCard}>
      <View style={styles.novaHeaderRow}>
        <View style={styles.novaBadge}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <Text style={styles.novaBadgeText}>Nova Report</Text>
        </View>
        <Text style={styles.novaHeadline}>{profile.headline}</Text>
      </View>

      <Text style={styles.novaIdentity}>{profile.professionalIdentity}</Text>

      <View style={styles.novaSection}>
        <Text style={styles.novaSectionTitle}>DISC Color Profile</Text>
        <Text style={styles.novaSectionText}>
          Dominant style: {DISC_META[dominantDisc].label}
        </Text>
        <Text style={styles.novaSectionHint}>
          Note: DISC percentages are independent indicators and do not need to total 100%.
        </Text>

        {(["red", "yellow", "green", "blue"] as const).map((key) => (
          <View key={key} style={styles.discRow}>
            <View style={styles.discRowHeader}>
              <View style={[styles.discDot, { backgroundColor: DISC_META[key].color }]} />
              <Text style={styles.discLabel}>{DISC_META[key].label}</Text>
              <Text style={styles.discPercent}>{disc[key]}%</Text>
            </View>
            <View style={styles.discTrack}>
              <View
                style={[
                  styles.discFill,
                  {
                    width: `${Math.max(0, Math.min(100, disc[key]))}%`,
                    backgroundColor: DISC_META[key].color,
                  },
                ]}
              />
            </View>
            <Text style={styles.discDescription}>{DISC_META[key].description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.novaSection}>
        <Text style={styles.novaSectionTitle}>Natural vs Adapted Style</Text>
        <Text style={styles.novaSectionText}>
          Natural: {profile.styleComparison.naturalStyleSummary}
        </Text>
        <Text style={styles.novaSectionText}>
          Adapted: {profile.styleComparison.adaptedStyleSummary}
        </Text>
        <Text style={styles.novaSectionText}>
          Adaptation drivers: {profile.styleComparison.adaptationDrivers.join(", ")}
        </Text>
        <Text style={styles.novaSectionText}>
          Stress signals: {profile.styleComparison.stressSignals.join(", ")}
        </Text>
        <View style={styles.tagsRow}>
          {profile.behavior.traits.slice(0, 4).map((trait, i) => (
            <View key={`trait-${i}`} style={styles.tag}>
              <Text style={styles.tagText}>{trait}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.novaSection}>
        <Text style={styles.novaSectionTitle}>Deep Motivations (Your Why)</Text>
        <Text style={styles.novaSectionText}>{profile.motivations.valuesSummary}</Text>
        <View style={styles.tagsRow}>
          {profile.motivations.topMotivators.slice(0, 3).map((item, i) => (
            <View key={`mot-${i}`} style={styles.tag}>
              <Text style={styles.tagText}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.novaSectionText}>
          Demotivators: {profile.motivations.demotivators.join(", ")}
        </Text>
      </View>

      <View style={styles.novaSection}>
        <Text style={styles.novaSectionTitle}>Cognition, Communication, and Projection</Text>
        <Text style={styles.novaSectionText}>
          Decision style: {profile.cognition.decisionStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Thinking preference: {profile.cognition.thinkingStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Learning style: {profile.cognition.learningStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Communication style: {profile.cognition.communicationStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Best-fit environments: {profile.careerProjection.bestFitEnvironments.join(", ")}
        </Text>
        <Text style={styles.novaSectionText}>
          Leadership style: {profile.careerProjection.leadershipStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Watchouts: {profile.careerProjection.watchouts.join(", ")}
        </Text>
        <Text style={styles.novaSectionText}>
          Future projection: {profile.careerProjection.futureFocus}
        </Text>
        <Text style={styles.novaSectionText}>
          Development axes: {profile.recommendedDevelopmentAxes.join(", ")}
        </Text>
      </View>
    </View>
  );
}

function CareerCard({
  career,
  styles,
  onGenerateRoadmap,
}: {
  career: CareerRecommendation;
  styles: any;
  onGenerateRoadmap: () => void;
}) {
  const isHigh = career.matchPercent >= 88;
  return (
    <View style={styles.careerCard}>
      <View style={styles.careerCardHeader}>
        <Text style={styles.careerTitle}>{career.title}</Text>
        <View
          style={[
            styles.matchPill,
            isHigh ? styles.matchPillGreen : styles.matchPillOrange,
          ]}
        >
          <Text style={styles.matchPillText}>{career.matchPercent}% match</Text>
        </View>
      </View>
      <Text style={styles.careerDesc}>{career.description}</Text>
      <View style={styles.tagsRow}>
        {career.tags.map((tag, i) => (
          <View key={i} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
      <Pressable
        style={({ pressed }) => [styles.roadmapBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Generate roadmap for ${career.title}`}
        accessibilityHint="Opens a personalized career roadmap generator"
        onPress={onGenerateRoadmap}
      >
        <Ionicons name="map" size={16} color="#fff" />
        <Text style={styles.roadmapBtnText}>Generate roadmap</Text>
      </Pressable>
    </View>
  );
}
