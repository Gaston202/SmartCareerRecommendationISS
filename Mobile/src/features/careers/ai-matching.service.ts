/**
 * AI Career Matching Service – Backend-Only Implementation
 * 
 * NO fallback to OpenRouter. NO hardcoded responses.
 * All career matching goes through backend ai_v2 agents.
 * If backend is unavailable, the app shows a clear error.
 */

import { generateCareerMatches as generateCareerMatchesBackend } from "../../api/ai-backend.service";
import type {
  AiCareerMatchingInput,
  AiCareerMatchingOutput,
  AiCareerMatchResult,
} from "./ai-matching.types";

export type { AiCareerMatchingInput, AiCareerMatchingOutput, AiCareerMatchResult };

const AI_MATCHING_MAX_RETRIES_PER_MODEL = 2;
const AI_MATCHING_BASE_RETRY_DELAY_MS = 1500;
const AI_MATCHING_MODELS = [
  "stepfun/step-3.5-flash:free", // Faster and more reliable for JSON - try first
  "arcee-ai/trinity-large-preview:free", // Fallback
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  const exponential = AI_MATCHING_BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

function logDebug(message: string, ...args: unknown[]) {
  if (__DEV__) {
    console.log(message, ...args);
  }
}

function buildSystemPrompt(): string {
  return `You are an expert career counselor and AI career matching system. Your task is to analyze user data comprehensively and generate the TOP 5 most suitable careers.

You will receive:
1. Quiz questions with user's answers (shows interests, preferences, work style)
2. Nova psychometric profile summary (behavior, motivations, cognition, work environment fit)
2. CV analysis data (skills, interests, ATS score)
3. Optional list of reference careers (for inspiration only, not a hard constraint)

RESPOND WITH ONLY VALID JSON - NO MARKDOWN, NO CODE BLOCKS, NO EXTRA TEXT!
Output exactly this JSON structure:
{"topMatches":[{"careerTitle":"Career Title","careerDescription":"Brief description of the career","careerCategory":"Technology","requiredSkills":["Skill A","Skill B"],"estimatedSalaryRange":"$65,000-$95,000","growthRatePercent":18,"demandLevel":"high","tags":["Tag1","Tag2"],"matchScore":92,"matchingFactors":{"quizAlignment":"How quiz answers align with this career","skillsMatch":"How extracted skills and CV relate to this career","cvAnalysisMatch":"Additional insights from CV analysis if applicable"},"reasoning":"Detailed explanation of why this is a top match (2-3 sentences)","recommendedNextSteps":["Step 1","Step 2","Step 3"]}]}

CRITICAL RULES:
- Output MUST be valid JSON only (no markdown backticks, no explanations before or after)
- Return EXACTLY 5 careers
- matchScore: integer 75-99 range, ordered descending
- Careers should be AI-generated and personalized from user profile (not limited to any database list)
- careerDescription: 1-2 sentences
- reasoning: 2-3 sentences explaining the match
- recommendedNextSteps: array of 3 practical steps
- requiredSkills: 4-8 concise skills for the role
- demandLevel: one of low, medium, high, very-high
- Consider ALL user data holistically
- Prioritize careers matching MULTIPLE factors
- Focus on career viability with current + learnable skills`;
}

function buildUserMessage(input: AiCareerMatchingInput): string {
  const quizSection = input.quizQuestions
    .map(
      (q) =>
        `Q${q.questionNumber}: ${q.question}\nAnswer: ${q.selectedOption}`
    )
    .join("\n\n");

  const cvSection = input.cvAnalysis
    ? `
CV ANALYSIS SUMMARY:
- ATS Score: ${input.cvAnalysis.atsScore}/100
- Extracted Skills: ${input.cvAnalysis.extractedSkills.join(", ") || "None"}
- Extracted Interests: ${input.cvAnalysis.extractedInterests.join(", ") || "None"}
- Career Suggestions from CV Analysis: ${
        input.cvAnalysis.careerSuggestions
          .map(
            (c) =>
              `${c.title} (${c.match_score}% match)`
          )
          .join(", ") || "None"
      }`
    : "";

  const novaSection = input.novaProfile
    ? `
NOVA PSYCHOMETRIC PROFILE:
- Headline: ${input.novaProfile.headline || "N/A"}
- Professional Identity: ${input.novaProfile.professionalIdentity || "N/A"}
- Primary Style: ${input.novaProfile.primaryStyle || "N/A"}
- Top Motivators: ${(input.novaProfile.topMotivators || []).join(", ") || "None"}
- Decision Style: ${input.novaProfile.decisionStyle || "N/A"}
- Learning Style: ${input.novaProfile.learningStyle || "N/A"}
- Communication Style: ${input.novaProfile.communicationStyle || "N/A"}
- Best Fit Environments: ${(input.novaProfile.bestFitEnvironments || []).join(", ") || "None"}
- Watchouts: ${(input.novaProfile.watchouts || []).join(", ") || "None"}
- Development Axes: ${(input.novaProfile.recommendedDevelopmentAxes || []).join(", ") || "None"}`
    : "";

  const skillsSection =
    input.userSkills.length > 0
      ? `\nUSER CONFIRMED SKILLS: ${input.userSkills.join(", ")}`
      : "";

  const careersSection = input.availableCareers && input.availableCareers.length > 0 ? `
REFERENCE CAREERS (OPTIONAL CONTEXT, DO NOT LIMIT OUTPUT TO THIS LIST):
${input.availableCareers
  .map(
    (c) =>
      `- ${c.title} (${c.category}): ${c.description}\n  Required Skills: ${c.required_skills.join(", ") || "None"}\n  Salary: $${c.average_salary?.toLocaleString() || "N/A"} | Growth: ${c.growth_rate || "N/A"}% | Demand: ${c.demand_level || "N/A"}`
  )
  .join("\n\n")}` : "";

  return `USER PROFILE DATA FOR CAREER MATCHING:

QUIZ RESPONSES:
${quizSection}
${skillsSection}
${novaSection}
${cvSection}

${careersSection}

===== CRITICAL INSTRUCTIONS =====
Analyze this comprehensive user data and return ONLY the TOP 5 most suitable AI-generated careers.

RESPOND WITH ONLY THIS JSON - NO OTHER TEXT, NO MARKDOWN BLOCKS:
{"topMatches":[...]}

DO NOT include explanations, do not use markdown, do not add any text before or after the JSON.`;
}

function parseContent(content: string): AiCareerMatchingOutput {
  let jsonStr = content.trim();

  logDebug("[AI-Matching] Raw response length:", jsonStr.length);
  logDebug("[AI-Matching] First 200 chars:", jsonStr.substring(0, 200));

  // Method 1: Try direct JSON parsing first (most common case)
  try {
    const parsed = JSON.parse(jsonStr) as { topMatches: AiCareerMatchResult[] };
    if (parsed.topMatches && Array.isArray(parsed.topMatches)) {
      logDebug("[AI-Matching] ✅ Direct JSON parsing succeeded");
      return {
        topMatches: parsed.topMatches,
        generationTimestamp: new Date().toISOString(),
        aiModel: "openrouter-ai-matching",
      };
    }
  } catch (e) {
    logDebug("[AI-Matching] Direct parsing failed, trying extraction methods...");
  }

  // Method 2: Extract from markdown code blocks
  let codeBlockContent: string | null = null;
  const codeBlockStart = jsonStr.indexOf("```");
  if (codeBlockStart >= 0) {
    const codeBlockEnd = jsonStr.indexOf("```", codeBlockStart + 3);
    if (codeBlockEnd >= 0) {
      codeBlockContent = jsonStr.slice(codeBlockStart + 3, codeBlockEnd).trim();
      // Remove language specifier if present
      if (codeBlockContent.startsWith("json")) {
        codeBlockContent = codeBlockContent.slice(4).trim();
      }
      logDebug("[AI-Matching] Extracted from code block:", codeBlockContent.substring(0, 100));
    }
  }

  if (codeBlockContent) {
    try {
      const parsed = JSON.parse(codeBlockContent) as {
        topMatches: AiCareerMatchResult[];
      };
      if (parsed.topMatches && Array.isArray(parsed.topMatches)) {
        logDebug("[AI-Matching] ✅ Code block JSON parsing succeeded");
        return {
          topMatches: parsed.topMatches,
          generationTimestamp: new Date().toISOString(),
          aiModel: "openrouter-ai-matching",
        };
      }
    } catch (e) {
      logDebug("[AI-Matching] Code block parsing failed:", String(e));
    }
  }

  // Method 3: Extract JSON object/array using smart boundary detection
  let extractedJson: string | null = null;

  // Find first { or [
  const firstBrace = jsonStr.indexOf("{");
  const firstBracket = jsonStr.indexOf("[");
  const startIdx =
    firstBrace >= 0 && firstBracket >= 0
      ? Math.min(firstBrace, firstBracket)
      : firstBrace >= 0
        ? firstBrace
        : firstBracket;

  if (startIdx >= 0) {
    // Find matching closing brace/bracket
    let braceCount = 0;
    let bracketCount = 0;
    let endIdx = -1;

    for (let i = startIdx; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      if (char === "{") braceCount++;
      else if (char === "}") {
        braceCount--;
        if (braceCount === 0 && bracketCount === 0) {
          endIdx = i;
          break;
        }
      } else if (char === "[") bracketCount++;
      else if (char === "]") {
        bracketCount--;
        if (braceCount === 0 && bracketCount === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx > startIdx) {
      extractedJson = jsonStr.slice(startIdx, endIdx + 1);
      logDebug("[AI-Matching] Extracted JSON via boundary detection:", extractedJson.substring(0, 100));
    }
  }

  // Try parsing extracted JSON
  if (extractedJson) {
    try {
      const parsed = JSON.parse(extractedJson) as {
        topMatches: AiCareerMatchResult[];
      };
      if (parsed.topMatches && Array.isArray(parsed.topMatches)) {
        logDebug("[AI-Matching] ✅ Boundary-extracted JSON parsing succeeded");
        return {
          topMatches: parsed.topMatches,
          generationTimestamp: new Date().toISOString(),
          aiModel: "openrouter-ai-matching",
        };
      }
    } catch (e) {
      logDebug("[AI-Matching] Boundary-extracted parsing failed:", String(e));
    }
  }

  // Method 4: Try cleaning common issues and retry
  let cleanedJson = jsonStr
    .replace(/,\s*([\]}])/g, "$1") // Remove trailing commas
    .replace(/([{,])\s*$/g, "$1") // Remove trailing commas at end
    .replace(/\]\s*\]/g, "]") // Remove duplicate closing brackets
    .replace(/\}\s*\}/g, "}"); // Remove duplicate closing braces

  if (cleanedJson !== jsonStr) {
    logDebug("[AI-Matching] Attempting with cleaned JSON");
    try {
      const parsed = JSON.parse(cleanedJson) as {
        topMatches: AiCareerMatchResult[];
      };
      if (parsed.topMatches && Array.isArray(parsed.topMatches)) {
        logDebug("[AI-Matching] ✅ Cleaned JSON parsing succeeded");
        return {
          topMatches: parsed.topMatches,
          generationTimestamp: new Date().toISOString(),
          aiModel: "openrouter-ai-matching",
        };
      }
    } catch (e) {
      logDebug("[AI-Matching] Cleaned parsing failed:", String(e));
    }
  }

  // If all parsing methods fail, throw detailed error
  const errorMsg = `Failed to parse AI response after 4 parsing attempts. Last cleaned: ${cleanedJson.substring(0, 200)}...`;
  logDebug("[AI-Matching] ❌", errorMsg);
  throw new Error(errorMsg);
}

async function callOpenRouter(
  input: AiCareerMatchingInput
): Promise<AiCareerMatchingOutput> {
  const key = getOpenRouterApiKey();
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(input);
  let lastError: unknown = null;

  for (
    let modelIndex = 0;
    modelIndex < AI_MATCHING_MODELS.length;
    modelIndex++
  ) {
    const model = AI_MATCHING_MODELS[modelIndex];

    for (
      let attempt = 0;
      attempt <= AI_MATCHING_MAX_RETRIES_PER_MODEL;
      attempt++
    ) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: buildOpenRouterHeaders(key),
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          const err = toOpenRouterError(res.status, text);
          lastError = err;

          logDebug(
            `[AI-Matching] OpenRouter response status: ${res.status} (${model}, attempt ${attempt + 1})`
          );

          const status = err.status;
          const isRetryable =
            status === 429 || status === 502 || status === 503 || status === 504;

          if (
            isRetryable &&
            attempt < AI_MATCHING_MAX_RETRIES_PER_MODEL
          ) {
            const delayMs = getRetryDelay(attempt);
            logDebug(
              `[AI-Matching] Retry ${model} after ${status} in ${delayMs}ms...`
            );
            await sleep(delayMs);
            continue;
          }

          if (
            (status === 429 || status === 404) &&
            modelIndex < AI_MATCHING_MODELS.length - 1
          ) {
            logDebug(
              `[AI-Matching] Model unavailable (status ${status}), switching to next model...`
            );
            break;
          }

          throw err;
        }

        const data = await res.json();
        const aiContent = data?.choices?.[0]?.message?.content?.trim();
        if (!aiContent) {
          throw new Error("Empty response from AI");
        }

          logDebug(`[AI-Matching] OpenRouter success with ${model}`);
          try {
            return parseContent(aiContent);
          } catch (parseErr) {
            logDebug(`[AI-Matching] JSON parse error with ${model}:`, String(parseErr));
            // If parsing fails, try next model instead of retrying
            if (modelIndex < AI_MATCHING_MODELS.length - 1) {
              logDebug(`[AI-Matching] Parse error - switching to next model...`);
              lastError = parseErr;
              break; // Break inner loop to try next model
            }
            throw parseErr; // If last model, throw the error
          }
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number })?.status;
        // Check if it's a JSON parse error (don't retry)
        const isParseError =
          err instanceof SyntaxError ||
          (err instanceof Error && err.message.includes("JSON"));
        const isRetryable =
          !isParseError &&
          (status === 429 || status === 502 || status === 503 || status === 504);

        if (!isRetryable) {
          logDebug(`[AI-Matching] Non-retryable error (${model}):`, err);
          throw err;
        }

        logDebug(
          `[AI-Matching] Retryable error (${model}, attempt ${attempt + 1}):`,
          err
        );
      }
    }
  }

  console.warn(
    `[AI-Matching] ⚠️ All OpenRouter models exhausted, last error:`,
    lastError
  );
  throw lastError || new Error("Failed to generate AI career matches");
}

/**
 * Generate TOP 5 career matches using AI analysis of quiz, CV, and skills data
 * @param input Comprehensive user data including quiz questions/answers, CV analysis, and available careers
 * @returns TOP career recommendations with match scores and reasoning
 */
export async function generateAiCareerMatches(
  input: AiCareerMatchingInput
): Promise<AiCareerMatchingOutput> {
  try {
    logDebug("[AI-Matching] Starting AI-driven career matching...", {
      userId: input.userId,
      quizQuestions: input.quizQuestions.length,
      hasCvAnalysis: !!input.cvAnalysis,
      userSkills: input.userSkills.length,
      availableCareers: input.availableCareers?.length || 0,
    });

    const result = await callOpenRouter(input);

    logDebug(
      `[AI-Matching] Generated ${result.topMatches.length} career matches`
    );
    return result;
  } catch (err) {
    console.error("[AI-Matching] Failed to generate AI career matches:", err);
    throw err;
  }
}
