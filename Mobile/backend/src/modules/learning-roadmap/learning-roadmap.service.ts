import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AiOrchestratorService } from '../../core/ai-orchestrator/ai-orchestrator.service';
import { CacheService } from '../../core/cache/cache.service';

export interface LearningSkill {
  id: string;
  name: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration_hours: number;
  category: string;
  importance: 'critical' | 'important' | 'nice-to-have';
  prerequisites: string[]; // Computed from dependencies
}

export interface LearningCourse {
  id: string;
  skill_id: string;
  title: string;
  description?: string;
  provider: string;
  url: string;
  duration_hours?: number;
  level: string;
  rating?: number;
  free: boolean;
  course_type: string;
}

export interface LearningRoadmapResponse {
  id: string;
  user_id: string;
  career_id: string;
  career_title: string;
  title: string;
  description: string;
  skills: Array<{
    skill: LearningSkill;
    courses: LearningCourse[];
    dependencies: LearningSkill[];
  }>;
  total_duration_hours: number;
  estimated_weeks: number;
  skill_count: number;
  created_at: string;
}

@Injectable()
export class LearningRoadmapService {
  private readonly logger = new Logger(LearningRoadmapService.name);

  constructor(
    private db: DatabaseService,
    private aiOrchestrator: AiOrchestratorService,
    private cacheService: CacheService,
  ) {}

  async generateLearningRoadmap(
    userId: string,
    careerId: string,
    careerTitle: string,
    careerDescription: string,
    userProfile?: {
      skills?: string[];
      novaProfile?: any;
      cvSummary?: string;
    },
  ): Promise<LearningRoadmapResponse> {
    const cacheKey = `learning-roadmap:${userId}:${careerId}`;
    const cached = await this.cacheService.get<LearningRoadmapResponse>(cacheKey);
    if (cached) return cached;

    try {
      // For now, we'll return a structured response
      // In production, this would call the AI orchestrator to generate skills
      const roadmapData = this.generateFallbackRoadmap(
        careerId,
        careerTitle,
        careerDescription,
        userProfile,
      );

      // Cache for 24 hours
      await this.cacheService.set(cacheKey, roadmapData, 86400);

      return roadmapData;
    } catch (error) {
      this.logger.error('Failed to generate learning roadmap', error);
      throw error;
    }
  }

  private generateFallbackRoadmap(
    careerId: string,
    careerTitle: string,
    careerDescription: string,
    userProfile?: any,
  ): LearningRoadmapResponse {
    // This is a fallback structure that matches the frontend expectations
    return {
      id: `learning-roadmap-${careerId}-${Date.now()}`,
      user_id: '',
      career_id: careerId,
      career_title: careerTitle,
      title: `Learning Path: ${careerTitle}`,
      description: `A comprehensive skill-based learning roadmap to become a ${careerTitle}`,
      skills: [],
      total_duration_hours: 0,
      estimated_weeks: 0,
      skill_count: 0,
      created_at: new Date().toISOString(),
    };
  }

  async getSkillsForCareer(careerId: string): Promise<LearningSkill[]> {
    const cacheKey = `career-skills:${careerId}`;
    const cached = await this.cacheService.get<LearningSkill[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data: skills, error } = await this.db.supabase
        .from('learning_skills')
        .select('*')
        .eq('career_id', careerId)
        .order('level');

      if (error) {
        this.logger.error(`Failed to fetch skills for career ${careerId}`, error);
        return [];
      }

      const enrichedSkills = await Promise.all(
        (skills || []).map(async (skill) => {
          const prerequisites = await this.getSkillPrerequisites(skill.id);
          return {
            ...skill,
            prerequisites: prerequisites.map((p) => p.from_skill_id),
          };
        }),
      );

      await this.cacheService.set(cacheKey, enrichedSkills, 86400);

      return enrichedSkills;
    } catch (error) {
      this.logger.error('Failed to get skills for career', error);
      throw error;
    }
  }

  async getSkillPrerequisites(
    skillId: string,
  ): Promise<Array<{ from_skill_id: string; to_skill_id: string; dependency_type: string }>> {
    try {
      const { data, error } = await this.db.supabase
        .from('skill_dependencies')
        .select('*')
        .eq('to_skill_id', skillId);

      if (error) {
        this.logger.error(`Failed to fetch prerequisites for skill ${skillId}`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get skill prerequisites', error);
      return [];
    }
  }

  async getCoursesForSkill(skillId: string): Promise<LearningCourse[]> {
    const cacheKey = `skill-courses:${skillId}`;
    const cached = await this.cacheService.get<LearningCourse[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data: courses, error } = await this.db.supabase
        .from('learning_courses')
        .select('*')
        .eq('skill_id', skillId)
        .order('rating', { ascending: false });

      if (error) {
        this.logger.error(`Failed to fetch courses for skill ${skillId}`, error);
        return [];
      }

      const result = courses || [];
      await this.cacheService.set(cacheKey, result, 86400);

      return result;
    } catch (error) {
      this.logger.error('Failed to get courses for skill', error);
      throw error;
    }
  }

  async saveLearningRoadmap(
    userId: string,
    careerId: string,
    careerTitle: string,
    roadmapData: any,
  ): Promise<any> {
    try {
      const { data, error } = await this.db.supabase
        .from('user_learning_roadmaps')
        .insert([
          {
            user_id: userId,
            career_id: careerId,
            career_title: careerTitle,
            title: `Learning Path: ${careerTitle}`,
            description: `A comprehensive skill-based learning roadmap to become a ${careerTitle}`,
            skills: roadmapData.skills || [],
            total_duration_hours: roadmapData.total_duration_hours,
            estimated_weeks: roadmapData.estimated_weeks,
            skill_count: roadmapData.skill_count,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to save learning roadmap', error);
      throw error;
    }
  }

  async getUserLearningRoadmaps(userId: string): Promise<LearningRoadmapResponse[]> {
    try {
      const { data, error } = await this.db.supabase
        .from('user_learning_roadmaps')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(`Failed to fetch roadmaps for user ${userId}`, error);
        return [];
      }

      return (data || []).map((rm) => ({
        id: rm.id,
        user_id: rm.user_id,
        career_id: rm.career_id,
        career_title: rm.career_title,
        title: rm.title,
        description: rm.description,
        skills: rm.skills || [],
        total_duration_hours: rm.total_duration_hours,
        estimated_weeks: rm.estimated_weeks,
        skill_count: rm.skill_count,
        created_at: rm.created_at,
      }));
    } catch (error) {
      this.logger.error('Failed to get user learning roadmaps', error);
      throw error;
    }
  }
}
