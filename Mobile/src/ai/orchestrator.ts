import { normalizeOpenRouterMessageContent } from "../api/openrouter";
import { openRouterChatWithModelFallback } from "./openrouter-chat";
import type { ChatMessage, OpenRouterToolDefinition, ToolCall } from "./types";

export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<string> | string;

export interface RunToolAgentOptions {
  models: string[];
  systemPrompt: string;
  userPrompt: string;
  tools: OpenRouterToolDefinition[];
  toolHandlers: Record<string, ToolHandler>;
  maxIterations?: number;
  temperature?: number;
  /** Log prefix for __DEV__ traces */
  label?: string;
}

export interface ToolAgentResult {
  finalContent: string;
  modelUsed: string;
  iterations: number;
}

function safeParseToolArgs(raw: string): Record<string, unknown> {
  const trimmed = raw?.trim() || "{}";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

async function runToolCall(
  call: ToolCall,
  handlers: Record<string, ToolHandler>
): Promise<string> {
  const name = call.function?.name;
  if (!name || !handlers[name]) {
    return JSON.stringify({
      error: `Unknown or unsupported tool: ${name ?? "(missing)"}`,
    });
  }
  const args = safeParseToolArgs(call.function.arguments);
  try {
    const out = await handlers[name](args);
    return typeof out === "string" ? out : JSON.stringify(out);
  } catch (e) {
    return JSON.stringify({
      error: "Tool execution failed",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Multi-step agent: model may emit tool_calls; we execute handlers and append tool
 * messages until the assistant returns plain content (no tools) or maxIterations.
 */
export async function runOpenRouterToolAgent(
  options: RunToolAgentOptions
): Promise<ToolAgentResult> {
  const maxIterations = options.maxIterations ?? 14;
  const messages: ChatMessage[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userPrompt },
  ];

  let iterations = 0;
  let lastModel = options.models[0] ?? "";

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
    const { response, model } = await openRouterChatWithModelFallback({
      models: options.models,
      messages,
      tools: options.tools,
      toolChoice: "auto",
      temperature: options.temperature,
      label: options.label,
    });
    lastModel = model;

    const choice = response.choices?.[0];
    const msg = choice?.message;
    const toolCalls = msg?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      const assistantContentRaw = msg?.content ?? null;
      const assistantContent =
        assistantContentRaw == null || assistantContentRaw === ""
          ? null
          : normalizeOpenRouterMessageContent(assistantContentRaw) || null;
      messages.push({
        role: "assistant",
        content: assistantContent,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const content = await runToolCall(tc, options.toolHandlers);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content,
        });
      }
      continue;
    }

    const text = normalizeOpenRouterMessageContent(msg?.content ?? "");
    if (!text) {
      throw new Error("Empty assistant message (no tools, no content)");
    }

    return {
      finalContent: text,
      modelUsed: lastModel,
      iterations,
    };
  }

  throw new Error(
    `Agent exceeded maxIterations (${maxIterations}) without a final answer`
  );
}
