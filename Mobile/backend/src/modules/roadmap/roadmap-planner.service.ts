import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CacheService } from '../../core/cache/cache.service';
import { RoadmapSkillGapService } from './roadmap-skill-gap.service';
import { RoadmapEvidenceService } from './roadmap-evidence.service';
import { RoadmapRetrievalService } from './roadmap-retrieval.service';
import { RoadmapWebSearchService } from './roadmap-web-search.service';
import type {
  EvidenceBundle,
  PlanRoadmapDto,
  PlannedRoadmapResponse,
  PlanningContext,
  ResourceEvidence,
  RetrievedResource,
  RoadmapLevel,
  RoadmapStep,
  SkillGap,
} from './roadmap-rag.types';

interface CareerRow {
  id: string;
  title: string;
  required_skills: string[];
  preferred_interests: string[];
  typical_traits: string[];
}

@Injectable()
export class RoadmapPlannerService {
  private readonly logger = new Logger(RoadmapPlannerService.name);
  private readonly cacheVersion = process.env.ROADMAP_PLANNER_CACHE_VERSION?.trim() || 'v3';
  private readonly bypassPlannerCache =
    process.env.BYPASS_PLANNER_CACHE === 'true' || process.env.BYPASS_PLANNER_CACHE === '1';
  private readonly plannerCacheTtlSeconds = 24 * 60 * 60;

  constructor(
    private readonly db: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly skillGapService: RoadmapSkillGapService,
    private readonly evidenceService: RoadmapEvidenceService,
    private readonly retrievalService: RoadmapRetrievalService,
    private readonly webSearchService: RoadmapWebSearchService,
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

    const planningContext = this.buildPlanningContext(input, career);
    const requiredSkills = this.getRequiredSkills(career);

    let gaps = await this.skillGapService.loadRoleSkills(career.id);
    if (gaps.length === 0) {
      const fallback = await this.planWithLegacyHeuristics(career, planningContext, requiredSkills, input);
      await this.cacheService.set(cacheKey, fallback, this.plannerCacheTtlSeconds);
      return fallback;
    }

    gaps = this.applySequenceConstraints(gaps, input.sequence_constraints || []);
    const filteredGaps = this.skillGapService.subtractKnownSkills(gaps, planningContext.userSkills);
    const shortlist = this.skillGapService.buildPrerequisiteShortlist(filteredGaps, planningContext.maxSteps);

    if (shortlist.length === 0) {
      const emptyResponse = this.buildEmptyResponse(career, planningContext, requiredSkills);
      await this.cacheService.set(cacheKey, emptyResponse, this.plannerCacheTtlSeconds);
      return emptyResponse;
    }

    const broad = await this.retrievalService.searchResources({
      query: `${planningContext.targetRole} learning roadmap`,
      top_k: 20,
      filters: input.filters,
    });

    const focused = await Promise.all(
      shortlist.map((skill) =>
        this.retrievalService.searchResources({
          query: `${skill.canonicalName} for ${planningContext.targetRole}`,
          required_skills: [skill.canonicalName],
          top_k: 10,
          filters: input.filters,
        }),
      ),
    );

    let pool = this.dedupeResources([
      ...broad.resources,
      ...focused.flatMap((result) => result.resources),
    ]);

    const finalizedBundles = await this.buildBundlesWithWebFallback(pool, shortlist, planningContext.targetRole);
    pool = this.dedupeResources([
      ...pool,
      ...finalizedBundles.webResources,
    ]);

    const response = this.buildResponseFromBundles(
      career,
      planningContext,
      shortlist,
      finalizedBundles.bundles,
      pool,
      requiredSkills,
    );

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

  private buildPlanningContext(input: PlanRoadmapDto, career: CareerRow): PlanningContext {
    const declaredSkills = Array.isArray(input.user_profile?.declared_skills)
      ? input.user_profile.declared_skills
      : [];
    const cvSkills = Array.isArray(input.user_profile?.cv_extracted_skills)
      ? input.user_profile.cv_extracted_skills
      : [];
    const userSkills = Array.from(new Set([...declaredSkills, ...cvSkills].map((skill) => skill.trim()).filter(Boolean)));
    const preferences = input.user_profile?.preferences || {};
    const maxSteps = input.max_steps ?? 8;
    const targetRole = input.target_role || career.title;

    return {
      careerId: input.career_id || career.id,
      targetRole,
      userSkills,
      preferences,
      maxSteps,
      language: preferences.language || null,
      budget: preferences.budget || null,
    };
  }

  private async buildBundlesWithWebFallback(
    initialPool: RetrievedResource[],
    shortlist: SkillGap[],
    role: string,
  ): Promise<{ bundles: EvidenceBundle[]; webResources: RetrievedResource[] }> {
    const rawBundles = await this.evidenceService.buildEvidenceBundlesWithLinks(initialPool, shortlist, role);
    let bundles = this.evidenceService.selectTopPerSkill(rawBundles, 3);
    const webResources: RetrievedResource[] = [];

    for (let index = 0; index < bundles.length; index += 1) {
      const bundle = bundles[index];
      if (!bundle.hasWeakEvidence) {
        continue;
      }

      const skill = shortlist[index];
      const webResults = await this.webSearchService.searchForSkill(skill, role);
      if (webResults.length === 0) {
        continue;
      }

      webResources.push(...webResults);
      const scopedPool = this.dedupeResources([...initialPool, ...webResults]);
      const rebuilt = this.evidenceService
        .selectTopPerSkill(await this.evidenceService.buildEvidenceBundlesWithLinks(scopedPool, [skill], role), 3)[0];

      const webResourceIds = new Set(webResults.map((resource) => resource.resource_id));
      bundles[index] = {
        ...rebuilt,
        webSearchUsed: true,
        resources: rebuilt.resources.map((resource) =>
          webResourceIds.has(resource.resourceId)
            ? {
                ...resource,
                matchedBy: ['web_search'],
                whySelected: resource.whySelected.includes('web_search')
                  ? resource.whySelected
                  : `${resource.whySelected.replace(/\.$/, '')}; found via web_search.`,
              }
            : resource,
        ),
      };
    }

    return { bundles, webResources };
  }

  private buildResponseFromBundles(
    career: CareerRow,
    planningContext: PlanningContext,
    shortlist: SkillGap[],
    bundles: EvidenceBundle[],
    pool: RetrievedResource[],
    requiredSkills: string[],
  ): PlannedRoadmapResponse {
    const poolById = new Map(pool.map((resource) => [resource.resource_id, resource] as const));

    const steps: RoadmapStep[] = bundles.map((bundle, index) => {
      const skill = shortlist[index];
      const primaryResource = bundle.resources[0] ?? null;
      const backupResources = bundle.resources.slice(1);
      const resourceMeta = primaryResource ? poolById.get(primaryResource.resourceId) ?? null : null;

      return {
        skill_name: bundle.skillName,
        why_it_matters: this.generateWhyItMatters(skill, planningContext.targetRole),
        difficulty: skill.difficulty,
        estimated_duration_hours: skill.estimatedHours,
        prerequisites: skill.prerequisites,
        resource_id: primaryResource?.resourceId ?? null,
        resource_title: primaryResource?.title ?? null,
        resource_type: resourceMeta?.resource_type ?? null,
        free_or_paid: resourceMeta?.free_or_paid ?? null,
        language: resourceMeta?.language ?? null,
        level: resourceMeta?.level ?? null,
        provider: resourceMeta?.provider ?? null,
        source_url: resourceMeta?.source_url ?? null,
        confidence_score: bundle.coverageScore,
        order_index: index,
        primary_resource: primaryResource,
        backup_resources: backupResources,
        evidence_reasons: [primaryResource?.whySelected ?? 'No strong evidence found'],
      };
    });

    const weakCount = bundles.filter((bundle) => bundle.hasWeakEvidence).length;
    const strongCount = bundles.length - weakCount;
    const sourceCount = new Set(steps.map((step) => step.source_url).filter((value): value is string => Boolean(value))).size;
    const confidence = Number(
      (
        bundles.reduce((sum, bundle) => sum + bundle.coverageScore, 0) / Math.max(1, bundles.length)
      ).toFixed(4),
    );

    return {
      success: true,
      mode: 'stored_kb_v1',
      target_role: planningContext.targetRole,
      career_id: career.id,
      confidence,
      weak_evidence: weakCount > steps.length / 2,
      message: weakCount > 0 ? 'insufficient reliable sources for some steps' : undefined,
      steps,
      diagnostics: this.evidenceService.buildRetrievalDiagnostics(pool, bundles),
      metadata: {
        required_skills: requiredSkills,
        existing_skills: planningContext.userSkills,
        missing_skills: shortlist.map((skill) => skill.skillName),
        evidence_summary: {
          strong_steps: strongCount,
          weak_steps: weakCount,
          source_count: sourceCount,
        },
      },
    };
  }

  private async planWithLegacyHeuristics(
    career: CareerRow,
    planningContext: PlanningContext,
    requiredSkills: string[],
    input: PlanRoadmapDto,
  ): Promise<PlannedRoadmapResponse> {
    this.logger.log(
      `[Roadmap RAG] skill gap map missing for career=${career.id}; falling back to heuristic planning`,
    );

    const orderedSkills = this.applySequenceConstraintsToStrings(requiredSkills, input.sequence_constraints || []);
    const existingSkillSet = new Set(planningContext.userSkills.map((skill) => skill.toLowerCase()));
    const missingSkills = orderedSkills.filter((skill) => !existingSkillSet.has(skill.toLowerCase()));
    const targetSkills = missingSkills.slice(0, planningContext.maxSteps);
    const steps: RoadmapStep[] = [];

    for (let index = 0; index < targetSkills.length; index += 1) {
      const skill = targetSkills[index];
      const retrieval = await this.retrievalService.searchResources({
        query: `${skill} for ${planningContext.targetRole}`,
        required_skills: [skill],
        top_k: 5,
        filters: input.filters,
      });

      const best = retrieval.resources[0] || null;
      steps.push({
        skill_name: skill,
        why_it_matters: `${skill} supports essential capabilities needed to progress toward ${planningContext.targetRole}.`,
        difficulty: this.deriveDifficulty(skill),
        estimated_duration_hours: this.estimateDuration(skill),
        prerequisites: targetSkills.slice(0, index).slice(-2),
        resource_id: best?.resource_id || null,
        resource_title: best?.resource_title || null,
        resource_type: best?.resource_type || null,
        free_or_paid: best?.free_or_paid || null,
        language: best?.language || null,
        level: best?.level || null,
        provider: best?.provider || null,
        source_url: best?.source_url || null,
        confidence_score: retrieval.confidence,
        order_index: index,
        primary_resource: best
          ? {
              resourceId: best.resource_id,
              title: best.resource_title,
              matchedBy: ['rag_search'],
              keywordScore: best.keyword_score ?? 0,
              semanticScore: best.semantic_score ?? 0,
              skillLinkScore: 0.2,
              finalScore: retrieval.confidence,
              whySelected: `Selected from hybrid retrieval for ${skill}.`,
            }
          : null,
        backup_resources: [],
        evidence_reasons: [best ? `Selected from hybrid retrieval for ${skill}.` : 'No strong evidence found'],
      });
    }

    const weakCount = steps.filter((step) => step.confidence_score < 0.35 || !step.resource_id).length;
    const strongCount = steps.length - weakCount;
    const sourceCount = new Set(steps.map((step) => step.source_url).filter((value): value is string => Boolean(value))).size;
    const confidence = Number(
      (
        steps.reduce((sum, step) => sum + step.confidence_score, 0) / Math.max(1, steps.length)
      ).toFixed(4),
    );

    return {
      success: true,
      mode: 'stored_kb_v1',
      target_role: planningContext.targetRole,
      career_id: career.id,
      confidence,
      weak_evidence: weakCount > steps.length / 2,
      message: weakCount > 0 ? 'insufficient reliable sources for some steps' : undefined,
      steps,
      diagnostics: {
        totalCandidates: steps.filter((step) => step.resource_id).length,
        poolSize: steps.filter((step) => step.resource_id).length,
        coverageBySkill: Object.fromEntries(steps.map((step) => [step.skill_name, step.confidence_score])),
      },
      metadata: {
        required_skills: requiredSkills,
        existing_skills: planningContext.userSkills,
        missing_skills: missingSkills,
        evidence_summary: {
          strong_steps: strongCount,
          weak_steps: weakCount,
          source_count: sourceCount,
        },
      },
    };
  }

  private buildEmptyResponse(
    career: CareerRow,
    planningContext: PlanningContext,
    requiredSkills: string[],
  ): PlannedRoadmapResponse {
    return {
      success: true,
      mode: 'stored_kb_v1',
      target_role: planningContext.targetRole,
      career_id: career.id,
      confidence: 0,
      weak_evidence: true,
      message: 'insufficient reliable sources',
      steps: [],
      diagnostics: {
        totalCandidates: 0,
        poolSize: 0,
        coverageBySkill: {},
      },
      metadata: {
        required_skills: requiredSkills,
        existing_skills: planningContext.userSkills,
        missing_skills: [],
        evidence_summary: {
          strong_steps: 0,
          weak_steps: 0,
          source_count: 0,
        },
      },
    };
  }

  private getRequiredSkills(career: CareerRow): string[] {
    const primary = Array.isArray(career.required_skills) ? career.required_skills : [];
    const interests = Array.isArray(career.preferred_interests) ? career.preferred_interests : [];
    const traits = Array.isArray(career.typical_traits) ? career.typical_traits : [];

    return [...new Set([...primary, ...interests, ...traits])].filter(Boolean);
  }

  private dedupeResources(resources: RetrievedResource[]): RetrievedResource[] {
    const byId = new Map<string, RetrievedResource>();

    for (const resource of resources) {
      const existing = byId.get(resource.resource_id);
      if (!existing || resource.score > existing.score) {
        byId.set(resource.resource_id, resource);
      }
    }

    return Array.from(byId.values());
  }

  private generateWhyItMatters(skill: SkillGap, role: string): string {
    if (skill.difficulty === 'advanced') {
      return `${skill.skillName} helps you handle higher-complexity responsibilities expected in ${role}.`;
    }

    if (skill.difficulty === 'intermediate') {
      return `${skill.skillName} is an important practical skill for progressing toward ${role}.`;
    }

    return `${skill.skillName} gives you a strong foundation for starting toward ${role}.`;
  }

  private applySequenceConstraints(gaps: SkillGap[], constraints: Array<{ before: string; after: string }>): SkillGap[] {
    const ordered = [...gaps];

    for (const constraint of constraints) {
      const beforeCanonical = this.skillGapService.normalizeSkillName(constraint.before);
      const afterCanonical = this.skillGapService.normalizeSkillName(constraint.after);
      const beforeIndex = ordered.findIndex((gap) => gap.canonicalName === beforeCanonical);
      const afterIndex = ordered.findIndex((gap) => gap.canonicalName === afterCanonical);

      if (beforeIndex > -1 && afterIndex > -1 && beforeIndex > afterIndex) {
        const [item] = ordered.splice(beforeIndex, 1);
        ordered.splice(afterIndex, 0, item);
      }
    }

    return ordered;
  }

  private applySequenceConstraintsToStrings(skills: string[], constraints: Array<{ before: string; after: string }>): string[] {
    const ordered = [...new Set(skills)];

    for (const constraint of constraints) {
      const beforeIndex = ordered.findIndex((skill) => skill.toLowerCase() === constraint.before.toLowerCase());
      const afterIndex = ordered.findIndex((skill) => skill.toLowerCase() === constraint.after.toLowerCase());

      if (beforeIndex > -1 && afterIndex > -1 && beforeIndex > afterIndex) {
        const [item] = ordered.splice(beforeIndex, 1);
        ordered.splice(afterIndex, 0, item);
      }
    }

    return ordered;
  }

  private deriveDifficulty(skill: string): RoadmapLevel {
    const normalized = skill.toLowerCase();
    if (normalized.includes('architecture') || normalized.includes('distributed') || normalized.includes('optimization')) {
      return 'advanced';
    }
    if (normalized.includes('api') || normalized.includes('database') || normalized.includes('framework') || normalized.includes('testing')) {
      return 'intermediate';
    }
    return 'beginner';
  }

  private estimateDuration(skill: string): number {
    const difficulty = this.deriveDifficulty(skill);
    if (difficulty === 'advanced') return 50;
    if (difficulty === 'intermediate') return 30;
    return 18;
  }
}
