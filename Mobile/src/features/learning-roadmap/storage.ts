import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LearningRoadmap, SavedLearningRoadmap } from './types';

const getLearningRoadmapsKey = (userId: string) =>
  `learning_roadmaps_v1_${userId}`;

export async function getSavedLearningRoadmaps(
  userId: string,
): Promise<SavedLearningRoadmap[]> {
  try {
    const stored = await AsyncStorage.getItem(getLearningRoadmapsKey(userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedLearningRoadmap[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn('[learning-roadmap] Failed to load saved learning roadmaps', error);
    return [];
  }
}

export async function saveLearningRoadmap(
  userId: string,
  roadmap: LearningRoadmap,
): Promise<void> {
  try {
    const existing = await getSavedLearningRoadmaps(userId);
    const withoutSameId = existing.filter((r) => r.id !== roadmap.id);
    const savedRoadmap: SavedLearningRoadmap = {
      id: roadmap.id,
      user_id: userId,
      career_id: roadmap.career_id,
      careerTitle: roadmap.career_title,
      createdAt: roadmap.created_at,
      roadmap,
    };
    const next = [...withoutSameId, savedRoadmap];
    await AsyncStorage.setItem(getLearningRoadmapsKey(userId), JSON.stringify(next));
  } catch (error) {
    console.warn('[learning-roadmap] Failed to save learning roadmap', error);
  }
}

export async function getLearningRoadmapById(
  userId: string,
  id: string,
): Promise<SavedLearningRoadmap | null> {
  const all = await getSavedLearningRoadmaps(userId);
  return all.find((r) => r.id === id) ?? null;
}

export async function getLearningRoadmapByCareerTitle(
  userId: string,
  careerTitle: string,
): Promise<SavedLearningRoadmap | null> {
  const all = await getSavedLearningRoadmaps(userId);
  return (
    all.find(
      (r) => r.careerTitle.toLowerCase() === careerTitle.toLowerCase(),
    ) ?? null
  );
}

export async function deleteLearningRoadmap(userId: string, id: string): Promise<void> {
  try {
    const existing = await getSavedLearningRoadmaps(userId);
    const next = existing.filter((r) => r.id !== id);
    await AsyncStorage.setItem(getLearningRoadmapsKey(userId), JSON.stringify(next));
  } catch (error) {
    console.warn('[learning-roadmap] Failed to delete learning roadmap', error);
  }
}
