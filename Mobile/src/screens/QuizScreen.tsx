import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fetchQuizNext } from "../features/quiz/api";
import type {
  QuizQuestion,
  QuizResults,
  QuizOption,
  CareerRecommendation,
  ChatMessage,
} from "../features/quiz/types";
import { homeColors } from "./homeTheme";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "ai",
  content:
    "Hi 👋 I'm your AI Career Assistant. I'll ask you a few quick questions to discover careers that fit you perfectly. Ready? Let's go!",
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

function getIcon(name: string): keyof typeof Ionicons.glyphMap {
  return ICON_MAP[name] ?? "ellipse";
}

function ThinkingDots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((prev) => (prev + 1) % 4), 400);
    return () => clearInterval(id);
  }, []);
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
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResults = results !== null;
  const totalQuestions = 5;
  const currentStep = answers.length;
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
        setMessages((prev) => [
          ...prev,
          { id: `q-${response.questionNumber}`, role: "ai", content: response.question },
        ]);
      } else {
        setCurrentQuestion(null);
        setResults(response);
        setMessages((prev) => [
          ...prev,
          {
            id: "results-intro",
            role: "ai",
            content:
              "Based on your answers, here are careers that match you:",
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
    loadNext([]);
  }, []);

  const onSelectOption = (option: QuizOption) => {
    if (loading || isResults) return;
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
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };
  useEffect(() => {
    scrollToEnd();
  }, [messages, loading]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (isResults) {
              setResults(null);
              setAnswers([]);
              setCurrentQuestion(null);
              setMessages([WELCOME_MESSAGE]);
              loadNext([]);
            } else {
              Alert.alert(
                "Leave quiz?",
                "Your progress will be lost.",
                [
                  { text: "Stay", style: "cancel" },
                  { text: "Leave", style: "destructive", onPress: () => (navigation.getParent() as any)?.navigate?.("Home") },
                ]
              );
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color={homeColors.textDark} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="chatbubble-ellipses" size={20} color={homeColors.primary} />
          <Text style={styles.headerTitle}>Career Assistant</Text>
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
        colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
        style={styles.gradient}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg) => {
            if (msg.content === "__THINKING__") {
              return (
                <View key={msg.id} style={styles.bubbleRowLeft}>
                  <View style={styles.avatarAi}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={homeColors.primary} />
                  </View>
                  <View style={styles.bubbleAi}>
                    <Text style={styles.thinkingText}>AI is thinking</Text>
                    <ThinkingDots />
                  </View>
                </View>
              );
            }
            if (msg.role === "ai") {
              return (
                <View key={msg.id} style={styles.bubbleRowLeft}>
                  <View style={styles.avatarAi}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={homeColors.primary} />
                  </View>
                  <View style={styles.bubbleAi}>
                    <Text style={styles.bubbleAiText}>{msg.content}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={msg.id} style={styles.bubbleRowRight}>
                <View style={styles.bubbleUser}>
                  {msg.icon ? (
                    <Ionicons
                      name={getIcon(msg.icon)}
                      size={18}
                      color="#fff"
                      style={styles.bubbleUserIcon}
                    />
                  ) : null}
                  <Text style={styles.bubbleUserText}>{msg.content}</Text>
                </View>
              </View>
            );
          })}

          {/* Results: career cards */}
          {isResults && results && (
            <View style={styles.resultsBlock}>
              {results.careers.map((career, i) => (
                <CareerCard key={i} career={career} />
              ))}
            </View>
          )}

          {/* Current question options */}
          {!isResults && currentQuestion && !loading && (
            <>
              <Text style={styles.chooseLabel}>Choose an answer</Text>
              <View style={styles.optionsGrid}>
                {currentQuestion.options.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={({ pressed }) => [
                      styles.optionCard,
                      pressed && styles.optionCardPressed,
                    ]}
                    onPress={() => onSelectOption(opt)}
                  >
                    <Ionicons
                      name={getIcon(opt.icon)}
                      size={24}
                      color={homeColors.primary}
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
              <ActivityIndicator size="small" color={homeColors.primary} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}

          {/* Error state: show message and Retry */}
          {error && !loading && !currentQuestion && !isResults && (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                onPress={() => {
                  setError(null);
                  loadNext([]);
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

function CareerCard({ career }: { career: CareerRecommendation }) {
  const isHigh = career.matchPercent >= 88;
  return (
    <View style={styles.careerCard}>
      <View style={styles.careerCardHeader}>
        <Text style={styles.careerTitle}>{career.title}</Text>
        <View style={[styles.matchPill, isHigh ? styles.matchPillGreen : styles.matchPillOrange]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },
  container: {
    flex: 1,
    backgroundColor: homeColors.tabBarBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: homeColors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: homeColors.cardBorder,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    color: homeColors.textDark,
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
    color: homeColors.textDark,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: homeColors.primary,
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
    backgroundColor: homeColors.cardBg,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: homeColors.cardBorder,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: homeColors.primary,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 13,
    color: homeColors.textMuted,
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
    backgroundColor: homeColors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  bubbleAi: {
    maxWidth: "80%",
    backgroundColor: "#fff",
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
    color: homeColors.textDark,
    lineHeight: 22,
  },
  thinkingText: {
    fontSize: 14,
    color: homeColors.textMuted,
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
    backgroundColor: homeColors.cardBorder,
  },
  thinkingDotOn: {
    backgroundColor: homeColors.primary,
  },
  bubbleUser: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "85%",
    backgroundColor: homeColors.primary,
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
    color: homeColors.textMuted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
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
  optionIcon: {
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: homeColors.textDark,
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
    color: homeColors.textMuted,
  },
  errorBlock: {
    marginTop: 24,
    padding: 20,
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  errorText: {
    fontSize: 14,
    color: homeColors.textDark,
    marginBottom: 16,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: homeColors.primary,
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
    gap: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  careerCard: {
    backgroundColor: "#fff",
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
    color: homeColors.textDark,
    flex: 1,
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
    color: homeColors.textDark,
  },
  careerDesc: {
    fontSize: 14,
    color: homeColors.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: homeColors.primary + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: homeColors.primary,
  },
});
