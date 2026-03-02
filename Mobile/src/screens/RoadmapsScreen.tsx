import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCareersWithSkills } from "../features/careers";
import { useMatchedCareers } from "../features/careers/useMatchedCareers";
import type { CareerWithSkills } from "../features/careers";
import { useCvAnalysis } from "../features/cv/hooks";
import { getQuizQuestionsWithAnswers } from "../features/quiz/storage";
import { homeColors } from "./homeTheme";

const CATEGORY_COLORS: Record<string, string> = {
  Technology: homeColors.primary,
  Business: homeColors.accentOrange,
  Design: homeColors.accentTeal,
  Healthcare: homeColors.accentGreen,
};

const DEMAND_LABELS: Record<string, { label: string; color: string }> = {
  "very-high": { label: "Very High", color: "#4CAF50" },
  high: { label: "High", color: "#8BC34A" },
  medium: { label: "Medium", color: "#FFC107" },
  low: { label: "Low", color: "#FF9800" },
};

const IMPORTANCE_COLORS: Record<string, string> = {
  required: "#f44336",
  preferred: "#FF9800",
  optional: "#9E9E9E",
};

export default function RoadmapsScreen(): React.ReactElement {
  const { data: careers, isLoading, error } = useCareersWithSkills();
  const { data: matchedCareers, isLoading: matchedLoading } = useMatchedCareers();
  const { data: cvAnalysis, isLoading: cvLoading } = useCvAnalysis();
  const [expandedCareer, setExpandedCareer] = useState<string | null>(null);
  const [hasQuizData, setHasQuizData] = useState(false);
  const [checkingRequirements, setCheckingRequirements] = useState(true);

  // Check if all requirements are met
  useEffect(() => {
    checkRequirements();
  }, [cvAnalysis]);

  const checkRequirements = async () => {
    setCheckingRequirements(true);
    const quizData = await getQuizQuestionsWithAnswers();
    setHasQuizData(quizData && quizData.length > 0);
    setCheckingRequirements(false);
  };

  const hasCvAnalysis = cvAnalysis && cvAnalysis.id;
  const allRequirementsMet = hasCvAnalysis && hasQuizData;

  const toggleCareer = (careerId: string) => {
    setExpandedCareer(expandedCareer === careerId ? null : careerId);
  };

  if (isLoading || matchedLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={homeColors.primary} />
        <Text style={styles.loadingText}>Loading careers...</Text>
      </View>
    );
  }

  if (error) {
    console.error("Careers fetch error:", error);
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={homeColors.textMuted} />
        <Text style={styles.errorText}>Failed to load careers</Text>
        <Text style={styles.errorSubtext}>
          {error instanceof Error ? error.message : "Please try again later"}
        </Text>
      </View>
    );
  }

  if (!careers || careers.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="briefcase-outline" size={48} color={homeColors.textMuted} />
        <Text style={styles.emptyText}>No careers available</Text>
        <Text style={styles.emptySubtext}>Check back soon for career roadmaps</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Career Roadmaps</Text>
          <Text style={styles.subtitle}>
            Explore {careers.length} career paths with required skills
          </Text>
        </View>

        {/* Requirements Check Message */}
        {!checkingRequirements && !allRequirementsMet && (
          <View style={styles.requirementsCard}>
            <View style={styles.requirementsHeader}>
              <Ionicons name="information-circle-outline" size={24} color={homeColors.primary} />
              <Text style={styles.requirementsTitle}>Complete to See Your Top Matches</Text>
            </View>
            <View style={styles.requirementsList}>
              <RequirementItem
                icon="help-circle-outline"
                label="Take the Career Quiz"
                completed={hasQuizData}
              />
              <RequirementItem
                icon="document-outline"
                label="Upload & Analyze Your CV"
                completed={!!hasCvAnalysis}
              />
            </View>
            <Text style={styles.requirementsMessage}>
              Once you complete both steps, we'll show you your personalized top 5 career matches based on AI analysis.
            </Text>
          </View>
        )}

        {/* Matched Careers Section */}
        {allRequirementsMet && matchedCareers && matchedCareers.length > 0 && (
          <View style={styles.matchedSection}>
            <View style={styles.matchedHeader}>
              <Ionicons name="star" size={20} color={homeColors.primary} />
              <Text style={styles.matchedTitle}>Top Matches For You</Text>
            </View>
            <Text style={styles.matchedSubtitle}>
              Based on your quiz and CV analysis
            </Text>
            <View style={styles.matchedCareers}>
              {matchedCareers.map((match) => (
                <MatchedCareerCard
                  key={match.career.id}
                  match={match}
                  isExpanded={expandedCareer === match.career.id}
                  onToggle={() => toggleCareer(match.career.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Careers List Header */}
        <View style={[styles.header, matchedCareers?.length > 0 && { marginTop: 16 }]}>
          <Text style={styles.title}>All Career Roadmaps</Text>
          <Text style={styles.subtitle}>
            Explore {careers.length} career paths with required skills
          </Text>
        </View>

        {/* Careers List */}
        <View style={styles.careersList}>
          {careers.map((career) => (
            <CareerCard
              key={career.id}
              career={career}
              isExpanded={expandedCareer === career.id}
              onToggle={() => toggleCareer(career.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

interface MatchedCareerCardProps {
  match: any;
  isExpanded: boolean;
  onToggle: () => void;
}

function MatchedCareerCard({ match, isExpanded, onToggle }: MatchedCareerCardProps) {
  const career = match.career;
  const categoryColor = CATEGORY_COLORS[career.category] || homeColors.textMuted;

  return (
    <View style={styles.matchedCareerCard}>
      <Pressable
        style={({ pressed }) => [styles.matchedCareerHeader, pressed && styles.pressed]}
        onPress={onToggle}
      >
        <View style={styles.matchedCareerContent}>
          <View style={styles.matchedCareerTitleRow}>
            <Text style={styles.matchedCareerTitle}>{career.title}</Text>
            <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(match.score) + "20" }]}>
              <Text style={[styles.scoreBadgeText, { color: getScoreColor(match.score) }]}>
                {match.score}% match
              </Text>
            </View>
          </View>
          <Text style={styles.matchedCareerDescription} numberOfLines={isExpanded ? undefined : 2}>
            {career.description}
          </Text>
          {match.matchReasons.length > 0 && (
            <View style={styles.reasonsWrap}>
              {match.matchReasons.map((reason: string, idx: number) => (
                <Text key={idx} style={styles.reasonText}>
                  • {reason}
                </Text>
              ))}
            </View>
          )}
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={homeColors.textMuted}
        />
      </Pressable>
    </View>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

interface RequirementItemProps {
  icon: string;
  label: string;
  completed: boolean;
}

function RequirementItem({ icon, label, completed }: RequirementItemProps) {
  return (
    <View style={styles.requirementItem}>
      <View style={styles.requirementIcon}>
        <Ionicons
          name={icon as any}
          size={18}
          color={completed ? homeColors.accentGreen : homeColors.textMuted}
        />
      </View>
      <Text style={[styles.requirementLabel, !completed && { color: homeColors.textMuted }]}>
        {label}
      </Text>
      {completed && (
        <Ionicons name="checkmark-circle" size={20} color={homeColors.accentGreen} />
      )}
    </View>
  );
}

interface CareerCardProps {
  career: CareerWithSkills;
  isExpanded: boolean;
  onToggle: () => void;
}

function CareerCard({ career, isExpanded, onToggle }: CareerCardProps) {
  const categoryColor = CATEGORY_COLORS[career.category] || homeColors.textMuted;
  const demandInfo = DEMAND_LABELS[career.demand_level] || {
    label: career.demand_level,
    color: homeColors.textMuted,
  };

  return (
    <View style={styles.careerCard}>
      <Pressable
        style={({ pressed }) => [styles.careerHeader, pressed && styles.pressed]}
        onPress={onToggle}
      >
        <View style={styles.careerHeaderContent}>
          <View style={styles.careerTitleRow}>
            <Text style={styles.careerTitle}>{career.title}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + "20" }]}>
              <Text style={[styles.categoryText, { color: categoryColor }]}>
                {career.category}
              </Text>
            </View>
          </View>
          <Text style={styles.careerDescription} numberOfLines={isExpanded ? undefined : 2}>
            {career.description}
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="cash-outline" size={16} color={homeColors.textMuted} />
              <Text style={styles.statText}>${(career.average_salary / 1000).toFixed(0)}K</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="trending-up-outline" size={16} color={homeColors.accentGreen} />
              <Text style={styles.statText}>+{career.growth_rate}%</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={16} color={demandInfo.color} />
              <Text style={[styles.statText, { color: demandInfo.color }]}>
                {demandInfo.label}
              </Text>
            </View>
            {career.skills.length > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="school-outline" size={16} color={homeColors.primary} />
                <Text style={styles.statText}>{career.skills.length} skills</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={homeColors.textMuted}
        />
      </Pressable>

      {/* Expanded Skills Section */}
      {isExpanded && career.skills.length > 0 && (
        <View style={styles.skillsSection}>
          <View style={styles.skillsHeader}>
            <Ionicons name="school" size={18} color={homeColors.primary} />
            <Text style={styles.skillsTitle}>Required Skills</Text>
          </View>
          <View style={styles.skillsGrid}>
            {career.skills.map((skill) => (
              <View
                key={skill.id}
                style={[
                  styles.skillChip,
                  { borderColor: IMPORTANCE_COLORS[skill.importance] + "40" },
                ]}
              >
                <View
                  style={[
                    styles.importanceDot,
                    { backgroundColor: IMPORTANCE_COLORS[skill.importance] },
                  ]}
                />
                <Text style={styles.skillName}>{skill.name}</Text>
                <Text style={[styles.skillCategory, { color: categoryColor }]}>
                  {skill.category}
                </Text>
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Importance:</Text>
            <View style={styles.legendItems}>
              {Object.entries(IMPORTANCE_COLORS).map(([key, color]) => (
                <View key={key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {isExpanded && career.skills.length === 0 && (
        <View style={styles.noSkillsSection}>
          <Ionicons name="information-circle-outline" size={20} color={homeColors.textMuted} />
          <Text style={styles.noSkillsText}>No skills defined for this career yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeColors.backgroundStart,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: homeColors.backgroundStart,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: homeColors.textMuted,
  },
  errorText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: homeColors.textDark,
  },
  errorSubtext: {
    marginTop: 4,
    fontSize: 14,
    color: homeColors.textMuted,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: homeColors.textDark,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: homeColors.textMuted,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: homeColors.textDark,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: homeColors.textMuted,
  },

  // Careers List
  careersList: {
    gap: 16,
  },

  // Career Card
  careerCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    overflow: "hidden",
  },
  careerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 12,
  },
  careerHeaderContent: {
    flex: 1,
    gap: 10,
  },
  careerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  careerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  careerDescription: {
    fontSize: 14,
    color: homeColors.textMuted,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: "600",
    color: homeColors.textMuted,
  },

  // Skills Section
  skillsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: homeColors.cardBorder,
  },
  skillsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  skillsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  skillChip: {
    backgroundColor: homeColors.backgroundStart,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  importanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skillName: {
    fontSize: 13,
    fontWeight: "600",
    color: homeColors.textDark,
  },
  skillCategory: {
    fontSize: 11,
    fontWeight: "500",
    marginLeft: 4,
  },

  // Legend
  legend: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: homeColors.cardBorder,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: homeColors.textMuted,
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: homeColors.textMuted,
  },

  // Matched Careers Section
  matchedSection: {
    marginBottom: 24,
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.primary + "30",
    padding: 16,
    gap: 12,
  },
  matchedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  matchedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: homeColors.textDark,
  },
  matchedSubtitle: {
    fontSize: 13,
    color: homeColors.textMuted,
    marginBottom: 4,
  },
  matchedCareers: {
    gap: 10,
  },
  matchedCareerCard: {
    backgroundColor: homeColors.backgroundStart,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    overflow: "hidden",
  },
  matchedCareerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 10,
  },
  matchedCareerContent: {
    flex: 1,
    gap: 8,
  },
  matchedCareerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  matchedCareerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  scoreBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  matchedCareerDescription: {
    fontSize: 13,
    color: homeColors.textMuted,
    lineHeight: 18,
  },
  reasonsWrap: {
    gap: 4,
    marginTop: 4,
  },
  reasonText: {
    fontSize: 12,
    color: homeColors.primary,
    fontWeight: "500",
  },

  // Requirements Check Card
  requirementsCard: {
    marginBottom: 24,
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.primary + "30",
    padding: 16,
    gap: 12,
  },
  requirementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: homeColors.textDark,
    flex: 1,
  },
  requirementsList: {
    gap: 10,
    paddingVertical: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
  },
  requirementIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  requirementLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: homeColors.textDark,
    flex: 1,
  },
  requirementsMessage: {
    fontSize: 13,
    color: homeColors.textMuted,
    lineHeight: 18,
    fontStyle: "italic",
    paddingTop: 4,
  },

  // No Skills
  noSkillsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: homeColors.cardBorder,
  },
  noSkillsText: {
    fontSize: 14,
    color: homeColors.textMuted,
    fontStyle: "italic",
  },
});
