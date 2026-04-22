import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CacheService } from '../../core/cache/cache.service';
import { RoadmapRetrievalService } from './roadmap-retrieval.service';
import type {
  PlanRoadmapDto,
  PlannedRoadmapResponse,
  RoadmapLevel,
  RoadmapStep,
} from './roadmap-rag.types';

interface CareerRow {
  id: string;
  title: string;
  required_skills: string[];
  preferred_interests: string[];
  typical_traits: string[];
}

interface RoleSkillRow {
  skill_name: string;
  difficulty: RoadmapLevel | null;
  estimated_duration_hours: number | null;
  prerequisites: string[];
  priority: number;
}

@Injectable()
export class RoadmapPlannerService {
  private readonly logger = new Logger(RoadmapPlannerService.name);
  private readonly cacheVersion = process.env.ROADMAP_PLANNER_CACHE_VERSION?.trim() || 'v2';
  private readonly bypassPlannerCache =
    process.env.BYPASS_PLANNER_CACHE === 'true' || process.env.BYPASS_PLANNER_CACHE === '1';
  private readonly plannerCacheTtlSeconds = 24 * 60 * 60;

  constructor(
    private readonly db: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly retrievalService: RoadmapRetrievalService,
  ) {}

  async planRoadmap(userId: string, input: PlanRoadmapDto): Promise<PlannedRoadmapResponse> {
    this.logger.log(
      `[Roadmap RAG] planning started user=${userId} career_id=${input.career_id || 'n/a'} target_role=${input.target_role || 'n/a'} max_steps=${input.max_steps || 8}`,
    );

    const cacheKey = `roadmap:plan:${this.cacheVersion}:${userId}:${Buffer.from(JSON.stringify(input)).toString('base64')}`;
    if (this.bypassPlannerCache) {
      this.logger.log('[Roadmap RAG] planner cache bypassed via BYPASS_PLANNER_CACHE');
    } else {
      const cached = await this.cacheService.get<PlannedRoadmapResponse>(cacheKey);
      if (cached) {
        this.logger.log('[Roadmap RAG] planner cache hit');
        return cached;
      }
    }

    const career = await this.resolveCareer(input);
    if (!career) {
      throw new BadRequestException('Could not resolve target role/career. Provide career_id or target_role.');
    }

    this.logger.log(
      `[Roadmap RAG] resolved career id=${career.id} title="${career.title}" required_skills=${career.required_skills?.length || 0}`,
    );

    const userSignals = await this.loadUserSignals(userId, input);
    const requiredSkills = this.getRequiredSkills(career);
    const orderedSkills = await this.orderSkills(career, requiredSkills, input.sequence_constraints || []);

    const existingSkillSet = new Set(userSignals.existingSkills.map((s) => s.toLowerCase()));
    const missingSkills = orderedSkills.filter((s) => !existingSkillSet.has(s.toLowerCase()));

    const maxSteps = Math.min(Math.max(input.max_steps || 8, 3), 20);
    const targetSkills = missingSkills.slice(0, maxSteps);

    this.logger.log(
      `[Roadmap RAG] user_signals existing_skills=${userSignals.existingSkills.length} required_skills=${requiredSkills.length} missing_skills=${missingSkills.length} target_steps=${targetSkills.length}`,
    );

    const steps: RoadmapStep[] = [];

    for (let i = 0; i < targetSkills.length; i += 1) {
      const skill = targetSkills[i];
      this.logger.log(`[Roadmap RAG] retrieving evidence for step=${i + 1} skill="${skill}"`);
      let retrieval = await this.retrievalService.searchResources({
        query: `${skill} for ${career.title}`,
        required_skills: [skill],
        top_k: 5,
        filters: {
          ...(input.filters || {}),
          target_role: input.target_role || career.title,
        },
      });

      if (retrieval.resources.length === 0) {
        this.logger.log(
          `[Roadmap RAG] retrying retrieval without target_role filter for step=${i + 1} skill="${skill}"`,
        );
        retrieval = await this.retrievalService.searchResources({
          query: `${skill} for ${career.title}`,
          required_skills: [skill],
          top_k: 5,
          filters: {
            ...(input.filters || {}),
            skill_tags: [skill],
          },
        });
      }

      if (retrieval.resources.length === 0) {
        this.logger.log(
          `[Roadmap RAG] retrying retrieval with broad skill query for step=${i + 1} skill="${skill}"`,
        );
        retrieval = await this.retrievalService.searchResources({
          query: skill,
          required_skills: [skill],
          top_k: 5,
          filters: {
            ...(input.filters || {}),
            skill_tags: [skill],
          },
        });
      }

      const best = retrieval.resources[0] || null;
      const weak = retrieval.weakEvidence || !best;

      this.logger.log(
        `[Roadmap RAG] retrieval result step=${i + 1} skill="${skill}" resources=${retrieval.resources.length} confidence=${retrieval.confidence} weak=${weak} top_provider=${best?.provider || 'n/a'} top_title="${best?.resource_title || 'n/a'}"`,
      );

      steps.push({
        skill_name: skill,
        why_it_matters: this.whySkillMatters(skill, career.title, career.required_skills),
        difficulty: this.deriveDifficulty(skill),
        estimated_duration_hours: this.estimateDuration(skill),
        prerequisites: orderedSkills.slice(0, i).filter((prev) => prev !== skill).slice(-2),
        resource_id: best?.resource_id || null,
        resource_title: weak ? null : best?.resource_title || null,
        resource_type: weak ? null : best?.resource_type || null,
        free_or_paid: weak ? null : best?.free_or_paid || null,
        language: weak ? null : best?.language || null,
        level: weak ? null : (best?.level as any),
        provider: weak ? null : best?.provider || null,
        source_url: weak ? null : best?.source_url || null,
        confidence_score: Number((weak ? retrieval.confidence * 0.6 : retrieval.confidence).toFixed(4)),
        order_index: i + 1,
      });
    }

    const weakCount = steps.filter((s) => s.confidence_score < 0.45 || !s.source_url).length;
    const strongCount = steps.length - weakCount;
    const sourceCount = new Set(steps.map((s) => s.source_url).filter(Boolean)).size;

    const confidence = Number(
      (
        (steps.reduce((acc, s) => acc + s.confidence_score, 0) / Math.max(1, steps.length)) * 0.7 +
        (sourceCount / Math.max(1, steps.length)) * 0.3
      ).toFixed(4),
    );

    const weakEvidence = confidence < 0.5 || weakCount > Math.ceil(steps.length * 0.5);

    const response: PlannedRoadmapResponse = {
      success: true,
      mode: 'stored_kb_v1',
      target_role: input.target_role || career.title,
      career_id: career.id,
      confidence,
      weak_evidence: weakEvidence,
      message: weakEvidence ? 'insufficient reliable sources' : undefined,
      steps,
      metadata: {
        required_skills: requiredSkills,
        existing_skills: userSignals.existingSkills,
        missing_skills: missingSkills,
        evidence_summary: {
          strong_steps: strongCount,
          weak_steps: weakCount,
          source_count: sourceCount,
        },
      },
    };

    await this.cacheService.set(cacheKey, response, this.plannerCacheTtlSeconds);
    this.logger.log(
      `[Roadmap RAG] planning completed target_role="${response.target_role}" confidence=${response.confidence} weak_evidence=${response.weak_evidence} steps=${response.steps.length}`,
    );
    return response;
  }

  private async resolveCareer(input: PlanRoadmapDto): Promise<CareerRow | null> {
    if (input.career_id) {
      const { data } = await this.db.supabase
        .from('careers')
        .select('id,title,required_skills,preferred_interests,typical_traits')
        .eq('id', input.career_id)
        .maybeSingle();
      if (data) return data as CareerRow;
    }

    const target = input.target_role || input.user_profile?.selected_role || input.query;
    if (!target) return null;

    const { data } = await this.db.supabase
      .from('careers')
      .select('id,title,required_skills,preferred_interests,typical_traits')
      .ilike('title', `%${target}%`)
      .limit(1)
      .maybeSingle();

    return (data as CareerRow) || null;
  }

  private async loadUserSignals(userId: string, input: PlanRoadmapDto): Promise<{ existingSkills: string[] }> {
    const [userRow, cvRow] = await Promise.all([
      this.db.supabase
        .from('users')
        .select('skills')
        .eq('id', userId)
        .maybeSingle(),
      this.db.supabase
        .from('cv_analysis')
        .select('extracted_skills, extracted_interests')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const declaredFromProfile = Array.isArray(input.user_profile?.declared_skills)
      ? input.user_profile?.declared_skills
      : [];
    const declaredFromDb = typeof userRow.data?.skills === 'string'
      ? userRow.data.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const cvSkills = Array.isArray(cvRow.data?.extracted_skills)
      ? cvRow.data.extracted_skills
      : [];
    const cvInterests = Array.isArray(cvRow.data?.extracted_interests)
      ? cvRow.data.extracted_interests
      : [];

    const existingSkills = [...new Set([...declaredFromProfile, ...declaredFromDb, ...cvSkills, ...cvInterests])];

    return { existingSkills };
  }

  private getRequiredSkills(career: CareerRow): string[] {
    const primary = Array.isArray(career.required_skills) ? career.required_skills : [];
    const interests = Array.isArray(career.preferred_interests) ? career.preferred_interests : [];
    const traits = Array.isArray(career.typical_traits) ? career.typical_traits : [];

    return [...new Set([...primary, ...interests, ...traits])].filter(Boolean);
  }

  private async orderSkills(
    career: CareerRow,
    fallbackSkills: string[],
    constraints: Array<{ before: string; after: string }>,
  ): Promise<string[]> {
    const { data } = await this.db.supabase
      .from('role_skill_map')
      .select('skill_name,difficulty,estimated_duration_hours,prerequisites,priority')
      .eq('career_id', career.id)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    const mapped = (data || []) as RoleSkillRow[];
    const seeds = mapped.length > 0
      ? mapped.map((row) => row.skill_name)
      : fallbackSkills;

    // Apply explicit sequence constraints using a simple swap pass.
    const ordered = [...new Set(seeds)];
    constraints.forEach((c) => {
      const beforeIdx = ordered.findIndex((s) => s.toLowerCase() === c.before.toLowerCase());
      const afterIdx = ordered.findIndex((s) => s.toLowerCase() === c.after.toLowerCase());
      if (beforeIdx > -1 && afterIdx > -1 && beforeIdx > afterIdx) {
        const [item] = ordered.splice(beforeIdx, 1);
        ordered.splice(afterIdx, 0, item);
      }
    });

    return ordered;
  }

  private deriveDifficulty(skill: string): RoadmapLevel {
    const s = skill.toLowerCase();
    if (s.includes('architecture') || s.includes('distributed') || s.includes('optimization')) {
      return 'advanced';
    }
    if (s.includes('api') || s.includes('database') || s.includes('framework') || s.includes('testing')) {
      return 'intermediate';
    }
    return 'beginner';
  }

  private estimateDuration(skill: string): number {
    const d = this.deriveDifficulty(skill);
    if (d === 'advanced') return 50;
    if (d === 'intermediate') return 30;
    return 18;
  }

  private whySkillMatters(skill: string, roleTitle: string, requiredSkills: string[]): string {
    const direct = requiredSkills.some((req) => req.toLowerCase() === skill.toLowerCase());
    if (direct) {
      return `${skill} is a core requirement for ${roleTitle} and directly impacts job readiness.`;
    }
    return `${skill} supports essential capabilities needed to progress toward ${roleTitle}.`;
  }
}
