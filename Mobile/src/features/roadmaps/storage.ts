import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedRoadmap } from './types';

const getRoadmapsKey = (userId: string) => `career_roadmaps_v1_${userId}`;

export async function getSavedRoadmaps(userId: string): Promise<SavedRoadmap[]> {
  try {
    const stored = await AsyncStorage.getItem(getRoadmapsKey(userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedRoadmap[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn('[roadmaps] Failed to load saved roadmaps', error);
    return [];
  }
}

export async function saveRoadmap(userId: string, roadmap: SavedRoadmap): Promise<void> {
  try {
    const existing = await getSavedRoadmaps(userId);
    const withoutSameId = existing.filter((r) => r.id !== roadmap.id);
    const next = [...withoutSameId, roadmap];
    await AsyncStorage.setItem(getRoadmapsKey(userId), JSON.stringify(next));
  } catch (error) {
    console.warn('[roadmaps] Failed to save roadmap', error);
  }
}

export async function getRoadmapById(userId: string, id: string): Promise<SavedRoadmap | null> {
  const all = await getSavedRoadmaps(userId);
  return all.find((r) => r.id === id) ?? null;
}

export async function findRoadmapByCareerTitle(
  userId: string,
  careerTitle: string,
): Promise<SavedRoadmap | null> {
  const all = await getSavedRoadmaps(userId);
  return (
    all.find(
      (r) => r.careerTitle.toLocaleLowerCase() === careerTitle.toLocaleLowerCase(),
    ) ?? null
  );
}

