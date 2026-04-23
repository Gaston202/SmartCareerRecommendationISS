import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../core/database/database.service';
import { AiOrchestratorService } from '../../core/ai-orchestrator/ai-orchestrator.service';
import { CacheService } from '../../core/cache/cache.service';

type DiscColor = 'red' | 'yellow' | 'green' | 'blue';

interface QuizAnswerRow {
  selected_option: string;
  question_number: number;
}

export interface Career {
  id: string;
  title: string;
  description: string;
  category: string;
  required_skills: string[];
  preferred_interests: string[];
  typical_traits: string[];
  tags: string[];
  average_salary: number;
  growth_rate: number;
  demand_level: string;
  salary_range_min: number;
  salary_range_max: number;
  growth_potential: string;
  is_active: boolean;
}

export interface CareerMatch {
  career: Career;
  match_score: number;
  match_reasons: string[];
  ai_explanation: string;
}

interface DerivedQuizProfile {
  skills: string[];
  interests: string[];
  traits: string[];
  disc: Record<DiscColor, number>;
}

interface UserProfileDetails {
  educationLevel?: string;
  fieldOfStudy?: string;
  careerGoal?: string;
  bio?: string;
  declaredSkills?: string[];
}

interface MarketDataSnapshot {
  average_salary: number;
  salary_range_min: number;
  salary_range_max: number;
  growth_rate: number;
  demand_level: 'low' | 'medium' | 'high' | 'very-high';
}

@Injectable()
export class CareerService {
  private readonly logger = new Logger(CareerService.name);
  private readonly marketWebSearchEnabled: boolean;
  private readonly marketSearchTtlSeconds: number;

  private static readonly MARKET_SEARCH_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  private mapCareerRow(c: any): Career {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category || 'General',
      required_skills: Array.isArray(c.required_skills) ? c.required_skills : [],
      preferred_interests: Array.isArray(c.preferred_interests) ? c.preferred_interests : [],
      typical_traits: Array.isArray(c.typical_traits) ? c.typical_traits : [],
      tags: Array.isArray(c.tags) ? c.tags : [],
      average_salary: c.average_salary ?? 0,
      growth_rate: c.growth_rate ?? 0,
      demand_level: c.demand_level || 'medium',
      salary_range_min: c.salary_range_min ?? 0,
      salary_range_max: c.salary_range_max ?? 0,
      growth_potential: c.growth_potential || 'medium',
      is_active: c.is_active !== false,
    };
  }

  // Deterministic mapping from quiz work-style choices -> profile signals.
  private static readonly COLOR_SIGNALS: Record<
    DiscColor,
    { skills: string[]; interests: string[]; traits: string[] }
  > = {
    blue: {
      skills: ['Analysis', 'Problem Solving', 'Quality Assurance', 'Research', 'Planning'],
      interests: ['Data', 'Technology', 'Process Improvement', 'Stability'],
      traits: ['Analytical', 'Detail-oriented', 'Methodical', 'Structured'],
    },
    green: {
      skills: ['Communication', 'Mentoring', 'Collaboration', 'Conflict Resolution', 'Support'],
      interests: ['People', 'Teamwork', 'Community Impact', 'Culture'],
      traits: ['Collaborative', 'Empathetic', 'Supportive', 'Patient'],
    },
    red: {
      skills: ['Leadership', 'Decision Making', 'Execution', 'Strategy', 'Negotiation'],
      interests: ['Business', 'Achievement', 'Competition', 'Growth'],
      traits: ['Decisive', 'Results-oriented', 'Strategic', 'Ambitious'],
    },
    yellow: {
      skills: ['Creativity', 'Ideation', 'Storytelling', 'Experimentation', 'Adaptability'],
      interests: ['Innovation', 'Design', 'Variety', 'Creativity'],
      traits: ['Creative', 'Innovative', 'Flexible', 'Visionary'],
    },
  };

  private static readonly COLOR_KEYWORDS: Record<DiscColor, string[]> = {
    blue: ['analy', 'data', 'detail', 'quality', 'accuracy', 'structure', 'process', 'methodical'],
    green: ['team', 'support', 'collabor', 'help', 'care', 'people', 'relationship', 'mentor'],
    red: ['lead', 'target', 'result', 'fast', 'decision', 'strateg', 'competitive', 'recognition'],
    yellow: ['creative', 'innovat', 'idea', 'design', 'experiment', 'variety', 'flexible', 'brainstorm'],
  };

  constructor(
    private db: DatabaseService,
    private aiOrchestrator: AiOrchestratorService,
    private cacheService: CacheService,
    private configService: ConfigService,
  ) {
    const enabled = this.configService.get<string>('ENABLE_MARKET_WEB_SEARCH');
    this.marketWebSearchEnabled = enabled !== 'false' && enabled !== '0';

    const ttlFromEnv = Number(this.configService.get<string>('MARKET_WEB_SEARCH_TTL_SECONDS') || 86400);
    this.marketSearchTtlSeconds = Number.isFinite(ttlFromEnv) && ttlFromEnv > 0 ? ttlFromEnv : 86400;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 64);
  }

  private decodeHtmlEntities(raw: string): string {
    return raw
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async fetchDuckDuckGoSnippets(query: string): Promise<string[]> {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CareerService.MARKET_SEARCH_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed with status ${response.status}`);
    }

    const html = await response.text();
    const snippets: string[] = [];

    const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null = null;
    while ((match = snippetRegex.exec(html)) !== null) {
      const text = this.decodeHtmlEntities(match[1] || '');
      if (text && text.length > 24) {
        snippets.push(text);
      }
      if (snippets.length >= 8) break;
    }

    if (snippets.length < 3) {
      const fallbackRegex = /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      while ((match = fallbackRegex.exec(html)) !== null) {
        const text = this.decodeHtmlEntities(match[1] || '');
        if (text && text.length > 24) {
          snippets.push(text);
        }
        if (snippets.length >= 8) break;
      }
    }

    return [...new Set(snippets)].slice(0, 8);
  }

  private async collectMarketSnippets(careerTitle: string): Promise<string[]> {
    const queries = [
      `${careerTitle} average salary 2025`,
      `${careerTitle} job growth rate BLS`,
      `${careerTitle} demand outlook job market`,
    ];

    const results = await Promise.all(
      queries.map((query) =>
        this.fetchDuckDuckGoSnippets(query).catch((error) => {
          this.logger.warn(`Web search query failed for ${careerTitle}: ${query}`, error);
          return [];
        }),
      ),
    );

    return [...new Set(results.flat())].slice(0, 12);
  }

  private mapDemandLevel(value: string | undefined): 'low' | 'medium' | 'high' | 'very-high' {
    if (value === 'low' || value === 'medium' || value === 'high' || value === 'very-high') {
      return value;
    }
    return 'medium';
  }

  private async enrichCareerWithMarketData(career: Career): Promise<Career> {
    if (!this.marketWebSearchEnabled) {
      return career;
    }

    const cacheKey = `career:market:data:${this.slugify(career.title)}`;
    const cached = await this.cacheService.get<MarketDataSnapshot>(cacheKey);
    if (cached) {
      return {
        ...career,
        average_salary: cached.average_salary,
        salary_range_min: cached.salary_range_min,
        salary_range_max: cached.salary_range_max,
        growth_rate: cached.growth_rate,
        demand_level: cached.demand_level,
      };
    }

    const snippets = await this.collectMarketSnippets(career.title);
    if (!snippets.length) {
      return career;
    }

    const intel = await this.aiOrchestrator.extractCareerMarketIntel(career.title, snippets, this.marketSearchTtlSeconds);
    if (!intel) {
      return career;
    }

    const confidence = typeof intel.confidence === 'number' ? intel.confidence : 0;
    if (confidence < 0.35) {
      return career;
    }

    const minSalary = typeof intel.salary_min === 'number' ? Math.max(0, Math.round(intel.salary_min)) : career.salary_range_min;
    const maxSalary = typeof intel.salary_max === 'number' ? Math.max(minSalary, Math.round(intel.salary_max)) : career.salary_range_max;

    const averageSalary = minSalary > 0 && maxSalary > 0
      ? Math.round((minSalary + maxSalary) / 2)
      : career.average_salary;

    const growthRate = typeof intel.growth_rate_percent === 'number'
      ? Math.max(0, Math.min(40, Math.round(intel.growth_rate_percent)))
      : career.growth_rate;

    const demandLevel = this.mapDemandLevel(intel.demand_level);

    const snapshot: MarketDataSnapshot = {
      average_salary: averageSalary,
      salary_range_min: minSalary,
      salary_range_max: maxSalary,
      growth_rate: growthRate,
      demand_level: demandLevel,
    };

    await this.cacheService.set(cacheKey, snapshot, this.marketSearchTtlSeconds);

    return {
      ...career,
      average_salary: snapshot.average_salary,
      salary_range_min: snapshot.salary_range_min,
      salary_range_max: snapshot.salary_range_max,
      growth_rate: snapshot.growth_rate,
      demand_level: snapshot.demand_level,
    };
  }

  private async enrichMatchesWithMarketData(matches: CareerMatch[]): Promise<CareerMatch[]> {
    return Promise.all(
      matches.map(async (match) => {
        try {
          const enrichedCareer = await this.enrichCareerWithMarketData(match.career);
          return {
            ...match,
            career: enrichedCareer,
          };
        } catch (error) {
          this.logger.warn(`Market enrichment failed for ${match.career.title}`, error);
          return match;
        }
      }),
    );
  }

  async getAllCareers(): Promise<Career[]> {
    const cacheKey = 'careers:all';
    const cached = await this.cacheService.get<Career[]>(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.db.supabase
      .from('careers')
      .select('*')
      .eq('is_active', true)
      .order('title', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch careers', error);
      return [];
    }

    const careers: Career[] = (data || []).map((c: any) => this.mapCareerRow(c));

    await this.cacheService.set(cacheKey, careers, 3600);
    return careers;
  }

  private async selectAiCareersFromDatabase(
    quizAnswers: string[],
    dbCareers: Career[],
    userSkills: string[],
    userInterests: string[],
    userTraits: string[],
    disc: Record<DiscColor, number>,
    novaProfile?: any,
    userProfileDetails?: UserProfileDetails,
  ): Promise<Career[]> {
    const generated = await this.aiOrchestrator.generateCareersFromProfile({
      quizAnswers,
      skills: userSkills,
      interests: userInterests,
      traits: userTraits,
      disc,
      novaProfile,
      candidateCareers: dbCareers.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        required_skills: c.required_skills,
        tags: c.tags,
      })),
      userProfileDetails,
    });

    if (!generated.length) return [];

    const byTitle = new Map(dbCareers.map((c) => [c.title.toLowerCase().trim(), c]));

    const matched = generated
      .map((g) => byTitle.get(g.title.toLowerCase().trim()))
      .filter(Boolean) as Career[];

    return matched.length > 0 ? matched : dbCareers;
  }

  private detectDiscColor(answer: string): DiscColor {
    const lower = answer.toLowerCase();
    const scores: Record<DiscColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 };

    (Object.keys(CareerService.COLOR_KEYWORDS) as DiscColor[]).forEach((color) => {
      for (const keyword of CareerService.COLOR_KEYWORDS[color]) {
        if (lower.includes(keyword)) scores[color] += 1;
      }
    });

    const best = (Object.entries(scores) as Array<[DiscColor, number]>).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'blue';
  }

  private deriveProfileFromQuiz(answers: QuizAnswerRow[]): DerivedQuizProfile {
    const discCounts: Record<DiscColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
    const skills: string[] = [];
    const interests: string[] = [];
    const traits: string[] = [];

    for (const answer of answers) {
      const color = this.detectDiscColor(answer.selected_option);
      discCounts[color] += 1;
      skills.push(...CareerService.COLOR_SIGNALS[color].skills);
      interests.push(...CareerService.COLOR_SIGNALS[color].interests);
      traits.push(...CareerService.COLOR_SIGNALS[color].traits);
    }

    return {
      skills: [...new Set(skills)],
      interests: [...new Set(interests)],
      traits: [...new Set(traits)],
      disc: discCounts,
    };
  }

  private findOverlap(userItems: string[], targetItems: string[]): string[] {
    if (!userItems?.length || !targetItems?.length) return [];
    const user = userItems.map((x) => x.toLowerCase().trim());
    const target = targetItems.map((x) => x.toLowerCase().trim());

    return target.filter((targetItem) =>
      user.some((userItem) => userItem.includes(targetItem) || targetItem.includes(userItem)),
    );
  }

  private scoreCareerDeterministically(
    career: Career,
    userSkills: string[],
    userInterests: string[],
    userTraits: string[],
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];

    const skillOverlap = this.findOverlap(userSkills, career.required_skills);
    const skillScore = (skillOverlap.length / Math.max(career.required_skills.length, 1)) * 45;
    if (skillOverlap.length) reasons.push(`Skills matched: ${skillOverlap.slice(0, 3).join(', ')}`);

    const interestUniverse = [...career.preferred_interests, ...career.tags];
    const interestOverlap = this.findOverlap(userInterests, interestUniverse);
    const interestScore = (interestOverlap.length / Math.max(interestUniverse.length, 1)) * 35;
    if (interestOverlap.length) reasons.push(`Interests aligned: ${interestOverlap.slice(0, 3).join(', ')}`);

    const traitOverlap = this.findOverlap(userTraits, career.typical_traits);
    const traitScore = (traitOverlap.length / Math.max(career.typical_traits.length, 1)) * 20;
    if (traitOverlap.length) reasons.push(`Traits aligned: ${traitOverlap.slice(0, 3).join(', ')}`);

    const score = Math.min(100, Math.round(skillScore + interestScore + traitScore));
    if (!reasons.length) reasons.push('General profile alignment based on quiz preferences');

    return { score, reasons };
  }

  private async enhanceMatchesWithAi(
    matches: CareerMatch[],
    quizAnswers: string[],
    cvSkills: string[],
    disc: Record<DiscColor, number>,
  ): Promise<CareerMatch[]> {
    return Promise.all(
      matches.map(async (match) => {
        try {
          const explanation = await this.aiOrchestrator.generateCareerExplanation(
            {
              id: match.career.id,
              title: match.career.title,
              description: match.career.description,
              required_skills: match.career.required_skills,
              match_score: match.match_score,
              match_reasons: match.match_reasons,
            },
            quizAnswers,
            cvSkills,
            { behavior: { discPercentages: disc } },
          );
          return { ...match, ai_explanation: explanation };
        } catch (error) {
          this.logger.warn(`Failed AI explanation for ${match.career.id}`, error);
          return {
            ...match,
            ai_explanation: `Based on your profile, this role matches your strengths with a ${match.match_score}% fit.`,
          };
        }
      }),
    );
  }

  async getCareerRecommendations(
    userId: string,
    quizSessionId: string,
    cvAnalysisId?: string,
    novaProfile?: any,
  ): Promise<CareerMatch[]> {
    const traceId = `rec:${userId}:${quizSessionId.slice(0, 8)}`;
    const cacheKey = `career:matches:${userId}:${cvAnalysisId || 'none'}:${quizSessionId}`;

    const cached = await this.cacheService.get<CareerMatch[]>(cacheKey);
    if (cached) return cached;

    const { data: answers, error: answersError } = await this.db.supabase
      .from('user_quiz_responses')
      .select('selected_option, question_number')
      .eq('session_id', quizSessionId)
      .order('question_number', { ascending: true });

    if (answersError || !answers?.length) {
      this.logger.error(`[${traceId}] Quiz answers not found`, answersError);
      throw new Error('Quiz answers not found');
    }

    const quizAnswers = answers.map((a: QuizAnswerRow) => a.selected_option);
    const quizProfile = this.deriveProfileFromQuiz(answers as QuizAnswerRow[]);

    let resolvedCvAnalysisId = cvAnalysisId;
    if (!resolvedCvAnalysisId) {
      const { data: latestCv } = await this.db.supabase
        .from('cv_analysis')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      resolvedCvAnalysisId = latestCv?.id;
    }

    let cvSkills: string[] = [];
    let cvInterests: string[] = [];
    if (resolvedCvAnalysisId) {
      const { data: cvData } = await this.db.supabase
        .from('cv_analysis')
        .select('extracted_skills, extracted_interests')
        .eq('id', resolvedCvAnalysisId)
        .single();
      if (cvData) {
        cvSkills = Array.isArray(cvData.extracted_skills) ? cvData.extracted_skills : [];
        cvInterests = Array.isArray(cvData.extracted_interests) ? cvData.extracted_interests : [];
      }
    }

    const userSkills = [...new Set([...quizProfile.skills, ...cvSkills])];
    const userInterests = [...new Set([...quizProfile.interests, ...cvInterests])];

    let userProfileDetails: UserProfileDetails = {};
    try {
      const { data: userProfileRow } = await this.db.supabase
        .from('users')
        .select('education_level, field_of_study, career_goal, bio, skills')
        .eq('id', userId)
        .maybeSingle();

      if (userProfileRow) {
        userProfileDetails = {
          educationLevel: userProfileRow.education_level || undefined,
          fieldOfStudy: userProfileRow.field_of_study || undefined,
          careerGoal: userProfileRow.career_goal || undefined,
          bio: userProfileRow.bio || undefined,
          declaredSkills:
            typeof userProfileRow.skills === 'string'
              ? userProfileRow.skills
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [],
        };
      }
    } catch (error) {
      this.logger.warn(`[${traceId}] Could not load user profile details from users table`, error);
    }

    const mergedSkills = [...new Set([...(userProfileDetails.declaredSkills || []), ...userSkills])];

    const dbCareers = await this.getAllCareers();

    let careers = await this.selectAiCareersFromDatabase(
      quizAnswers,
      dbCareers,
      mergedSkills,
      userInterests,
      quizProfile.traits,
      quizProfile.disc,
      novaProfile,
      userProfileDetails,
    );
    if (!careers.length) {
      careers = dbCareers;
    }

    const deterministicMatches: CareerMatch[] = careers
      .map((career) => {
        const { score, reasons } = this.scoreCareerDeterministically(
          career,
          userSkills,
          userInterests,
          quizProfile.traits,
        );
        return {
          career,
          match_score: score,
          match_reasons: reasons,
          ai_explanation: '',
        };
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5);

    // Store deterministic ranking first.
    if (resolvedCvAnalysisId) {
      try {
        await this.db.supabase.from('career_match_results').upsert(
          deterministicMatches.map((m, idx) => ({
            user_id: userId,
            quiz_session_id: quizSessionId,
            cv_analysis_id: resolvedCvAnalysisId,
            career_id: m.career.id,
            match_score: m.match_score,
            match_reasons: m.match_reasons,
            ai_insights: { explanation: null, status: 'pending' },
            ranking: idx + 1,
            generated_at: new Date().toISOString(),
          })),
          { onConflict: 'user_id,quiz_session_id,career_id' },
        );
      } catch (error) {
        this.logger.error(`[${traceId}] Failed to save deterministic matches`, error);
      }
    } else {
      this.logger.warn(`[${traceId}] No cv_analysis_id available, skipping career_match_results persistence`);
    }

    // AI is used only for "why it fits" explanation.
    const enhancedMatches = await this.enhanceMatchesWithAi(
      deterministicMatches,
      quizAnswers,
      cvSkills,
      quizProfile.disc,
    );

    const marketEnrichedMatches = await this.enrichMatchesWithMarketData(enhancedMatches);

    if (resolvedCvAnalysisId) {
      try {
        await this.db.supabase.from('career_match_results').upsert(
          marketEnrichedMatches.map((m, idx) => ({
            user_id: userId,
            quiz_session_id: quizSessionId,
            cv_analysis_id: resolvedCvAnalysisId,
            career_id: m.career.id,
            match_score: m.match_score,
            match_reasons: m.match_reasons,
            ai_insights: { explanation: m.ai_explanation, status: 'completed' },
            ranking: idx + 1,
            generated_at: new Date().toISOString(),
          })),
          { onConflict: 'user_id,quiz_session_id,career_id' },
        );
      } catch (error) {
        this.logger.error(`[${traceId}] Failed to save AI-enhanced matches`, error);
      }
    }

    await this.cacheService.set(cacheKey, marketEnrichedMatches, 21600);
    return marketEnrichedMatches;
  }
}
