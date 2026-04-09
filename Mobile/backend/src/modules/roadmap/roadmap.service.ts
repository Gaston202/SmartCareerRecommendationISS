import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AiOrchestratorService } from '../../core/ai-orchestrator/ai-orchestrator.service';
import { QueueService, ROADMAP_GENERATION_QUEUE } from '../../core/queue/queue.service';
import { CacheService } from '../../core/cache/cache.service';

export interface Roadmap {
  id: string;
  user_id: string;
  career_id: string;
  title: string;
  description: string;
  milestones: RoadmapMilestone[];
  total_duration_weeks: number;
  created_at: string;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  duration_weeks: number;
  tasks: RoadmapTask[];
  resources: RoadmapResource[];
}

export interface RoadmapTask {
  id: string;
  title: string;
  description?: string;
  estimated_hours: number;
  dependencies?: string[];
}

export interface RoadmapResource {
  id: string;
  type: 'course' | 'book' | 'article' | 'tool' | 'certification';
  title: string;
  url?: string;
  description?: string;
}

@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    private db: DatabaseService,
    private aiOrchestrator: AiOrchestratorService,
    private queueService: QueueService,
    private cacheService: CacheService,
  ) {}

  async getOrGenerateRoadmap(
    userId: string,
    careerId: string,
    userProfile?: {
      skills?: string[];
      novaProfile?: any;
      cvSummary?: string;
    },
  ): Promise<Roadmap> {
    const cacheKey = `roadmap:${userId}:${careerId}`;
    const cached = await this.cacheService.get<Roadmap>(cacheKey);
    if (cached) return cached;

    try {
      // Check if we have a base roadmap template for this career
      const { data: baseRoadmap, error: baseError } = await this.db.supabase
        .from('career_roadmaps')
        .select('*')
        .eq('career_id', careerId)
        .single();

      if (baseError || !baseRoadmap) {
        throw new NotFoundException(`No roadmap template found for career ${careerId}`);
      }

      let personalizedMilestones: RoadmapMilestone[] = baseRoadmap.milestones;

      // If user profile provided, personalize
      if (userProfile) {
        const personalized = await this.aiOrchestrator.personalizeRoadmap(
          baseRoadmap,
          userProfile.skills || [],
          userProfile.novaProfile || {},
          userProfile.cvSummary || '',
        );
        personalizedMilestones = personalized.personalizedMilestones || baseRoadmap.milestones;
      }

      const roadmap: Roadmap = {
        id: baseRoadmap.id,
        user_id: userId,
        career_id: careerId,
        title: baseRoadmap.title,
        description: baseRoadmap.description,
        milestones: personalizedMilestones,
        total_duration_weeks: personalizedMilestones.reduce((sum, m) => sum + m.duration_weeks, 0),
        created_at: new Date().toISOString(),
      };

      // Cache for 12 hours
      await this.cacheService.set(cacheKey, roadmap, 43200);

      return roadmap;
    } catch (error) {
      this.logger.error('Failed to get/generate roadmap', error);
      throw error;
    }
  }

  async generateRoadmapAsync(
    userId: string,
    careerId: string,
    userProfile?: any,
  ): Promise<{ jobId: string; message: string }> {
    // Queue async generation
    const job = await this.queueService.addJob(ROADMAP_GENERATION_QUEUE, 'generate-roadmap', {
      userId,
      careerId,
      userProfile,
    });

    return {
      jobId: job.id,
      message: 'Roadmap generation queued. Check job status.',
    };
  }

  async getRoadmapJobStatus(jobId: string): Promise<any> {
    return this.queueService.getJobStatus(jobId);
  }
}
