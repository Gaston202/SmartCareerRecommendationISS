// Supabase Edge Function: quiz-next
// Calls OpenRouter to get next quiz question or career results. API key stays on server.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Use a small, fast model to avoid 504 timeout and 546 CPU limit. 70B models are too slow!
const MODEL = "deepseek/deepseek-r1-0528:free";

// CORS headers so the app (and browser) can call this function
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Short prompt = faster response, less CPU, avoids 504/546
const SYSTEM_PROMPT = `Career quiz AI. Output ONLY valid JSON, no markdown.

If answers.length < 5: return next question:
{"type":"question","question":"...?","questionNumber":1-5,"totalQuestions":5,"options":[{"id":"a","label":"...","icon":"brush"},{"id":"b","label":"...","icon":"people"},{"id":"c","label":"...","icon":"globe"},{"id":"d","label":"...","icon":"business"}]}
Icons: brush, people, globe, business, ribbon, flash, trophy, construct.

If answers.length === 5: return results:
{"type":"results","careers":[{"title":"...","description":"...","matchPercent":85,"tags":["Tag1","Tag2"]},{"title":"...","description":"...","matchPercent":82,"tags":["Tag1"]},{"title":"...","description":"...","matchPercent":80,"tags":["Tag1"]}]}
Exactly 3 careers, matchPercent 75-98, 2-4 tags each.`;

function buildUserMessage(answers: string[]): string {
  if (answers.length === 0) {
    return "Start the quiz. Send the first question.";
  }
  return `User's answers so far: ${JSON.stringify(answers)}. ${
    answers.length >= 5
      ? "We have 5 answers. Return career results."
      : `Return question number ${answers.length + 1} (next question with 4 options).`
  }`;
}

interface QuizNextBody {
  answers?: string[];
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request): Promise<Response> {
  const json = (body: unknown, status: number, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return json({ error: "OPENROUTER_API_KEY not set in Supabase secrets" }, 500);
    }

    const body = (await req.json()) as QuizNextBody;
    const answers = Array.isArray(body.answers) ? body.answers : [];

    const userMessage = buildUserMessage(answers);

    const openRouterRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 512,
        temperature: 0.5,
      }),
    });

    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      console.error("OpenRouter error:", openRouterRes.status, errText);
      return json({ error: "AI service error", details: errText }, 502);
    }

    const data = await openRouterRes.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return json({ error: "Empty response from AI" }, 502);
    }

    // Strip markdown code blocks if present (lightweight string ops to save CPU)
    let jsonStr = content;
    const start = content.indexOf("```");
    if (start >= 0) {
      const end = content.indexOf("```", start + 3);
      if (end >= 0) {
        jsonStr = content.slice(start + 3, end).trim();
        if (jsonStr.startsWith("json")) jsonStr = jsonStr.slice(4).trim();
      }
    }
    const parsed = JSON.parse(jsonStr);

    return json(parsed, 200);
  } catch (e) {
    console.error("quiz-next error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}
