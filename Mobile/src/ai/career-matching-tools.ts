import type { OpenRouterToolDefinition } from "./types";
import type { AiCareerMatchingInput } from "../features/careers/ai-matching.types";
import type { ToolHandler } from "./orchestrator";

const TOOL_DEFINITIONS: OpenRouterToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_quiz_responses",
      description:
        "Returns all quiz questions and the user's selected answers for career matching.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_nova_psychometric_profile",
      description:
        "Returns Nova psychometric summary (motivations, cognition, work style) if available.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cv_and_skills_snapshot",
      description:
        "Returns user-confirmed skills plus CV analysis (ATS, extracted skills/interests, prior career suggestions).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reference_career_overview",
      description:
        "Summarizes careers available in the app database: counts by category and sample titles. Use before searching.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_reference_careers",
      description:
        "Keyword search over the reference career pool (title, description, category, required skills).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Space-separated keywords to match against careers.",
          },
          limit: {
            type: "integer",
            description: "Max careers to return (default 12, max 30).",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

function buildHandlers(input: AiCareerMatchingInput): Record<string, ToolHandler> {
  const pool = input.availableCareers ?? [];

  return {
    get_quiz_responses: () =>
      JSON.stringify({
        quizQuestions: input.quizQuestions,
      }),

    get_nova_psychometric_profile: () =>
      JSON.stringify({
        novaProfile: input.novaProfile ?? null,
      }),

    get_cv_and_skills_snapshot: () =>
      JSON.stringify({
        userSkills: input.userSkills,
        cvAnalysis: input.cvAnalysis ?? null,
      }),

    list_reference_career_overview: () => {
      const categories: Record<string, number> = {};
      for (const c of pool) {
        const key = c.category || "uncategorized";
        categories[key] = (categories[key] ?? 0) + 1;
      }
      const sampleTitles = pool.slice(0, 20).map((c) => c.title);
      return JSON.stringify({
        totalCareers: pool.length,
        categories,
        sampleTitles,
      });
    },

    search_reference_careers: (args) => {
      const query = String(args.query ?? "").trim().toLowerCase();
      const limit = Math.min(
        Math.max(Number(args.limit) || 12, 1),
        30
      );
      if (!query) {
        return JSON.stringify({ careers: [], note: "empty query" });
      }
      const words = query.split(/\s+/).filter((w) => w.length > 1);
      const scored = pool.map((c) => {
        const hay = `${c.title} ${c.description} ${c.category} ${(c.required_skills || []).join(" ")}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (hay.includes(w)) score += 1;
        }
        return { career: c, score };
      });
      const careers = scored
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.career);
      return JSON.stringify({ careers, matchedCount: careers.length });
    },
  };
}

export function createCareerMatchingTooling(input: AiCareerMatchingInput): {
  tools: OpenRouterToolDefinition[];
  toolHandlers: Record<string, ToolHandler>;
} {
  return {
    tools: TOOL_DEFINITIONS,
    toolHandlers: buildHandlers(input),
  };
}
