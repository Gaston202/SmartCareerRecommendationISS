import {
  buildOpenRouterHeaders,
  getOpenRouterApiKey,
  OPENROUTER_URL,
  toOpenRouterError,
} from "../api/openrouter";
import type { ChatMessage, OpenRouterChatResponse, OpenRouterToolDefinition } from "./types";

const DEFAULT_MAX_RETRIES_PER_MODEL = 2;
const DEFAULT_BASE_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  const exponential = DEFAULT_BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  tools?: OpenRouterToolDefinition[];
  toolChoice?: "auto" | "none" | "required";
  temperature?: number;
}

export async function openRouterChatCompletion(
  params: ChatCompletionParams
): Promise<OpenRouterChatResponse> {
  const key = getOpenRouterApiKey();
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.3,
  };
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
    body.tool_choice = params.toolChoice ?? "auto";
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: buildOpenRouterHeaders(key),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw toOpenRouterError(res.status, text);
  }

  return (await res.json()) as OpenRouterChatResponse;
}

export interface ModelFallbackChatParams
  extends Omit<ChatCompletionParams, "model"> {
  models: string[];
  maxRetriesPerModel?: number;
  label?: string;
}

/**
 * Tries each model in order with retries on transient errors (429, 5xx).
 */
export async function openRouterChatWithModelFallback(
  params: ModelFallbackChatParams
): Promise<{ response: OpenRouterChatResponse; model: string }> {
  const models = params.models;
  const maxRetries = params.maxRetriesPerModel ?? DEFAULT_MAX_RETRIES_PER_MODEL;
  const { models: _m, maxRetriesPerModel: _mr, label, ...rest } = params;
  let lastError: unknown = null;
  const logPrefix = label ? `[${label}]` : "[openrouter-chat]";

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await openRouterChatCompletion({ ...rest, model });
        return { response, model };
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number })?.status;
        const isRetryable =
          status === 429 || status === 502 || status === 503 || status === 504;

        if (isRetryable && attempt < maxRetries) {
          await sleep(getRetryDelay(attempt));
          continue;
        }

        if ((status === 429 || status === 404) && modelIndex < models.length - 1) {
          if (__DEV__) {
            console.log(`${logPrefix} switching model after ${status}: ${model}`);
          }
          break;
        }

        throw err;
      }
    }
  }

  throw lastError || new Error("OpenRouter chat: all models exhausted");
}
