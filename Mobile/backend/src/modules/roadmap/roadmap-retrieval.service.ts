import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../../core/database/database.service';
import { CacheService } from '../../core/cache/cache.service';
import type {
  RetrievedResource,
  RetrievalResponse,
  RoadmapResourceFilters,
  SearchResourcesDto,
} from './roadmap-rag.types';

interface KeywordRow {
  resource_id: string;
  title: string;
  provider: string;
  source_url: string;
  resource_type: string;
  language: string;
  level: string | null;
  free_or_paid: 'free' | 'paid' | 'mixed';
  keyword_score: number;
}

interface FallbackKeywordResourceRow {
  id: string;
  title: string;
  description: string | null;
  provider: string;
  source_url: string;
  resource_type: string;
  language: string;
  level: string | null;
  free_or_paid: 'free' | 'paid' | 'mixed';
  skill_tags: string[] | null;
  target_roles: string[] | null;
}

interface ResourceChunkRow {
  id: string;
  resource_id: string;
  chunk_text: string;
}

interface SemanticRow {
  resource_id: string;
  title: string;
  provider: string;
  source_url: string;
  resource_type: string;
  language: string;
  level: string | null;
  free_or_paid: 'free' | 'paid' | 'mixed';
  semantic_score: number;
}

@Injectable()
export class RoadmapRetrievalService {
  private readonly logger = new Logger(RoadmapRetrievalService.name);
  private readonly embeddingApiKey =
    process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
  private readonly embeddingApiBaseUrl =
    process.env.OPENROUTER_API_KEY
      ? process.env.OPENROUTER_EMBEDDINGS_URL || 'https://openrouter.ai/api/v1/embeddings'
      : 'https://api.openai.com/v1/embeddings';
  private readonly embeddingModel = this.resolveEmbeddingModel();

  constructor(
    private readonly db: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  async searchResources(input: SearchResourcesDto): Promise<RetrievalResponse> {
    this.logger.log(
      `[Roadmap Retrieval] search started query="${input.query}" top_k=${input.top_k || 10} required_skills=${input.required_skills?.length || 0}`,
    );

    const topK = Math.min(Math.max(input.top_k || 10, 1), 40);
    const cacheKey = `roadmap:search:${Buffer.from(JSON.stringify(input)).toString('base64')}`;

    const cached = await this.cacheService.get<RetrievalResponse>(cacheKey);
    if (cached) {
      this.logger.log(
        `[Roadmap Retrieval] cache hit query="${input.query}" resources=${cached.resources.length} confidence=${cached.confidence}`,
      );
      return cached;
    }

    const [structured, keywordRows, semanticRows] = await Promise.all([
      this.structuredFilterCandidates(input.query, input.filters),
      this.keywordCandidates(input.query, input.filters, topK * 4),
      this.semanticCandidates(input.query, input.filters, topK * 4),
    ]);

    const normalizedKeywordMap = this.normalizeScores(
      keywordRows.map((row) => ({
        id: row.resource_id,
        raw_score: row.keyword_score,
      })),
    );
    const normalizedSemanticMap = this.normalizeScores(
      semanticRows.map((row) => ({
        id: row.resource_id,
        raw_score: row.semantic_score,
      })),
    );

    const fused = this.fuseAndRerank(
      structured,
      keywordRows,
      semanticRows,
      normalizedKeywordMap,
      normalizedSemanticMap,
      input.required_skills || [],
    );
    const trimmed = fused.slice(0, topK);

    const confidence = this.computeConfidence(trimmed);
    const weakEvidence = confidence < 0.45 || trimmed.length < Math.min(3, topK);

    const response: RetrievalResponse = {
      resources: trimmed,
      confidence,
      weakEvidence,
      reason: weakEvidence ? 'insufficient reliable sources' : undefined,
    };

    await this.cacheService.set(cacheKey, response, 1800);
    this.logger.log(
      `[Roadmap Retrieval] search completed query="${input.query}" structured=${structured.length} keyword=${keywordRows.length} semantic=${semanticRows.length} fused=${trimmed.length} confidence=${confidence} weak=${weakEvidence}`,
    );
    return response;
  }

  private async structuredFilterCandidates(
    query: string,
    filters?: RoadmapResourceFilters,
  ): Promise<RetrievedResource[]> {
    let q = this.db.supabase
      .from('resources')
      .select('id,title,resource_type,free_or_paid,language,level,provider,source_url,skill_tags,provider_rating')
      .eq('is_active', true)
      .limit(80);

    q = this.applyResourceFilters(q, filters);

    if (query && query.trim().length > 0) {
      const escaped = query.replace(/,/g, ' ');
      q = q.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }

    const { data, error } = await q;
    if (error) {
      this.logger.warn('Structured resource retrieval failed', error.message);
      return [];
    }

    return (data || []).map((r: any, idx: number) => ({
      resource_id: r.id,
      resource_title: r.title,
      resource_type: r.resource_type,
      free_or_paid: r.free_or_paid,
      language: r.language,
      level: r.level,
      provider: r.provider,
      source_url: r.source_url,
      score: Math.max(0.01, 1 - idx / 100),
      structured_score: Math.max(0.01, 1 - idx / 100),
      matched_skill_tags: Array.isArray(r.skill_tags) ? r.skill_tags : [],
    }));
  }

  private async keywordCandidates(
    query: string,
    filters: RoadmapResourceFilters | undefined,
    limitCount: number,
  ): Promise<KeywordRow[]> {
    if (!query || query.trim().length === 0) return [];

    const { data, error } = await this.db.supabase.rpc('roadmap_keyword_search', {
      query_text: query,
      limit_count: limitCount,
      filters: filters || {},
    });

    if (error) {
      this.logger.warn('Keyword search RPC failed', error.message);
      return this.keywordFallbackCandidates(query, filters, limitCount);
    }

    const rows = (data || []) as KeywordRow[];
    if (rows.length > 0) {
      return this.dedupeByMaxScore(rows);
    }

    return this.keywordFallbackCandidates(query, filters, limitCount);
  }

  private dedupeByMaxScore(
    rows: KeywordRow[],
  ): KeywordRow[] {
    const best = new Map<string, KeywordRow>();

    for (const row of rows) {
      const existing = best.get(row.resource_id);
      if (!existing || row.keyword_score > existing.keyword_score) {
        best.set(row.resource_id, row);
      }
    }

    return Array.from(best.values());
  }

  private async semanticCandidates(
    query: string,
    filters: RoadmapResourceFilters | undefined,
    limitCount: number,
  ): Promise<SemanticRow[]> {
    if (!query || query.trim().length === 0) return [];

    const embedding = await this.getQueryEmbedding(query);
    if (!embedding || embedding.length === 0) {
      return [];
    }

    const { data, error } = await this.db.supabase.rpc('roadmap_semantic_search', {
      query_embedding: `[${embedding.join(',')}]`,
      limit_count: limitCount,
      filters: filters || {},
    });

    if (error) {
      this.logger.warn('Semantic search RPC failed', error.message);
      return [];
    }

    return (data || []) as SemanticRow[];
  }

  private fuseAndRerank(
    structured: RetrievedResource[],
    keywordRows: KeywordRow[],
    semanticRows: SemanticRow[],
    normalizedKeywordMap: Map<string, number>,
    normalizedSemanticMap: Map<string, number>,
    requiredSkills: string[],
  ): RetrievedResource[] {
    const rrfK = 60;

    const structuredById = new Map<string, RetrievedResource>();
    structured.forEach((row) => structuredById.set(row.resource_id, row));

    const keywordById = new Map<string, KeywordRow>();
    keywordRows.forEach((row) => {
      if (!keywordById.has(row.resource_id)) keywordById.set(row.resource_id, row);
    });

    const semanticById = new Map<string, SemanticRow>();
    semanticRows.forEach((row) => {
      if (!semanticById.has(row.resource_id)) semanticById.set(row.resource_id, row);
    });

    const ids = new Set<string>([
      ...structuredById.keys(),
      ...keywordById.keys(),
      ...semanticById.keys(),
    ]);

    const keywordRank = new Map<string, number>();
    keywordRows.forEach((row, idx) => {
      if (!keywordRank.has(row.resource_id)) keywordRank.set(row.resource_id, idx + 1);
    });

    const semanticRank = new Map<string, number>();
    semanticRows.forEach((row, idx) => {
      if (!semanticRank.has(row.resource_id)) semanticRank.set(row.resource_id, idx + 1);
    });

    const structuredRank = new Map<string, number>();
    structured.forEach((row, idx) => structuredRank.set(row.resource_id, idx + 1));

    const fused: RetrievedResource[] = [];

    ids.forEach((id) => {
      const s = structuredById.get(id);
      const k = keywordById.get(id);
      const v = semanticById.get(id);

      const sr = structuredRank.get(id);
      const kr = keywordRank.get(id);
      const vr = semanticRank.get(id);

      const structuredScore = sr ? 1 / (rrfK + sr) : 0;
      const keywordScore = kr ? 1 / (rrfK + kr) : 0;
      const semanticScore = vr ? 1 / (rrfK + vr) : 0;
      const krNorm = normalizedKeywordMap.get(id) ?? 0;
      const vrNorm = normalizedSemanticMap.get(id) ?? 0;
      const srNorm = structuredRank.get(id)
        ? 1 / (rrfK + (structuredRank.get(id) ?? 999))
        : 0;

      let rerankBoost = 0;
      const title = (s?.resource_title || k?.title || v?.title || '').toLowerCase();
      if (requiredSkills.length > 0) {
        const overlap = requiredSkills.filter((skill) =>
          title.includes(skill.toLowerCase()),
        ).length;
        rerankBoost += Math.min(0.2, overlap * 0.07);
      }

      const rrfScore =
        (kr ? 1 / (rrfK + kr) : 0) * 0.35 +
        (vr ? 1 / (rrfK + vr) : 0) * 0.30 +
        srNorm * 0.35;

      const normScore = krNorm * 0.45 + vrNorm * 0.35 + 0;

      const total = rrfScore * 0.4 + normScore * 0.6 + rerankBoost;

      fused.push({
        resource_id: id,
        resource_title: s?.resource_title || k?.title || v?.title || 'Unknown Resource',
        resource_type: s?.resource_type || k?.resource_type || v?.resource_type || 'article',
        free_or_paid: s?.free_or_paid || k?.free_or_paid || v?.free_or_paid || 'free',
        language: s?.language || k?.language || v?.language || 'en',
        level: (s?.level || k?.level || v?.level || null) as any,
        provider: s?.provider || k?.provider || v?.provider || 'unknown',
        source_url: s?.source_url || k?.source_url || v?.source_url || '',
        score: Number(total.toFixed(4)),
        structured_score: Number(structuredScore.toFixed(4)),
        keyword_score: Number((normalizedKeywordMap.get(id) ?? 0).toFixed(4)),
        semantic_score: Number((normalizedSemanticMap.get(id) ?? 0).toFixed(4)),
        rerank_score: Number(rerankBoost.toFixed(4)),
        matched_skill_tags: s?.matched_skill_tags || [],
      });
    });

    return fused.sort((a, b) => b.score - a.score);
  }

  private computeConfidence(resources: RetrievedResource[]): number {
    if (resources.length === 0) return 0;

    const top = resources[0]?.score || 0;
    const second = resources[1]?.score || 0;
    const density = Math.min(1, resources.length / 8);
    const margin = Math.max(0, top - second);

    return Number(Math.min(1, top * 0.6 + density * 0.25 + margin * 0.15).toFixed(4));
  }

  private normalizeScores(
    results: Array<{ id: string; raw_score: number }>,
  ): Map<string, number> {
    if (results.length === 0) return new Map();

    const scores = results.map((result) => result.raw_score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;

    return new Map(
      results.map((result) => [
        result.id,
        range > 0 ? (result.raw_score - min) / range : 1.0,
      ]),
    );
  }

  private applyResourceFilters(query: any, filters?: RoadmapResourceFilters): any {
    if (!filters) return query;

    if (filters.level) query = query.eq('level', filters.level);
    if (filters.free_or_paid) query = query.eq('free_or_paid', filters.free_or_paid);
    if (filters.language) query = query.eq('language', filters.language);
    if (filters.resource_type) query = query.eq('resource_type', filters.resource_type);
    if (filters.provider) query = query.eq('provider', filters.provider);
    if (typeof filters.certificate === 'boolean') query = query.eq('certificate', filters.certificate);
    if (typeof filters.duration_min === 'number') query = query.gte('duration_hours', filters.duration_min);
    if (typeof filters.duration_max === 'number') query = query.lte('duration_hours', filters.duration_max);
    if (filters.target_role) query = query.contains('target_roles', [filters.target_role]);
    if (filters.skill_tags && filters.skill_tags.length > 0) query = query.overlaps('skill_tags', filters.skill_tags);

    return query;
  }

  private async keywordFallbackCandidates(
    query: string,
    filters: RoadmapResourceFilters | undefined,
    limitCount: number,
  ): Promise<KeywordRow[]> {
    const terms = this.tokenizeQuery(query);
    if (terms.length === 0) return [];

    let resourceQuery = this.db.supabase
      .from('resources')
      .select(
        'id,title,description,provider,source_url,resource_type,language,level,free_or_paid,skill_tags,target_roles',
      )
      .eq('is_active', true)
      .limit(Math.max(limitCount * 3, 60));

    resourceQuery = this.applyResourceFilters(resourceQuery, filters);

    const { data: resources, error: resourceError } = await resourceQuery;
    if (resourceError) {
      this.logger.warn('Keyword fallback resource search failed', resourceError.message);
      return [];
    }

    const resourceRows = (resources || []) as FallbackKeywordResourceRow[];
    if (resourceRows.length === 0) return [];

    const resourceIds = resourceRows.map((row) => row.id);
    const { data: chunks, error: chunkError } = await this.db.supabase
      .from('resource_chunks')
      .select('id,resource_id,chunk_text')
      .in('resource_id', resourceIds)
      .limit(Math.max(limitCount * 6, 120));

    if (chunkError) {
      this.logger.warn('Keyword fallback chunk search failed', chunkError.message);
      return [];
    }

    const chunksByResource = new Map<string, ResourceChunkRow[]>();
    ((chunks || []) as ResourceChunkRow[]).forEach((chunk) => {
      const current = chunksByResource.get(chunk.resource_id) || [];
      current.push(chunk);
      chunksByResource.set(chunk.resource_id, current);
    });

    const scored = resourceRows
      .map((resource) => {
        const resourceChunks = chunksByResource.get(resource.id) || [];
        const title = (resource.title || '').toLowerCase();
        const description = (resource.description || '').toLowerCase();
        const chunkText = resourceChunks.map((chunk) => chunk.chunk_text || '').join(' ').toLowerCase();
        const skillTags = Array.isArray(resource.skill_tags) ? resource.skill_tags.map((tag) => tag.toLowerCase()) : [];
        const targetRoles = Array.isArray(resource.target_roles)
          ? resource.target_roles.map((role) => role.toLowerCase())
          : [];

        let score = 0;
        for (const term of terms) {
          if (title.includes(term)) score += 1.2;
          if (skillTags.some((tag) => tag.includes(term))) score += 1.0;
          if (targetRoles.some((role) => role.includes(term))) score += 0.8;
          if (description.includes(term)) score += 0.55;
          if (chunkText.includes(term)) score += 0.45;
        }

        return {
          resource_id: resource.id,
          title: resource.title,
          provider: resource.provider,
          source_url: resource.source_url,
          resource_type: resource.resource_type,
          language: resource.language,
          level: resource.level,
          free_or_paid: resource.free_or_paid,
          keyword_score: Number((score / terms.length).toFixed(4)),
        };
      })
      .filter((row) => row.keyword_score > 0)
      .sort((a, b) => b.keyword_score - a.keyword_score)
      .slice(0, limitCount);

    return scored;
  }

  private async getQueryEmbedding(text: string): Promise<number[] | null> {
    if (!this.embeddingApiKey) {
      return null;
    }

    try {
      const response = await axios.post(
        this.embeddingApiBaseUrl,
        {
          model: this.embeddingModel,
          input: text,
          dimensions: 1536,
        },
        {
          headers: {
            Authorization: `Bearer ${this.embeddingApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const embedding = response.data?.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) return null;
      return embedding as number[];
    } catch (error: any) {
      this.logger.warn(`Embedding generation skipped: ${error.message}`);
      return null;
    }
  }

  private resolveEmbeddingModel(): string {
    const configuredModel = process.env.ROADMAP_EMBEDDING_MODEL?.trim();
    const defaultModel = process.env.OPENROUTER_API_KEY
      ? 'openai/text-embedding-3-small'
      : 'text-embedding-3-small';
    const model = configuredModel || defaultModel;

    if (process.env.OPENROUTER_API_KEY && !model.includes('/')) {
      return `openai/${model}`;
    }

    return model;
  }

  private tokenizeQuery(query: string): string[] {
    return Array.from(
      new Set(
        query
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .map((term) => term.trim())
          .filter((term) => term.length >= 2),
      ),
    );
  }
}
