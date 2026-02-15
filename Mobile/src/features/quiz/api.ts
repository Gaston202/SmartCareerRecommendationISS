/**
 * Quiz API – calls OpenRouter directly (no Supabase Edge Function).
 * Add EXPO_PUBLIC_OPENROUTER_API_KEY to .env. Get key at https://openrouter.ai/keys
 */
import type { QuizNextResponse } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const INSTRUCTIONS = `You are a Career quiz AI. Output ONLY valid JSON, no markdown.
If answers.length < 5: return next question:
{"type":"question","question":"...?","questionNumber":1-5,"totalQuestions":5,"options":[{"id":"a","label":"...","icon":"brush"},{"id":"b","label":"...","icon":"people"},{"id":"c","label":"...","icon":"globe"},{"id":"d","label":"...","icon":"business"}]}
Icons: brush, people, globe, business, ribbon, flash, trophy, construct.
If answers.length === 5: return results:
{"type":"results","careers":[{"title":"...","description":"...","matchPercent":85,"tags":["Tag1","Tag2"]},{"title":"...","description":"...","matchPercent":82,"tags":["Tag1"]},{"title":"...","description":"...","matchPercent":80,"tags":["Tag1"]}]}
Exactly 3 careers, matchPercent 75-98, 2-4 tags each.`;

export interface QuizNextRequest {
  answers: string[];
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 6000;

function buildUserMessage(answers: string[]): string {
  const quizPart =
    answers.length === 0
      ? 'Start the quiz. Send the first question.'
      : `User's answers so far: ${JSON.stringify(answers)}. ${
          answers.length >= 5
            ? 'We have 5 answers. Return career results.'
            : `Return question number ${answers.length + 1} (next question with 4 options).`
        }`;
  return `${INSTRUCTIONS}\n\n${quizPart}`;
}

function parseContent(content: string): QuizNextResponse {
  let jsonStr = content;
  const start = content.indexOf('```');
  if (start >= 0) {
    const end = content.indexOf('```', start + 3);
    if (end >= 0) {
      jsonStr = content.slice(start + 3, end).trim();
      if (jsonStr.startsWith('json')) jsonStr = jsonStr.slice(4).trim();
    }
  }
  return JSON.parse(jsonStr) as QuizNextResponse;
}

async function callOpenRouter(request: QuizNextRequest): Promise<QuizNextResponse> {
  const key = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_OPENROUTER_API_KEY;
  if (!key || !key.startsWith('sk-')) {
    throw new Error('Add EXPO_PUBLIC_OPENROUTER_API_KEY to Mobile/.env. Get key at https://openrouter.ai/keys');
  }
  const content = buildUserMessage(request.answers);
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://smartcareer.app',
      'X-Title': 'Smart Career Recommendation',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-r1-0528:free',
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`OpenRouter error ${res.status}: ${text.slice(0, 150)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const aiContent = data?.choices?.[0]?.message?.content?.trim();
  if (!aiContent) throw new Error('Empty response from AI');
  return parseContent(aiContent);
}

/**
 * Get the next quiz step: first question (answers empty), next question, or results (after 5 answers).
 * Calls OpenRouter directly – no Supabase Edge Function.
 */
export async function fetchQuizNext(request: QuizNextRequest): Promise<QuizNextResponse> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callOpenRouter(request);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const status = (e as Error & { status?: number }).status;
      const isRateLimited = status === 429 || lastError.message.includes('429');
      if (__DEV__) console.warn('[Quiz] OpenRouter error:', e);
      if (attempt < MAX_RETRIES && (isRateLimited || status === 502 || status === 503)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error('Quiz request failed.');
}
