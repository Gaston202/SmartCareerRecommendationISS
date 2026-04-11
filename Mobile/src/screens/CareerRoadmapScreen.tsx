import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { homeColors } from "./homeTheme";
import type { SavedRoadmap } from "../features/roadmaps/types";
import {
  getRoadmapById,
  saveRoadmap,
  findRoadmapByCareerTitle,
} from "../features/roadmaps/storage";
import { generateCareerRoadmap } from "../features/roadmaps/ai-roadmap.service";
import { useAuth } from "../auth/AuthProvider";

type HomeStackParamList = {
  HomeMain: undefined;
  Quiz: undefined;
  SkillsReview: undefined;
  CVAnalysis: undefined;
  CareerRoadmap: {
    roadmapId?: string;
    careerId?: string;
    careerTitle: string;
    careerDescription: string;
    matchPercent?: number;
    tags?: string[];
  };
};

type RouteParams = HomeStackParamList["CareerRoadmap"];

type CareerRoadmapScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "CareerRoadmap"
>;

export default function CareerRoadmapScreen(): React.ReactElement {
  const route = useRoute<any>();
  const navigation = useNavigation<CareerRoadmapScreenNavigationProp>();
  const params = route.params as RouteParams;

  const [roadmap, setRoadmap] = useState<SavedRoadmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { state } = useAuth();

  const hasRoadmap = !!roadmap;

  useEffect(() => {
    navigation.setOptions?.({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    loadInitialRoadmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialRoadmap = async () => {
    if (!state.user?.id) return;
    try {
      if (params.roadmapId) {
        const existing = await getRoadmapById(state.user.id, params.roadmapId);
        if (existing) {
          setRoadmap(existing);
          return;
        }
      }

      const existingForCareer = await findRoadmapByCareerTitle(state.user.id, params.careerTitle);
      if (existingForCareer) {
        setRoadmap(existingForCareer);
      }
    } catch (error) {
      console.warn("[CareerRoadmap] Failed to load roadmap", error);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const generated = await generateCareerRoadmap(
        params.careerTitle,
        params.careerDescription,
        params.tags,
        params.matchPercent,
        params.careerId,
      );
      setRoadmap(generated);
    } catch (error: any) {
      console.error("[CareerRoadmap] Generate failed", error);
      const msg = error?.message || "Could not generate roadmap. Please try again.";
      Alert.alert("Generation failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!roadmap || !state.user?.id) return;
    setSaving(true);
    try {
      await saveRoadmap(state.user.id, roadmap);
      Alert.alert("Saved", "This career roadmap has been saved to your Roadmaps tab.");
      // After saving, take user back to the Roadmaps tab
      (navigation as any).navigate("Roadmaps");
    } catch (error) {
      console.warn("[CareerRoadmap] Save failed", error);
      Alert.alert("Save failed", "Could not save this roadmap. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={homeColors.textDark} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="map" size={20} color={homeColors.primary} />
          <Text style={styles.headerTitle}>Career Roadmap</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Career summary */}
        <View style={styles.careerCard}>
          <Text style={styles.careerTitle}>{params.careerTitle}</Text>
          {typeof params.matchPercent === "number" && (
            <View style={styles.matchPill}>
              <Text style={styles.matchPillText}>{params.matchPercent}% match</Text>
            </View>
          )}
          <Text style={styles.careerDescription}>{params.careerDescription}</Text>
          {params.tags && params.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {params.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Generate / Regenerate */}
        {!hasRoadmap && !loading && (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={handleGenerate}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Generate roadmap</Text>
          </Pressable>
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={homeColors.primary} />
            <Text style={styles.loadingText}>AI is generating your roadmap...</Text>
          </View>
        )}

        {hasRoadmap && (
          <View style={styles.roadmapSection}>
            <View style={styles.roadmapHeader}>
              <Text style={styles.roadmapTitle}>Your step-by-step roadmap</Text>
              <Text style={styles.roadmapMeta}>
                Generated on {new Date(roadmap!.createdAt).toLocaleDateString()}
              </Text>
            </View>

            {roadmap!.steps.map((step, index) => (
              <View key={`${step.title}-${index}`} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumberCircle}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepHeaderText}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    {step.timeframe && (
                      <View style={styles.timeframePill}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={homeColors.primary}
                        />
                        <Text style={styles.timeframeText}>{step.timeframe}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            ))}

            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={homeColors.primary} />
              ) : (
                <>
                  <Ionicons
                    name="bookmark-outline"
                    size={18}
                    color={homeColors.primary}
                  />
                  <Text style={styles.secondaryBtnText}>Save to Roadmaps</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
              onPress={handleGenerate}
            >
              <Ionicons name="refresh" size={16} color={homeColors.textMuted} />
              <Text style={styles.ghostBtnText}>Regenerate roadmap</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeColors.backgroundStart,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: homeColors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: homeColors.cardBorder,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
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
  headerRight: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  careerCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  careerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: homeColors.textDark,
    marginBottom: 4,
  },
  matchPill: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
  },
  matchPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  careerDescription: {
    fontSize: 14,
    color: homeColors.textMuted,
    lineHeight: 20,
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: homeColors.primary + "15",
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: homeColors.primary,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: homeColors.primary,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    color: homeColors.textMuted,
  },
  roadmapSection: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    padding: 16,
    gap: 14,
  },
  roadmapHeader: {
    gap: 2,
    marginBottom: 4,
  },
  roadmapTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  roadmapMeta: {
    fontSize: 12,
    color: homeColors.textMuted,
  },
  stepCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    padding: 12,
    backgroundColor: homeColors.backgroundStart,
    marginTop: 4,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  stepNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: homeColors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.primary,
  },
  stepHeaderText: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  timeframePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: homeColors.primary + "10",
  },
  timeframeText: {
    fontSize: 12,
    color: homeColors.primary,
    fontWeight: "500",
  },
  stepDescription: {
    fontSize: 13,
    color: homeColors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: homeColors.cardBg,
    borderWidth: 1,
    borderColor: homeColors.primary + "40",
    marginTop: 4,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.primary,
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  ghostBtnText: {
    fontSize: 13,
    color: homeColors.textMuted,
    fontWeight: "500",
  },
});

