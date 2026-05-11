import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  saveLearningRoadmap,
  getLearningRoadmapByCareerTitle,
} from '../features/learning-roadmap/storage';
import { useAuth } from '../auth/AuthProvider';
import { homeColors } from './homeTheme';
import type {
  LearningCourse,
  LearningRoadmap,
  LearningRoadmapNode,
  LearningRoadmapResource,
  LearningSkill,
  SkillLevel,
} from '../features/learning-roadmap/types';
import {
  fetchIngestionStatus,
  fetchRoadmapPlanFromBackend,
  refreshRoadmapProvider,
  saveLearningRoadmapToBackend,
  type BackendIngestionStatusData,
  type BackendPlannedRoadmapResponse,
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return homeColors.accentGreen;
    case 'in-progress':
      return homeColors.primary;
    case 'locked':
      return '#9CA3AF';
    default:
      return homeColors.textMuted;
  }
};

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

const parseSkillsInput = (value: string) =>
  value
    .split(/[,\n]/)
    .map((skill) => skill.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean);

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
    recommendation_reason: resource?.recommendation_reason ?? fallback?.recommendation_reason ?? null,
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
  description: resource.why_selected || `Recommended learning resource for ${skillName}`,
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

const isRagRoadmap = (value?: LearningRoadmap | null) =>
  Boolean(value?.confidence != null || value?.metadata || value?.diagnostics || value?.weak_evidence != null);

export default function LearningRoadmapScreen(): React.ReactElement {
  const route = useRoute<any>();
  const navigation = useNavigation<LearningRoadmapScreenNavigationProp>();
  const params = route.params;
  const insets = useSafeAreaInsets();

  const [roadmap, setRoadmap] = useState<LearningRoadmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<LearningRoadmapNode | null>(null);
  const [skillsInput, setSkillsInput] = useState('python, git');
  const [targetRoleInput, setTargetRoleInput] = useState(params.careerTitle || 'backend_developer');
  const [refreshingSkillId, setRefreshingSkillId] = useState<string | null>(null);
  const [ingestionStatusBySkill, setIngestionStatusBySkill] = useState<Record<string, BackendIngestionStatusData>>({});
  const { state } = useAuth();

  const progressAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  const buildLearningRoadmapFromPlan = (
    plan: BackendPlannedRoadmapResponse,
  ): LearningRoadmap => {
    const now = new Date().toISOString();
    const steps = plan.steps || [];
    const orderedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
    const skillIdByName = new Map<string, string>();
    const targetRoleTitle = plan.target_role || targetRoleInput || params.careerTitle;

    const toSkillId = (name: string, index: number) =>
      `${params.careerTitle}-${index}-${name}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    orderedSteps.forEach((step, index) => {
      skillIdByName.set(step.skill_name.toLowerCase(), toSkillId(step.skill_name, index));
    });

    const skills = orderedSteps.map((step, index): LearningRoadmapNode => {
      const skillId = skillIdByName.get(step.skill_name.toLowerCase()) || toSkillId(step.skill_name, index);
      const prerequisiteIds = step.prerequisites
        .map((name) => skillIdByName.get(name.toLowerCase()))
        .filter((value): value is string => Boolean(value));

      const primaryResource = toLearningResource(step.primary_resource, {
        resource_id: step.resource_id,
        title: step.resource_title,
        provider: step.provider,
        source_url: step.source_url,
        score: step.confidence_score,
        display_badges: step.primary_resource?.display_badges ?? null,
        recommendation_reason: step.primary_resource?.recommendation_reason ?? null,
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
        category: 'RAG Roadmap',
        importance: index < 2 ? 'critical' : index < 4 ? 'important' : 'nice-to-have',
        created_at: now,
      };

      const dependencies: LearningSkill[] = step.prerequisites
        .map((name) => {
          const dependencyIndex = orderedSteps.findIndex(
            (candidate) => candidate.skill_name.toLowerCase() === name.toLowerCase(),
          );
          if (dependencyIndex < 0) return null;
          const dependencyStep = orderedSteps[dependencyIndex];
          const dependencyId =
            skillIdByName.get(dependencyStep.skill_name.toLowerCase()) ||
            toSkillId(dependencyStep.skill_name, dependencyIndex);

          return {
            id: dependencyId,
            name: normalizeSkillLabel(dependencyStep.skill_name),
            description: dependencyStep.why_it_matters,
            level: dependencyStep.difficulty,
            duration_hours: Math.max(1, Math.round(dependencyStep.estimated_duration_hours || 1)),
            prerequisites: [],
            category: 'RAG Roadmap',
            importance: dependencyIndex < 2 ? 'critical' : dependencyIndex < 4 ? 'important' : 'nice-to-have',
            created_at: now,
          };
        })
        .filter((value): value is LearningSkill => Boolean(value));

      const resourcesForCourses = [primaryResource, ...backupResources]
        .filter((resource): resource is LearningRoadmapResource => Boolean(resource?.title))
        .filter((resource, resourceIndex, all) => {
          const key = resource.source_url || resource.resource_id || resource.title;
          return all.findIndex((candidate) => (candidate.source_url || candidate.resource_id || candidate.title) === key) === resourceIndex;
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

      return {
        skill,
        courses,
        dependencies,
        primaryResource,
        backupResources,
        evidenceReasons: step.evidence_reasons || [],
        userProgress: {
          started: index === 0,
          completedPercentage: 0,
          completedCourses: [],
        },
      };
    });

    const totalDurationHours = skills.reduce((sum, node) => sum + node.skill.duration_hours, 0);

    return {
      id: `learning-rag-${params.careerId || params.careerTitle}-${Date.now()}`,
      user_id: state.user?.id || '',
      career_id: plan.career_id || params.careerId || targetRoleTitle,
      career_title: targetRoleTitle,
      title: `${normalizeSkillLabel(targetRoleTitle)} Learning Roadmap`,
      description: `Retrieval-backed learning path for ${normalizeSkillLabel(targetRoleTitle)}.`,
      confidence: plan.confidence,
      weak_evidence: plan.weak_evidence,
      message: plan.message,
      diagnostics: plan.diagnostics || null,
      metadata: plan.metadata || null,
      skills,
      total_duration_hours: totalDurationHours,
      estimated_weeks: Math.max(1, Math.ceil(totalDurationHours / 8)),
      skill_count: skills.length,
      created_at: now,
      updated_at: now,
    };
  };

  useEffect(() => {
    if (roadmap) {
      // Start rotation animation for in-progress items
      Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [roadmap, rotationAnim]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    loadInitialRoadmap();
  }, []);

  useEffect(() => {
    if (roadmap) {
      const completedCount = roadmap.skills.filter(
        (s) => s.userProgress?.completedPercentage === 100,
      ).length;
      const totalCount = roadmap.skills.length;
      const percentValue = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

      Animated.timing(progressAnim, {
        toValue: percentValue,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    }
  }, [roadmap]);

  // Auto-save roadmap progress whenever it changes
  useEffect(() => {
    if (!roadmap || !state.user?.id) return;

    // Debounce the save to avoid excessive writes
    const saveTimer = setTimeout(async () => {
      try {
        const roadmapWithUser = { ...roadmap, user_id: state.user!.id };
        await saveLearningRoadmap(state.user!.id, roadmapWithUser);
        await saveLearningRoadmapToBackend({
          careerId: String(roadmap.career_id || params.careerId || params.careerTitle),
          careerTitle: String(roadmap.career_title || params.careerTitle),
          roadmapData: roadmapWithUser as unknown as Record<string, unknown>,
        });
        console.log('[LearningRoadmap] Auto-saved progress');
      } catch (error) {
        console.warn('[LearningRoadmap] Auto-save failed', error);
      }
    }, 1000); // Wait 1 second after last change before saving

    return () => clearTimeout(saveTimer);
  }, [roadmap, state.user?.id]);

  const loadInitialRoadmap = async () => {
    if (!state.user?.id) return;
    try {
      const existing = await getLearningRoadmapByCareerTitle(state.user.id, params.careerTitle);
      if (isRagRoadmap(existing?.roadmap)) {
        setRoadmap(existing.roadmap);
      }
    } catch (error) {
      console.warn('[LearningRoadmap] Failed to load roadmap', error);
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

  const replacePrimaryResource = (
    skillId: string,
    resource: LearningRoadmapResource,
    confidenceScore?: number,
  ) => {
    setRoadmap((current) => {
      if (!current) return current;
      return {
        ...current,
        skills: current.skills.map((node) => {
          if (node.skill.id !== skillId) return node;
          const updatedCourse: LearningCourse = {
            id: `${skillId}-resource`,
            skill_id: skillId,
            title: resource.title || node.courses[0]?.title || node.skill.name,
            description: resource.why_selected || node.courses[0]?.description || `Recommended learning resource for ${node.skill.name}`,
            provider: resource.provider || node.courses[0]?.provider || 'Curated Resource',
            url: resource.source_url || node.courses[0]?.url || '',
            source_resource_id: resource.resource_id,
            confidence_score: confidenceScore ?? resource.score,
            display_badges: resource.display_badges,
            recommendation_reason: resource.recommendation_reason,
            duration_hours: node.courses[0]?.duration_hours || Math.max(1, Math.round(node.skill.duration_hours * 0.6)),
            level: node.courses[0]?.level || node.skill.level,
            rating: node.courses[0]?.rating || 4,
            free: node.courses[0]?.free ?? true,
            course_type: node.courses[0]?.course_type || 'text',
            created_at: node.courses[0]?.created_at || new Date().toISOString(),
          };

          return {
            ...node,
            primaryResource: resource,
            courses: [updatedCourse, ...node.courses.slice(1)],
          };
        }),
        updated_at: new Date().toISOString(),
      };
    });

    setSelectedSkill((current) => {
      if (!current || current.skill.id !== skillId) return current;
      const updatedCourse: LearningCourse = {
        id: `${skillId}-resource`,
        skill_id: skillId,
        title: resource.title || current.courses[0]?.title || current.skill.name,
        description: resource.why_selected || current.courses[0]?.description || `Recommended learning resource for ${current.skill.name}`,
        provider: resource.provider || current.courses[0]?.provider || 'Curated Resource',
        url: resource.source_url || current.courses[0]?.url || '',
        source_resource_id: resource.resource_id,
        confidence_score: confidenceScore ?? resource.score,
        display_badges: resource.display_badges,
        recommendation_reason: resource.recommendation_reason,
        duration_hours: current.courses[0]?.duration_hours || Math.max(1, Math.round(current.skill.duration_hours * 0.6)),
        level: current.courses[0]?.level || current.skill.level,
        rating: current.courses[0]?.rating || 4,
        free: current.courses[0]?.free ?? true,
        course_type: current.courses[0]?.course_type || 'text',
        created_at: current.courses[0]?.created_at || new Date().toISOString(),
      };
      return {
        ...current,
        primaryResource: resource,
        courses: [updatedCourse, ...current.courses.slice(1)],
      };
    });
  };

  const pollIngestionStatus = async (
    skillId: string,
    jobId: string,
    replacementResource: LearningRoadmapResource | null,
  ) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetchIngestionStatus(jobId);
      const status = response.data;
      setIngestionStatusBySkill((current) => ({ ...current, [skillId]: status }));

      if (
        status.outcome === 'completed' ||
        status.outcome === 'partial_success' ||
        status.outcome === 'no_changes' ||
        status.status === 'completed'
      ) {
        const storedResource = status.stored_resource
          ? {
              resource_id: status.stored_resource.resource_id,
              title: status.stored_resource.title,
              provider: status.stored_resource.provider,
              source_url: status.stored_resource.url,
              score: replacementResource?.score ?? 0,
              why_selected: replacementResource?.why_selected ?? null,
              display_badges: replacementResource?.display_badges ?? null,
              recommendation_reason: replacementResource?.recommendation_reason ?? null,
            }
          : replacementResource;
        if (storedResource) replacePrimaryResource(skillId, storedResource);
        return;
      }

      if (status.outcome === 'failed' || status.status === 'failed') {
        Alert.alert('Source refresh failed', status.error_message || 'The source could not be ingested.');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  };

  const handleRefreshResource = async (node: LearningRoadmapNode) => {
    const replacement =
      node.backupResources?.find(
        (resource) => resource.source_url && resource.source_url !== node.primaryResource?.source_url,
      ) || node.primaryResource || null;

    if (!replacement?.source_url) {
      Alert.alert('No source URL', 'This step does not have a refreshable source yet.');
      return;
    }

    setRefreshingSkillId(node.skill.id);
    try {
      const response = await refreshRoadmapProvider({
        url: replacement.source_url,
        skillName: node.skill.name.toLowerCase().replace(/\s+/g, '_'),
        targetRole: roadmap?.career_title || targetRoleInput || params.careerTitle,
      });
      setIngestionStatusBySkill((current) => ({
        ...current,
        [node.skill.id]: {
          id: response.data.id,
          provider: response.data.provider,
          job_type: 'on_demand_refresh',
          status: response.data.status,
          outcome: response.data.status === 'completed' ? 'completed' : 'pending',
          stats: null,
          filters: response.data.filters || null,
          error_message: null,
          started_at: null,
          finished_at: null,
          created_at: null,
          updated_at: null,
          queue_state: null,
          stored_resource: null,
        },
      }));
      await pollIngestionStatus(node.skill.id, response.data.id, replacement);
    } catch (error: any) {
      Alert.alert('Refresh failed', error?.message ? String(error.message) : 'Unable to refresh this source.');
    } finally {
      setRefreshingSkillId(null);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const userSkills = parseSkillsInput(skillsInput);
      const targetRole = targetRoleInput.trim() || params.careerTitle;
      const planned = await fetchRoadmapPlanFromBackend({
        careerId: params.careerId,
        careerTitle: targetRole,
        targetRole,
        careerDescription: params.careerDescription,
        userSkills,
        maxSteps: 12,
      });
      const generated = buildLearningRoadmapFromPlan(planned);
      setRoadmap(generated);
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
    // Determine status based on actual userProgress data
    const userProgress = item.userProgress;
    const isCompleted = userProgress?.completedPercentage === 100;
    const isInProgress = (userProgress?.started === true && userProgress?.completedPercentage < 100);
    const isLocked = !userProgress?.started;
    const progress = userProgress?.completedPercentage || 0;
    const primaryCourse = item.courses?.[0];

    const rotation = rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View key={item.skill.id} style={styles.timelineItem}>
        {/* Timeline Circle */}
        <View style={styles.timelineCircleContainer}>
          <View
            style={[
              styles.timelineCircle,
              {
                backgroundColor: isCompleted
                  ? '#22c55e'
                  : isInProgress
                    ? '#8158F8'
                    : '#E5E7EB',
                borderColor: isInProgress ? '#8158F8' : 'transparent',
                borderWidth: isInProgress ? 4 : 0,
                shadowColor: isInProgress ? '#8158F8' : '#000',
                shadowOpacity: isInProgress ? 0.25 : 0.1,
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

        {/* Timeline Card */}
        <Pressable
          style={({ pressed }) => [
            styles.skillCard,
            {
              backgroundColor: isInProgress ? '#f5f3ff' : isCompleted ? '#f0fdf4' : '#f8f9fa',
              borderLeftColor: isInProgress ? '#8158F8' : isCompleted ? '#22c55e' : '#E5E7EB',
              opacity: isLocked ? 0.6 : 1,
            },
            pressed && styles.skillCardPressed,
          ]}
          onPress={() => !isLocked && setSelectedSkill(item)}
        >
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.skillTitle}>{item.skill.name}</Text>
              {isCompleted && <Text style={styles.statusBadge}>Completed</Text>}
            </View>
            {!isLocked && (
              <Ionicons
                name={isLocked ? 'eye-off' : 'chevron-forward'}
                size={20}
                color="#6B5B95"
              />
            )}
          </View>

          <Text style={[styles.skillDescription, { color: isLocked ? '#9CA3AF' : '#6B5B95' }]}>
            {item.skill.description}
          </Text>

          {/* Metadata Row */}
          <View style={styles.metadataRow}>
            {/* Difficulty Badge */}
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

            {/* Duration Badge */}
            <View style={[styles.badge, { backgroundColor: '#f2e2ff' }]}>
              <Ionicons name="time-outline" size={12} color="#8158F8" />
              <Text style={[styles.badgeText, { color: '#8158F8' }]}>{item.skill.duration_hours}h</Text>
            </View>

            {/* Importance Badge */}
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
                <Text style={styles.inlineResourceProvider} numberOfLines={1}>
                  {primaryCourse.provider}
                </Text>
                <Text style={styles.inlineResourceTitle} numberOfLines={2}>
                  {primaryCourse.title}
                </Text>
                {primaryCourse.recommendation_reason && (
                  <Text style={styles.resourceReason} numberOfLines={2}>
                    {primaryCourse.recommendation_reason}
                  </Text>
                )}
                {Boolean(primaryCourse.display_badges?.length) && (
                  <View style={styles.resourceBadgeRow}>
                    {primaryCourse.display_badges?.map((badge) => (
                      <View key={badge} style={styles.resourceBadge}>
                        <Text style={styles.resourceBadgeText}>{badge}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <Ionicons name="open-outline" size={18} color="#8158F8" />
            </Pressable>
          )}

          {/* Progress Bar (for in-progress) */}
          {isInProgress && (
            <View style={styles.progressSection}>
              <View style={styles.progressMeta}>
                <Text style={styles.progressLabel}>Current Progress</Text>
                <Text style={styles.progressTime}>{Math.round(item.skill.duration_hours * (1 - progress / 100))}h left</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress}%`, backgroundColor: "#8158F8" },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Courses/Prerequisites Section */}
          {(item.courses?.length > 0 || item.dependencies?.length > 0) && (
            <View style={styles.metaSection}>
              <Text style={styles.metaTitle}>
                {isCompleted
                  ? 'Certifications'
                  : isLocked && item.dependencies?.length
                    ? 'Prerequisites'
                    : 'Featured Courses'}
              </Text>
              <View style={styles.metaItems}>
                {isCompleted
                  ? item.courses?.slice(0, 2).map((course) => (
                      <Text key={course.id} style={styles.metaTag}>
                        {course.provider}
                      </Text>
                    ))
                  : isLocked && item.dependencies?.length
                    ? item.dependencies.slice(0, 2).map((dep) => (
                        <Text key={dep.id} style={[styles.metaTag, styles.metaTagLocked]}>
                          {dep.name}
                        </Text>
                      ))
                    : item.courses?.slice(0, 2).map((course) => (
                        <Text key={course.id} style={styles.metaTag}>
                          {course.provider}
                        </Text>
                      ))}
                {((isCompleted ? item.courses : isLocked ? item.dependencies : item.courses) || []).length > 2 && (
                  <Text style={styles.metaTag}>
                    +{(isCompleted ? item.courses : isLocked ? item.dependencies : item.courses)?.length - 2}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Action Buttons */}
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

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#8158F8" />
        <Text style={styles.loadingText}>Generating your learning roadmap...</Text>
      </View>
    );
  }

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

          <View style={styles.planForm}>
            <Text style={styles.inputLabel}>Target role</Text>
            <TextInput
              style={styles.textInput}
              value={targetRoleInput}
              onChangeText={setTargetRoleInput}
              placeholder="backend_developer"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputLabel}>Your skills</Text>
            <TextInput
              style={[styles.textInput, styles.skillsInput]}
              value={skillsInput}
              onChangeText={setSkillsInput}
              placeholder="python, git"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
          </View>

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

  const completedCount = roadmap?.skills.filter(s => s.userProgress?.completedPercentage === 100).length || 0;
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
        {/* Progress Header Section */}
        <View style={styles.progressHeaderSection}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.currentPathLabel}>Current Path</Text>
              <Text style={styles.careerTitle}>{normalizeSkillLabel(String(roadmap?.career_title || params.careerTitle))}</Text>
            </View>
            <View style={styles.progressPercentage}>
              <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
              <Text style={styles.progressPercentLabel}>Complete</Text>
            </View>
          </View>

          {/* Progress Bar */}
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

        {/* Timeline Section */}
        <View style={styles.timelineSection}>
          {/* Ghost Line */}
          <View style={styles.ghostLine} />

          {/* Skills Timeline */}
          <View style={styles.skillsTimeline}>
            {roadmap?.skills.map((skill, index) => renderSkillCard(skill, index))}
          </View>
        </View>

        {/* AI Recommendation Card */}
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
              <Pressable style={styles.aiButton}>
                <Text style={styles.aiButtonText}>Schedule Mentor →</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Action Buttons */}
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

      {/* Detail Panel */}
      {selectedSkill && (
        <View style={[styles.detailPanel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Close Button */}
          <Pressable 
            style={styles.detailCloseButton}
            onPress={() => setSelectedSkill(null)}
          >
            <Ionicons name="chevron-down" size={24} color="#37274d" />
          </Pressable>

          <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
            {/* Header Card */}
            <View style={styles.detailHeaderCard}>
              <View style={styles.detailHeaderBadge}>
                <Ionicons name="school-outline" size={40} color="#8158F8" />
              </View>
              <Text style={styles.detailHeaderTitle}>{selectedSkill.skill.name}</Text>
              <Text style={styles.detailHeaderSubtitle}>{selectedSkill.skill.description}</Text>
              
              {/* Metadata Pills */}
              <View style={styles.metadatapills}>
                <View style={styles.metadataPill}>
                  <Ionicons name="time-outline" size={14} color="#8158F8" />
                  <Text style={styles.metadataPillText}>{selectedSkill.skill.duration_hours}h</Text>
                </View>
                <View style={styles.metadataPill}>
                  <Ionicons name={getDifficultyIcon(selectedSkill.skill.level)} size={14} color={getDifficultyColor(selectedSkill.skill.level)} />
                  <Text style={[styles.metadataPillText, { color: getDifficultyColor(selectedSkill.skill.level) }]}>
                    {selectedSkill.skill.level}
                  </Text>
                </View>
                <View style={[styles.metadataPill, {
                  backgroundColor: selectedSkill.skill.importance === 'critical' ? '#fee2e2' : selectedSkill.skill.importance === 'important' ? '#fef3c7' : '#f2e2ff'
                }]}>
                  <Text style={[styles.metadataPillText, {
                    color: selectedSkill.skill.importance === 'critical' ? '#dc2626' : selectedSkill.skill.importance === 'important' ? '#d97706' : '#8158F8'
                  }]}>
                    {selectedSkill.skill.importance === 'critical' ? '★ Critical' : selectedSkill.skill.importance === 'important' ? '◆ Important' : '○ Optional'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Courses Section */}
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
                          {course.recommendation_reason && (
                            <Text style={styles.resourceReason} numberOfLines={2}>
                              {course.recommendation_reason}
                            </Text>
                          )}
                          {Boolean(course.display_badges?.length) && (
                            <View style={styles.resourceBadgeRow}>
                              {course.display_badges?.map((badge) => (
                                <View key={badge} style={styles.resourceBadge}>
                                  <Text style={styles.resourceBadgeText}>{badge}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <Ionicons name="open-outline" size={22} color="#8158F8" />
                      </View>

                      <View style={styles.courseMetadata}>
                        {course.rating && (
                          <View style={styles.courseMetaItem}>
                            <Ionicons name="star" size={14} color="#FCD34D" />
                            <Text style={styles.courseMetaLabel}>{course.rating}/5</Text>
                          </View>
                        )}
                        <View style={styles.courseMetaItem}>
                          <Ionicons name="flag-outline" size={14} color={getDifficultyColor(course.level)} />
                          <Text style={[styles.courseMetaLabel, { color: getDifficultyColor(course.level) }]}>
                            {course.level}
                          </Text>
                        </View>
                        {course.free && (
                          <View style={[styles.courseMetaItem, { backgroundColor: '#dcfce7' }]}>
                            <Ionicons name="pricetag-outline" size={14} color="#22c55e" />
                            <Text style={[styles.courseMetaLabel, { color: '#22c55e' }]}>
                              Free
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}

                <Pressable
                  style={({ pressed }) => [
                    styles.refreshSourceButton,
                    pressed && styles.buttonPressed,
                    refreshingSkillId === selectedSkill.skill.id && styles.buttonDisabled,
                  ]}
                  onPress={() => handleRefreshResource(selectedSkill)}
                  disabled={refreshingSkillId === selectedSkill.skill.id}
                >
                  {refreshingSkillId === selectedSkill.skill.id ? (
                    <ActivityIndicator size="small" color="#8158F8" />
                  ) : (
                    <Ionicons name="refresh" size={18} color="#8158F8" />
                  )}
                  <Text style={styles.refreshSourceText}>Generate More Options</Text>
                </Pressable>

                {ingestionStatusBySkill[selectedSkill.skill.id] && (
                  <View style={styles.ingestionStatusCard}>
                    <View style={styles.ingestionStatusHeader}>
                      <Ionicons name="cloud-done-outline" size={18} color="#8158F8" />
                      <Text style={styles.ingestionStatusTitle}>
                        {ingestionStatusBySkill[selectedSkill.skill.id].outcome}
                      </Text>
                    </View>
                    <View style={styles.ingestionStatsRow}>
                      <Text style={styles.ingestionStatText}>
                        Stored {ingestionStatusBySkill[selectedSkill.skill.id].stats?.stored_count ?? 0}
                      </Text>
                      <Text style={styles.ingestionStatText}>
                        Skipped {ingestionStatusBySkill[selectedSkill.skill.id].stats?.skipped_count ?? 0}
                      </Text>
                    </View>
                    {ingestionStatusBySkill[selectedSkill.skill.id].queue_state && (
                      <Text style={styles.queueStateText}>
                        Queue {String(ingestionStatusBySkill[selectedSkill.skill.id].queue_state?.status || 'active')}
                      </Text>
                    )}
                  </View>
                )}
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header Bar */
  headerBar: {
    display: 'none',
  },
  headerBarTitle: {
    display: 'none',
  },

  /* Content Area */
  content: {
    flex: 1,
  },

  /* Progress Header Section */
  progressHeaderSection: {
    paddingHorizontal: 16,
    paddingVertical: 28,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0,
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
    color: "#9c9a9a",
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  careerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: "#37274d",
    letterSpacing: -0.02,
  },
  progressPercentage: {
    alignItems: 'flex-end',
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: '800',
    color: "#8158F8",
  },
  progressPercentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9c9a9a',
    marginTop: 2,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#f2e2ff",
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: "#8158F8",
    borderRadius: 4,
  },
  /* Timeline Section */
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
    backgroundColor: "#f2e2ff",
  },
  skillsTimeline: {
    paddingLeft: 0,
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

  /* Skill Card */
  skillCard: {
    flex: 1,
    marginLeft: 12,
    marginRight: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderLeftWidth: 0,
    shadowColor: "#37274d",
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
    color: "#37274d",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: "#22c55e",
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  skillDescription: {
    fontSize: 13,
    color: "#6B5B95",
    lineHeight: 19,
    marginBottom: 12,
    fontWeight: '500',
  },

  /* Metadata Row */
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
    backgroundColor: "#f2e2ff",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: "#8158F8",
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
  resourceReason: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '500',
    color: '#6B5B95',
    lineHeight: 16,
  },
  resourceBadgeRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  resourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f2e2ff',
  },
  resourceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B5B95',
  },

  /* Progress Section in Card */
  progressSection: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 0,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: "#8158F8",
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTime: {
    fontSize: 11,
    fontWeight: '700',
    color: "#8158F8",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#f2e2ff",
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  /* Meta Section */
  metaSection: {
    borderTopWidth: 0,
    paddingTop: 14,
    marginTop: 14,
  },
  metaTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9c9a9a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  metaItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaTag: {
    fontSize: 11,
    color: "#8158F8",
    backgroundColor: '#f2e2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 0,
  },
  metaTagLocked: {
    color: '#9c9a9a',
    backgroundColor: '#f8f9fa',
    fontStyle: 'italic',
  },

  /* AI Recommendation Card */
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
    shadowColor: "#37274d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  aiIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#8158F8" + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiContent: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: "#37274d",
    marginBottom: 6,
  },
  aiText: {
    fontSize: 12,
    color: "#6B5B95",
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '500',
  },
  aiButton: {
    paddingHorizontal: 0,
  },
  aiButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: "#8158F8",
  },

  /* Detail Panel */
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

  /* Detail Header Card */
  detailHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 0,
    shadowColor: "#37274d",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  detailHeaderBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#f2e2ff",
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: "#37274d",
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.02,
  },
  detailHeaderSubtitle: {
    fontSize: 13,
    color: "#6B5B95",
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
    backgroundColor: "#f2e2ff",
    borderRadius: 16,
    borderWidth: 0,
  },
  metadataPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: "#8158F8",
  },

  /* Section Content */
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
    color: "#37274d",
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

  /* Course Card */
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: "#37274d",
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
    backgroundColor: "#f2e2ff",
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: "#8158F8",
  },
  courseProvider: {
    fontSize: 11,
    fontWeight: '600',
    color: "#8158F8",
    marginBottom: 4,
  },
  courseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: "#37274d",
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
  refreshSourceButton: {
    marginTop: 4,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#f2e2ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshSourceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8158F8',
  },
  ingestionStatusCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f8f9fa',
    gap: 8,
  },
  ingestionStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingestionStatusTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#37274d',
    textTransform: 'capitalize',
  },
  ingestionStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingestionStatText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B5B95',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  queueStateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },

  /* Prerequisite Card */
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
    color: "#37274d",
  },

  /* Action Buttons */
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
    color: "#8158F8",
  },
  buttonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#8158F8",
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

  /* Empty State */
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
    color: "#37274d",
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
  planForm: {
    width: '100%',
    marginBottom: 18,
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B5B95',
    marginTop: 4,
  },
  textInput: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#37274d',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#f2e2ff',
  },
  skillsInput: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#8158F8",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#8158F8",
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
  loadingText: {
    fontSize: 14,
    color: "#37274d",
    marginTop: 16,
    fontWeight: '600',
  },

  /* Skill Action Buttons */
  startButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#8158F8",
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0,
    marginTop: 12,
    shadowColor: "#8158F8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  completeButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#22c55e",
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0,
    marginTop: 12,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
});
