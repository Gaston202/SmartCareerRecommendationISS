import { runOpenRouterToolAgent } from "./orchestrator";
import { createCareerMatchingTooling } from "./career-matching-tools";
import type { AiCareerMatchingInput, AiCareerMatchingOutput } from "../features/careers/ai-matching.types";
import {
  buildAiCareerMatchingSystemPrompt,
  parseAiCareerMatchingJson,
} from "../features/careers/ai-matching-llm-core";

const AGENT_ORCHESTRATION_SUFFIX = `

MULTI-STEP ORCHESTRATION (TOOLS):
- Use the provided tools to load quiz data, Nova profile, CV/skills, and reference careers. Do not invent quiz answers or CV facts.
- Call tools in any order; you may call the same tool more than once if useful (e.g. different search_reference_careers queries).
- When you are ready to finalize, respond with ONLY valid JSON (the same schema as above: single object with key "topMatches"). Do not use tools on the final turn.
- The final message must be parseable JSON only: no markdown fences, no commentary.`;

function buildAgentUserPrompt(input: AiCareerMatchingInput): string {
  return `User id: ${input.userId}

Produce the TOP 5 personalized career recommendations for this user.
Use tools to retrieve profile and reference-career data as needed, then output ONLY the JSON object with key "topMatches" (exactly 5 items), following all rules in the system message.`;
}

/**
 * Orchestrated career matching: model uses tools to pull structured context, then returns JSON.
 */
export async function runCareerMatchingAgent(
  input: AiCareerMatchingInput,
  models: string[]
): Promise<AiCareerMatchingOutput> {
  const { tools, toolHandlers } = createCareerMatchingTooling(input);
  const systemPrompt =
    buildAiCareerMatchingSystemPrompt() + AGENT_ORCHESTRATION_SUFFIX;

  const { finalContent, modelUsed, iterations } = await runOpenRouterToolAgent({
    models,
    systemPrompt,
    userPrompt: buildAgentUserPrompt(input),
    tools,
    toolHandlers,
    maxIterations: 16,
    temperature: 0.25,
    label: "CareerAgent",
  });

  if (__DEV__) {
    console.log(
      `[CareerAgent] completed in ${iterations} LLM step(s), model=${modelUsed}`
    );
  }

  const parsed = parseAiCareerMatchingJson(finalContent);
  return {
    ...parsed,
    aiModel: modelUsed,
  };
}
