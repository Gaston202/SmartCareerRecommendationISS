import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import type {
  EvidenceBundle,
  ResourceEvidence,
  RetrievalDiagnostics,
  RetrievedResource,
  SkillGap,
} from './roadmap-rag.types';

@Injectable()
export class RoadmapEvidenceService {
  private readonly logger = new Logger(RoadmapEvidenceService.name);

  constructor(private readonly db: DatabaseService) {}

  buildEvidenceBundles(
    pool: RetrievedResource[],
    targetSkills: SkillGap[],
    role: string,
  ): EvidenceBundle[] {
    return this.buildEvidenceBundlesInternal(pool, targetSkills, role, new Map());
  }

  async loadSkillResourceLinks(
    skillNames: string[],
  ): Promise<Map<string, Map<string, number>>> {
    const normalizedSkillNames = Array.from(
      new Set(
        skillNames
          .map((skillName) => skillName.trim())
          .filter((skillName) => skillName.length > 0),
      ),
    );

    if (normalizedSkillNames.length === 0) {
      return new Map();
    }

    try {
      const { data, error } = await this.db.supabase
        .from('skill_resource_map')
        .select('resource_id,skill_name,relevance_score')
        .in('skill_name', normalizedSkillNames)
        .eq('is_active', true);

      if (error) {
        this.logger.warn(`[Roadmap Evidence] failed to load skill_resource_map links: ${error.message}`);
        return new Map();
      }

      const links = new Map<string, Map<string, number>>();

      for (const row of data ?? []) {
        const skillName =
          typeof row.skill_name === 'string' ? row.skill_name.trim().toLowerCase() : '';
        const resourceId =
          typeof row.resource_id === 'string' ? row.resource_id.trim() : '';
        const relevanceScore =
          typeof row.relevance_score === 'number' ? row.relevance_score : Number(row.relevance_score ?? 0);

        if (!skillName || !resourceId || Number.isNaN(relevanceScore)) {
          continue;
        }

        const current = links.get(skillName) ?? new Map<string, number>();
        current.set(resourceId, Math.max(0, Math.min(1, relevanceScore)));
        links.set(skillName, current);
      }

      return links;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`[Roadmap Evidence] failed to load skill_resource_map links: ${message}`);
      return new Map();
    }
  }

  async buildEvidenceBundlesWithLinks(
    pool: RetrievedResource[],
    targetSkills: SkillGap[],
    role: string,
  ): Promise<EvidenceBundle[]> {
    const links = await this.loadSkillResourceLinks(
      targetSkills.map((skill) => skill.canonicalName),
    );

    return this.buildEvidenceBundlesInternal(pool, targetSkills, role, links);
  }

  private buildEvidenceBundlesInternal(
    pool: RetrievedResource[],
    targetSkills: SkillGap[],
    role: string,
    skillLinks: Map<string, Map<string, number>>,
  ): EvidenceBundle[] {
    this.logger.log(
      `[Roadmap Evidence] building bundles pool=${pool.length} target_skills=${targetSkills.length} role="${role}"`,
    );

    return targetSkills.map((skill) => {
      const scoredResources = pool
        .map((resource) => {
          const matchedBy = this.matchResourceToSkill(resource, skill);
          if (matchedBy.length === 0) {
            return null;
          }

          return this.scoreResource(resource, skill, matchedBy, role, skillLinks);
        })
        .filter((resource): resource is ResourceEvidence => resource !== null)
        .sort((left, right) => right.finalScore - left.finalScore)
        .slice(0, 5);

      const topCoverageCandidates = scoredResources.slice(0, 3);
      const coverageScore =
        topCoverageCandidates.length > 0
          ? Number(
              (
                topCoverageCandidates.reduce((sum, resource) => sum + resource.finalScore, 0) /
                topCoverageCandidates.length
              ).toFixed(4),
            )
          : 0;

      return {
        skillName: skill.skillName,
        resources: scoredResources,
        coverageScore,
        hasWeakEvidence: scoredResources.length === 0 || coverageScore < 0.35,
      };
    });
  }

  selectTopPerSkill(bundles: EvidenceBundle[], n: number = 3): EvidenceBundle[] {
    const limit = Math.max(1, n);

    return bundles.map((bundle) => ({
      ...bundle,
      resources: [...bundle.resources]
        .sort((left, right) => right.finalScore - left.finalScore)
        .slice(0, limit),
    }));
  }

  buildRetrievalDiagnostics(
    pool: RetrievedResource[],
    bundles: EvidenceBundle[],
  ): RetrievalDiagnostics {
    const uniqueResourceIds = new Set(pool.map((resource) => resource.resource_id));
    const coverageBySkill = bundles.reduce<Record<string, number>>((accumulator, bundle) => {
      accumulator[bundle.skillName] = bundle.coverageScore;
      return accumulator;
    }, {});

    return {
      totalCandidates: pool.length,
      poolSize: uniqueResourceIds.size,
      coverageBySkill,
    };
  }

  private matchResourceToSkill(
    resource: RetrievedResource,
    skill: SkillGap,
  ): string[] {
    const matchedBy = new Set<string>();
    const canonicalName = skill.canonicalName.trim().toLowerCase();
    const skillName = skill.skillName.trim().toLowerCase();
    const resourceTitle = resource.resource_title.trim().toLowerCase();
    const matchedTags = (resource.matched_skill_tags ?? []).map((tag) => tag.trim().toLowerCase());

    if (
      matchedTags.some(
        (tag) => tag === canonicalName || tag === skillName || tag.includes(canonicalName) || canonicalName.includes(tag),
      )
    ) {
      matchedBy.add('skill_tag');
      matchedBy.add('skill_link');
    }

    if (
      (skillName.length > 0 && resourceTitle.includes(skillName)) ||
      (canonicalName.length > 0 && resourceTitle.includes(canonicalName))
    ) {
      matchedBy.add('title_match');
    }

    const titleTerms = resourceTitle.split(/[^a-z0-9]+/i).filter((term) => term.length > 1);
    const broadTitleMatch =
      resource.score > 0 &&
      (titleTerms.includes(canonicalName) ||
        titleTerms.includes(skillName) ||
        titleTerms.some((term) => canonicalName.includes(term) || skillName.includes(term)));

    if (broadTitleMatch) {
      matchedBy.add('title_match');
    }

    return Array.from(matchedBy);
  }

  private scoreResource(
    resource: RetrievedResource,
    skill: SkillGap,
    matchedBy: string[],
    role: string,
    skillLinks: Map<string, Map<string, number>>,
  ): ResourceEvidence {
    const keyword = resource.keyword_score ?? 0;
    const semantic = resource.semantic_score ?? 0;
    const metadata = this.computeMetadataScore(resource, skill, role);
    const normalizedSkillName = skill.canonicalName.trim().toLowerCase();
    const dbSkillLinkScore = skillLinks.get(normalizedSkillName)?.get(resource.resource_id);
    const skillLink = typeof dbSkillLinkScore === 'number'
      ? dbSkillLinkScore
      : matchedBy.includes('skill_link')
        ? 1.0
        : matchedBy.includes('skill_tag')
          ? 0.6
          : 0.2;

    if (typeof dbSkillLinkScore === 'number' && !matchedBy.includes('skill_link')) {
      matchedBy.push('skill_link');
    }
    const diversity = 1.0;
    const provider = 0.5;

    const weightedScore =
      keyword * 0.3 +
      semantic * 0.3 +
      metadata * 0.2 +
      skillLink * 0.1 +
      diversity * 0.05 +
      provider * 0.05;

    const finalScore = Number(Math.max(0, Math.min(1, weightedScore)).toFixed(4));
    const whySelected = this.buildWhySelected(skill, matchedBy, keyword, semantic, metadata);

    return {
      resourceId: resource.resource_id,
      title: resource.resource_title,
      matchedBy,
      keywordScore: Number(keyword.toFixed(4)),
      semanticScore: Number(semantic.toFixed(4)),
      skillLinkScore: Number(skillLink.toFixed(4)),
      finalScore,
      whySelected,
    };
  }

  private computeMetadataScore(
    resource: RetrievedResource,
    skill: SkillGap,
    role: string,
  ): number {
    let score = 0;
    const resourceTitle = resource.resource_title.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();
    const resourceLevel = resource.level?.trim().toLowerCase();
    const skillDifficulty = skill.difficulty.trim().toLowerCase();

    if (resourceLevel === skillDifficulty) {
      score += 0.3;
    }

    if (normalizedRole.length > 0 && resourceTitle.includes(normalizedRole)) {
      score += 0.25;
    }

    if ((resource.matched_skill_tags ?? []).length > 0) {
      score += 0.25;
    }

    if (resource.language === 'en') {
      score += 0.2;
    }

    return Number(Math.min(1, score).toFixed(4));
  }

  private buildWhySelected(
    skill: SkillGap,
    matchedBy: string[],
    keyword: number,
    semantic: number,
    metadata: number,
  ): string {
    const reasonCandidates: Array<{ label: string; score: number }> = [
      { label: `Strong semantic match for ${skill.canonicalName}`, score: semantic },
      { label: `Strong keyword match for ${skill.canonicalName}`, score: keyword },
      { label: `Good metadata fit for ${skill.skillName}`, score: metadata },
      { label: `Found via ${matchedBy[0]}`, score: matchedBy.length > 0 ? 0.4 : 0 },
      { label: `Also matched by ${matchedBy[1]}`, score: matchedBy.length > 1 ? 0.3 : 0 },
    ];

    const topReasons = reasonCandidates
      .filter((reason) => reason.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 2)
      .map((reason) => reason.label);

    if (topReasons.length === 0) {
      return `Selected as a relevant candidate for ${skill.skillName}.`;
    }

    return `${topReasons.join('; ')}.`;
  }
}
