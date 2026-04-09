import { Injectable, Logger } from '@nestjs/common';
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
  required_skills: string[];
  preferred_interests: string[];
  typical_traits: string[];
  tags: string[];
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

@Injectable()
export class CareerService {
  private readonly logger = new Logger(CareerService.name);

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
  ) {}

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

    const careers: Career[] = (data || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      required_skills: Array.isArray(c.required_skills) ? c.required_skills : [],
      preferred_interests: Array.isArray(c.preferred_interests) ? c.preferred_interests : [],
      typical_traits: Array.isArray(c.typical_traits) ? c.typical_traits : [],
      tags: Array.isArray(c.tags) ? c.tags : [],
      salary_range_min: c.salary_range_min ?? 0,
      salary_range_max: c.salary_range_max ?? 0,
      growth_potential: c.growth_potential || 'medium',
      is_active: c.is_active !== false,
    }));

    await this.cacheService.set(cacheKey, careers, 3600);
    return careers;
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

    let cvSkills: string[] = [];
    let cvInterests: string[] = [];
    if (cvAnalysisId) {
      const { data: cvData } = await this.db.supabase
        .from('cv_analysis')
        .select('extracted_skills, extracted_interests')
        .eq('id', cvAnalysisId)
        .single();
      if (cvData) {
        cvSkills = Array.isArray(cvData.extracted_skills) ? cvData.extracted_skills : [];
        cvInterests = Array.isArray(cvData.extracted_interests) ? cvData.extracted_interests : [];
      }
    }

    const userSkills = [...new Set([...quizProfile.skills, ...cvSkills])];
    const userInterests = [...new Set([...quizProfile.interests, ...cvInterests])];

    const careers = await this.getAllCareers();
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
    try {
      await this.db.supabase.from('career_match_results').upsert(
        deterministicMatches.map((m, idx) => ({
          user_id: userId,
          quiz_session_id: quizSessionId,
          cv_analysis_id: cvAnalysisId,
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

    // AI is used only for "why it fits" explanation.
    const enhancedMatches = await this.enhanceMatchesWithAi(
      deterministicMatches,
      quizAnswers,
      cvSkills,
      quizProfile.disc,
    );

    try {
      await this.db.supabase.from('career_match_results').upsert(
        enhancedMatches.map((m, idx) => ({
          user_id: userId,
          quiz_session_id: quizSessionId,
          cv_analysis_id: cvAnalysisId,
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

    await this.cacheService.set(cacheKey, enhancedMatches, 21600);
    return enhancedMatches;
  }
}
