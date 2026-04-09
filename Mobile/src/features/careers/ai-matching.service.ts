/**
 * AI Career Matching Service
 * Uses OpenRouter to analyze quiz questions/responses, CV analysis, and available careers
 * to generate personalized TOP 5 career recommendations with match scores
 */

import {
  buildOpenRouterHeaders,
  getOpenRouterApiKey,
  normalizeOpenRouterMessageContent,
  OPENROUTER_URL,
  toOpenRouterError,
} from "../../api/openrouter";
import { runCareerMatchingAgent } from "../../ai/career-matching-agent";
import {
  buildAiCareerMatchingSystemPrompt,
  buildCareerMatchingUserMessage,
  parseAiCareerMatchingJson,
} from "./ai-matching-llm-core";
import type {
  AiCareerMatchingInput,
  AiCareerMatchingOutput,
  AiCareerMatchResult,
} from "./ai-matching.types";

export type { AiCareerMatchingInput, AiCareerMatchingOutput, AiCareerMatchResult };
export {
  buildAiCareerMatchingSystemPrompt,
  parseAiCareerMatchingJson,
} from "./ai-matching-llm-core";

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

async function callOpenRouter(
  input: AiCareerMatchingInput
): Promise<AiCareerMatchingOutput> {
  const key = getOpenRouterApiKey();
  const systemPrompt = buildAiCareerMatchingSystemPrompt();
  const userMessage = buildCareerMatchingUserMessage(input);
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
        const aiContent = normalizeOpenRouterMessageContent(
          data?.choices?.[0]?.message?.content
        );
        if (!aiContent) {
          throw new Error("Empty response from AI");
        }

          logDebug(`[AI-Matching] OpenRouter success with ${model}`);
          try {
            return parseAiCareerMatchingJson(aiContent);
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
 * @returns TOP 5 career recommendations with match scores and reasoning
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

    let result: AiCareerMatchingOutput;
    try {
      result = await runCareerMatchingAgent(input, AI_MATCHING_MODELS);
      logDebug("[AI-Matching] Used tool-orchestrated agent path");
    } catch (agentErr) {
      logDebug(
        "[AI-Matching] Agent orchestration failed; falling back to single-shot:",
        agentErr
      );
      result = await callOpenRouter(input);
    }

    logDebug(
      `[AI-Matching] Generated ${result.topMatches.length} career matches`
    );
    return result;
  } catch (err) {
    console.error("[AI-Matching] Failed to generate AI career matches:", err);
    throw err;
  }
}
