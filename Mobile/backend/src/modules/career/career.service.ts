import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { AiOrchestratorService } from "../../core/ai-orchestrator/ai-orchestrator.service";
import { CacheService } from "../../core/cache/cache.service";

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
  match_reasons: any; // JSONB from database
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
    const cacheKey = "careers:all";
    const cached = await this.cacheService.get<Career[]>(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.db.supabase
      .from("careers")
      .select("*")
      .eq("is_active", true)
      .order("title", { ascending: true });

    if (error) {
      this.logger.error("Failed to fetch careers", error);
      return [];
    }

    // Map your existing columns to the Career interface
    const careers: Career[] = (data || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      required_skills: c.required_skills || [],
      preferred_interests: this.inferInterests(c),
      typical_traits: this.inferTraits(c),
      tags: this.buildTags(c),
      salary_range_min:
        c.salary_range_min || Math.round((c.average_salary || 0) * 0.9),
      salary_range_max:
        c.salary_range_max || Math.round((c.average_salary || 0) * 1.1),
      growth_potential:
        c.growth_potential || this.inferGrowthPotential(c.growth_rate),
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
        interests.push("Skilled Work");
      }
    }

    return [...new Set(interests)];
  }

  private inferTraits(career: any): string[] {
    const traits: string[] = [];

    // Map demand_level to traits
    if (career.demand_level) {
      const demand = career.demand_level.toLowerCase();
      if (demand === "high") {
        traits.push("Dynamic", "Fast-paced");
      } else if (demand === "medium") {
        traits.push("Stable", "Balanced");
      } else if (demand === "low") {
        traits.push("Niche", "Specialized");
      }
    }

    // Map growth_rate to traits
    if (career.growth_rate) {
      const rate = Number(career.growth_rate);
      if (rate >= 20) {
        traits.push("Growth-oriented", "Evolving");
      } else if (rate >= 10) {
        traits.push("Steady", "Consistent");
      } else {
        traits.push("Stable", "Mature");
      }
    }

    // Use category for traits
    if (career.category) {
      const cat = career.category.toLowerCase();
      if (cat.includes("tech") || cat.includes("engineering")) {
        traits.push("Analytical", "Technical");
      } else if (cat.includes("management") || cat.includes("business")) {
        traits.push("Strategic", "Leadership");
      } else if (cat.includes("creative") || cat.includes("design")) {
        traits.push("Creative", "Innovative");
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
    if (!growthRate) return "medium";
    const rate = Number(growthRate);
    if (rate >= 20) return "high";
    if (rate >= 10) return "medium";
    return "low";
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
      const skillOverlap = this.getArrayOverlap(
        userSkills,
        career.required_skills,
      );
      const skillScore =
        (skillOverlap.length / Math.max(career.required_skills.length, 1)) * 40;
      score += skillScore;
      if (skillOverlap.length > 0) {
        reasons.push(`Skills matched: ${skillOverlap.slice(0, 3).join(", ")}`);
      }

      // Interest match (30%)
      const interestOverlap = this.getArrayOverlap(
        userInterests,
        career.preferred_interests,
      );
      const interestScore =
        (interestOverlap.length /
          Math.max(career.preferred_interests.length, 1)) *
        30;
      score += interestScore;
      if (interestOverlap.length > 0) {
        reasons.push(
          `Interests aligned: ${interestOverlap.slice(0, 2).join(", ")}`,
        );
      }

      // Quiz-based trait matching (30%)
      const traitScore = this.calculateTraitScoreFromQuiz(
        quizAnswers,
        career.typical_traits,
      );
      score += traitScore;
      if (traitScore > 15) {
        reasons.push("Work style matches career profile");
      }

      return {
        career,
        match_score: Math.min(Math.round(score), 100),
        match_reasons: reasons,
        ai_explanation: "", // Will be filled by AI
      };
    });

    // Sort by score, take top 5
    const topMatches = scoredCareers
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)
      .map((match, index) => ({ ...match, ranking: index + 1 }));

    return topMatches;
  }

  private getArrayOverlap(
    userItems: string[],
    careerItems: string[],
  ): string[] {
    if (!userItems || !careerItems) return [];
    const userLower = userItems.map((i) => i.toLowerCase().trim());
    const careerLower = careerItems.map((i) => i.toLowerCase().trim());

    return careerLower.filter((careerItem) =>
      userLower.some(
        (userItem) =>
          userItem.includes(careerItem) || careerItem.includes(userItem),
      ),
    );
  }

  /**
   * Compute approximate DISC profile from quiz answers (for AI explanation personalization)
   */
  private computeDiscProfile(answers: string[]): {
    red: number;
    yellow: number;
    green: number;
    blue: number;
  } {
    const scores = { red: 0, yellow: 0, green: 0, blue: 0 };

    // Keywords associated with each DISC dimension
    const patterns: Record<string, string[]> = {
      red: [
        "lead",
        "direct",
        "decide",
        "action",
        "fast",
        "competitive",
        "results",
        "challenge",
        "control",
        "risk",
        "dominant",
        "assertive",
      ],
      blue: [
        "analyze",
        "data",
        "detail",
        "precision",
        "structure",
        "process",
        "quality",
        "systematic",
        "accurate",
        "plan",
        "cautious",
        "thorough",
      ],
      green: [
        "team",
        "support",
        "collaborate",
        "help",
        "harmony",
        "stable",
        "trust",
        "relationships",
        "care",
        "empathy",
        "patient",
        "cooperative",
      ],
      yellow: [
        "creative",
        "ideas",
        "innovate",
        "flexible",
        "variety",
        "inspire",
        "experiment",
        "vision",
        "future",
        "possibilities",
        "enthusiastic",
        "spontaneous",
      ],
    };

    answers.forEach((answer) => {
      const lower = answer.toLowerCase();
      Object.entries(patterns).forEach(([color, keywords]) => {
        if (keywords.some((k) => lower.includes(k))) {
          (scores as any)[color] += 1;
        }
      });
    });

    const total = answers.length || 1;
    return {
      red: Math.round((scores.red / total) * 100),
      yellow: Math.round((scores.yellow / total) * 100),
      green: Math.round((scores.green / total) * 100),
      blue: Math.round((scores.blue / total) * 100),
    };
  }

  private calculateTraitScoreFromQuiz(
    answers: string[],
    careerTraits: string[],
  ): number {
    // Enhanced trait mapping with weighted relevance
    const traitWeights: Record<string, number> = {
      // Leadership/Decisive traits
      leadership: 1.0,
      decisive: 1.0,
      strategic: 0.9,
      ambitious: 0.8,
      competitive: 0.7,

      // Analytical/Detail traits
      analytical: 1.0,
      "detail-oriented": 1.0,
      logical: 0.9,
      methodical: 0.8,
      precise: 0.7,
      curious: 0.6,

      // Team/Support traits
      team: 1.0,
      supportive: 1.0,
      empathetic: 0.9,
      collaborative: 0.9,
      caring: 0.8,
      relationship: 0.7,

      // Creative/Innovative traits
      creative: 1.0,
      innovative: 1.0,
      flexible: 0.7,
      adaptive: 0.7,
      experimental: 0.6,
    };

    // Answer patterns mapped to traits (more granular)
    const answerToTraits: Record<string, string[]> = {
      // Independence/Leadership
      independently: ["leadership", "decisive"],
      alone: ["leadership", "decisive"],
      "self-directed": ["leadership", "decisive"],
      lead: ["leadership"],
      direct: ["decisive", "strategic"],
      "fast-paced": ["decisive", "competitive"],
      competitive: ["competitive", "ambitious"],
      results: ["decisive", "strategic"],
      targets: ["decisive", "competitive"],

      // Analytical
      analyzing: ["analytical", "logical"],
      data: ["analytical", "detail-oriented", "curious"],
      research: ["analytical", "curious"],
      structure: ["methodical", "analytical"],
      processes: ["methodical", "analytical"],
      precision: ["detail-oriented", "precise"],
      quality: ["detail-oriented", "precise"],
      accuracy: ["detail-oriented", "precise"],
      complex: ["analytical", "logical"],
      systematic: ["methodical", "analytical"],

      // Team/Support
      team: ["team", "collaborative"],
      collaborate: ["collaborative", "team"],
      support: ["supportive", "empathetic"],
      mentor: ["supportive", "empathetic"],
      care: ["empathetic", "caring"],
      relationships: ["relationship", "empathetic"],
      help: ["supportive", "caring"],
      positive: ["empathetic"],
      culture: ["collaborative"],

      // Creative
      creative: ["creative", "innovative"],
      innovate: ["innovative", "creative"],
      design: ["creative", "innovative"],
      experiment: ["experimental", "flexible"],
      flexible: ["flexible", "adaptive"],
      variety: ["flexible", "adaptive"],
      freedom: ["flexible", "innovative"],
      brainstorm: ["creative", "innovative"],
      "new ideas": ["creative", "innovative"],
    };

    // Build trait score from answers
    const traitScores: Record<string, number> = {};
    const totalAnswers = answers.length || 1;

    answers.forEach((answer) => {
      const lower = answer.toLowerCase();

      // Check for trait keywords
      Object.entries(answerToTraits).forEach(([keyword, traits]) => {
        if (lower.includes(keyword)) {
          traits.forEach((trait) => {
            traitScores[trait] =
              (traitScores[trait] || 0) + (traitWeights[trait] || 0.5);
          });
        }
      });
    });

    // Calculate match score for given career traits
    let score = 0;
    const careerTraitsLower = careerTraits.map((t) => t.toLowerCase());

    careerTraitsLower.forEach((careerTrait) => {
      // Find best matching user trait for this career trait
      let bestMatch = 0;
      Object.entries(traitScores).forEach(([userTrait, userScore]) => {
        if (
          careerTrait.includes(userTrait) ||
          userTrait.includes(careerTrait)
        ) {
          bestMatch = Math.max(bestMatch, userScore);
        }
      });
      score += bestMatch;
    });

    // Normalize: max possible score is number of career traits * max weight per trait (1.0) = careerTraits.length
    const maxPossible = careerTraits.length;
    const normalizedScore = maxPossible > 0 ? (score / maxPossible) * 30 : 0;

    return Math.min(normalizedScore, 30);
  }

  async enhanceMatchesWithAi(
    matches: CareerMatch[],
    quizAnswers: string[],
    cvSkills: string[],
  ): Promise<CareerMatch[]> {
    try {
      this.logger.debug(
        `Enhancing ${matches.length} career matches with AI explanations`,
      );

      // Compute DISC profile from quiz answers for personalization
      const discProfile = this.computeDiscProfile(quizAnswers);
      this.logger.debug(
        `Computed DISC profile: R${discProfile.red} Y${discProfile.yellow} G${discProfile.green} B${discProfile.blue}`,
      );

      const enhancedMatches = await Promise.all(
        matches.map(async (match) => {
          try {
            // Parse match_reasons if it's a JSON string (from database)
            const matchReasons = typeof match.match_reasons === 'string' 
              ? JSON.parse(match.match_reasons) 
              : match.match_reasons;
              
            const explanation =
              await this.aiOrchestrator.generateCareerExplanation(
                {
                  id: match.career.id,
                  title: match.career.title,
                  description: match.career.description,
                  required_skills: match.career.required_skills,
                  match_score: match.match_score,
                  match_reasons: matchReasons,
                },
                quizAnswers,
                cvSkills,
                {
                  behavior: {
                    discPercentages: discProfile,
                  },
                },
              );
            return { ...match, ai_explanation: explanation };
          } catch (error) {
            this.logger.warn(
              `Failed to generate AI explanation for career ${match.career.id}`,
              error,
            );
            return {
              ...match,
              ai_explanation: `Strong ${match.match_score}% match based on your skills and preferences.`,
            };
          }
        }),
      );

       return enhancedMatches;
     } catch (error) {
       this.logger.error('AI enhancement failed, returning base matches', error);
       return matches;
     }
   }

   async getCareerRecommendations(
      }
  }

  async getCareerRecommendations(
    userId: string,
    quizSessionId: string,
    cvAnalysisId?: string,
  ): Promise<CareerMatch[]> {
    const traceId = `rec:${userId}:${quizSessionId.slice(0, 8)}`;
    this.logger.log(`[${traceId}] Starting career recommendation pipeline`);

    try {
      const cacheKey = `career:matches:${userId}:${cvAnalysisId || 'none'}:${quizSessionId}`;
      const cached = await this.cacheService.get<CareerMatch[]>(cacheKey);
      if (cached) {
        this.logger.log(`[${traceId}] Cache hit, returning cached matches`);
        return cached;
      }
      this.logger.log(`[${traceId}] Cache miss, computing fresh matches`);

      // Fetch quiz answers from user_quiz_responses
      this.logger.debug(`[${traceId}] Fetching quiz answers for session ${quizSessionId}`);
      const { data: answers, error: answersError } = await this.db.supabase
        .from('user_quiz_responses')
        .select('selected_option, question_number, question')
        .eq('session_id', quizSessionId)
        .order('question_number', { ascending: true });

      if (answersError || !answers) {
        this.logger.error(`[${traceId}] Failed to fetch quiz answers`, answersError);
        throw new Error('Quiz answers not found');
      }

      const quizAnswers = answers.map(a => a.selected_option);
      this.logger.debug(`[${traceId}] Retrieved ${quizAnswers.length} quiz answers`);

      // Fetch CV skills if available
      let userSkills: string[] = [];
      let userInterests: string[] = [];

      if (cvAnalysisId) {
        this.logger.debug(`[${traceId}] Fetching CV analysis data for ${cvAnalysisId}`);
        const { data: cvData, error: cvError } = await this.db.supabase
          .from('cv_analysis')
          .select('extracted_skills, extracted_interests')
          .eq('id', cvAnalysisId)
          .single();

        if (cvError) {
          this.logger.warn(`[${traceId}] CV analysis not found`, cvError);
        } else if (cvData) {
          // Handle JSONB arrays properly - they come as arrays from PostgreSQL
          userSkills = Array.isArray(cvData.extracted_skills) ? cvData.extracted_skills : [];
          userInterests = Array.isArray(cvData.extracted_interests) ? cvData.extracted_interests : [];
          this.logger.debug(`[${traceId}] CV skills: ${userSkills.length}, interests: ${userInterests.length}`);
        }
      } else {
        this.logger.debug(`[${traceId}] No CV analysis provided`);
      }

      // Calculate deterministic matches using your careers table
      this.logger.debug(`[${traceId}] Calculating deterministic matches`);
      const matches = await this.calculateMatch(quizAnswers, userSkills, userInterests);
      this.logger.log(`[${traceId}] Computed ${matches.length} matches: ${matches.map(m => `${m.career.title}(${m.match_score}%)`).join(', ')}`);

      // Save preliminary results (without AI explanations) to career_match_results
      try {
        this.logger.debug(`[${traceId}] Saving preliminary match results`);
        const preliminaryData = matches.map((m, idx) => ({
          user_id: userId,
          quiz_session_id: quizSessionId,
          cv_analysis_id: cvAnalysisId,
          career_id: m.career.id,
          match_score: m.match_score,
          match_reasons: m.match_reasons, // Already JSON array, no conversion needed
          ai_insights: { explanation: null, status: 'pending' },
          ranking: idx + 1,
          generated_at: new Date().toISOString(),
        }));

        await this.db.supabase
          .from('career_match_results')
          .upsert(preliminaryData, { onConflict: 'user_id,quiz_session_id,career_id' });
        this.logger.debug(`[${traceId}] Preliminary results saved`);
      } catch (dbError) {
        this.logger.error(`[${traceId}] Failed to save preliminary results`, dbError);
        // Continue anyway - we'll still return matches even if DB fails
      }

      // Enhance with AI (explanations only)
      this.logger.debug(`[${traceId}] Generating AI explanations`);
      const enhancedMatches = await this.enhanceMatchesWithAi(matches, quizAnswers, userSkills);

      // Update career_match_results with AI explanations
      try {
        this.logger.debug(`[${traceId}] Saving final results with AI explanations`);
        await this.db.supabase
          .from('career_match_results')
          .upsert(
            enhancedMatches.map((m, idx) => ({
              user_id: userId,
              quiz_session_id: quizSessionId,
              cv_analysis_id: cvAnalysisId,
              career_id: m.career.id,
              match_score: m.match_score,
              match_reasons: m.match_reasons, // Already JSON array, no conversion needed
              ai_insights: { explanation: m.ai_explanation, status: 'completed' },
              ranking: idx + 1,
              generated_at: new Date().toISOString(),
            })),
            { onConflict: 'user_id,quiz_session_id,career_id' }
          );
        this.logger.debug(`[${traceId}] Final results saved`);
      } catch (dbError) {
        this.logger.error(`[${traceId}] Failed to save final results`, dbError);
      }

      // Enhance with AI (explanations only)
      this.logger.debug(`[${traceId}] Generating AI explanations`);
      const enhancedMatches = await this.enhanceMatchesWithAi(matches, quizAnswers, userSkills);

      // Update career_match_results with AI explanations
      try {
        this.logger.debug(`[${traceId}] Saving final results with AI explanations`);
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
              ai_insights: { explanation: m.ai_explanation, status: 'completed' },
              ranking: idx + 1,
              generated_at: new Date().toISOString(),
            })),
            { onConflict: 'user_id,quiz_session_id,career_id' }
          );
        this.logger.debug(`[${traceId}] Final results saved`);
      } catch (dbError) {
        this.logger.error(`[${traceId}] Failed to save final results`, dbError);
      }

      await this.cacheService.set(cacheKey, enhancedMatches, 21600);
      this.logger.log(`[${traceId}] Pipeline completed successfully`);
      return enhancedMatches;
    } catch (error) {
      this.logger.error(`[${traceId}] Pipeline failed`, error);
      throw error;
    }
  }
      this.logger.log(`[${traceId}] Cache miss, computing fresh matches`);

      // Fetch quiz answers from user_quiz_responses
      this.logger.debug(
        `[${traceId}] Fetching quiz answers for session ${quizSessionId}`,
      );
      const { data: answers, error: answersError } = await this.db.supabase
        .from("user_quiz_responses")
        .select("selected_option, question_number, question")
        .eq("session_id", quizSessionId)
        .order("question_number", { ascending: true });

      if (answersError || !answers) {
        this.logger.error(
          `[${traceId}] Failed to fetch quiz answers`,
          answersError,
        );
        throw new Error("Quiz answers not found");
      }

      const quizAnswers = answers.map((a) => a.selected_option);
      this.logger.debug(
        `[${traceId}] Retrieved ${quizAnswers.length} quiz answers`,
      );

      // Fetch CV skills if available
      let userSkills: string[] = [];
      let userInterests: string[] = [];

      if (cvAnalysisId) {
        this.logger.debug(
          `[${traceId}] Fetching CV analysis data for ${cvAnalysisId}`,
        );
        const { data: cvData, error: cvError } = await this.db.supabase
          .from("cv_analysis")
          .select("extracted_skills, extracted_interests")
          .eq("id", cvAnalysisId)
          .single();

        if (cvError) {
          this.logger.warn(`[${traceId}] CV analysis not found`, cvError);
        } else if (cvData) {
          userSkills = Array.isArray(cvData.extracted_skills)
            ? cvData.extracted_skills
            : [];
          userInterests = Array.isArray(cvData.extracted_interests)
            ? cvData.extracted_interests
            : [];
          this.logger.debug(
            `[${traceId}] CV skills: ${userSkills.length}, interests: ${userInterests.length}`,
          );
        }
      } else {
        this.logger.debug(`[${traceId}] No CV analysis provided`);
      }

      // Calculate deterministic matches using your careers table
      this.logger.debug(`[${traceId}] Calculating deterministic matches`);
      const matches = await this.calculateMatch(
        quizAnswers,
        userSkills,
        userInterests,
      );
      this.logger.log(
        `[${traceId}] Computed ${matches.length} matches: ${matches.map((m) => `${m.career.title}(${m.match_score}%)`).join(", ")}`,
      );

      // Save preliminary results (without AI explanations) to career_match_results
      try {
        this.logger.debug(`[${traceId}] Saving preliminary match results`);
        const preliminaryData = matches.map((m, idx) => ({
          user_id: userId,
          quiz_session_id: quizSessionId,
          cv_analysis_id: cvAnalysisId,
          career_id: m.career.id,
          match_score: m.match_score,
          match_reasons: m.match_reasons,
          ai_insights: { explanation: null, status: "pending" },
          ranking: idx + 1,
          generated_at: new Date().toISOString(),
        }));

        await this.db.supabase
          .from("career_match_results")
          .upsert(preliminaryData, {
            onConflict: "user_id,quiz_session_id,career_id",
          });
        this.logger.debug(`[${traceId}] Preliminary results saved`);
      } catch (dbError) {
        this.logger.error(
          `[${traceId}] Failed to save preliminary results`,
          dbError,
        );
        // Continue anyway - we'll still return matches even if DB fails
      }

      // Enhance with AI (explanations only)
      this.logger.debug(`[${traceId}] Generating AI explanations`);
      const enhancedMatches = await this.enhanceMatchesWithAi(
        matches,
        quizAnswers,
        userSkills,
      );

      // Update career_match_results with AI explanations
      try {
        this.logger.debug(
          `[${traceId}] Saving final results with AI explanations`,
        );
        await this.db.supabase.from("career_match_results").upsert(
          enhancedMatches.map((m, idx) => ({
            user_id: userId,
            quiz_session_id: quizSessionId,
            cv_analysis_id: cvAnalysisId,
            career_id: m.career.id,
            match_score: m.match_score,
            match_reasons: m.match_reasons,
            ai_insights: { explanation: m.ai_explanation, status: "completed" },
            ranking: idx + 1,
            generated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,quiz_session_id,career_id" },
        );
        this.logger.debug(`[${traceId}] Final results saved`);
      } catch (dbError) {
        this.logger.error(`[${traceId}] Failed to save final results`, dbError);
      }

      await this.cacheService.set(cacheKey, enhancedMatches, 21600);
      this.logger.log(`[${traceId}] Pipeline completed successfully`);
      return enhancedMatches;
    } catch (error) {
      this.logger.error(`[${traceId}] Pipeline failed`, error);
      throw error;
    }
  }

  private computeDiscProfile(answers: string[]): {
    red: number;
    yellow: number;
    green: number;
    blue: number;
  } {
    const scores = { red: 0, yellow: 0, green: 0, blue: 0 };

    const patterns: Record<string, string[]> = {
      red: [
        "lead",
        "direct",
        "decide",
        "action",
        "fast",
        "competitive",
        "results",
        "challenge",
        "control",
        "risk",
        "dominant",
        "assertive",
      ],
      blue: [
        "analyze",
        "data",
        "detail",
        "precision",
        "structure",
        "process",
        "quality",
        "systematic",
        "accurate",
        "plan",
        "cautious",
        "thorough",
      ],
      green: [
        "team",
        "support",
        "collaborate",
        "help",
        "harmony",
        "stable",
        "trust",
        "relationships",
        "care",
        "empathy",
        "patient",
        "cooperative",
      ],
      yellow: [
        "creative",
        "ideas",
        "innovate",
        "flexible",
        "variety",
        "inspire",
        "experiment",
        "vision",
        "future",
        "possibilities",
        "enthusiastic",
        "spontaneous",
      ],
    };

    answers.forEach((answer) => {
      const lower = answer.toLowerCase();
      Object.entries(patterns).forEach(([color, keywords]) => {
        if (keywords.some((k) => lower.includes(k))) {
          (scores as any)[color] += 1;
        }
      });
    });

    const total = answers.length || 1;
    return {
      red: Math.round((scores.red / total) * 100),
      yellow: Math.round((scores.yellow / total) * 100),
      green: Math.round((scores.green / total) * 100),
      blue: Math.round((scores.blue / total) * 100),
    };
  }
}
