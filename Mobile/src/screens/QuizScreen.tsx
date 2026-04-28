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
import { startQuiz, submitAnswer, setSessionId, getSessionId, getQuizResults, regenerateQuizResults, getQuizHistory } from "../features/quiz/api-backend";
import { clearQuizSession, getQuizSession, saveQuizSession } from "../features/quiz/storage";
import { AppLogo } from "../ui/AppLogo";
import { supabase } from "../api/supabase";
import { useAuth } from "../auth/AuthProvider";
import type {
  QuizQuestion,
  QuizResults,
  QuizOption,
  ChatMessage,
  QuestionWithAnswer,
  NovaProfileSummary,
} from "../features/quiz/types";

// Import static fallback questions
import { STATIC_NOVA_QUESTIONS } from "../features/quiz/api";
import { generateFallbackResults, computeDiscPercentages } from "../features/quiz/api";

const QUIZ_COLORS = {
  backgroundStart: "#F6F3FF",
  backgroundEnd: "#E9E2FF",
  cardBg: "#FFFFFF",
  cardBorder: "#EAE6F5",
  primary: "#8158F8",
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
  analytics: "analytics",
  people: "people",
  globe: "globe",
  locate: "locate",
  target: "locate",
  flash: "flash",
  trophy: "trophy",
  school: "school",
  heart: "heart",
  star: "star",
  bulb: "bulb",
  book: "book",
  time: "time",
  document: "document",
  call: "call",
  videocam: "videocam",
  chatbubbleEllipses: "chatbubble-ellipses",
  chatbubble: "chatbubble-ellipses",
chatbubbleellipses: "chatbubble-ellipses",
  shield_checkmark: "shield-checkmark",
  fitness: "fitness",
  car: "car",
  home: "home",
  wallet: "wallet",
  ear: "ear",
  code: "code",
  construct: "construct",
  handshake: "hand-left",
  briefcase: "briefcase",
  business: "briefcase",
  ribbon: "ribbon",
  palette: "color-palette",
  brush: "brush",
  create: "color-palette",
  pulse: "pulse",
  bookmark: "bookmark",
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

function buildMessagesFromSavedAnswers(questionsWithAnswers: QuestionWithAnswer[]): ChatMessage[] {
  const restored: ChatMessage[] = [WELCOME_MESSAGE];

  for (const qa of questionsWithAnswers) {
    restored.push({
      id: `saved-q-${qa.questionNumber}-${Math.random()}`,
      role: "ai",
      content: qa.question,
    });
    restored.push({
      id: `saved-a-${qa.questionNumber}-${Math.random()}`,
      role: "user",
      content: qa.selectedOption,
    });
  }

  restored.push({
    id: `saved-session-${Date.now()}`,
    role: "ai",
    content: "Welcome back. Your previous Nova report is saved. Tap Restart Quiz if you want a fresh assessment.",
  });

  return restored;
}

function normalizeHistoryAnswersToSession(answers: any[]): QuestionWithAnswer[] {
  if (!Array.isArray(answers)) return [];

  return answers
    .map((item: any, idx: number) => ({
      questionNumber: Number(item?.question_number ?? item?.questionNumber ?? idx + 1),
      question: String(item?.question ?? ""),
      selectedOption: String(item?.answer ?? item?.selected_option ?? item?.selectedOption ?? ""),
      allOptions: Array.isArray(item?.options)
        ? item.options.map((opt: any) => String(opt))
        : Array.isArray(item?.all_options)
          ? item.all_options.map((opt: any) => String(opt))
          : Array.isArray(item?.allOptions)
            ? item.allOptions.map((opt: any) => String(opt))
            : [],
    }))
    .filter((item) => item.question.trim().length > 0 || item.selectedOption.trim().length > 0)
    .sort((a, b) => a.questionNumber - b.questionNumber);
}

function getIcon(name: string): keyof typeof Ionicons.glyphMap {
  if (!name) return "ellipse";
  const lower = name.toLowerCase();
  
  // Direct lookup first
  if (ICON_MAP[lower]) return ICON_MAP[lower];
  
  // Try normalization
  const normalized = lower.replace(/[-_]/g, "");
  if (ICON_MAP[normalized]) return ICON_MAP[normalized];
  
  // Check if any key contains this name
  for (const key of Object.keys(ICON_MAP)) {
    if (key.includes(lower) || lower.includes(key)) {
      return ICON_MAP[key];
    }
  }
  
  // Default fallback
  return "ellipse";
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
  const { state } = useAuth();
  const user = state.user;
  const authLoading = state.isLoading;
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
    // Careers section styles
    careersSection: {
      gap: 12,
      marginTop: 8,
    },
    careersTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
      marginBottom: 4,
    },
    careerCard: {
      backgroundColor: QUIZ_COLORS.cardBg,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: QUIZ_COLORS.cardBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
      gap: 8,
    },
    careerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    careerTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: QUIZ_COLORS.textDark,
      flex: 1,
    },
    matchBadge: {
      backgroundColor: QUIZ_COLORS.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      minWidth: 48,
      alignItems: "center",
    },
    matchPercent: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
    careerDescription: {
      fontSize: 13,
      color: QUIZ_COLORS.textMuted,
      lineHeight: 18,
    },
    tagsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 4,
    },
    tag: {
      backgroundColor: QUIZ_COLORS.backgroundStart,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagText: {
      fontSize: 11,
      fontWeight: "600",
      color: QUIZ_COLORS.primary,
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

    try {
      let response: { question?: QuizQuestion; results?: QuizResults };

      if (nextAnswers.length === 0) {
        // Starting new quiz - call backend start endpoint
        const result = await startQuiz();
        response = { question: result.question };
        // Store backend session ID for future requests (do not save incomplete quiz session)
        await setSessionId(result.session.id);
        console.log('[QuizScreen] Started new backend session:', result.session.id);
      } else {
        // Submitting an answer
        response = await submitAnswer(nextAnswers[nextAnswers.length - 1], {
          questionNumber: currentQuestion?.questionNumber,
          question: currentQuestion?.question || '',
          options: (currentQuestion?.options || []).map((o) => o.label),
        });
      }

      console.log('[QuizScreen] API response:', JSON.stringify(response, null, 2));

      if (response.results) {
        // Quiz completed - got results
        const results = response.results as QuizResults;
        console.log('[QuizScreen] Got results with careers:', results.careers?.length);
        setCurrentQuestion(null);
        setResults(results);

        // Build complete quiz session with questions and answers
        const questionsWithAnswers: QuestionWithAnswer[] = questionsAsked.map((q, idx) => ({
          questionNumber: q.questionNumber,
          question: q.question,
          selectedOption: nextAnswers[idx] || "",
          allOptions: q.options,
        }));

        // Save complete session including results
        try {
          await saveQuizSession({
            questionsWithAnswers,
            results,
            completedAt: new Date().toISOString(),
          });
          console.log('[QuizScreen] Session saved successfully');
        } catch (saveErr) {
          console.error('[QuizScreen] Failed to save session:', saveErr);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `results-intro-${Date.now()}`,
            role: "ai",
            content:
              "Your Nova report is ready. Review your profile insights below.",
          },
        ]);
        return;
      }

      if (response.question) {
        const questionObj = response.question;
        console.log('[QuizScreen] Got question:', questionObj.question, 'questionNumber:', questionObj.questionNumber);
        // Ensure questionNumber is set
        const safeQuestionNumber = questionObj.questionNumber ?? answers.length + 1;
        const questionWithNumber = { ...questionObj, questionNumber: safeQuestionNumber };
        setCurrentQuestion(questionWithNumber);
        setQuestionsAsked((prev) => [
          ...prev,
          {
            questionNumber: safeQuestionNumber,
            question: questionObj.question,
            options: questionObj.options?.map((o) => o.label) || [],
          },
        ]);
        setMessages((prev) => [
          ...prev,
          { id: `q-${safeQuestionNumber}-${Date.now()}`, role: "ai", content: questionObj.question },
        ]);
        return;
      }

      throw new Error(`Unexpected quiz response shape: ${JSON.stringify(response).slice(0, 300)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      console.error('[Quiz] loadNext error:', e);

      // Check for network errors
      const isNetworkError = msg.includes('Network request failed') || msg.includes('timeout') || msg.includes('Unable to connect');

      // Check if it's an authentication error
      if (msg.includes('not authenticated') || msg.includes('Invalid or expired token') || msg.includes('401')) {
        Alert.alert(
          'Authentication Error',
          'Your session has expired. Please log in again to continue.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Login', onPress: async () => {
              await clearQuizSession();
              navigation.navigate('Login' as never);
            }},
          ]
        );
      } else if (isNetworkError) {
        setError('Network error. Please check your connection and try again.');
        Alert.alert('Connection Error', 'Please check your internet connection and try again.');
      } else {
        setError(msg);
        Alert.alert('Quiz Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const regenerateReport = async () => {
    if (!results) return;

    setLoading(true);
    setError(null);

    try {
      const sessionId = await getSessionId();
      if (!sessionId) {
        throw new Error("No saved quiz session found. Please take the quiz again.");
      }

      const response = await regenerateQuizResults(sessionId);
      if (!response || !('type' in response) || response.type !== 'results') {
        throw new Error("Failed to regenerate the Nova report.");
      }

      const newResults = response as QuizResults;
      setResults(newResults);

      const questionsWithAnswers: QuestionWithAnswer[] = questionsAsked.map((q, idx) => ({
        questionNumber: q.questionNumber,
        question: q.question,
        selectedOption: answers[idx] || "",
        allOptions: q.options,
      }));

      await saveQuizSession({
        questionsWithAnswers,
        results: newResults,
        completedAt: new Date().toISOString(),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `regen-${Date.now()}`,
          role: "ai",
          content: "Your Nova report has been regenerated from the full quiz session.",
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to regenerate the report right now.";
      setError(msg);
      Alert.alert("Regenerate report", msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeQuiz = async () => {
      // Check authentication first
      if (!user) {
        setLoading(false);
        if (!authLoading) {
          Alert.alert(
            'Authentication Required',
            'Please log in to take the quiz.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Login', onPress: () => navigation.navigate('Login' as never) },
            ]
          );
        }
        return;
      }

      setLoading(true);
      try {
        // Check if we have a completed quiz session stored locally
        const savedSession = await getQuizSession();
        if (!mounted) return;

        if (savedSession?.results?.novaProfile) {
          const savedCareers = savedSession.results.careers || [];
          const hasNonZeroCareerMatch = savedCareers.some(
            (career) => typeof career.matchPercent === 'number' && career.matchPercent > 0,
          );
          const savedDisc = savedSession.results.novaProfile?.behavior?.discPercentages;
          const hasNonZeroDisc = !!savedDisc &&
            [savedDisc.red, savedDisc.yellow, savedDisc.green, savedDisc.blue].some(
              (value) => typeof value === 'number' && value > 0,
            );

          // Ignore stale local sessions captured before percentage fixes.
          if (!hasNonZeroCareerMatch && !hasNonZeroDisc) {
            await clearQuizSession();
          } else {
          // We have saved results, display them and rebuild full Q/A chat history
          setResults(savedSession.results);
          setCurrentQuestion(null);
          const restoredQuestions = savedSession.questionsWithAnswers ?? [];
          setAnswers(restoredQuestions.map((item) => item.selectedOption));
          setQuestionsAsked(
            restoredQuestions.map((item) => ({
              questionNumber: item.questionNumber,
              question: item.question,
              options: item.allOptions,
            }))
          );
          setMessages(buildMessagesFromSavedAnswers(restoredQuestions));
          return;
          }
        }

        // Check if we have a backend session ID - try to get results
        const sessionId = await getSessionId();

        if (sessionId) {
          try {
            const results = await getQuizResults(sessionId);
            // Session completed on backend, show results
            setResults(results);
            setCurrentQuestion(null);

            // Rehydrate full question/answer history from backend quiz history.
            const history = await getQuizHistory();
            const matchingSession = Array.isArray(history)
              ? history.find((entry: any) => String(entry?.id ?? entry?.session_id ?? "") === String(sessionId))
              : null;

            const restoredQuestions = normalizeHistoryAnswersToSession(matchingSession?.answers ?? []);

            if (restoredQuestions.length > 0) {
              setAnswers(restoredQuestions.map((item) => item.selectedOption));
              setQuestionsAsked(
                restoredQuestions.map((item) => ({
                  questionNumber: item.questionNumber,
                  question: item.question,
                  options: item.allOptions,
                }))
              );
              setMessages(buildMessagesFromSavedAnswers(restoredQuestions));

              await saveQuizSession({
                questionsWithAnswers: restoredQuestions,
                results,
                completedAt: new Date().toISOString(),
              });
            } else {
              setMessages([
                WELCOME_MESSAGE,
                {
                  id: `saved-session-${Date.now()}`,
                  role: "ai",
                  content: "Welcome back. Your Nova report is saved. Tap Restart Quiz if you want a fresh assessment.",
                },
              ]);
            }
            return;
          } catch (error) {
            // Session not found or not completed - start fresh
            console.log('[Quiz] No valid backend session, starting new quiz');
            await clearQuizSession();
          }
        }

        // Start new quiz
        await loadNext([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeQuiz();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

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
          <Text style={styles.headerTitle}>Career Quiz</Text>
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
                    accessibilityLabel="Regenerate report"
                    accessibilityHint="Rebuilds your Nova report from the completed quiz session without restarting the quiz"
                    disabled={loading}
                    onPress={regenerateReport}
                  >
                    <Ionicons name="reload" size={16} color={QUIZ_COLORS.textDark} />
                    <Text style={styles.restartButtonText}>{loading ? "Regenerating..." : "Regenerate Report"}</Text>
                  </Pressable>

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
  const styleComparison = profile.styleComparison ?? {
    naturalStyleSummary: "Your natural style reflects how you prefer to work day-to-day.",
    adaptedStyleSummary: "Your adapted style shows how you adjust to different situations.",
    adaptationDrivers: [],
    stressSignals: [],
  };

  const motivations = profile.motivations ?? {
    topMotivators: [],
    demotivators: [],
    valuesSummary: "Your motivations reflect what energizes you and keeps you engaged at work.",
  };

  const cognition = profile.cognition ?? {
    decisionStyle: "Balanced",
    thinkingStyle: "Balanced",
    learningStyle: "Balanced",
    communicationStyle: "Balanced",
  };

  const careerProjection = profile.careerProjection ?? {
    bestFitEnvironments: [],
    leadershipStyle: "Balanced",
    watchouts: [],
    futureFocus: "Your future trajectory will be strongest in environments that align with your strengths.",
  };

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
          Note: These DISC percentages are independent indicators, so they do not have to add up to 100%.
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
          Natural: {styleComparison.naturalStyleSummary}
        </Text>
        <Text style={styles.novaSectionText}>
          Adapted: {styleComparison.adaptedStyleSummary}
        </Text>
        <Text style={styles.novaSectionText}>
          Adaptation drivers: {(styleComparison.adaptationDrivers || []).join(", ")}
        </Text>
        <Text style={styles.novaSectionText}>
          Stress signals: {(styleComparison.stressSignals || []).join(", ")}
        </Text>
        <View style={styles.tagsRow}>
          {(profile.behavior?.traits || []).slice(0, 4).map((trait, i) => (
            <View key={`trait-${i}`} style={styles.tag}>
              <Text style={styles.tagText}>{trait}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.novaSection}>
        <Text style={styles.novaSectionTitle}>Deep Motivations (Your Why)</Text>
        <Text style={styles.novaSectionText}>{motivations.valuesSummary}</Text>
        <View style={styles.tagsRow}>
          {(motivations.topMotivators || []).slice(0, 3).map((item, i) => (
            <View key={`mot-${i}`} style={styles.tag}>
              <Text style={styles.tagText}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.novaSectionText}>
          Demotivators: {(motivations.demotivators || []).join(", ")}
        </Text>
      </View>

      <View style={styles.novaSection}>
        <Text style={styles.novaSectionTitle}>Cognition, Communication, and Projection</Text>
        <Text style={styles.novaSectionText}>
          Decision style: {cognition.decisionStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Thinking preference: {cognition.thinkingStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Learning style: {cognition.learningStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Communication style: {cognition.communicationStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Best-fit environments: {(careerProjection.bestFitEnvironments || []).join(", ")}
        </Text>
        <Text style={styles.novaSectionText}>
          Leadership style: {careerProjection.leadershipStyle}
        </Text>
        <Text style={styles.novaSectionText}>
          Watchouts: {(careerProjection.watchouts || []).join(", ")}
        </Text>
        <Text style={styles.novaSectionText}>
          Future projection: {careerProjection.futureFocus}
        </Text>
        <Text style={styles.novaSectionText}>
          Development axes: {(profile.recommendedDevelopmentAxes || []).join(", ")}
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
