import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthProvider';
import { homeColors } from './homeTheme';
import {
  saveLearningRoadmap,
  getLearningRoadmapByCareerTitle,
} from '../features/learning-roadmap/storage';
import type {
  LearningCourse,
  LearningRoadmap,
  LearningRoadmapNode,
  LearningRoadmapResource,
  LearningSkill,
  SkillLevel,
} from '../features/learning-roadmap/types';
import {
  fetchRoadmapPlanFromBackend,
  saveLearningRoadmapToBackend,
  type BackendPlannedRoadmapResponse,
  type BackendPlannedRoadmapStep,
  type BackendRoadmapResource,
} from '../features/roadmaps/api-backend';

type HomeStackParamList = {
  LearningRoadmap: {
    careerId?: string;
    careerTitle: string;
    careerDescription: string;
  };
};

type LearningRoadmapScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'LearningRoadmap'
>;

const getDifficultyIcon = (level: string) => {
  if (level.toLowerCase() === 'beginner') return 'trending-up-outline';
  if (level.toLowerCase() === 'intermediate') return 'bar-chart-outline';
  return 'alert-circle-outline';
};

const getDifficultyColor = (level: string) => {
  if (level.toLowerCase() === 'beginner') return '#86EFAC';
  if (level.toLowerCase() === 'intermediate') return '#FCD34D';
  return '#FCA5A5';
};

const normalizeSkillLabel = (skill: string) =>
  skill
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toSkillLevel = (value?: string | null): SkillLevel => {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') return value;
  return 'beginner';
};

const toLearningResource = (
  resource: BackendRoadmapResource | null | undefined,
  fallback?: Partial<LearningRoadmapResource>,
): LearningRoadmapResource | null => {
  if (!resource && !fallback?.title && !fallback?.source_url) return null;
  return {
    resource_id: resource?.resource_id ?? fallback?.resource_id ?? null,
    title: resource?.title ?? fallback?.title ?? null,
    provider: resource?.provider ?? fallback?.provider ?? null,
    source_url: resource?.source_url ?? fallback?.source_url ?? null,
    score: resource?.score ?? fallback?.score ?? 0,
    why_selected: resource?.why_selected ?? fallback?.why_selected ?? null,
    display_badges: resource?.display_badges ?? fallback?.display_badges ?? null,
    recommendation_reason:
      resource?.recommendation_reason ?? fallback?.recommendation_reason ?? null,
  };
};

const resourceToCourse = (
  resource: LearningRoadmapResource,
  skillId: string,
  skillName: string,
  fallbackLevel: SkillLevel,
  durationHours: number,
  index: number,
  createdAt: string,
): LearningCourse => ({
  id: `${skillId}-resource-${index}`,
  skill_id: skillId,
  title: resource.title || `${skillName} resource`,
  description:
    resource.why_selected ||
    `This resource focuses directly on ${skillName.replace(/_/g, ' ')}, giving you practical skills for this step.`,
  provider: resource.provider || 'Curated Resource',
  url: resource.source_url || '',
  source_resource_id: resource.resource_id,
  confidence_score: resource.score,
  display_badges: resource.display_badges,
  recommendation_reason: resource.recommendation_reason,
  duration_hours: Math.max(1, Math.round(durationHours * 0.6)),
  level: fallbackLevel,
  rating: 4,
  free: true,
  course_type: 'text',
  created_at: createdAt,
});

export default function LearningRoadmapScreen(): React.ReactElement {
  const route = useRoute<any>();
  const navigation = useNavigation<LearningRoadmapScreenNavigationProp>();
  const params = route.params;
  const insets = useSafeAreaInsets();
  const { state } = useAuth();

  const [roadmap, setRoadmap] = useState<LearningRoadmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<LearningRoadmapNode | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  const buildLearningRoadmapFromPlan = (
    plan: BackendPlannedRoadmapResponse,
  ): LearningRoadmap => {
    const now = new Date().toISOString();
    const steps = [...(plan.steps || [])].sort((a, b) => a.order_index - b.order_index);
    const targetRoleTitle = plan.target_role || params.careerTitle;

    const toSkillId = (name: string, index: number) =>
      `${params.careerTitle}-${index}-${name}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Map skill_name to ID using index to ensure uniqueness (handles duplicate names)
    const skillIdByName = new Map<string, string>();
    const skillIdByIndex = new Map<number, string>();
    
    steps.forEach((step, index) => {
      const skillId = toSkillId(step.skill_name, index);
      skillIdByIndex.set(index, skillId);
      // Also track by name, but only for first occurrence
      const nameLower = step.skill_name.toLowerCase();
      if (!skillIdByName.has(nameLower)) {
        skillIdByName.set(nameLower, skillId);
      }
    });

    const roadmapNodes = steps.map((step, index): LearningRoadmapNode => {
      // Use index-based lookup first to ensure uniqueness, fallback to name lookup for prerequisites
      const skillId = skillIdByIndex.get(index) || toSkillId(step.skill_name, index);
      const prerequisiteIds = step.prerequisites
        .map((name) => {
          // Find prerequisite by name and return its index-based ID
          const prereqIndex = steps.findIndex(
            (s) => s.skill_name.toLowerCase() === name.toLowerCase()
          );
          return prereqIndex >= 0 ? skillIdByIndex.get(prereqIndex) : undefined;
        })
        .filter((value): value is string => Boolean(value));

      const primaryResource = toLearningResource(step.primary_resource, {
        resource_id: step.resource_id,
        title: step.resource_title,
        provider: step.provider,
        source_url: step.source_url,
        score: step.confidence_score,
      });
      const backupResources = (step.backup_resources || [])
        .map((resource) => toLearningResource(resource))
        .filter((resource): resource is LearningRoadmapResource => Boolean(resource));
      const displayLevel = toSkillLevel(step.level || step.difficulty);

      const skill: LearningSkill = {
        id: skillId,
        name: normalizeSkillLabel(step.skill_name),
        description: step.why_it_matters,
        level: step.difficulty,
        sourceLevel: step.level,
        confidence_score: step.confidence_score,
        duration_hours: Math.max(1, Math.round(step.estimated_duration_hours || 1)),
        prerequisites: prerequisiteIds,
        category: 'Learning Roadmap',
        importance: index < 2 ? 'critical' : index < 4 ? 'important' : 'nice-to-have',
        created_at: now,
      };

      const dependencies: LearningSkill[] = step.prerequisites
        .map((name) => {
          const dependencyIndex = steps.findIndex(
            (candidate) => candidate.skill_name.toLowerCase() === name.toLowerCase(),
          );
          if (dependencyIndex < 0) return null;
          const dependencyStep = steps[dependencyIndex];
          const dependencyId = skillIdByIndex.get(dependencyIndex) || toSkillId(dependencyStep.skill_name, dependencyIndex);

          return {
            id: dependencyId,
            name: normalizeSkillLabel(dependencyStep.skill_name),
            description: dependencyStep.why_it_matters,
            level: dependencyStep.difficulty,
            duration_hours: Math.max(1, Math.round(dependencyStep.estimated_duration_hours || 1)),
            prerequisites: [],
            category: 'Learning Roadmap',
            importance: dependencyIndex < 2 ? 'critical' : dependencyIndex < 4 ? 'important' : 'nice-to-have',
            created_at: now,
          };
        })
        .filter((value): value is LearningSkill => Boolean(value));

      const resourcesForCourses = [primaryResource, ...backupResources]
        .filter((resource): resource is LearningRoadmapResource => Boolean(resource?.title))
        .filter((resource, resourceIndex, all) => {
          const key = resource.source_url || resource.resource_id || resource.title;
          return (
            all.findIndex(
              (candidate) => (candidate.source_url || candidate.resource_id || candidate.title) === key,
            ) === resourceIndex
          );
        })
        .slice(0, 7);

      const courses: LearningCourse[] = resourcesForCourses.map((resource, resourceIndex) => ({
        ...resourceToCourse(
          resource,
          skillId,
          normalizeSkillLabel(step.skill_name),
          displayLevel,
          step.estimated_duration_hours || 1,
          resourceIndex,
          now,
        ),
        free: step.free_or_paid !== 'paid',
      }));

      const certifications = (step.certifications || [])
        .map((resource) => toLearningResource(resource))
        .filter((resource): resource is LearningRoadmapResource => Boolean(resource));

      return {
        skill,
        courses,
        dependencies,
        primaryResource,
        backupResources,
        certifications,
        evidenceReasons: step.evidence_reasons || [],
        userProgress: {
          started: index === 0,
          completedPercentage: 0,
          completedCourses: [],
        },
      };
    });

    const totalDurationHours = roadmapNodes.reduce((sum, node) => sum + node.skill.duration_hours, 0);

    return {
      id: `learning-roadmap-${plan.career_id || params.careerTitle}-${Date.now()}`,
      user_id: state.user?.id || '',
      career_id: plan.career_id || params.careerId || targetRoleTitle,
      career_title: targetRoleTitle,
      title: `${normalizeSkillLabel(targetRoleTitle)} Learning Roadmap`,
      description: `Learning path for ${normalizeSkillLabel(targetRoleTitle)}.`,
      confidence: plan.confidence,
      weak_evidence: plan.weak_evidence,
      message: plan.message,
      diagnostics: plan.diagnostics || null,
      metadata: plan.metadata || null,
      skills: roadmapNodes,
      total_duration_hours: totalDurationHours,
      estimated_weeks: Math.max(1, Math.ceil(totalDurationHours / 8)),
      skill_count: roadmapNodes.length,
      created_at: now,
      updated_at: now,
    };
  };

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    void loadInitialRoadmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!roadmap) return;

    const completedCount = roadmap.skills.filter(
      (skill) => skill.userProgress?.completedPercentage === 100,
    ).length;
    const totalCount = roadmap.skills.length;
    const percentValue = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    Animated.timing(progressAnim, {
      toValue: percentValue,
      duration: 1500,
      useNativeDriver: false,
    }).start();

    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      }),
    ).start();
  }, [roadmap, progressAnim, rotationAnim]);

  useEffect(() => {
    if (!roadmap || !state.user?.id) return;

    const saveTimer = setTimeout(async () => {
      try {
        const roadmapWithUser = { ...roadmap, user_id: state.user!.id };
        await saveLearningRoadmap(state.user!.id, roadmapWithUser);
        await saveLearningRoadmapToBackend({
          careerId: String(roadmap.career_id || params.careerId || params.careerTitle),
          careerTitle: String(roadmap.career_title || params.careerTitle),
          roadmapData: roadmapWithUser as unknown as Record<string, unknown>,
        });
      } catch (error) {
        console.warn('[LearningRoadmap] Auto-save failed', error);
      }
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [roadmap, state.user?.id]);

  const loadInitialRoadmap = async () => {
    if (!state.user?.id) return;

    try {
      const existing = await getLearningRoadmapByCareerTitle(state.user.id, params.careerTitle);
      if (existing?.roadmap) {
        setRoadmap(existing.roadmap);
      }
    } catch (error) {
      console.warn('[LearningRoadmap] Failed to load roadmap', error);
    }
  };

  const openResourceUrl = async (url?: string | null) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert('Unable to open resource', 'The resource link could not be opened on this device.');
    }
  };

  const handleStartSkill = (skillIndex: number) => {
    if (!roadmap) return;
    const updatedRoadmap = { ...roadmap };
    const skill = updatedRoadmap.skills[skillIndex];

    if (!skill.userProgress) {
      skill.userProgress = {
        started: true,
        completedPercentage: 0,
        completedCourses: [],
      };
    } else {
      skill.userProgress.started = true;
    }

    setRoadmap(updatedRoadmap);
  };

  const handleUpdateProgress = (skillIndex: number, percentage: number) => {
    if (!roadmap) return;
    const updatedRoadmap = { ...roadmap };
    const skill = updatedRoadmap.skills[skillIndex];

    if (!skill.userProgress) {
      skill.userProgress = {
        started: true,
        completedPercentage: percentage,
        completedCourses: [],
      };
    } else {
      skill.userProgress.completedPercentage = Math.min(percentage, 100);
      skill.userProgress.started = true;
    }

    setRoadmap(updatedRoadmap);
  };

  const handleCompleteSkill = (skillIndex: number) => {
    handleUpdateProgress(skillIndex, 100);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const planned = await fetchRoadmapPlanFromBackend({
        careerId: params.careerId,
        careerTitle: params.careerTitle,
        careerDescription: params.careerDescription,
        targetRole: params.careerTitle,
        maxSteps: 12,
      });

      const generated = buildLearningRoadmapFromPlan(planned);
      setRoadmap(generated);

      if (state.user?.id) {
        const roadmapWithUser = { ...generated, user_id: state.user.id };
        await saveLearningRoadmap(state.user.id, roadmapWithUser);
        await saveLearningRoadmapToBackend({
          careerId: String(generated.career_id || params.careerId || params.careerTitle),
          careerTitle: String(generated.career_title || params.careerTitle),
          roadmapData: roadmapWithUser as unknown as Record<string, unknown>,
        });
      }
    } catch (error: any) {
      console.error('[LearningRoadmap] Generate failed', error);
      Alert.alert('Generation failed', error?.message ? String(error.message) : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!roadmap || !state.user?.id) return;

    setSaving(true);
    try {
      const roadmapWithUser = { ...roadmap, user_id: state.user.id };
      await saveLearningRoadmap(state.user.id, roadmapWithUser);
      await saveLearningRoadmapToBackend({
        careerId: String(roadmap.career_id || params.careerId || params.careerTitle),
        careerTitle: String(roadmap.career_title || params.careerTitle),
        roadmapData: roadmapWithUser as unknown as Record<string, unknown>,
      });
      Alert.alert('Saved', 'Learning roadmap saved successfully.');
      navigation.goBack();
    } catch (error) {
      console.warn('[LearningRoadmap] Save failed', error);
      Alert.alert('Save failed', 'Failed to save roadmap');
    } finally {
      setSaving(false);
    }
  };

  const renderSkillCard = (item: LearningRoadmapNode, index: number) => {
    const userProgress = item.userProgress;
    const isCompleted = userProgress?.completedPercentage === 100;
    const isInProgress = userProgress?.started === true && userProgress?.completedPercentage < 100;
    const isLocked = !userProgress?.started;
    const rotation = rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const primaryCourse = item.courses?.[0];

    return (
      <View key={item.skill.id} style={styles.timelineItem}>
        <View style={styles.timelineCircleContainer}>
          <View
            style={[
              styles.timelineCircle,
              {
                backgroundColor: isCompleted ? '#22c55e' : isInProgress ? '#8158F8' : '#E5E7EB',
                borderColor: isInProgress ? '#8158F8' : 'transparent',
                borderWidth: isInProgress ? 4 : 0,
              },
            ]}
          >
            {isCompleted && <Ionicons name="checkmark-circle" size={32} color="white" />}
            {isInProgress && (
              <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                <Ionicons name="play" size={28} color="white" />
              </Animated.View>
            )}
            {isLocked && <Ionicons name="lock-closed" size={24} color="white" />}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.skillCard,
            {
              backgroundColor: isInProgress ? '#f5f3ff' : isCompleted ? '#f0fdf4' : '#ffffff',
              borderLeftColor: isInProgress ? '#8158F8' : isCompleted ? '#22c55e' : '#E5E7EB',
              opacity: isLocked ? 0.6 : 1,
            },
            pressed && styles.skillCardPressed,
          ]}
          onPress={() => !isLocked && setSelectedSkill(item)}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.skillTitle}>{item.skill.name}</Text>
              {isCompleted && <Text style={styles.statusBadge}>Completed</Text>}
            </View>
            {!isLocked && <Ionicons name="chevron-forward" size={20} color="#6B5B95" />}
          </View>

          <Text style={[styles.skillDescription, { color: isLocked ? '#9CA3AF' : '#6B5B95' }]}>
            {item.skill.description}
          </Text>

          <View style={styles.metadataRow}>
            <View style={[styles.badge, { backgroundColor: getDifficultyColor(item.skill.level) + '20' }]}>
              <Ionicons
                name={getDifficultyIcon(item.skill.level)}
                size={12}
                color={getDifficultyColor(item.skill.level)}
              />
              <Text style={[styles.badgeText, { color: getDifficultyColor(item.skill.level) }]}>
                {item.skill.level}
              </Text>
            </View>

            <View style={[styles.badge, { backgroundColor: '#f2e2ff' }]}>
              <Ionicons name="time-outline" size={12} color="#8158F8" />
              <Text style={[styles.badgeText, { color: '#8158F8' }]}>{item.skill.duration_hours}h</Text>
            </View>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    item.skill.importance === 'critical'
                      ? '#FEE2E2'
                      : item.skill.importance === 'important'
                        ? '#FEF3C7'
                        : '#F3F4F6',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeTextSmall,
                  {
                    color:
                      item.skill.importance === 'critical'
                        ? '#EF4444'
                        : item.skill.importance === 'important'
                          ? '#D97706'
                          : '#6B7280',
                  },
                ]}
              >
                {item.skill.importance === 'critical' ? '★' : item.skill.importance === 'important' ? '◆' : '○'}
              </Text>
            </View>
          </View>

          {primaryCourse?.url && (
            <Pressable
              style={({ pressed }) => [styles.inlineResourceCard, pressed && { opacity: 0.82 }]}
              onPress={() => openResourceUrl(primaryCourse.url)}
            >
              <View style={styles.inlineResourceText}>
                <View style={styles.skillLinkageBadge}>
                  <Ionicons name="link-outline" size={12} color="#22c55e" />
                  <Text style={styles.skillLinkageText}>Best for: {item.skill.name}</Text>
                </View>

                <Text style={styles.inlineResourceProvider} numberOfLines={1}>
                  {primaryCourse.provider}
                </Text>
                <Text style={styles.inlineResourceTitle} numberOfLines={2}>
                  {primaryCourse.title}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#8158F8" />
            </Pressable>
          )}

          {!isCompleted && (
            <View style={[styles.metaSection, { paddingTop: 12, marginTop: 12 }]}>
              {isLocked ? (
                <Pressable
                  style={({ pressed }) => [styles.startButton, pressed && styles.buttonPressed]}
                  onPress={() => handleStartSkill(index)}
                >
                  <Ionicons name="play" size={28} color="white" />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.completeButton, pressed && styles.buttonPressed]}
                  onPress={() => handleCompleteSkill(index)}
                >
                  <Ionicons name="checkmark-done-outline" size={28} color="white" />
                </Pressable>
              )}
            </View>
          )}
        </Pressable>
      </View>
    );
  };

  if (!roadmap && !loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.emptyStateContent}>
          <View style={styles.emptyIcon}>
            <Ionicons name="school-outline" size={64} color="#8158F8" />
          </View>
          <Text style={styles.emptyStateTitle}>No Learning Path Yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Generate a personalized learning roadmap to master the skills needed for {params.careerTitle}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.generateButton, pressed && styles.generateButtonPressed]}
            onPress={handleGenerate}
          >
            <Ionicons name="sparkles" size={20} color="white" />
            <Text style={styles.generateButtonText}>Generate Roadmap</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="sparkles" size={48} color="#8158F8" />
          </View>
          <Text style={styles.loadingTitle}>Building your roadmap</Text>
          <Text style={styles.loadingSubtitle}>
            Analyzing skills and finding the best courses for {normalizeSkillLabel(params.careerTitle)}
          </Text>
          <ActivityIndicator size="large" color="#8158F8" style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  const completedCount =
    roadmap?.skills.filter((skill) => skill.userProgress?.completedPercentage === 100).length || 0;
  const totalCount = roadmap?.skills.length || 1;
  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!selectedSkill}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        <View style={styles.progressHeaderSection}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.currentPathLabel}>Current Path</Text>
              <Text style={styles.careerTitle}>
                {normalizeSkillLabel(String(roadmap?.career_title || params.careerTitle))}
              </Text>
            </View>
            <View style={styles.progressPercentage}>
              <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
              <Text style={styles.progressPercentLabel}>Complete</Text>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.timelineSection}>
          <View style={styles.ghostLine} />

          {roadmap?.skills.length > 0 && (
            <View style={styles.timelineSummary}>
              <View style={styles.timelineSummaryIcon}>
                <Ionicons name="book-outline" size={20} color="#8158F8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineSummaryTitle}>Skill-by-Skill Learning Journey</Text>
                <Text style={styles.timelineSummarySubtitle}>
                  Each step pairs a specific skill with the best-matched course. Tap any step to see more.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.skillsTimeline}>{roadmap?.skills.map((skill, index) => renderSkillCard(skill, index))}</View>
        </View>

        {roadmap && (
          <View style={styles.aiRecommendationCard}>
            <View style={styles.aiIconContainer}>
              <Ionicons name="bulb-outline" size={40} color="#8158F8" />
            </View>
            <View style={styles.aiContent}>
              <Text style={styles.aiTitle}>Pro Tip: Deep Dive Recommended</Text>
              <Text style={styles.aiText}>
                Complete fundamentals first to build a strong foundation. Consider scheduling a 1:1 mentor session for advanced topics.
              </Text>
            </View>
          </View>
        )}

        {roadmap && !selectedSkill && (
          <View style={[styles.actionButtons, { marginHorizontal: 16, marginVertical: 12, borderTopWidth: 0 }]}>
            <Pressable
              style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
              onPress={handleGenerate}
            >
              <Ionicons name="refresh" size={18} color="#8158F8" />
              <Text style={styles.buttonSecondaryText}>Regenerate</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.buttonPrimary,
                pressed && styles.buttonPressed,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="bookmark" size={18} color="white" />
                  <Text style={styles.buttonPrimaryText}>Save Roadmap</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      {selectedSkill && (
        <View style={[styles.detailPanel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable style={styles.detailCloseButton} onPress={() => setSelectedSkill(null)}>
            <Ionicons name="chevron-down" size={24} color="#37274d" />
          </Pressable>

          <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeaderCard}>
              <View style={styles.detailHeaderBadge}>
                <Ionicons name="school-outline" size={40} color="#8158F8" />
              </View>
              <Text style={styles.detailHeaderTitle}>{selectedSkill.skill.name}</Text>
              <Text style={styles.detailHeaderSubtitle}>{selectedSkill.skill.description}</Text>

              <View style={styles.metadatapills}>
                <View style={styles.metadataPill}>
                  <Ionicons name="time-outline" size={14} color="#8158F8" />
                  <Text style={styles.metadataPillText}>{selectedSkill.skill.duration_hours}h</Text>
                </View>
                <View style={styles.metadataPill}>
                  <Ionicons
                    name={getDifficultyIcon(selectedSkill.skill.level)}
                    size={14}
                    color={getDifficultyColor(selectedSkill.skill.level)}
                  />
                  <Text style={[styles.metadataPillText, { color: getDifficultyColor(selectedSkill.skill.level) }]}>
                    {selectedSkill.skill.level}
                  </Text>
                </View>
              </View>
            </View>

            {selectedSkill.courses && selectedSkill.courses.length > 0 && (
              <View style={styles.detailSectionContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="play-circle-outline" size={20} color="#8158F8" />
                  <Text style={styles.sectionTitle}>Recommended Courses</Text>
                  <Text style={styles.courseCount}>{selectedSkill.courses.length}</Text>
                </View>

                {selectedSkill.courses.map((course) => (
                  <Pressable
                    key={course.id}
                    style={({ pressed }) => [styles.courseCard, pressed && { opacity: 0.85 }]}
                    onPress={() => openResourceUrl(course.url)}
                  >
                    <View style={styles.courseCardContent}>
                      <View style={styles.courseHeader}>
                        <View style={styles.providerBadge}>
                          <Text style={styles.providerBadgeText}>{course.provider.substring(0, 2).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.courseProvider}>{course.provider}</Text>
                          <Text style={styles.courseTitle} numberOfLines={2}>
                            {course.title}
                          </Text>
                        </View>
                        <Ionicons name="open-outline" size={22} color="#8158F8" />
                      </View>

                      <View style={styles.courseMetadata}>
                        <View style={styles.courseMetaItem}>
                          <Ionicons name="flag-outline" size={14} color={getDifficultyColor(course.level)} />
                          <Text style={[styles.courseMetaLabel, { color: getDifficultyColor(course.level) }]}>
                            {course.level}
                          </Text>
                        </View>
                        {course.free && (
                          <View style={[styles.courseMetaItem, { backgroundColor: '#dcfce7' }]}>
                            <Ionicons name="pricetag-outline" size={14} color="#22c55e" />
                            <Text style={[styles.courseMetaLabel, { color: '#22c55e' }]}>Free</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {selectedSkill.dependencies && selectedSkill.dependencies.length > 0 && (
              <View style={styles.detailSectionContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                  <Text style={styles.sectionTitle}>Prerequisites</Text>
                  <Text style={styles.courseCount}>{selectedSkill.dependencies.length}</Text>
                </View>

                {selectedSkill.dependencies.map((dep) => (
                  <View key={dep.id} style={styles.prerequisiteCard}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#9CA3AF" />
                    <Text style={styles.prerequisiteTitle}>{dep.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {selectedSkill.certifications && selectedSkill.certifications.length > 0 && (
              <View style={styles.detailSectionContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="ribbon-outline" size={20} color="#F59E0B" />
                  <Text style={styles.sectionTitle}>Certifications</Text>
                  <Text style={styles.courseCount}>{selectedSkill.certifications.length}</Text>
                </View>

                {selectedSkill.certifications.map((cert) => (
                  <Pressable
                    key={cert.resource_id || cert.title}
                    style={({ pressed }) => [styles.courseCard, pressed && { opacity: 0.85 }]}
                    onPress={() => openResourceUrl(cert.source_url)}
                  >
                    <View style={styles.courseCardContent}>
                      <View style={styles.courseHeader}>
                        <View style={[styles.providerBadge, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.providerBadgeText, { color: '#D97706' }]}>
                            {(cert.provider || 'CERT').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.courseProvider}>{cert.provider || 'Certification'}</Text>
                          <Text style={styles.courseTitle} numberOfLines={2}>
                            {cert.title || 'Certification'}
                          </Text>
                        </View>
                        <Ionicons name="open-outline" size={22} color="#F59E0B" />
                      </View>

                      <View style={styles.courseMetadata}>
                        <View style={[styles.courseMetaItem, { backgroundColor: '#FEF3C7' }]}>
                          <Ionicons name="ribbon-outline" size={14} color="#D97706" />
                          <Text style={[styles.courseMetaLabel, { color: '#D97706' }]}>Certification</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
  },
  progressHeaderSection: {
    paddingHorizontal: 16,
    paddingVertical: 28,
    backgroundColor: '#ffffff',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  currentPathLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9c9a9a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  careerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#37274d',
    letterSpacing: -0.02,
  },
  progressPercentage: {
    alignItems: 'flex-end',
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: '800',
    color: '#8158F8',
  },
  progressPercentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9c9a9a',
    marginTop: 2,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f2e2ff',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8158F8',
    borderRadius: 4,
  },
  timelineSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    position: 'relative',
  },
  ghostLine: {
    position: 'absolute',
    left: 32,
    top: 24,
    bottom: 24,
    width: 1,
    backgroundColor: '#f2e2ff',
  },
  skillsTimeline: {
    paddingLeft: 0,
  },
  timelineSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  timelineSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f2e2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#37274d',
    marginBottom: 4,
  },
  timelineSummarySubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B5B95',
    lineHeight: 18,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineCircleContainer: {
    width: 64,
    alignItems: 'center',
    paddingTop: 8,
  },
  timelineCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 4,
  },
  skillCard: {
    flex: 1,
    marginLeft: 12,
    marginRight: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderLeftWidth: 0,
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  skillCardPressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skillTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#37274d',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  skillDescription: {
    fontSize: 13,
    color: '#6B5B95',
    lineHeight: 19,
    marginBottom: 12,
    fontWeight: '500',
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f2e2ff',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8158F8',
  },
  badgeTextSmall: {
    fontSize: 12,
    fontWeight: '600',
  },
  inlineResourceCard: {
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineResourceText: {
    flex: 1,
    minWidth: 0,
  },
  inlineResourceProvider: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8158F8',
    marginBottom: 3,
  },
  inlineResourceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#37274d',
    lineHeight: 17,
  },
  skillLinkageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  skillLinkageText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  metaSection: {
    borderTopWidth: 0,
    paddingTop: 14,
    marginTop: 14,
  },
  aiRecommendationCard: {
    margin: 16,
    marginTop: 32,
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#f2e2ff',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 16,
    borderWidth: 0,
    marginBottom: 24,
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  aiIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#8158F8' + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiContent: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#37274d',
    marginBottom: 6,
  },
  aiText: {
    fontSize: 12,
    color: '#6B5B95',
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '500',
  },
  detailPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    zIndex: 1000,
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 15,
  },
  detailCloseButton: {
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  detailHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 0,
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  detailHeaderBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#f2e2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#37274d',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.02,
  },
  detailHeaderSubtitle: {
    fontSize: 13,
    color: '#6B5B95',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: '500',
  },
  metadatapills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  metadataPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f2e2ff',
    borderRadius: 16,
    borderWidth: 0,
  },
  metadataPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8158F8',
  },
  detailSectionContent: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#37274d',
    flex: 1,
    letterSpacing: -0.3,
  },
  courseCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9c9a9a',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  courseCardContent: {
    gap: 12,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f2e2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8158F8',
  },
  courseProvider: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8158F8',
    marginBottom: 4,
  },
  courseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#37274d',
    lineHeight: 18,
  },
  courseMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  courseMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 0,
  },
  courseMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B5B95',
  },
  prerequisiteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fcf4ff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 0,
  },
  prerequisiteTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#37274d',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  buttonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 0,
    backgroundColor: '#f2e2ff',
    gap: 6,
  },
  buttonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8158F8',
  },
  buttonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#8158F8',
    gap: 6,
  },
  buttonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyStateContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#37274d',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.02,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B5B95',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
    fontWeight: '500',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8158F8',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#8158F8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  generateButtonPressed: {
    opacity: 0.85,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#f2e2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#37274d',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#6B5B95',
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '500',
  },
  startButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#8158F8',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0,
    marginTop: 12,
    shadowColor: '#8158F8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  completeButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0,
    marginTop: 12,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
});