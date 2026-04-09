/**
 * Shared prompts and JSON parsing for career matching (single-shot + tool agent).
 */

import type {
  AiCareerMatchingInput,
  AiCareerMatchingOutput,
  AiCareerMatchResult,
} from "./ai-matching.types";

function logDebug(message: string, ...args: unknown[]) {
  if (__DEV__) {
    console.log(message, ...args);
  }
}

export function buildAiCareerMatchingSystemPrompt(): string {
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

export function buildCareerMatchingUserMessage(input: AiCareerMatchingInput): string {
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

export function parseAiCareerMatchingJson(content: string): AiCareerMatchingOutput {
  let jsonStr = content.trim();

  logDebug("[AI-Matching] Raw response length:", jsonStr.length);
  logDebug("[AI-Matching] First 200 chars:", jsonStr.substring(0, 200));

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
  } catch {
    logDebug("[AI-Matching] Direct parsing failed, trying extraction methods...");
  }

  let codeBlockContent: string | null = null;
  const codeBlockStart = jsonStr.indexOf("```");
  if (codeBlockStart >= 0) {
    const codeBlockEnd = jsonStr.indexOf("```", codeBlockStart + 3);
    if (codeBlockEnd >= 0) {
      codeBlockContent = jsonStr.slice(codeBlockStart + 3, codeBlockEnd).trim();
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

  let extractedJson: string | null = null;

  const firstBrace = jsonStr.indexOf("{");
  const firstBracket = jsonStr.indexOf("[");
  const startIdx =
    firstBrace >= 0 && firstBracket >= 0
      ? Math.min(firstBrace, firstBracket)
      : firstBrace >= 0
        ? firstBrace
        : firstBracket;

  if (startIdx >= 0) {
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

  let cleanedJson = jsonStr
    .replace(/,\s*([\]}])/g, "$1")
    .replace(/([{,])\s*$/g, "$1")
    .replace(/\]\s*\]/g, "]")
    .replace(/\}\s*\}/g, "}");

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

  const errorMsg = `Failed to parse AI response after 4 parsing attempts. Last cleaned: ${cleanedJson.substring(0, 200)}...`;
  logDebug("[AI-Matching] ❌", errorMsg);
  throw new Error(errorMsg);
}
