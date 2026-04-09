import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { PromptRegistry } from "./prompt.registry";
import { OpenRouterService } from "./providers/openrouter.service";
import { z } from "zod";

const ExplanationSchema = z.string();

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private readonly MODELS = {
    quiz: [
      "arcee-ai/trinity-large-preview:free",
      "stepfun/step-3.5-flash:free",
    ],
    cv: ["stepfun/step-3.5-flash:free", "arcee-ai/trinity-large-preview:free"],
    roadmap: [
      "arcee-ai/trinity-large-preview:free",
      "stepfun/step-3.5-flash:free",
    ],
    explanation: [
      "stepfun/step-3.5-flash:free",
      "arcee-ai/trinity-large-preview:free",
    ],
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

  // Keep previous methods (generateQuizNext, generateQuizResults, analyzeCv, generateCvSuggestions, personalizeRoadmap)
  // ... (copy the previous implementations)

  async generateQuizNext(
    answers: string[],
    questionNumber: number,
    cacheTtl: number = 3600,
  ): Promise<any> {
    this.logger.log(
      `\n[Quiz] ========== GENERATING Q${questionNumber} ==========`,
    );
    this.logger.log(`[Quiz] Previous answers: ${JSON.stringify(answers)}`);

    // Use versioned cache key to avoid stale cached questions
    const cacheKey = `quiz:next:v5:${Buffer.from(answers.join(",")).toString("base64")}:${questionNumber}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.log(`[Quiz] Cache hit for Q${questionNumber}`);
        if (this.isValidPreferenceQuestion(cached, questionNumber)) {
          this.logger.log(
            `[Quiz] ✅ Using cached question: "${(cached as any).question.substring(0, 60)}..."`,
          );
          return cached;
        } else {
          this.logger.warn(
            `[Quiz] Cached question failed validation, regenerating`,
          );
        }
      }
    }

    this.logger.log(`[Quiz] 🔄 Calling AI for Q${questionNumber} (cache miss)`);
    const prompt = this.promptRegistry.compile("quiz-question", {
      answers,
      questionNumber,
    });
    this.logger.debug(`[Quiz] Prompt snippet: ${prompt.substring(0, 400)}...`);

    const response = await this.openRouter.chatWithRetry(
      this.MODELS.quiz,
      [{ role: "user", content: prompt }],
      0.75,
      600,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      this.logger.error("[Quiz] Empty AI response");
      throw new BadRequestException("Empty response from AI");
    }

    this.logger.debug(`[Quiz] AI raw output: ${content.substring(0, 300)}...`);

    let result;
    try {
      const jsonStr = this.extractJson(content);
      result = JSON.parse(jsonStr);
      this.logger.debug(
        `[Quiz] Parsed JSON: type=${result.type}, question="${result.question?.substring(0, 50)}..."`,
      );
    } catch (error) {
      this.logger.warn("[Quiz] JSON parse failed, using fallback", error);
      result = this.getFallbackQuestion(questionNumber);
    }

    // Validate and sanitize
    result = this.validateAndSanitizeQuestion(result, questionNumber);

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, result, cacheTtl);
      this.logger.log(`[Quiz] Cached result with key prefix: quiz:next:v5`);
    }

    this.logger.log(`[Quiz] ✅ FINAL QUESTION: "${result.question}"`);
    this.logger.log(`[Quiz] ========== END Q${questionNumber} ==========\n`);
    return result;
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
      if (!opt.icon || !validIcons.includes(opt.icon)) {
        this.logger.warn(`[Quiz] ❌ Invalid icon: ${opt.icon}, using fallback`);
        return this.getFallbackQuestion(questionNumber);
      }
    }

    this.logger.log(
      `[Quiz] ✅ Validated preference question: "${result.question.substring(0, 60)}..."`,
    );
    return result;
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
              np.motivators.topMotivators = [];
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
    // Complete set of 10 preference-focused static questions
    const staticQuestions = [
      {
        type: "question" as const,
        question: "Do you prefer working independently or as part of a team?",
        questionNumber: 1,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "I do my best work alone, focused and self-directed",
            icon: "code",
          },
          {
            id: "green",
            label: "I enjoy teamwork but also value some independent tasks",
            icon: "people",
          },
          {
            id: "red",
            label: "I thrive in teams, especially when leading or competing",
            icon: "target",
          },
          {
            id: "yellow",
            label:
              "I prefer spontaneous collaborations over structured teamwork",
            icon: "globe",
          },
        ],
      },
      {
        type: "question" as const,
        question: "What kind of work environment helps you thrive most?",
        questionNumber: 2,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "A quiet, structured office with clear processes",
            icon: "construct",
          },
          {
            id: "green",
            label: "A collaborative team space where I can support others",
            icon: "handshake",
          },
          {
            id: "red",
            label: "A fast-paced, competitive setting with rapid decisions",
            icon: "flash",
          },
          {
            id: "yellow",
            label:
              "A flexible, dynamic environment with variety and experimentation",
            icon: "globe",
          },
        ],
      },
      {
        type: "question" as const,
        question: "What type of problems do you enjoy solving?",
        questionNumber: 3,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "Complex analytical problems that require research and data",
            icon: "analytics",
          },
          {
            id: "green",
            label: "People problems: conflicts, relationships, team dynamics",
            icon: "people",
          },
          {
            id: "red",
            label:
              "Action problems: quick decisions, crisis management, obstacles to overcome",
            icon: "business",
          },
          {
            id: "yellow",
            label:
              "Creative problems: designing, innovating, brainstorming new ideas",
            icon: "brush",
          },
        ],
      },
      {
        type: "question" as const,
        question:
          "How important is it for your job to directly help or serve others?",
        questionNumber: 4,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "Not important; I prefer technical or analytical work",
            icon: "analytics",
          },
          {
            id: "green",
            label:
              "Very important; I want to make a positive difference in people's lives",
            icon: "people",
          },
          {
            id: "red",
            label:
              "Somewhat important; helping others should align with achieving results",
            icon: "target",
          },
          {
            id: "yellow",
            label:
              "It depends; I enjoy inspiring or entertaining others in creative ways",
            icon: "brush",
          },
        ],
      },
      {
        type: "question" as const,
        question:
          "Do you prefer clear instructions and structure or freedom to innovate?",
        questionNumber: 5,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label:
              "Clear instructions and well-defined processes are essential",
            icon: "construct",
          },
          {
            id: "green",
            label:
              "I like some structure but also room to adapt and collaborate",
            icon: "handshake",
          },
          {
            id: "red",
            label: "I want freedom to make decisions and chart my own course",
            icon: "flash",
          },
          {
            id: "yellow",
            label:
              "Give me the vision and let me innovate freely with minimal rules",
            icon: "globe",
          },
        ],
      },
      {
        type: "question" as const,
        question:
          "Which of these work activities sounds most appealing to you?",
        questionNumber: 6,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label:
              "Analyzing data, writing reports, ensuring quality and accuracy",
            icon: "analytics",
          },
          {
            id: "green",
            label: "Supporting, mentoring, or caring for people in some way",
            icon: "people",
          },
          {
            id: "red",
            label:
              "Leading projects, meeting targets, making strategic decisions",
            icon: "business",
          },
          {
            id: "yellow",
            label:
              "Creating designs, developing new concepts, expressing ideas",
            icon: "brush",
          },
        ],
      },
      {
        type: "question" as const,
        question: "What is your preferred pace of work?",
        questionNumber: 7,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "Steady, methodical pace with time to perfect my work",
            icon: "construct",
          },
          {
            id: "green",
            label:
              "Moderate pace that allows for collaboration and relationship-building",
            icon: "handshake",
          },
          {
            id: "red",
            label: "Fast-paced with quick turnarounds and high energy",
            icon: "flash",
          },
          {
            id: "yellow",
            label:
              "Variable pace; sometimes intense bursts, sometimes relaxed exploration",
            icon: "globe",
          },
        ],
      },
      {
        type: "question" as const,
        question: "When choosing a job, what matters most to you?",
        questionNumber: 8,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "Job security, stability, and clear career progression path",
            icon: "ribbon",
          },
          {
            id: "green",
            label:
              "Positive workplace culture and strong relationships with colleagues",
            icon: "people",
          },
          {
            id: "red",
            label:
              "High salary, advancement opportunities, and visible recognition",
            icon: "trophy",
          },
          {
            id: "yellow",
            label:
              "Creative freedom, variety of tasks, and opportunity to experiment",
            icon: "brush",
          },
        ],
      },
      {
        type: "question" as const,
        question: "What kind of people do you enjoy working with most?",
        questionNumber: 9,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "Detail-oriented experts who value precision and quality",
            icon: "analytics",
          },
          {
            id: "green",
            label:
              "Supportive, empathetic team players who create positive environments",
            icon: "people",
          },
          {
            id: "red",
            label: "Ambitious, driven go-getters who push for results",
            icon: "target",
          },
          {
            id: "yellow",
            label: "Creative, energetic innovators who think outside the box",
            icon: "globe",
          },
        ],
      },
      {
        type: "question" as const,
        question: "How do you like to receive feedback on your work?",
        questionNumber: 10,
        totalQuestions: 10,
        options: [
          {
            id: "blue",
            label: "Detailed, specific feedback with clear examples and data",
            icon: "analytics",
          },
          {
            id: "green",
            label:
              "Encouraging, supportive feedback that considers my feelings",
            icon: "people",
          },
          {
            id: "red",
            label:
              "Direct, concise feedback focused on results and improvement",
            icon: "business",
          },
          {
            id: "yellow",
            label:
              "Brainstorming sessions where feedback flows as creative dialogue",
            icon: "brush",
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
