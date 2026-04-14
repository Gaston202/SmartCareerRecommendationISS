import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { PromptRegistry } from "./prompt.registry";
import { OpenRouterService } from "./providers/openrouter.service";
import { z } from "zod";

const ExplanationSchema = z.string();

const GeneratedCareerSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(10),
  category: z.string().optional(),
  required_skills: z.array(z.string()).optional(),
  preferred_interests: z.array(z.string()).optional(),
  typical_traits: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  growth_potential: z.string().optional(),
  salary_range_min: z.number().optional(),
  salary_range_max: z.number().optional(),
});

const GeneratedCareersSchema = z.object({
  careers: z.array(GeneratedCareerSchema).min(3).max(8),
});

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private readonly MODELS = {
    quiz: ["arcee-ai/trinity-large-preview:free"],
    cv: ["arcee-ai/trinity-large-preview:free"],
    roadmap: ["arcee-ai/trinity-large-preview:free"],
    explanation: ["arcee-ai/trinity-large-preview:free"],
  };

  constructor(
    private promptRegistry: PromptRegistry,
    private openRouter: OpenRouterService,
    private cacheService: CacheService,
  ) {}

  async generateCareerExplanation(
    career: {
      id: string;
      title: string;
      description: string;
      required_skills: string[];
      match_score?: number;
      match_reasons?: string[];
    },
    quizAnswers: string[],
    cvSkills: string[],
    novaProfile?: any,
  ): Promise<string> {
    const cacheKey = `career:explanation:${career.id}:${Buffer.from(quizAnswers.join(",") + cvSkills.join(",")).toString("base64")}`;

    const cached = await this.cacheService.get<string>(cacheKey);
    if (cached) return cached;

    try {
      // Build detailed context from match data for personalized explanation
      const matchContext =
        career.match_score !== undefined
          ? `Match Strength: ${career.match_score}% compatible`
          : "Potential match based on profile";

      const reasonsContext =
        career.match_reasons && career.match_reasons.length > 0
          ? `Key matching factors: ${career.match_reasons.join("; ")}`
          : "";

      // Generate a natural language explanation for why this career matches
      const prompt = `Write a concise, personalized explanation (2-3 sentences, ~100-150 characters) of why this career is a good match for this user.

Career: ${career.title}
Description: ${career.description}
Required Skills: ${career.required_skills?.join(", ") || "N/A"}

User Profile:
- Quiz highlights: ${quizAnswers.slice(0, 3).join("; ")}...
- Confirmed Skills: ${cvSkills?.join(", ") || "Not provided"}
${novaProfile?.behavior?.discPercentages ? `- DISC Profile: R${novaProfile.behavior.discPercentages.red} Y${novaProfile.behavior.discPercentages.yellow} G${novaProfile.behavior.discPercentages.green} B${novaProfile.behavior.discPercentages.blue}` : ""}
${matchContext}
${reasonsContext}

Write an encouraging, specific explanation that references at least one skill or trait from the user's profile. Start with "Based on your profile..." or similar. Be concrete, not generic.`;

      const response = await this.openRouter.chatWithRetry(
        this.MODELS.explanation,
        [{ role: "user", content: prompt }],
        0.6,
        400,
      );

      const content = response.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new BadRequestException("Empty explanation from AI");
      }

      // Validate it's a string
      const explanation = ExplanationSchema.parse(content);

      await this.cacheService.set(cacheKey, explanation, 86400);
      this.logger.debug(
        `Generated AI explanation for ${career.title}: ${explanation.substring(0, 80)}...`,
      );
      return explanation;
    } catch (error) {
      this.logger.warn(
        `Failed to generate career explanation for ${career.title}, using fallback`,
        error,
      );
      // Fallback: generate a decent explanation from deterministic data
      const topSkill =
        cvSkills.length > 0
          ? cvSkills[0]
          : career.required_skills[0] || "your background";
      const topReason =
        career.match_reasons?.[0]?.replace(/^Skills matched: /, "") || "";
      return `Great ${career.match_score || "match"}% fit! Your ${topSkill} skill${topReason ? ` and ${topReason}` : ""} align well with this role.`;
    }
  }

  async generateCareersFromProfile(
    profile: {
      quizAnswers: string[];
      skills: string[];
      interests: string[];
      traits: string[];
      disc: { red: number; yellow: number; green: number; blue: number };
      novaProfile?: any;
      candidateCareers?: Array<{
        id: string;
        title: string;
        description: string;
        category?: string;
        required_skills?: string[];
        tags?: string[];
      }>;
      userProfileDetails?: {
        educationLevel?: string;
        fieldOfStudy?: string;
        careerGoal?: string;
        bio?: string;
        declaredSkills?: string[];
      };
    },
    cacheTtl: number = 21600,
  ): Promise<
    Array<{
      title: string;
      description: string;
      category: string;
      required_skills: string[];
      preferred_interests: string[];
      typical_traits: string[];
      tags: string[];
      growth_potential: string;
      salary_range_min?: number;
      salary_range_max?: number;
    }>
  > {
    const hashSeed = JSON.stringify({
      q: profile.quizAnswers.slice(0, 10),
      s: profile.skills.slice(0, 20),
      i: profile.interests.slice(0, 20),
      t: profile.traits.slice(0, 20),
      d: profile.disc,
      n: profile.novaProfile || null,
      c: (profile.candidateCareers || []).map((x) => x.id),
      u: profile.userProfileDetails || null,
    });
    const cacheKey = `career:generated:${Buffer.from(hashSeed).toString("base64")}`;

    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const prompt = `You are a career intelligence AI.

  Based on this user profile, generate 5 realistic career suggestions.

  WEIGHTING RULES (MUST FOLLOW):
  - CV + extracted skills + demonstrated interests: 60% of decision weight
  - User profile details (education level, field of study, career goal, bio, declared skills): 25% of decision weight
  - Full Nova report (behavior, cognition, motivation, projection): 15% of decision weight
  - If inputs conflict, prioritize CV/skills first, then profile details, then Nova style adjustments

PROFILE:
- Quiz answers: ${profile.quizAnswers.join(" | ")}
- Skills: ${profile.skills.join(", ") || "none"}
- Interests: ${profile.interests.join(", ") || "none"}
- Traits: ${profile.traits.join(", ") || "none"}
- DISC: red=${profile.disc.red}, yellow=${profile.disc.yellow}, green=${profile.disc.green}, blue=${profile.disc.blue}
- User profile details: ${profile.userProfileDetails ? JSON.stringify(profile.userProfileDetails) : "not available"}
  - Full Nova report JSON: ${profile.novaProfile ? JSON.stringify(profile.novaProfile) : "not available"}

CANDIDATE CAREERS FROM DATABASE (you MUST select from these only):
${JSON.stringify(
      (profile.candidateCareers || []).map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        required_skills: c.required_skills || [],
        tags: c.tags || [],
      })),
    )}

Return ONLY valid JSON in this exact shape:
{
  "careers": [
    {
      "title": "string",
      "description": "string",
      "category": "Technology|Business|Design|Data|Marketing|Operations|Education|Healthcare|General",
      "required_skills": ["string"],
      "preferred_interests": ["string"],
      "typical_traits": ["string"],
      "tags": ["string"],
      "growth_potential": "high|medium|low",
      "salary_range_min": number,
      "salary_range_max": number
    }
  ]
}

Rules:
- 5 careers exactly
- Every career title MUST be chosen from the candidate careers list above
- Avoid duplicates or near-duplicates
- Keep descriptions concise (1-2 sentences)
- Skills/interests/traits/tags should each have 3-6 items
- salary_range_min <= salary_range_max
- Use globally understandable career titles
- Ensure each career is realistically reachable based on listed skills (do not suggest unrelated senior-only paths)
- Ensure recommendations align with career_goal and education/field where possible (unless CV evidence strongly suggests better fit)`;

    try {
      const response = await this.openRouter.chatWithRetry(
        this.MODELS.explanation,
        [{ role: "user", content: prompt }],
        0.55,
        1800,
      );

      const content = response.choices[0]?.message?.content?.trim() || "";
      const jsonStr = this.extractJson(content);
      const parsed = JSON.parse(jsonStr);
      const validated = GeneratedCareersSchema.parse(parsed);

      const normalized = validated.careers.slice(0, 5).map((c) => ({
        title: c.title.trim(),
        description: c.description.trim(),
        category: (c.category || "General").trim(),
        required_skills: Array.isArray(c.required_skills)
          ? c.required_skills.filter(Boolean).slice(0, 8)
          : [],
        preferred_interests: Array.isArray(c.preferred_interests)
          ? c.preferred_interests.filter(Boolean).slice(0, 8)
          : [],
        typical_traits: Array.isArray(c.typical_traits)
          ? c.typical_traits.filter(Boolean).slice(0, 8)
          : [],
        tags: Array.isArray(c.tags) ? c.tags.filter(Boolean).slice(0, 8) : [],
        growth_potential: ["high", "medium", "low"].includes(c.growth_potential || "")
          ? (c.growth_potential as string)
          : "medium",
        salary_range_min:
          typeof c.salary_range_min === "number" ? Math.max(0, c.salary_range_min) : undefined,
        salary_range_max:
          typeof c.salary_range_max === "number" ? Math.max(0, c.salary_range_max) : undefined,
      }));

      await this.cacheService.set(cacheKey, normalized, cacheTtl);
      return normalized;
    } catch (error) {
      this.logger.warn("Failed to generate careers from profile, using fallback list", error);

      const fallback = (profile.candidateCareers || []).slice(0, 5).map((c) => ({
        title: c.title,
        description: c.description,
        category: c.category || "General",
        required_skills: c.required_skills || [],
        preferred_interests: [],
        typical_traits: [],
        tags: c.tags || [],
        growth_potential: "medium",
        salary_range_min: undefined,
        salary_range_max: undefined,
      }));

      return fallback;
    }
  }

  // Keep previous methods (generateQuizNext, generateQuizResults, analyzeCv, generateCvSuggestions, personalizeRoadmap)
  // ... (copy the previous implementations)

  async generateQuizNext(
    answers: string[],
    questionNumber: number,
    previousQuestions: string[] = [],
    cacheTtl: number = 3600,
  ): Promise<any> {
    this.logger.log(
      `\n[Quiz] ========== GENERATING Q${questionNumber} ==========`,
    );
    this.logger.log(`[Quiz] Previous answers: ${JSON.stringify(answers)}`);

    // Use versioned cache key to avoid stale cached questions
    const cacheKey = `quiz:next:v9:${Buffer.from(answers.join(",")).toString("base64")}:${questionNumber}`;
    this.logger.log(`[Quiz] Cache bypass enabled for Q${questionNumber}; generating fresh AI question`);

    this.logger.log(`[Quiz] 🔄 Calling AI for Q${questionNumber} (cache miss)`);
    let result = await this.tryGenerateQuizQuestionFromAi(
      answers,
      questionNumber,
      previousQuestions,
    );

    if (!result) {
      this.logger.warn(
        `[Quiz] AI generation attempts failed for Q${questionNumber}. Falling back to static question as last resort.`,
      );
      result = this.getFallbackQuestion(questionNumber);
    }

    if (this.cacheService && cacheTtl > 0) {
      await this.cacheService.set(cacheKey, result, cacheTtl);
      this.logger.log(`[Quiz] Cached result with key prefix: quiz:next:v9`);
    }

    this.logger.log(`[Quiz] ✅ FINAL QUESTION: "${result.question}"`);
    this.logger.log(`[Quiz] ========== END Q${questionNumber} ==========\n`);
    return result;
  }

  private async tryGenerateQuizQuestionFromAi(
    answers: string[],
    questionNumber: number,
    previousQuestions: string[],
  ): Promise<any | null> {
    const maxAttempts = 3;
    let localPreviousQuestions = [...previousQuestions];
    const requiredDimension = this.getRequiredDimensionForQuestion(questionNumber);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const prompt = this.promptRegistry.compile("quiz-question", {
        answers,
        questionNumber,
        requiredDimension,
        previousQuestions: localPreviousQuestions,
      });
      this.logger.debug(
        `[Quiz] Prompt snippet (attempt ${attempt}): ${prompt.substring(0, 400)}...`,
      );

      try {
        const response = await this.openRouter.chatWithRetry(
          this.MODELS.quiz,
          [{ role: "user", content: prompt }],
          0.75,
          600,
        );

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
          this.logger.warn(`[Quiz] Empty AI response on attempt ${attempt}`);
          continue;
        }

        this.logger.debug(
          `[Quiz] AI raw output (attempt ${attempt}): ${content.substring(0, 300)}...`,
        );

        const jsonStr = this.extractJson(content);
        let parsed = JSON.parse(jsonStr);
        parsed = this.validateAndSanitizeQuestion(parsed, questionNumber);

        if (this.isQuestionTooSimilar(parsed.question, previousQuestions)) {
          this.logger.warn(
            `[Quiz] Attempt ${attempt} produced repeated/similar question. Retrying AI generation.`,
          );
          localPreviousQuestions.push(parsed.question);
          continue;
        }
        if (!this.isQuestionAlignedWithRequiredDimension(parsed.question, questionNumber)) {
          this.logger.warn(
            `[Quiz] Attempt ${attempt} not aligned to required dimension "${requiredDimension}". Retrying.`,
          );
          localPreviousQuestions.push(parsed.question);
          continue;
        }

        return parsed;
      } catch (error) {
        this.logger.warn(
          `[Quiz] AI generation attempt ${attempt} failed for Q${questionNumber}`,
          error,
        );
      }
    }

    return null;
  }

  private getRequiredDimensionForQuestion(questionNumber: number): string {
    const map: Record<number, string> = {
      1: "Core motivation drivers",
      2: "Communication style preference",
      3: "Decision-making style",
      4: "Learning and development preference",
      5: "Work values priority",
      6: "Team/leadership dynamic preference",
      7: "Natural style under normal conditions",
      8: "Adapted style in formal environments",
      9: "Cognitive approach to ambiguity",
      10: "Preferred feedback and growth style",
    };
    return map[questionNumber] || "Work preference dimension";
  }

  private isQuestionAlignedWithRequiredDimension(
    questionText: string,
    questionNumber: number,
  ): boolean {
    const text = (questionText || "").toLowerCase();
    const dimensionKeywords: Record<number, string[]> = {
      1: ["motivat", "energ", "drive", "inspires", "most important"],
      2: ["communicat", "discuss", "express", "conversation", "interact"],
      3: ["decide", "decision", "choose", "prioritize", "judgment"],
      4: ["learn", "development", "grow", "improve", "coaching"],
      5: ["value", "important", "non-negotiable", "principle", "matters most"],
      6: ["team", "lead", "collabor", "role", "support"],
      7: ["natural", "default", "normally", "typically", "usual style"],
      8: ["formal", "adapt", "expectation", "professional setting", "structured environment"],
      9: ["uncertain", "ambigu", "unknown", "complex", "incomplete information"],
      10: ["feedback", "review", "growth", "improve", "development feedback"],
    };
    const kws = dimensionKeywords[questionNumber] || [];
    return kws.some((kw) => text.includes(kw));
  }

  private isQuestionTooSimilar(
    questionText: string,
    previousQuestions: string[] = [],
  ): boolean {
    if (!questionText || previousQuestions.length === 0) return false;

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const stopWords = new Set([
      "what",
      "which",
      "who",
      "where",
      "when",
      "why",
      "how",
      "is",
      "are",
      "do",
      "does",
      "you",
      "your",
      "most",
      "kind",
      "type",
      "work",
      "job",
      "at",
      "in",
      "of",
      "to",
      "the",
      "a",
      "an",
      "or",
      "and",
    ]);

    const tokenSet = (s: string) =>
      new Set(
        normalize(s)
          .split(" ")
          .filter((w) => w.length > 2 && !stopWords.has(w)),
      );

    const currentNorm = normalize(questionText);
    const currentTokens = tokenSet(questionText);

    return previousQuestions.some((q) => {
      const prevNorm = normalize(q);
      if (!prevNorm) return false;

      if (prevNorm === currentNorm) return true;

      const prevTokens = tokenSet(q);
      if (prevTokens.size === 0 || currentTokens.size === 0) return false;

      let intersection = 0;
      for (const t of currentTokens) {
        if (prevTokens.has(t)) intersection += 1;
      }

      const similarity = intersection / Math.max(currentTokens.size, prevTokens.size);
      return similarity >= 0.6;
    });
  }

  private isValidPreferenceQuestion(
    question: any,
    questionNumber: number,
  ): boolean {
    if (!question || question.type !== "question") return false;
    if (question.questionNumber !== questionNumber) return false;
    if (!question.question || typeof question.question !== "string")
      return false;
    if (!Array.isArray(question.options) || question.options.length !== 4)
      return false;

    // Check for off-topic keywords in the question text
    const questionLower = question.question.toLowerCase();
    const offTopicKeywords = [
      "resume",
      "cv",
      "cover letter",
      "interview",
      "experience",
      "education",
      "stress",
      "pressure",
      "conflict",
      "weakness",
      "strength",
      "past",
      "previous job",
      "childhood",
      "family",
      "salary",
      "expectation",
      "greatest",
      "challenge",
      "describe",
      "tell me about",
      "application",
      "job hunting",
      "career history",
      "training",
      "certification",
      "degree",
      "university",
      "college",
      "school",
      "previous role",
      "last position",
      "why should we hire",
      "what is your",
      "purpose of a",
    ];

    const isInterviewStyle =
      /what is (the|your)|describe|tell me about|how do you handle/i.test(
        question.question,
      );
    const hasOffTopicWord = offTopicKeywords.some((keyword) =>
      questionLower.includes(keyword),
    );

    if (isInterviewStyle || hasOffTopicWord) {
      this.logger.debug(
        `Cached question failed off-topic check: "${question.question}"`,
      );
      return false;
    }

    // Check all options have valid ids and icons
    const validIcons = [
      "brush",
      "people",
      "globe",
      "business",
      "ribbon",
      "flash",
      "trophy",
      "construct",
      "target",
      "handshake",
      "analytics",
      "code",
    ];
    for (const opt of question.options) {
      if (!opt.id || !["red", "blue", "green", "yellow"].includes(opt.id))
        return false;
      if (!opt.icon || !validIcons.includes(opt.icon)) return false;
    }

    return true;
  }

  private validateAndSanitizeQuestion(
    result: any,
    questionNumber: number,
  ): any {
    this.logger.debug(
      `[Quiz] Validating Q${questionNumber}: ${JSON.stringify(result).substring(0, 200)}`,
    );

    // Force required fields
    result.type = "question";
    result.questionNumber = questionNumber;
    result.totalQuestions = 10;
    result.question = this.stripEmbeddedOptionsFromQuestion(result.question);

    if (
      !result.question ||
      typeof result.question !== "string" ||
      result.question.trim().length === 0
    ) {
      this.logger.warn(
        `[Quiz] ❌ Missing question text for Q${questionNumber}, using fallback`,
      );
      return this.getFallbackQuestion(questionNumber);
    }

    // AGGRESSIVE off-topic detection - reject ANY question not about work preferences
    const questionLower = result.question.toLowerCase();
    const offTopicKeywords = [
      "resume",
      "cv",
      "cover letter",
      "interview",
      "experience",
      "education",
      "stress",
      "pressure",
      "conflict",
      "weakness",
      "strength",
      "past",
      "previous job",
      "childhood",
      "family",
      "salary",
      "expectation",
      "greatest",
      "challenge",
      "describe",
      "tell me about",
      "application",
      "job hunting",
      "career history",
      "training",
      "certification",
      "degree",
      "university",
      "college",
      "school",
      "previous role",
      "last position",
      "why should we hire",
      "what is your",
      "purpose of a",
      "cover letter",
      "portfolio",
      "references",
      "recommendation",
      "relocation",
      "visa",
      "gap in employment",
      "greatest accomplishment",
      "proudest moment",
      "handle conflict",
      "difficult situation",
      "why do you want to work",
    ];

    const isInterviewStyle =
      /what is (the|your)|describe\s+.*|tell me about|how do you (handle|deal|manage)|what would you do if|why should|what are your .*weakness|what is your .*salary|describe a time when/i.test(
        result.question,
      );
    const hasOffTopicWord = offTopicKeywords.some((keyword) =>
      questionLower.includes(keyword),
    );

    if (isInterviewStyle || hasOffTopicWord) {
      this.logger.warn(
        `[Quiz] ❌ REJECTED off-topic question: "${result.question}"`,
      );
      console.warn(
        `[Quiz] ⚠️ AI tried to generate off-topic question (resume/interview/etc). Replacing with fallback.`,
      );
      return this.getFallbackQuestion(questionNumber);
    }

    // Validate options exist and are correct
    if (!Array.isArray(result.options) || result.options.length !== 4) {
      this.logger.warn(
        `[Quiz] ❌ Invalid options count (${result.options?.length}), using fallback`,
      );
      return this.getFallbackQuestion(questionNumber);
    }

    const validIcons = [
      "brush",
      "people",
      "globe",
      "business",
      "ribbon",
      "flash",
      "trophy",
      "construct",
      "target",
      "handshake",
      "analytics",
      "code",
    ];
    const colorDefaultIcons: Record<"red" | "blue" | "green" | "yellow", string> = {
      red: "target",
      blue: "analytics",
      green: "people",
      yellow: "brush",
    };
    const seenOptionLabels = new Set<string>();
    for (const opt of result.options) {
      if (!opt.id || !["red", "blue", "green", "yellow"].includes(opt.id)) {
        this.logger.warn(
          `[Quiz] ❌ Invalid option id: ${opt.id}, using fallback`,
        );
        return this.getFallbackQuestion(questionNumber);
      }
      if (!opt.label) {
        opt.label = "Option";
      }
      opt.label = String(opt.label).replace(/\s+/g, " ").trim();
      const normalizedLabel = opt.label.toLowerCase();
      if (seenOptionLabels.has(normalizedLabel)) {
        this.logger.warn(
          `[Quiz] ❌ Duplicate option labels detected for Q${questionNumber}, using fallback`,
        );
        return this.getFallbackQuestion(questionNumber);
      }
      seenOptionLabels.add(normalizedLabel);
      if (!opt.icon || !validIcons.includes(opt.icon)) {
        const fallbackIcon = colorDefaultIcons[opt.id as "red" | "blue" | "green" | "yellow"];
        this.logger.warn(
          `[Quiz] Invalid icon "${opt.icon}" for ${opt.id}; replacing with "${fallbackIcon}"`,
        );
        opt.icon = fallbackIcon;
      }
    }

    this.logger.log(
      `[Quiz] ✅ Validated preference question: "${result.question.substring(0, 60)}..."`,
    );
    return result;
  }

  private stripEmbeddedOptionsFromQuestion(question: unknown): string {
    if (typeof question !== "string") return "";

    let cleaned = question.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return "";

    // Remove anything after explicit answer list markers.
    const splitPatterns: RegExp[] = [
      /\s(?:options?|choices?)\s*:\s*/i,
      /\s[A-D]\)\s+/,
      /\s[A-D]\.\s+/,
      /\s\d\)\s+/,
      /\s\d\.\s+/,
      /\s[-*]\s+/,
    ];

    for (const pattern of splitPatterns) {
      const match = cleaned.match(pattern);
      if (match && match.index !== undefined && match.index > 0) {
        cleaned = cleaned.slice(0, match.index).trim();
        break;
      }
    }

    // Keep up to the first question mark when present.
    const qIndex = cleaned.indexOf("?");
    if (qIndex >= 0) {
      cleaned = cleaned.slice(0, qIndex + 1).trim();
    }

    return cleaned.replace(/\s+/g, " ").trim();
  }

  async generateQuizResults(
    answers: string[],
    cacheTtl: number = 86400,
  ): Promise<any> {
    const cacheKey = `quiz:results:${Buffer.from(answers.join(",")).toString("base64")}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const prompt = this.promptRegistry.compile("quiz-results", { answers });
      const response = await this.openRouter.chatWithRetry(
        this.MODELS.quiz,
        [{ role: "user", content: prompt }],
        0.6,
        4000,
      );

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new BadRequestException("Empty response from AI");
      }

      let result;
      try {
        const jsonStr = this.extractJson(content);
        result = JSON.parse(jsonStr);
        this.validateQuizResults(result);
      } catch (parseError) {
        this.logger.warn("Failed to parse quiz results, using fallback", {
          parseError:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
          contentPreview: content.substring(0, 200),
          contentLength: content.length,
        });
        result = this.getFallbackResults();
      }

      // Additional validation: ensure novaProfile structure is complete
      if (result.type === "results") {
        // Validate careers array
        if (!Array.isArray(result.careers) || result.careers.length < 3) {
          this.logger.warn("Invalid or missing careers array, using fallback");
          result = this.getFallbackResults();
        } else {
          // Sanitize each career
          result.careers = result.careers.map((c: any) => ({
            title: c.title || "Unknown Career",
            description: c.description || "",
            matchPercent:
              typeof c.matchPercent === "number"
                ? Math.max(75, Math.min(98, c.matchPercent))
                : 80,
            tags: Array.isArray(c.tags) ? c.tags.slice(0, 4) : ["Career"],
          }));
        }

        const np = result.novaProfile;
        if (!np) {
          this.logger.warn("Missing novaProfile, using fallback");
          result = this.getFallbackResults();
        } else {
          // Ensure behavior structure
          if (!np.behavior || !np.behavior.primaryStyle) {
            np.behavior = {
              primaryStyle: "Balanced",
              traits: ["Adaptable"],
              discBlend: "R25 / Y25 / G25 / B25",
              discPercentages: { red: 25, yellow: 25, green: 25, blue: 25 },
            };
          } else {
            if (!Array.isArray(np.behavior.traits)) np.behavior.traits = [];
          }
          // Ensure styleComparison exists and arrays
          if (!np.styleComparison) {
            np.styleComparison = {
              naturalStyleSummary: "",
              adaptedStyleSummary: "",
              adaptationDrivers: [],
              stressSignals: [],
            };
          } else {
            if (!Array.isArray(np.styleComparison.adaptationDrivers))
              np.styleComparison.adaptationDrivers = [];
            if (!Array.isArray(np.styleComparison.stressSignals))
              np.styleComparison.stressSignals = [];
          }
          // Ensure motivations exists and arrays
          if (!np.motivations) {
            np.motivations = {
              topMotivators: [],
              demotivators: [],
              valuesSummary: "",
            };
          } else {
            if (!Array.isArray(np.motivations.topMotivators))
              np.motivations.topMotivators = [];
            if (!Array.isArray(np.motivations.demotivators))
              np.motivations.demotivators = [];
          }
          // Ensure cognition exists
          if (!np.cognition) {
            np.cognition = {
              decisionStyle: "",
              thinkingStyle: "",
              learningStyle: "",
              communicationStyle: "",
            };
          }
          // Ensure careerProjection exists and arrays
          if (!np.careerProjection) {
            np.careerProjection = {
              bestFitEnvironments: [],
              leadershipStyle: "",
              watchouts: [],
              futureFocus: "",
            };
          } else {
            if (!Array.isArray(np.careerProjection.bestFitEnvironments))
              np.careerProjection.bestFitEnvironments = [];
            if (!Array.isArray(np.careerProjection.watchouts))
              np.careerProjection.watchouts = [];
          }
          // Ensure recommendedDevelopmentAxes is array
          if (!Array.isArray(np.recommendedDevelopmentAxes))
            np.recommendedDevelopmentAxes = [];
        }
      }

      if (this.cacheService) {
        await this.cacheService.set(cacheKey, result, cacheTtl);
      }

      return result;
    } catch (error: any) {
      this.logger.warn("Failed to generate quiz results, using fallback", {
        error: error.message,
        stack: error.stack,
      });
      return this.getFallbackResults();
    }
  }

  async analyzeCv(pdfText: string, cacheTtl: number = 86400): Promise<any> {
    const cacheKey = `cv:analysis:${Buffer.from(pdfText.substring(0, 500)).toString("base64")}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) return cached;
    }

    const prompt = this.promptRegistry.compile("cv-analysis", {
      text: pdfText,
    });
    const response = await this.openRouter.chatWithRetry(
      this.MODELS.cv,
      [{ role: "user", content: prompt }],
      0.3,
      1500,
    );

    const content = response.choices[0]?.message?.content?.trim();
    let result;
    try {
      const jsonStr = this.extractJson(content);
      result = JSON.parse(jsonStr);
    } catch (error) {
      this.logger.warn("Failed to parse CV analysis, returning partial", error);
      result = {
        skills: [],
        experience: [],
        education: [],
        summary: "Could not fully analyze CV",
      };
    }

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, result, cacheTtl);
    }

    return result;
  }

  async generateCvSuggestions(
    cvText: string,
    atsScore: number,
    cacheTtl: number = 86400,
  ): Promise<any> {
    const cacheKey = `cv:suggestions:${Buffer.from(cvText.substring(0, 500)).toString("base64")}:${atsScore}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) return cached;
    }

    const prompt = this.promptRegistry.compile("cv-suggestions", {
      cvText,
      atsScore,
    });
    const response = await this.openRouter.chatWithRetry(
      this.MODELS.cv,
      [{ role: "user", content: prompt }],
      0.5,
      1000,
    );

    const content = response.choices[0]?.message?.content?.trim();
    let result;
    try {
      const jsonStr = this.extractJson(content);
      result = JSON.parse(jsonStr);
    } catch (error) {
      this.logger.warn("Failed to parse CV suggestions, using default", error);
      result = { ats_issues: [], suggested_improvements: [] };
    }

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, result, cacheTtl);
    }

    return result;
  }

  async personalizeRoadmap(
    baseRoadmap: any,
    skills: string[],
    novaProfile: any,
    cvSummary: string,
  ): Promise<any> {
    const prompt = this.promptRegistry.compile("roadmap-personalization", {
      roadmap: JSON.stringify(baseRoadmap, null, 2),
      skills: skills.join(", "),
      novaProfile: JSON.stringify(novaProfile, null, 2),
      cvSummary,
    });

    const response = await this.openRouter.chatWithRetry(
      this.MODELS.roadmap,
      [{ role: "user", content: prompt }],
      0.7,
      2000,
    );

    const content = response.choices[0]?.message?.content?.trim();
    try {
      const jsonStr = this.extractJson(content);
      return JSON.parse(jsonStr);
    } catch (error) {
      this.logger.warn(
        "Failed to parse personalized roadmap, returning base",
        error,
      );
      return { personalizedMilestones: baseRoadmap.milestones };
    }
  }

  private extractJson(content: string): string {
    this.logger.debug(
      `Extracting JSON from content (length=${content.length})`,
    );

    // Try code block first (markdown)
    const jsonRegex = /```(?:json)?\n?([\s\S]*?)```/;
    const match = content.match(jsonRegex);
    if (match) {
      const extracted = match[1].trim();
      this.logger.debug(
        `Extracted from code block (length=${extracted.length})`,
      );
      return extracted;
    }

    // Find first { and parse character by character to find matching closing brace
    const firstBrace = content.indexOf("{");
    if (firstBrace !== -1) {
      let depth = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = firstBrace; i < content.length; i++) {
        const char = content[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === "\\") {
          escapeNext = true;
          continue;
        }

        if (char === '"' || char === "'") {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "{") {
            depth++;
          } else if (char === "}") {
            depth--;
            if (depth === 0) {
              const extracted = content.substring(firstBrace, i + 1).trim();
              this.logger.debug(
                `Extracted JSON by brace counting (length=${extracted.length})`,
              );
              return extracted;
            }
          }
        }
      }
    }

    // If no JSON found, check if content itself is valid JSON
    try {
      const trimmed = content.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        JSON.parse(trimmed);
        this.logger.debug("Content itself is valid JSON");
        return trimmed;
      }
    } catch {
      // Not valid JSON
    }

    // Last resort: return content and let caller handle parse error
    this.logger.warn("Could not extract JSON, returning raw content");
    return content.trim();
  }

  private validateQuizResults(result: any) {
    // Basic validation (full zod schema would be used)
    if (!result || typeof result !== "object") {
      throw new Error("Invalid quiz results structure");
    }
    if (result.type !== "results") {
      throw new Error("Quiz results missing type=results");
    }
    if (!Array.isArray(result.careers) || result.careers.length < 3) {
      throw new Error("Quiz results must have at least 3 careers");
    }
  }

  private getFallbackQuestion(questionNumber: number): any {
    // Complete set of 10 Nova Profile-oriented fallback questions
    const staticQuestions = [
      {
        type: "question" as const,
        question: "When work pressure rises, what is your most natural first response?",
        questionNumber: 1,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Take control quickly and drive immediate action",
            icon: "flash",
          },
          {
            id: "yellow",
            label: "Energize others and generate fast creative momentum",
            icon: "globe",
          },
          {
            id: "green",
            label: "Stabilize the team and keep collaboration calm",
            icon: "people",
          },
          {
            id: "blue",
            label: "Pause to analyze facts before deciding next steps",
            icon: "analytics",
          },
        ],
      },
      {
        type: "question" as const,
        question: "In formal environments, how do you usually adapt your style?",
        questionNumber: 2,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "I become more precise, careful, and detail-focused",
            icon: "construct",
          },
          {
            id: "green",
            label: "I become more patient and relationship-oriented",
            icon: "handshake",
          },
          {
            id: "red",
            label: "I become more directive and results-focused",
            icon: "flash",
          },
          {
            id: "yellow",
            label: "I become more expressive and persuasive with others",
            icon: "globe",
          },
        ],
      },
      {
        type: "question" as const,
        question: "Which decision-making approach feels most natural to you?",
        questionNumber: 3,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Decide fast and adjust as new information appears",
            icon: "target",
          },
          {
            id: "yellow",
            label: "Discuss broadly to spark possibilities before deciding",
            icon: "globe",
          },
          {
            id: "green",
            label: "Seek alignment so people can support the decision",
            icon: "people",
          },
          {
            id: "blue",
            label: "Review evidence deeply before making final conclusions",
            icon: "analytics",
          },
        ],
      },
      {
        type: "question" as const,
        question: "What communication style helps you perform at your best?",
        questionNumber: 4,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Direct, concise communication focused on outcomes",
            icon: "business",
          },
          {
            id: "yellow",
            label: "Energetic, expressive dialogue that inspires momentum",
            icon: "globe",
          },
          {
            id: "green",
            label: "Warm, empathetic communication that builds trust",
            icon: "handshake",
          },
          {
            id: "blue",
            label: "Structured, fact-based communication with clear logic",
            icon: "analytics",
          },
        ],
      },
      {
        type: "question" as const,
        question: "What most consistently motivates your best professional performance?",
        questionNumber: 5,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Stretch targets, ownership, and visible achievement",
            icon: "trophy",
          },
          {
            id: "yellow",
            label: "Creative freedom, novelty, and recognition of ideas",
            icon: "brush",
          },
          {
            id: "green",
            label: "Meaningful contribution, connection, and helping others succeed",
            icon: "people",
          },
          {
            id: "blue",
            label: "Mastery, quality, and confidence in technical competence",
            icon: "code",
          },
        ],
      },
      {
        type: "question" as const,
        question: "Which value should never be compromised in your work environment?",
        questionNumber: 6,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Clear accountability and strong performance standards",
            icon: "target",
          },
          {
            id: "yellow",
            label: "Innovation, experimentation, and room for fresh thinking",
            icon: "brush",
          },
          {
            id: "green",
            label: "Respectful relationships and a collaborative team culture",
            icon: "handshake",
          },
          {
            id: "blue",
            label: "Accuracy, rigor, and evidence-based quality decisions",
            icon: "analytics",
          },
        ],
      },
      {
        type: "question" as const,
        question: "How do you prefer to learn and develop new professional skills?",
        questionNumber: 7,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Learn quickly by leading real projects and challenges",
            icon: "business",
          },
          {
            id: "yellow",
            label: "Learn through exploration, variety, and creative experimentation",
            icon: "globe",
          },
          {
            id: "green",
            label: "Learn with coaching, practice, and collaborative feedback",
            icon: "people",
          },
          {
            id: "blue",
            label: "Learn through structured study, models, and deep analysis",
            icon: "code",
          },
        ],
      },
      {
        type: "question" as const,
        question: "Which team role feels most aligned with your natural strengths?",
        questionNumber: 8,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Driving direction, decisions, and execution pace",
            icon: "target",
          },
          {
            id: "yellow",
            label: "Connecting people, ideas, and future opportunities",
            icon: "globe",
          },
          {
            id: "green",
            label: "Supporting cohesion, trust, and sustainable teamwork",
            icon: "handshake",
          },
          {
            id: "blue",
            label: "Ensuring quality, logic, and technical excellence",
            icon: "analytics",
          },
        ],
      },
      {
        type: "question" as const,
        question: "In uncertain situations, what best describes your cognitive approach?",
        questionNumber: 9,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Act decisively with available information and adjust fast",
            icon: "flash",
          },
          {
            id: "yellow",
            label: "Generate multiple possibilities before narrowing choices",
            icon: "brush",
          },
          {
            id: "green",
            label: "Gauge people impact first, then align on best path",
            icon: "people",
          },
          {
            id: "blue",
            label: "Break down variables and decide from evidence",
            icon: "analytics",
          },
        ],
      },
      {
        type: "question" as const,
        question: "What type of feedback best accelerates your professional growth?",
        questionNumber: 10,
        totalQuestions: 10,
        options: [
          {
            id: "red",
            label: "Direct challenge with clear next performance target",
            icon: "business",
          },
          {
            id: "yellow",
            label: "Interactive dialogue that sparks new ideas and options",
            icon: "globe",
          },
          {
            id: "green",
            label: "Supportive coaching with practical steps and encouragement",
            icon: "handshake",
          },
          {
            id: "blue",
            label: "Structured feedback with precise examples and quality criteria",
            icon: "analytics",
          },
        ],
      },
    ];

    const idx = Math.max(
      0,
      Math.min(questionNumber - 1, staticQuestions.length - 1),
    );
    return staticQuestions[idx];
  }

  private getFallbackResults(): any {
    // Default balanced DISC - will be computed from answers in production fallback path
    return {
      type: "results",
      careers: [
        {
          title: "Software Engineer",
          description:
            "Design, build, and maintain robust technical solutions.",
          matchPercent: 82,
          tags: ["Technology", "Problem Solving", "Continuous Learning"],
        },
        {
          title: "Product Manager",
          description:
            "Lead product vision and coordinate cross-functional teams.",
          matchPercent: 78,
          tags: ["Leadership", "Strategy", "Communication"],
        },
        {
          title: "Data Analyst",
          description:
            "Transform data into actionable recommendations for decisions.",
          matchPercent: 75,
          tags: ["Analytics", "Data", "Business Decisions"],
        },
      ],
      novaProfile: {
        headline: "Balanced Problem-Solver",
        professionalIdentity:
          "You have a balanced approach to work, combining analytical thinking with collaborative skills.",
        behavior: {
          primaryStyle: "Conscientiousness (Blue)",
          secondaryStyle: "Steadiness (Green)",
          traits: [
            "Analytical",
            "Collaborative",
            "Adaptable",
            "Detail-oriented",
          ],
          discBlend: "R25 / Y25 / G25 / B25",
          discPercentages: { red: 25, yellow: 25, green: 25, blue: 25 },
        },
        styleComparison: {
          naturalStyleSummary:
            "You work best when you have a mix of structured tasks and opportunities to collaborate.",
          adaptedStyleSummary:
            "Under pressure you may become more cautious or more decisive depending on the situation.",
          adaptationDrivers: [
            "Tight deadlines",
            "High expectations",
            "Ambiguous requirements",
          ],
          stressSignals: ["Over-analysis", "Withdrawal", "Impatience"],
        },
        motivations: {
          topMotivators: [
            "Solving complex problems",
            "Helping teams succeed",
            "Continuous learning",
          ],
          demotivators: [
            "Micromanagement",
            "Unclear goals",
            "Meritocracy only",
          ],
          valuesSummary:
            "You value competence, collaboration, and making a tangible impact.",
        },
        cognition: {
          decisionStyle: "Balanced between data and intuition",
          thinkingStyle: "Analytical with strategic projection",
          learningStyle: "Hands-on learning through feedback",
          communicationStyle: "Clear, respectful, solution-oriented",
        },
        careerProjection: {
          bestFitEnvironments: [
            "Demanding project teams",
            "Learning-oriented cultures",
            "Transformation contexts",
          ],
          leadershipStyle: "Structured leadership with human support",
          watchouts: [
            "Perfectionism under stress",
            "Scattering across too many priorities",
          ],
          futureFocus:
            "Strong trajectory toward senior expertise or leadership roles.",
        },
        recommendedDevelopmentAxes: [
          "Strengthen prioritization under uncertainty",
          "Develop cross-functional influence",
          "Improve delegation skills",
        ],
      },
    };
  }
}
