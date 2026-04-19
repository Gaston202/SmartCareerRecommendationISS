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
import { homeColors } from "./homeTheme";
import { useAuth } from "../auth/AuthProvider";
import {
  getSavedLearningRoadmaps,
  deleteLearningRoadmap,
} from "../features/learning-roadmap/storage";
import type { SavedLearningRoadmap } from "../features/learning-roadmap/types";
import { MainTopBar } from "../ui/MainTopBar";

export default function RoadmapsTabScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const [roadmaps, setRoadmaps] = useState<SavedLearningRoadmap[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      (async () => {
        if (!state.user?.id) return;
        setLoading(true);
        try {
          const saved = await getSavedLearningRoadmaps(state.user.id);
          if (!isActive) return;
          setRoadmaps(
            saved.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          );
        } catch (error) {
          console.warn("[RoadmapsTab] Failed to load roadmaps", error);
        } finally {
          if (isActive) setLoading(false);
        }
      })();
      return () => {
        isActive = false;
      };
    }, [state.user?.id]),
  );

  const handleDelete = async (id: string) => {
    if (!state.user?.id) return;
    try {
      await deleteLearningRoadmap(state.user.id, id);
      setRoadmaps((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.warn("[RoadmapsTab] Failed to delete roadmap", error);
    }
  };

  if (loading && roadmaps.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={homeColors.primary} />
        <Text style={styles.loadingText}>Loading your roadmaps...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MainTopBar topPadding={insets.top} onProfilePress={() => navigation.navigate("Profile")} />

      {roadmaps.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContent}
          showsVerticalScrollIndicator={false}
        >

          <View style={styles.emptyIcon}>
            <Ionicons name="school-outline" size={64} color={homeColors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Learning Paths Yet</Text>
          <Text style={styles.emptyDescription}>
            Go to Careers to find a career match and generate a personalized learning path.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.getParent?.()?.navigate("Careers")}
          >
            <Ionicons name="compass-outline" size={18} color="white" />
            <Text style={styles.primaryButtonText}>Explore Careers</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.roadmapsList}
          showsVerticalScrollIndicator={false}
        >
          {roadmaps.map((roadmap) => (
            <Pressable
              key={roadmap.id}
              style={({ pressed }) => [styles.roadmapCard, pressed && styles.cardPressed]}
              onPress={() =>
                navigation.navigate("LearningRoadmap", {
                  careerId: roadmap.career_id,
                  careerTitle: roadmap.careerTitle,
                  careerDescription: roadmap.roadmap.description,
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="school-outline" size={24} color={homeColors.primary} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{roadmap.careerTitle}</Text>
                  <Text style={styles.cardMeta}>
                    {roadmap.roadmap.skill_count} skills • {roadmap.roadmap.estimated_weeks}w
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}
                  onPress={() => handleDelete(roadmap.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </Pressable>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(30, (roadmap.roadmap.skill_count / 15) * 100)}%`,
                    },
                  ]}
                />
              </View>

              <Text style={styles.cardDescription}>
                {roadmap.roadmap.description}
              </Text>

              <View style={styles.actionBar}>
                <View style={styles.skillTag}>
                  <Ionicons name="checkmark-circle" size={14} color={homeColors.primary} />
                  <Text style={styles.skillTagText}>
                    {roadmap.roadmap.total_duration_hours}h total
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={homeColors.primary} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  logoHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  logo: {
    height: 60,
    width: 180,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#37274d",
    marginBottom: 6,
    letterSpacing: -0.02,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B5B95",
    fontWeight: "500",
  },
  emptyContent: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#37274d",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.02,
  },
  emptyDescription: {
    fontSize: 14,
    color: "#6B5B95",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
    fontWeight: "500",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: homeColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "white",
  },
  roadmapsList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  roadmapCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#37274d",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: homeColors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#37274d",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardMeta: {
    fontSize: 12,
    color: "#9c9a9a",
    fontWeight: "500",
  },
  deleteButton: {
    padding: 8,
  },
  deletePressed: {
    opacity: 0.6,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#f2e2ff",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#8158F8",
    borderRadius: 3,
  },
  cardDescription: {
    fontSize: 13,
    color: "#6B5B95",
    lineHeight: 20,
    marginBottom: 14,
    fontWeight: "500",
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 0,
    borderTopColor: "transparent",
  },
  skillTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f2e2ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  skillTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8158F8",
    letterSpacing: -0.2,
  },
  loadingText: {
    fontSize: 14,
    color: homeColors.textDark,
    marginTop: 12,
  },
});
