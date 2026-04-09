import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AiOrchestratorService } from '../../core/ai-orchestrator/ai-orchestrator.service';
import { CacheService } from '../../core/cache/cache.service';

export interface Career {
  id: string;
  title: string;
  description: string;
  required_skills: string[];
  preferred_interests: string[]; // Will come from category + demand_level
  typical_traits: string[]; // Will come from demand_level, growth_rate
  tags: string[]; // category, demand_level, etc.
  salary_range_min: number; // from average_salary * 0.9
  salary_range_max: number; // from average_salary * 1.1
  growth_potential: string; // derived from growth_rate
  is_active: boolean;
}

export interface CareerMatch {
  career: Career;
  match_score: number;
  match_reasons: string[];
  ai_explanation: string;
}

@Injectable()
export class CareerService {
  private readonly logger = new Logger(CareerService.name);

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

    // Map your existing columns to the Career interface
    const careers: Career[] = (data || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      required_skills: c.required_skills || [],
      preferred_interests: Array.isArray(c.preferred_interests) ? c.preferred_interests : [],
      typical_traits: Array.isArray(c.typical_traits) ? c.typical_traits : [],
      tags: Array.isArray(c.tags) ? c.tags : [],
      salary_range_min: c.salary_range_min ?? 0,
      salary_range_max: c.salary_range_max ?? 0,
      growth_potential: c.growth_potential || 'medium',
      is_active: c.is_active !== false, // default true
    }));

    await this.cacheService.set(cacheKey, careers, 3600);
    return careers;
  }

  private inferInterests(career: any): string[] {
    const interests: string[] = [];

    // Use category as primary interest
    if (career.category) {
      interests.push(career.category);
    }

    // Use demand_level as interest
    if (career.demand_level) {
      interests.push(`${career.demand_level} Demand`);
    }

    // Use required_skills categories as interests (simplified)
    if (career.required_skills && Array.isArray(career.required_skills)) {
      // Add top 2 skill categories (e.g., if skill is "JavaScript", category might be "Technology")
      // For now, just add a generic "Technical" if skills exist
      if (career.required_skills.length > 0) {
        interests.push('Skilled Work');
      }
    }

    return [...new Set(interests)];
  }

  private inferTraits(career: any): string[] {
    const traits: string[] = [];

    // Map demand_level to traits
    if (career.demand_level) {
      const demand = career.demand_level.toLowerCase();
      if (demand === 'high') {
        traits.push('Dynamic', 'Fast-paced');
      } else if (demand === 'medium') {
        traits.push('Stable', 'Balanced');
      } else if (demand === 'low') {
        traits.push('Niche', 'Specialized');
      }
    }

    // Map growth_rate to traits
    if (career.growth_rate) {
      const rate = Number(career.growth_rate);
      if (rate >= 20) {
        traits.push('Growth-oriented', 'Evolving');
      } else if (rate >= 10) {
        traits.push('Steady', 'Consistent');
      } else {
        traits.push('Stable', 'Mature');
      }
    }

    // Use category for traits
    if (career.category) {
      const cat = career.category.toLowerCase();
      if (cat.includes('tech') || cat.includes('engineering')) {
        traits.push('Analytical', 'Technical');
      } else if (cat.includes('management') || cat.includes('business')) {
        traits.push('Strategic', 'Leadership');
      } else if (cat.includes('creative') || cat.includes('design')) {
        traits.push('Creative', 'Innovative');
      }
    }

    return [...new Set(traits)];
  }

  private buildTags(career: any): string[] {
    const tags: string[] = [];

    if (career.category) {
      tags.push(career.category);
    }

    if (career.demand_level) {
      tags.push(`${career.demand_level} Demand`);
    }

    // Add growth potential as tag
    if (career.growth_rate) {
      const growth = this.inferGrowthPotential(career.growth_rate);
      tags.push(`${growth} Growth`);
    }

    return [...new Set(tags)];
  }

  private inferGrowthPotential(growthRate?: number): string {
    if (!growthRate) return 'medium';
    const rate = Number(growthRate);
    if (rate >= 20) return 'high';
    if (rate >= 10) return 'medium';
    return 'low';
  }

  async calculateMatch(
    quizAnswers: string[],
    userSkills: string[],
    userInterests: string[],
  ): Promise<CareerMatch[]> {
    const careers = await this.getAllCareers();

    // Deterministic scoring engine
    const scoredCareers = careers.map((career) => {
      let score = 0;
      const reasons: string[] = [];

      // Skill match (40%)
      const skillOverlap = this.getArrayOverlap(userSkills, career.required_skills);
      const skillScore = (skillOverlap.length / Math.max(career.required_skills.length, 1)) * 40;
      score += skillScore;
      if (skillOverlap.length > 0) {
        reasons.push(`Skills matched: ${skillOverlap.slice(0, 3).join(', ')}`);
      }

      // Interest match (30%)
      const interestOverlap = this.getArrayOverlap(userInterests, career.preferred_interests);
      const interestScore = (interestOverlap.length / Math.max(career.preferred_interests.length, 1)) * 30;
      score += interestScore;
      if (interestOverlap.length > 0) {
        reasons.push(`Interests aligned: ${interestOverlap.slice(0, 2).join(', ')}`);
      }

      // Quiz-based trait matching (30%)
      const traitScore = this.calculateTraitScoreFromQuiz(quizAnswers, career.typical_traits);
      score += traitScore;
      if (traitScore > 15) {
        reasons.push('Work style matches career profile');
      }

      return {
        career,
        match_score: Math.min(Math.round(score), 100),
        match_reasons: reasons,
        ai_explanation: '', // Will be filled by AI
      };
    });

    // Sort by score, take top 5
    const topMatches = scoredCareers
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)
      .map((match, index) => ({ ...match, ranking: index + 1 }));

    return topMatches;
  }

  private getArrayOverlap(userItems: string[], careerItems: string[]): string[] {
    if (!userItems || !careerItems) return [];
    const userLower = userItems.map((i) => i.toLowerCase().trim());
    const careerLower = careerItems.map((i) => i.toLowerCase().trim());

    return careerLower.filter((careerItem) =>
      userLower.some((userItem) => userItem.includes(careerItem) || careerItem.includes(userItem))
    );
  }

  private calculateTraitScoreFromQuiz(answers: string[], careerTraits: string[]): number {
    const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };

    answers.forEach((answer) => {
      const lower = answer.toLowerCase();
      if (lower.includes('action') || lower.includes('decide') || lower.includes('direct')) {
        colorCounts.red += 1;
      } else if (lower.includes('analyze') || lower.includes('careful') || lower.includes('structure')) {
        colorCounts.blue += 1;
      } else if (lower.includes('team') || lower.includes('align') || lower.includes('collaborate')) {
        colorCounts.green += 1;
      } else if (lower.includes('ideas') || lower.includes('creative') || lower.includes('flexible')) {
        colorCounts.yellow += 1;
      }
    });

    let score = 0;
    const total = answers.length || 1;

    if (careerTraits.some(t => t.toLowerCase().includes('leadership') || t.toLowerCase().includes('decisive'))) {
      score += (colorCounts.red / total) * 30;
    }
    if (careerTraits.some(t => t.toLowerCase().includes('analytical') || t.toLowerCase().includes('detail'))) {
      score += (colorCounts.blue / total) * 30;
    }
    if (careerTraits.some(t => t.toLowerCase().includes('team') || t.toLowerCase().includes('supportive'))) {
      score += (colorCounts.green / total) * 30;
    }
    if (careerTraits.some(t => t.toLowerCase().includes('creative') || t.toLowerCase().includes('innovative'))) {
      score += (colorCounts.yellow / total) * 30;
    }

    return Math.min(score, 30);
  }

  async enhanceMatchesWithAi(
    matches: CareerMatch[],
    quizAnswers: string[],
    cvSkills: string[],
  ): Promise<CareerMatch[]> {
    try {
      // Get DISC/Nova profile from quiz (we'll need to implement this calculation)
      // For now, pass minimal profile
      const novaProfile = {
        behavior: {
          discPercentages: { red: 25, yellow: 25, green: 25, blue: 25 },
        },
      };

      const enhancedMatches = await Promise.all(
        matches.map(async (match, index) => {
          try {
            const explanation = await this.aiOrchestrator.generateCareerExplanation(
              {
                ...match.career,
                title: match.career.title,
                description: match.career.description,
                required_skills: match.career.required_skills,
              },
              quizAnswers,
              cvSkills,
              novaProfile,
            );
            return { ...match, ai_explanation: explanation };
          } catch (error) {
            this.logger.warn(`Failed to generate AI explanation for career ${match.career.id}`, error);
            return {
              ...match,
              ai_explanation: `Strong ${match.match_score}% match based on your skills and preferences.`,
            };
          }
        })
      );

      return enhancedMatches;
    } catch (error) {
      this.logger.error('AI enhancement failed, returning base matches', error);
      return matches;
    }
  }

  async getCareerRecommendations(
    userId: string,
    quizSessionId: string,
    cvAnalysisId?: string,
  ): Promise<CareerMatch[]> {
    try {
      const cacheKey = `career:matches:${userId}:${cvAnalysisId || 'none'}:${quizSessionId}`;
      const cached = await this.cacheService.get<CareerMatch[]>(cacheKey);
      if (cached) return cached;

      // Fetch quiz answers from user_quiz_responses
      const { data: answers, error: answersError } = await this.db.supabase
        .from('user_quiz_responses')
        .select('selected_option')
        .eq('session_id', quizSessionId)
        .order('question_number', { ascending: true });

      if (answersError || !answers) {
        throw new Error('Quiz answers not found');
      }

      const quizAnswers = answers.map(a => a.selected_option);

      // Fetch CV skills if available
      let userSkills: string[] = [];
      let userInterests: string[] = [];

      if (cvAnalysisId) {
        const { data: cvData } = await this.db.supabase
          .from('cv_analysis')
          .select('extracted_skills, extracted_interests')
          .eq('id', cvAnalysisId)
          .single();

        if (cvData) {
          userSkills = Array.isArray(cvData.extracted_skills) ? cvData.extracted_skills : [];
          userInterests = Array.isArray(cvData.extracted_interests) ? cvData.extracted_interests : [];
        }
      }

      // Calculate deterministic matches using your careers table
      const matches = await this.calculateMatch(quizAnswers, userSkills, userInterests);

      // Save to career_match_results (your existing table)
      await this.db.supabase
        .from('career_match_results')
        .upsert(
          matches.map((m, idx) => ({
            user_id: userId,
            quiz_session_id: quizSessionId,
            cv_analysis_id: cvAnalysisId,
            career_id: m.career.id,
            match_score: m.match_score,
            match_reasons: m.match_reasons,
            ai_insights: { explanation: m.ai_explanation }, // temporary, will be replaced
            ranking: idx + 1,
            generated_at: new Date().toISOString(),
          }))
        );

      // Enhance with AI
      const enhancedMatches = await this.enhanceMatchesWithAi(matches, quizAnswers, userSkills);

      // Update career_match_results with AI explanations
      await this.db.supabase
        .from('career_match_results')
        .upsert(
          enhancedMatches.map((m, idx) => ({
            user_id: userId,
            quiz_session_id: quizSessionId,
            cv_analysis_id: cvAnalysisId,
            career_id: m.career.id,
            match_score: m.match_score,
            match_reasons: m.match_reasons,
            ai_insights: { explanation: m.ai_explanation },
            ranking: idx + 1,
            generated_at: new Date().toISOString(),
          }))
        );

      await this.cacheService.set(cacheKey, enhancedMatches, 21600);
      return enhancedMatches;
    } catch (error) {
      this.logger.error('Failed to get career recommendations', error);
      throw error;
    }
  }
}
