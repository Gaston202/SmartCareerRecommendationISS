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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCareersWithSkills } from "../features/careers";
import { useMatchedCareers } from "../features/careers/useMatchedCareers";
import type { CareerWithSkills } from "../features/careers";
import { homeColors } from "./homeTheme";
import {
  getSavedAiCareers,
  getSavedRoadmaps,
  removeSavedAiCareer,
  saveAiCareer,
} from "../features/roadmaps/storage";
import type { SavedAiCareer, SavedRoadmap } from "../features/roadmaps/types";
import { useAuth } from "../auth/AuthProvider";
import { AppBrand } from "../ui/AppBrand";
import LearningRoadmapScreen from "./LearningRoadmapScreen";

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
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { data: careers, isLoading, error } = useCareersWithSkills();
  const { data: matchedCareers, isLoading: matchedLoading } = useMatchedCareers();
  const [expandedCareer, setExpandedCareer] = useState<string | null>(null);
  const [savedRoadmaps, setSavedRoadmaps] = useState<SavedRoadmap[]>([]);
  const [savedAiCareers, setSavedAiCareers] = useState<SavedAiCareer[]>([]);
  const { state } = useAuth();

  // Reload saved roadmaps whenever this screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      (async () => {
        if (!state.user?.id) return;
        const roadmaps = await getSavedRoadmaps(state.user.id);
        const aiCareers = await getSavedAiCareers(state.user.id);
        if (!isActive) return;
        // Newest first
        setSavedRoadmaps(
          [...roadmaps].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
        setSavedAiCareers(
          [...aiCareers].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      })();
      return () => {
        isActive = false;
      };
    }, [state.user?.id]),
  );

  const toggleCareer = (careerId: string) => {
    setExpandedCareer(expandedCareer === careerId ? null : careerId);
  };

  const handleToggleSaveAiCareer = async (match: any) => {
    if (!state.user?.id) return;

    const title = String(match?.career?.title || "").trim();
    if (!title) return;

    const existing = savedAiCareers.find(
      (item) => item.careerTitle.toLocaleLowerCase() === title.toLocaleLowerCase(),
    );

    if (existing) {
      await removeSavedAiCareer(state.user.id, title);
      setSavedAiCareers((prev) =>
        prev.filter(
          (item) =>
            item.careerTitle.toLocaleLowerCase() !== title.toLocaleLowerCase(),
        ),
      );
      return;
    }

    const saved: SavedAiCareer = {
      id: `${title}-${Date.now()}`,
      careerId: String(match?.career?.id || "") || undefined,
      careerTitle: title,
      careerDescription: String(match?.career?.description || ""),
      matchPercent: typeof match?.score === "number" ? match.score : undefined,
      tags: Array.isArray(match?.career?.tags)
        ? match.career.tags.filter(Boolean)
        : undefined,
      createdAt: new Date().toISOString(),
    };

    await saveAiCareer(state.user.id, saved);
    setSavedAiCareers((prev) => [saved, ...prev]);
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLogoRow}>
            <AppBrand width={120} height={26} />
          </View>
          <Text style={styles.title}>Career Roadmaps</Text>
          <Text style={styles.subtitle}>
            Explore {careers.length} career paths with required skills
          </Text>
        </View>

        {/* Saved roadmaps for this user (before Top Matches section) */}
        {savedRoadmaps.length > 0 && (
          <View style={styles.savedSection}>
            <View style={styles.savedHeader}>
              <Ionicons name="bookmark" size={20} color={homeColors.primary} />
              <Text style={styles.savedTitle}>Your saved roadmaps</Text>
            </View>
            <Text style={styles.savedSubtitle}>
              Revisit AI-generated roadmaps from your quiz results.
            </Text>
            <View style={styles.savedList}>
              {savedRoadmaps.map((roadmap) => {
                const isHigh =
                  typeof roadmap.matchPercent === "number" &&
                  roadmap.matchPercent >= 88;
                return (
                  <View key={roadmap.id} style={styles.savedCard}>
                    <View style={styles.savedCardHeader}>
                      <Text style={styles.savedCardTitle}>
                        {roadmap.careerTitle}
                      </Text>
                      {typeof roadmap.matchPercent === "number" && (
                        <View
                          style={[
                            styles.savedMatchPill,
                            isHigh
                              ? styles.savedMatchPillGreen
                              : styles.savedMatchPillOrange,
                          ]}
                        >
                          <Text style={styles.savedMatchText}>
                            {roadmap.matchPercent}% match
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.savedCardDesc} numberOfLines={2}>
                      {roadmap.careerDescription}
                    </Text>
                    {roadmap.tags && roadmap.tags.length > 0 && (
                      <View style={styles.savedTagsRow}>
                        {roadmap.tags.map((tag) => (
                          <View key={tag} style={styles.savedTagChip}>
                            <Text style={styles.savedTagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={styles.savedMetaRow}>
                      <View style={styles.savedMetaItem}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={homeColors.textMuted}
                        />
                        <Text style={styles.savedMetaText}>
                          {new Date(roadmap.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.savedViewBtn,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        navigation.navigate("Home", {
                          screen: "CareerRoadmap",
                          params: {
                            roadmapId: roadmap.id,
                            careerId: roadmap.careerId,
                            careerTitle: roadmap.careerTitle,
                            careerDescription: roadmap.careerDescription,
                            matchPercent: roadmap.matchPercent,
                            tags: roadmap.tags,
                          },
                        })
                      }
                    >
                      <Ionicons name="map" size={16} color="#fff" />
                      <Text style={styles.savedViewBtnText}>View roadmap</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Saved AI careers */}
        {savedAiCareers.length > 0 && (
          <View style={styles.savedSection}>
            <View style={styles.savedHeader}>
              <Ionicons name="bookmark-outline" size={20} color={homeColors.primary} />
              <Text style={styles.savedTitle}>Saved AI careers</Text>
            </View>
            <Text style={styles.savedSubtitle}>
              Careers you bookmarked from your AI-matched results.
            </Text>
            <View style={styles.savedList}>
              {savedAiCareers.map((career) => (
                <View key={career.id} style={styles.savedCard}>
                  <View style={styles.savedCardHeader}>
                    <Text style={styles.savedCardTitle}>{career.careerTitle}</Text>
                    {typeof career.matchPercent === "number" && (
                      <View style={styles.savedMatchPillOrange}>
                        <Text style={styles.savedMatchText}>{career.matchPercent}% match</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.savedCardDesc} numberOfLines={2}>
                    {career.careerDescription}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.savedViewBtn, pressed && styles.pressed]}
                    onPress={() =>
                      navigation.navigate("Home", {
                        screen: "LearningRoadmap",
                        params: {
                          careerId: career.careerId,
                          careerTitle: career.careerTitle,
                          careerDescription: career.careerDescription,
                        },
                      })
                    }
                  >
                    <Ionicons name="map" size={16} color="#fff" />
                    <Text style={styles.savedViewBtnText}>Generate roadmap</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* AI Careers Section (selected from database careers) */}
        {matchedCareers && matchedCareers.length > 0 && (
          <View style={styles.matchedSection}>
            <View style={styles.matchedHeader}>
              <Ionicons name="sparkles-outline" size={20} color={homeColors.primary} />
              <Text style={styles.matchedTitle}>AI Career Matches</Text>
            </View>
            <Text style={styles.matchedSubtitle}>
              Generated by AI using your profile and selected from careers in your database
            </Text>
            <View style={styles.matchedCareers}>
              {matchedCareers.map((match) => {
                const savedForCareer =
                  savedRoadmaps.find(
                    (r) =>
                      r.careerTitle.toLocaleLowerCase() ===
                      String(match.career.title).toLocaleLowerCase(),
                  ) || null;
                return (
                  <MatchedCareerCard
                    key={match.career.id}
                    match={match}
                    isExpanded={expandedCareer === match.career.id}
                    onToggle={() => toggleCareer(match.career.id)}
                    savedRoadmap={savedForCareer}
                    isCareerSaved={
                      !!savedAiCareers.find(
                        (item) =>
                          item.careerTitle.toLocaleLowerCase() ===
                          String(match.career.title).toLocaleLowerCase(),
                      )
                    }
                    onToggleSaveCareer={() => handleToggleSaveAiCareer(match)}
                    onGenerateOrViewRoadmap={() => {
                      navigation.navigate("Home", {
                        screen: "LearningRoadmap",
                        params: {
                          careerId: match.career.id,
                          careerTitle: match.career.title,
                          careerDescription: match.career.description,
                        },
                      });
                    }}
                  />
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface MatchedCareerCardProps {
  match: any;
  isExpanded: boolean;
  onToggle: () => void;
  savedRoadmap?: SavedRoadmap | null;
  isCareerSaved: boolean;
  onToggleSaveCareer: () => void;
  onGenerateOrViewRoadmap: () => void;
}

function MatchedCareerCard({
  match,
  isExpanded,
  onToggle,
  savedRoadmap,
  isCareerSaved,
  onToggleSaveCareer,
  onGenerateOrViewRoadmap,
}: MatchedCareerCardProps) {
  const career = match.career;
  const categoryColor = CATEGORY_COLORS[career.category] || homeColors.textMuted;
  const demandInfo = DEMAND_LABELS[career.demand_level] || {
    label: career.demand_level || "Medium",
    color: homeColors.textMuted,
  };

  const requiredSkills = Array.isArray(career.required_skills)
    ? career.required_skills.filter(Boolean)
    : [];
  const tags = Array.isArray(career.tags) ? career.tags.filter(Boolean) : [];

  const salaryLabel =
    typeof career.average_salary === "number" && career.average_salary > 0
      ? `$${Math.round(career.average_salary / 1000)}K`
      : "N/A";

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

          <View style={[styles.matchedCategoryBadge, { backgroundColor: categoryColor + "20" }]}>
            <Text style={[styles.matchedCategoryText, { color: categoryColor }]}>
              {career.category || "General"}
            </Text>
          </View>

          <View style={styles.matchedStatsRow}>
            <View style={styles.matchedStatItem}>
              <Ionicons name="cash-outline" size={14} color={homeColors.textMuted} />
              <Text style={styles.matchedStatText}>{salaryLabel}</Text>
            </View>
            <View style={styles.matchedStatItem}>
              <Ionicons name="flame-outline" size={14} color={demandInfo.color} />
              <Text style={[styles.matchedStatText, { color: demandInfo.color }]}>{demandInfo.label}</Text>
            </View>
            <View style={styles.matchedStatItem}>
              <Ionicons name="school-outline" size={14} color={homeColors.primary} />
              <Text style={styles.matchedStatText}>{requiredSkills.length} skills</Text>
            </View>
          </View>

          {match.matchReasons.length > 0 && (
            <View style={styles.reasonsWrap}>
              {match.matchReasons.map((reason: string, idx: number) => (
                <Text key={idx} style={styles.reasonText}>
                  • {reason}
                </Text>
              ))}
            </View>
          )}

          {isExpanded && (
            <View style={styles.matchedDetailSection}>
              {requiredSkills.length > 0 && (
                <>
                  <Text style={styles.matchedDetailTitle}>Required skills</Text>
                  <View style={styles.matchedChipRow}>
                    {requiredSkills.slice(0, 8).map((skill: string) => (
                      <View key={skill} style={styles.matchedChip}>
                        <Text style={styles.savedTagText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {tags.length > 0 && (
                <>
                  <Text style={styles.matchedDetailTitle}>Tags</Text>
                  <View style={styles.matchedChipRow}>
                    {tags.slice(0, 8).map((tag: string) => (
                      <View key={tag} style={styles.savedTagChip}>
                        <Text style={styles.savedTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={homeColors.textMuted}
        />
      </Pressable>

      {/* Generate learning roadmap button */}
      <Pressable
        style={({ pressed }) => [styles.matchedRoadmapBtn, pressed && styles.pressed]}
        onPress={onGenerateOrViewRoadmap}
      >
        <Ionicons name="bulb-outline" size={16} color="#fff" />
        <Text style={styles.matchedRoadmapBtnText}>Generate Learning Roadmap</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.matchedSaveBtn, pressed && styles.pressed]}
        onPress={onToggleSaveCareer}
      >
        <Ionicons
          name={isCareerSaved ? "bookmark" : "bookmark-outline"}
          size={16}
          color={homeColors.primary}
        />
        <Text style={styles.matchedSaveBtnText}>
          {isCareerSaved ? "Saved" : "Save career"}
        </Text>
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
  onGenerateRoadmap: () => void;
}

function CareerCard({ career, isExpanded, onToggle, onGenerateRoadmap }: CareerCardProps) {
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

      <Pressable
        style={({ pressed }) => [styles.matchedRoadmapBtn, pressed && styles.pressed]}
        onPress={onGenerateRoadmap}
      >
        <Ionicons name="map" size={16} color="#fff" />
        <Text style={styles.matchedRoadmapBtnText}>Generate roadmap</Text>
      </Pressable>
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
  headerLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
    paddingBottom: 8,
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
  matchedCategoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  matchedCategoryText: {
    fontSize: 11,
    fontWeight: "700",
  },
  matchedStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  matchedStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  matchedStatText: {
    fontSize: 12,
    fontWeight: "600",
    color: homeColors.textMuted,
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
  matchedDetailSection: {
    marginTop: 8,
    gap: 6,
  },
  matchedDetailTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  matchedChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  matchedChip: {
    backgroundColor: homeColors.backgroundStart,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },

  matchedRoadmapBtn: {
    marginHorizontal: 12,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: homeColors.primary,
  },
  matchedRoadmapBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  matchedSaveBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeColors.primary + "50",
    backgroundColor: "#fff",
  },
  matchedSaveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: homeColors.primary,
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

  // Saved roadmaps section (card style similar to quiz results)
  savedSection: {
    marginBottom: 24,
  },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  savedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: homeColors.textDark,
  },
  savedSubtitle: {
    fontSize: 13,
    color: homeColors.textMuted,
    marginBottom: 10,
  },
  savedList: {
    gap: 12,
  },
  savedCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  savedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  savedCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.textDark,
    flex: 1,
  },
  savedMatchPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savedMatchPillGreen: {
    backgroundColor: "#DCFCE7",
  },
  savedMatchPillOrange: {
    backgroundColor: "#FFEDD5",
  },
  savedMatchText: {
    fontSize: 12,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  savedCardDesc: {
    fontSize: 14,
    color: homeColors.textMuted,
    lineHeight: 20,
    marginBottom: 10,
  },
  savedTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  savedTagChip: {
    backgroundColor: homeColors.primary + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  savedTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: homeColors.primary,
  },
  savedMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  savedMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  savedMetaText: {
    fontSize: 12,
    color: homeColors.textMuted,
  },
  savedViewBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: homeColors.primary,
  },
  savedViewBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
