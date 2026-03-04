import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedRoadmap } from './types';

const ROADMAPS_KEY = 'career_roadmaps_v1';

export async function getSavedRoadmaps(): Promise<SavedRoadmap[]> {
  try {
    const stored = await AsyncStorage.getItem(ROADMAPS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedRoadmap[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn('[roadmaps] Failed to load saved roadmaps', error);
    return [];
  }
}

export async function saveRoadmap(roadmap: SavedRoadmap): Promise<void> {
  try {
    const existing = await getSavedRoadmaps();
    const withoutSameId = existing.filter((r) => r.id !== roadmap.id);
    const next = [...withoutSameId, roadmap];
    await AsyncStorage.setItem(ROADMAPS_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[roadmaps] Failed to save roadmap', error);
  }
}

export async function getRoadmapById(id: string): Promise<SavedRoadmap | null> {
  const all = await getSavedRoadmaps();
  return all.find((r) => r.id === id) ?? null;
}

export async function findRoadmapByCareerTitle(
  careerTitle: string,
): Promise<SavedRoadmap | null> {
  const all = await getSavedRoadmaps();
  return (
    all.find(
      (r) => r.careerTitle.toLocaleLowerCase() === careerTitle.toLocaleLowerCase(),
    ) ?? null
  );
}

