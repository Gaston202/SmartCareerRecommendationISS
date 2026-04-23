import { Injectable, Logger } from '@nestjs/common';
import type { RetrievedResource, SkillGap } from './roadmap-rag.types';

interface TavilySearchResult {
  title?: string;
  url?: string;
  score?: number;
}

interface TavilySearchResponse {
  results?: TavilySearchResult[];
}

@Injectable()
export class RoadmapWebSearchService {
  private readonly logger = new Logger(RoadmapWebSearchService.name);
  private readonly tavilyApiKey = process.env.TAVILY_API_KEY?.trim() || '';
  private readonly tavilyUrl = 'https://api.tavily.com/search';

  async searchForSkill(skill: SkillGap, role: string): Promise<RetrievedResource[]> {
    if (!this.tavilyApiKey) {
      return [];
    }

    const query = `${skill.canonicalName} learning resource for ${role}`;

    try {
      const response = await fetch(this.tavilyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.tavilyApiKey,
          query,
          search_depth: 'basic',
          max_results: 5,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `[Roadmap Web Search] Tavily request failed skill="${skill.canonicalName}" status=${response.status}`,
        );
        return [];
      }

      const payload = (await response.json()) as TavilySearchResponse;
      const results = Array.isArray(payload.results) ? payload.results : [];

      return results
        .filter((result): result is Required<Pick<TavilySearchResult, 'title' | 'url'>> & TavilySearchResult => {
          return typeof result.title === 'string' && result.title.length > 0 &&
            typeof result.url === 'string' && result.url.length > 0;
        })
        .map((result) => ({
          resource_id: btoa(result.url).slice(0, 16),
          resource_title: result.title,
          resource_type: 'article',
          free_or_paid: 'free',
          language: 'en',
          level: null,
          provider: this.extractHostname(result.url),
          source_url: result.url,
          score: typeof result.score === 'number' ? result.score : 0.4,
          keyword_score: 0,
          semantic_score: typeof result.score === 'number' ? result.score : 0.4,
          matched_skill_tags: [skill.canonicalName],
        }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `[Roadmap Web Search] Tavily search failed skill="${skill.canonicalName}" role="${role}" error=${message}`,
      );
      return [];
    }
  }

  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname || 'web';
    } catch {
      return 'web';
    }
  }
}
