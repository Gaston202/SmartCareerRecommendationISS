import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCareersWithSkills } from "../features/careers";
import { useMatchedCareers } from "../features/careers/useMatchedCareers";
import { generatePersona } from "../features/careers/ai-persona.service";
import { homeColors } from "./homeTheme";
import { MainTopBar } from "../ui/MainTopBar";

const DEMAND_LABELS: Record<string, { label: string; color: string }> = {
  "very-high": { label: "Very High", color: "#4CAF50" },
  high: { label: "High", color: "#8BC34A" },
  medium: { label: "Medium", color: "#FFC107" },
  low: { label: "Low", color: "#FF9800" },
};

// Career title patterns to icon mapping (lucide-inspired icons using Ionicons)
const CAREER_ICON_MAP: Record<string, string> = {
  // Tech/Software roles
  "software engineer": "code-outline",
  "frontend developer": "code-slash-outline",
  "backend developer": "server-outline",
  "full stack developer": "code-outline",
  "mobile developer": "phone-portrait-outline",
  "devops engineer": "settings-outline",
  "cloud architect": "cloud-outline",
  "cybersecurity": "shield-outline",
  "security engineer": "shield-outline",
  "data scientist": "analytics-outline",
  "machine learning": "brain-outline",
  "ai engineer": "brain-outline",
  
  // Product/Design roles
  "product manager": "briefcase-outline",
  "product owner": "briefcase-outline",
  "ux designer": "color-palette-outline",
  "ui designer": "color-palette-outline",
  "design": "color-palette-outline",
  "graphic designer": "color-palette-outline",
  "ux researcher": "people-outline",
  "user researcher": "people-outline",
  "interaction designer": "hand-right-outline",
  
  // Business roles
  "business analyst": "analytics-outline",
  "sales": "trending-up-outline",
  "marketing": "megaphone-outline",
  "finance": "cash-outline",
  "accountant": "calculator-outline",
  "consultant": "bulb-outline",
  
  // Management/HR
  "manager": "people-outline",
  "hr": "people-outline",
  "human resources": "people-outline",
  "team lead": "people-outline",
  "director": "briefcase-outline",
  
  // Other roles
  "architect": "layers-outline",
  "engineer": "settings-outline",
  "scientist": "flask-outline",
  "researcher": "flask-outline",
  "analyst": "analytics-outline",
  "strategist": "compass-outline",
  "coordinator": "calendar-outline",
  "specialist": "medal-outline",
  "administrator": "settings-outline",
};

// Get icon name for a career title
const getCareerIcon = (title: string): string => {
  if (!title) return "briefcase-outline";
  
  const lowerTitle = title.toLowerCase();
  
  // Try exact match first
  if (CAREER_ICON_MAP[lowerTitle]) {
    return CAREER_ICON_MAP[lowerTitle];
  }
  
  // Try substring matching
  for (const [key, icon] of Object.entries(CAREER_ICON_MAP)) {
    if (lowerTitle.includes(key) || key.includes(lowerTitle)) {
      return icon;
    }
  }
  
  // Default icon
  return "briefcase-outline";
};

const formatSalaryCompact = (value?: number): string => {
  if (!value || value <= 0) return "N/A";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${value}`;
};

const formatGrowthRate = (value?: number): string => {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${value}%`;
};

const getDemandMeta = (value?: string): { label: string; color: string } => {
  const key = String(value || "medium").toLowerCase();
  return DEMAND_LABELS[key] || DEMAND_LABELS.medium;
};

const ProgressCircle = ({ percentage, size = 64 }: { percentage: number; size?: number }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: percentage,
      duration: 1500,
      useNativeDriver: false,
    }).start();
  }, [percentage, animatedValue]);

  return (
    <View style={[styles.progressCircle, { width: size, height: size }]}>
      <Text style={styles.progressText}>{Math.round(percentage)}%</Text>
      <Animated.View
        style={[
          styles.progressRing,
          {
            borderColor: homeColors.primary,
          },
        ]}
      >
        <View style={{ width: size, height: size }} />
      </Animated.View>
    </View>
  );
};

export default function CareersScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isLoading, error } = useCareersWithSkills();
  const { data: matchedCareers, isLoading: matchedLoading } = useMatchedCareers();
  const [persona, setPersona] = useState<{
    title: string;
    description: string;
    traits: string[];
  } | null>(null);
  const [personaLoading, setPersonaLoading] = useState(true);
  const insetBottom = useSafeAreaInsets().bottom;

  // Load AI-generated persona
  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const generatedPersona = await generatePersona();
        if (!isActive) return;
        setPersona({
          title: generatedPersona.title,
          description: generatedPersona.description,
          traits: generatedPersona.traits,
        });
      } catch (err) {
        console.warn('[CareersScreen] Failed to load persona', err);
        if (!isActive) return;
        // Set fallback persona
        setPersona({
          title: 'The Strategic Visionary',
          description:
            'You bridge the gap between abstract systems and human experience, seeing patterns where others see chaos.',
          traits: ['Systems Thinking', 'User Empathy', 'Technical Synthesis'],
        });
      } finally {
        if (isActive) setPersonaLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  if (isLoading || matchedLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={homeColors.primary} />
        <Text style={styles.loadingText}>Loading careers...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={homeColors.textMuted} />
        <Text style={styles.errorText}>Failed to load careers</Text>
      </View>
    );
  }

  const topMatch = matchedCareers?.[0];

  return (
    <View style={styles.container}>
      <MainTopBar topPadding={insets.top} onProfilePress={() => navigation.navigate("Profile")} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(100, insetBottom + 80) }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Badge */}
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={14} color={homeColors.primary} />
          <Text style={styles.badgeText}>AI Assessment Complete</Text>
        </View>

        {/* User Persona - Dynamic AI-generated */}
        {personaLoading ? (
          <View style={[styles.personaCard, styles.personaLoading]}>
            <ActivityIndicator size="small" color={homeColors.primary} />
            <Text style={styles.personaLoadingText}>Generating your persona...</Text>
          </View>
        ) : persona ? (
          <View style={styles.personaCard}>
            <Text style={styles.personaTitle}>{persona.title}</Text>
            <Text style={styles.personaDescription}>{persona.description}</Text>
            <View style={styles.skillChips}>
              {persona.traits.map((trait) => (
                <View key={trait} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{trait}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Top Match */}
        {topMatch && (
          <View style={styles.topMatchSection}>
            <View style={styles.topMatchHeader}>
              <Text style={styles.sectionTitle}>Top Match</Text>
              <Text style={styles.matchPercent}>{Math.round(topMatch.score)}%</Text>
            </View>

            <View style={styles.topMatchCard}>
              <View style={styles.topMatchCardHeader}>
                <View>
                  <Text style={styles.matchLabel}>Highly Compatible</Text>
                  <Text style={styles.careerTitle}>{topMatch.career.title}</Text>
                </View>
                <View style={styles.careerIcon}>
                  <Ionicons 
                    name={getCareerIcon(topMatch.career.title) as any} 
                    size={24} 
                    color={homeColors.primary} 
                  />
                </View>
              </View>

              <Text style={styles.careerDescription}>{topMatch.career.description}</Text>

              {/* Why AI chose this career */}
              {topMatch.aiInsight ? (
                <View style={styles.aiReasonSection}>
                  <Text style={styles.aiReasonLabel}>Why AI chose this career</Text>
                  <Text style={styles.aiReasonText}>
                    {topMatch.aiInsight}
                  </Text>
                </View>
              ) : null}

              <View style={styles.marketSnapshot}>
                <Text style={styles.marketSnapshotLabel}>Market Snapshot</Text>
                <View style={styles.marketStatsGrid}>
                  <View style={styles.marketStatCard}>
                    <View style={styles.marketStatIconWrap}>
                      <Ionicons name="cash-outline" size={14} color="#8158F8" />
                    </View>
                    <Text style={styles.marketStatValue}>
                      {formatSalaryCompact(topMatch.career.average_salary)}
                    </Text>
                    <Text style={styles.marketStatCaption}>Avg Salary</Text>
                  </View>

                  <View style={styles.marketStatCard}>
                    <View style={styles.marketStatIconWrap}>
                      <Ionicons name="trending-up-outline" size={14} color="#8158F8" />
                    </View>
                    <Text style={styles.marketStatValue}>
                      {formatGrowthRate(topMatch.career.growth_rate)}
                    </Text>
                    <Text style={styles.marketStatCaption}>Growth</Text>
                  </View>

                  <View style={styles.marketStatCard}>
                    <View style={styles.marketStatIconWrap}>
                      <Ionicons name="pulse-outline" size={14} color="#8158F8" />
                    </View>
                    <Text
                      style={[
                        styles.marketStatValue,
                        { color: getDemandMeta(topMatch.career.demand_level).color },
                      ]}
                    >
                      {getDemandMeta(topMatch.career.demand_level).label}
                    </Text>
                    <Text style={styles.marketStatCaption}>Demand</Text>
                  </View>
                </View>
              </View>

              <View style={styles.skillsSection}>
                <Text style={styles.skillsLabel}>Key Skills for Success</Text>
                <View style={styles.skillsList}>
                  {topMatch.career.required_skills?.slice(0, 2).map((skill) => (
                    <View key={skill} style={styles.skillTag}>
                      <View style={styles.skillDot} />
                      <Text style={styles.skillTagText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.generateButton,
                  pressed && styles.generateButtonPressed,
                ]}
                onPress={() =>
                  navigation.navigate("LearningRoadmap", {
                    careerId: topMatch.career.id,
                    careerTitle: topMatch.career.title,
                    careerDescription: topMatch.career.description,
                  })
                }
              >
                <Ionicons name="sparkles" size={18} color="white" />
                <Text style={styles.generateButtonText}>Generate Roadmap</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Alternatives */}
        {matchedCareers && matchedCareers.length > 1 && (
          <View style={styles.alternativesSection}>
            <Text style={styles.sectionTitle}>Strong Alternatives</Text>
            <View style={styles.alternativesList}>
              {matchedCareers.slice(1, 5).map((alt, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.alternativeCard,
                    pressed && styles.alternativeCardPressed,
                  ]}
                  onPress={() =>
                    navigation.navigate("LearningRoadmap", {
                      careerId: alt.career.id,
                      careerTitle: alt.career.title,
                      careerDescription: alt.career.description,
                    })
                  }
                >
                  <ProgressCircle percentage={alt.score} size={60} />
                  <View style={styles.alternativeContent}>
                    <Text style={styles.alternativeTitle}>{alt.career.title}</Text>
                    <Text style={styles.alternativeDesc}>
                      {alt.career.required_skills?.slice(0, 2).join(" • ")}
                    </Text>
                    <View style={styles.alternativeStatsRow}>
                      <Text style={styles.alternativeStatText}>
                        {formatSalaryCompact(alt.career.average_salary)}
                      </Text>
                      <Text style={styles.alternativeStatSeparator}>•</Text>
                      <Text style={styles.alternativeStatText}>
                        {formatGrowthRate(alt.career.growth_rate)} growth
                      </Text>
                      <View
                        style={[
                          styles.alternativeDemandChip,
                          { backgroundColor: `${getDemandMeta(alt.career.demand_level).color}1A` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.alternativeDemandChipText,
                            { color: getDemandMeta(alt.career.demand_level).color },
                          ]}
                        >
                          {getDemandMeta(alt.career.demand_level).label}
                        </Text>
                      </View>
                    </View>
                    {alt.aiInsight ? (
                      <Text style={styles.alternativeAiText} numberOfLines={4}>
                        {alt.aiInsight}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={homeColors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Insight Callout */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <Ionicons name="bulb" size={20} color={homeColors.primary} />
            <Text style={styles.insightLabel}>Navigator Insight</Text>
          </View>
          <Text style={styles.insightText}>
            Your high score in <Text style={styles.insightBold}>Systems Thinking</Text> makes you particularly suited for roles that bridge design and engineering.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 0,
  },
  logo: {
    height: 60,
    width: 180,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: homeColors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  personaCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#37274d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  personaTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#37274d",
    marginBottom: 12,
    letterSpacing: -0.02,
  },
  personaDescription: {
    fontSize: 15,
    color: "#6B5B95",
    lineHeight: 23,
    marginBottom: 16,
    fontWeight: "500",
  },
  skillChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChip: {
    backgroundColor: "#f2e2ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8158F8",
    letterSpacing: -0.3,
  },
  personaLoading: {
    justifyContent: "center",
    alignItems: "center",
    minHeight: 140,
  },
  personaLoadingText: {
    fontSize: 13,
    color: "#6B5B95",
    marginTop: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  topMatchSection: {
    marginBottom: 24,
  },
  topMatchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  matchPercent: {
    fontSize: 28,
    fontWeight: "800",
    color: homeColors.primary,
  },
  topMatchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#8158F8",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  topMatchCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  matchLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: homeColors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  careerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#37274d",
    letterSpacing: -0.02,
  },
  careerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: homeColors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  careerDescription: {
    fontSize: 13,
    color: homeColors.textMuted,
    lineHeight: 19,
    marginBottom: 16,
  },
  marketSnapshot: {
    backgroundColor: "#f8edff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  marketSnapshotLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8158F8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  marketStatsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  marketStatCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  marketStatIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f2e2ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  marketStatValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#37274d",
    marginBottom: 2,
  },
  marketStatCaption: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B5B95",
  },
  skillsSection: {
    marginBottom: 16,
  },
  skillsLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: homeColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  skillsList: {
    gap: 8,
  },
  skillTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  skillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: homeColors.primary,
  },
  skillTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: homeColors.textDark,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeColors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    shadowColor: homeColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  generateButtonPressed: {
    opacity: 0.85,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "white",
  },
  alternativesSection: {
    marginBottom: 24,
  },
  alternativesList: {
    gap: 12,
    marginTop: 12,
  },
  alternativeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fcf4ff",
    borderRadius: 20,
    padding: 14,
    shadowColor: "#37274d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  alternativeCardPressed: {
    opacity: 0.7,
  },
  alternativeContent: {
    flex: 1,
  },
  alternativeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.textDark,
    marginBottom: 2,
  },
  alternativeDesc: {
    fontSize: 12,
    color: homeColors.textMuted,
  },
  alternativeStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  alternativeStatText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B5B95",
  },
  alternativeStatSeparator: {
    fontSize: 10,
    color: "#B39DDB",
  },
  alternativeDemandChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alternativeDemandChipText: {
    fontSize: 10,
    fontWeight: "700",
  },
  aiReasonSection: {
    backgroundColor: "#f7f5ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  aiReasonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B5B95",
    marginBottom: 6,
  },
  aiReasonText: {
    fontSize: 13,
    color: "#37274d",
    lineHeight: 18,
  },
  alternativeAiText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B5B95",
  },
  insightCard: {
    backgroundColor: "#f2e2ff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: homeColors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  insightText: {
    fontSize: 13,
    color: homeColors.textMuted,
    lineHeight: 19,
  },
  insightBold: {
    fontWeight: "700",
    color: homeColors.textDark,
  },
  progressCircle: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  progressText: {
    position: "absolute",
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.primary,
  },
  progressRing: {
    borderRadius: 32,
    borderWidth: 4,
  },
  loadingText: {
    fontSize: 14,
    color: homeColors.textDark,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: homeColors.textDark,
    marginTop: 12,
  },
});
