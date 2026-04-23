import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import type { RoadmapLevel, SkillGap } from './roadmap-rag.types';

interface RoleSkillMapRow {
  skill_name: string;
  difficulty: RoadmapLevel | null;
  estimated_duration_hours: number | null;
  prerequisites: string[] | null;
  priority: number | null;
}

@Injectable()
export class RoadmapSkillGapService {
  private readonly logger = new Logger(RoadmapSkillGapService.name);

  constructor(private readonly db: DatabaseService) {}

  async loadRoleSkills(roleId: string): Promise<SkillGap[]> {
    const { data, error } = await this.db.supabase
      .from('role_skill_map')
      .select('skill_name,difficulty,estimated_duration_hours,prerequisites,priority')
      .eq('career_id', roleId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      this.logger.warn(`Failed to load role_skill_map for roleId=${roleId}: ${error.message}`);
      return [];
    }

    const rows = (data ?? []) as RoleSkillMapRow[];
    const merged = new Map<string, SkillGap>();

    for (const row of rows) {
      const rawSkillName = row.skill_name?.trim();
      if (!rawSkillName) continue;

      const canonicalName = this.normalizeSkillName(rawSkillName);
      const prerequisites = Array.isArray(row.prerequisites)
        ? row.prerequisites
            .map((value) => this.normalizeSkillName(value))
            .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
        : [];

      const candidate: SkillGap = {
        skillName: rawSkillName,
        canonicalName,
        difficulty: row.difficulty ?? this.deriveDifficulty(rawSkillName),
        estimatedHours: row.estimated_duration_hours ?? this.defaultEstimatedHours(row.difficulty),
        prerequisites,
        priority: row.priority ?? 0,
      };

      const existing = merged.get(canonicalName);
      if (!existing) {
        merged.set(canonicalName, candidate);
        continue;
      }

      merged.set(canonicalName, {
        skillName: existing.priority >= candidate.priority ? existing.skillName : candidate.skillName,
        canonicalName,
        difficulty: this.pickHigherDifficulty(existing.difficulty, candidate.difficulty),
        estimatedHours: Math.max(existing.estimatedHours, candidate.estimatedHours),
        prerequisites: Array.from(new Set([...existing.prerequisites, ...candidate.prerequisites])),
        priority: Math.max(existing.priority, candidate.priority),
      });
    }

    return Array.from(merged.values()).sort((a, b) => b.priority - a.priority);
  }

  subtractKnownSkills(gaps: SkillGap[], userSkills: string[]): SkillGap[] {
    const normalizedKnown = new Set(
      userSkills
        .map((skill) => this.normalizeSkillName(skill))
        .filter((skill) => skill.length > 0),
    );

    return gaps.filter((gap) => !normalizedKnown.has(gap.canonicalName));
  }

  buildPrerequisiteShortlist(gaps: SkillGap[], maxSteps: number): SkillGap[] {
    const cappedMaxSteps = Math.max(1, maxSteps);
    const byCanonicalName = new Map<string, SkillGap>();
    gaps.forEach((gap) => byCanonicalName.set(gap.canonicalName, gap));

    const ordered: SkillGap[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (gap: SkillGap): void => {
      if (visited.has(gap.canonicalName) || ordered.length >= cappedMaxSteps) {
        return;
      }

      if (visiting.has(gap.canonicalName)) {
        return;
      }

      visiting.add(gap.canonicalName);

      for (const prerequisite of gap.prerequisites) {
        const prerequisiteGap = byCanonicalName.get(this.normalizeSkillName(prerequisite));
        if (prerequisiteGap) {
          visit(prerequisiteGap);
        }
      }

      visiting.delete(gap.canonicalName);
      visited.add(gap.canonicalName);

      if (ordered.length < cappedMaxSteps) {
        ordered.push(gap);
      }
    };

    const sortedByPriority = [...gaps].sort((a, b) => b.priority - a.priority);
    for (const gap of sortedByPriority) {
      visit(gap);
      if (ordered.length >= cappedMaxSteps) {
        break;
      }
    }

    return ordered;
  }

  normalizeSkillName(raw: string): string {
    const cleaned = raw.trim().toLowerCase();
    if (!cleaned) return '';

    const aliases: Record<string, string> = {
      postgresql: 'SQL',
      postgres: 'SQL',
      mysql: 'SQL',
      sqlite: 'SQL',
      tsql: 'SQL',
      'microsoft excel': 'Excel',
      spreadsheets: 'Excel',
      'google sheets': 'Excel',
      pandas: 'Python',
      numpy: 'Python',
      py: 'Python',
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      node: 'Node.js',
      'nodejs': 'Node.js',
      'node.js': 'Node.js',
      kubernetes: 'Kubernetes',
      docker: 'Docker',
      tableau: 'Tableau',
      powerbi: 'Power BI',
      'power bi': 'Power BI',
      figma: 'Figma',
      'user research': 'UX Research',
      wireframing: 'Wireframing',
      prototyping: 'Prototyping',
      cicd: 'CI/CD',
      'ci/cd': 'CI/CD',
      devops: 'DevOps',
      aws: 'AWS',
      azure: 'Azure',
      gcp: 'GCP',
    };

    if (aliases[cleaned]) {
      return aliases[cleaned];
    }

    if (cleaned.includes('sql')) return 'SQL';
    if (cleaned.includes('excel') || cleaned.includes('sheet')) return 'Excel';
    if (cleaned.includes('python') || cleaned.includes('pandas')) return 'Python';
    if (cleaned.includes('tableau')) return 'Tableau';
    if (cleaned.includes('power bi')) return 'Power BI';
    if (cleaned.includes('statistics') || cleaned.includes('statistical')) return 'Statistics';
    if (cleaned.includes('visualization')) return 'Data Visualization';
    if (cleaned.includes('product sense')) return 'Product Sense';
    if (cleaned.includes('communication')) return 'Communication';

    return cleaned
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private deriveDifficulty(skillName: string): RoadmapLevel {
    const normalized = this.normalizeSkillName(skillName).toLowerCase();
    if (
      normalized.includes('architecture') ||
      normalized.includes('kubernetes') ||
      normalized.includes('distributed') ||
      normalized.includes('optimization')
    ) {
      return 'advanced';
    }

    if (
      normalized.includes('sql') ||
      normalized.includes('python') ||
      normalized.includes('tableau') ||
      normalized.includes('testing') ||
      normalized.includes('database')
    ) {
      return 'intermediate';
    }

    return 'beginner';
  }

  private defaultEstimatedHours(difficulty: RoadmapLevel | null): number {
    if (difficulty === 'advanced') return 50;
    if (difficulty === 'intermediate') return 30;
    return 18;
  }

  private pickHigherDifficulty(left: RoadmapLevel, right: RoadmapLevel): RoadmapLevel {
    const rank: Record<RoadmapLevel, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };

    return rank[left] >= rank[right] ? left : right;
  }
}
