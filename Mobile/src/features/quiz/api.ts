/**
 * Quiz API – calls OpenRouter directly (no Supabase Edge Function).
 * Add EXPO_PUBLIC_OPENROUTER_API_KEY to .env. Get key at https://openrouter.ai/keys
 */
import type { QuizNextResponse } from './types';
import {
  buildOpenRouterHeaders,
  getOpenRouterApiKey,
  OPENROUTER_URL,
  toOpenRouterError,
} from '../../api/openrouter';

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

const QUIZ_MAX_RETRIES_PER_MODEL = 2;
const QUIZ_BASE_RETRY_DELAY_MS = 1500;
const QUIZ_MODELS = [
  'arcee-ai/trinity-large-preview:free',
  'stepfun/step-3.5-flash:free',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  const exponential = QUIZ_BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

function logDebug(message: string, ...args: unknown[]) {
  if (__DEV__) {
    console.log(message, ...args);
  }
}

function generateFallbackQuestion(questionNumber: number): QuizNextResponse {
  const fallbackQuestions = [
    {
      type: 'question',
      question: 'Which area interests you most?',
      questionNumber: 1,
      totalQuestions: 5,
      options: [
        { id: 'a', label: 'Technology & Software', icon: 'flash' },
        { id: 'b', label: 'Business & Management', icon: 'business' },
        { id: 'c', label: 'Creative & Design', icon: 'brush' },
        { id: 'd', label: 'Healthcare & Science', icon: 'ribbon' },
      ],
    },
    {
      type: 'question',
      question: 'What is your preferred work environment?',
      questionNumber: 2,
      totalQuestions: 5,
      options: [
        { id: 'a', label: 'Remote & Independent', icon: 'globe' },
        { id: 'b', label: 'Team Collaboration', icon: 'people' },
        { id: 'c', label: 'Mixed (Remote & Office)', icon: 'business' },
        { id: 'd', label: 'On-site Only', icon: 'construct' },
      ],
    },
    {
      type: 'question',
      question: 'What drives your career decisions?',
      questionNumber: 3,
      totalQuestions: 5,
      options: [
        { id: 'a', label: 'Salary & Benefits', icon: 'trophy' },
        { id: 'b', label: 'Impact & Meaning', icon: 'flash' },
        { id: 'c', label: 'Learning & Growth', icon: 'brush' },
        { id: 'd', label: 'Work-Life Balance', icon: 'people' },
      ],
    },
    {
      type: 'question',
      question: 'What is your experience level?',
      questionNumber: 4,
      totalQuestions: 5,
      options: [
        { id: 'a', label: 'Entry Level (0-2 years)', icon: 'construct' },
        { id: 'b', label: 'Mid-Level (2-5 years)', icon: 'flash' },
        { id: 'c', label: 'Senior (5+ years)', icon: 'trophy' },
        { id: 'd', label: 'Career Change', icon: 'globe' },
      ],
    },
    {
      type: 'question',
      question: 'What is your learning style?',
      questionNumber: 5,
      totalQuestions: 5,
      options: [
        { id: 'a', label: 'Hands-on Practice', icon: 'construct' },
        { id: 'b', label: 'Structured Learning', icon: 'brush' },
        { id: 'c', label: 'Mentorship', icon: 'people' },
        { id: 'd', label: 'Self-directed Study', icon: 'globe' },
      ],
    },
  ];

  const normedQuestion = Math.max(0, Math.min(questionNumber - 1, fallbackQuestions.length - 1));
  return fallbackQuestions[normedQuestion] as QuizNextResponse;
}

function generateFallbackResults(): QuizNextResponse {
  return {
    type: 'results',
    careers: [
      {
        title: 'Software Engineer',
        description: 'Build and maintain software solutions across various platforms and technologies.',
        matchPercent: 82,
        tags: ['Technology', 'Problem-solving', 'Continuous Learning'],
      },
      {
        title: 'Product Manager',
        description: 'Lead product vision and strategy while collaborating with cross-functional teams.',
        matchPercent: 78,
        tags: ['Leadership', 'Strategy', 'Communication'],
      },
      {
        title: 'Data Analyst',
        description: 'Transform data into actionable insights to drive business decisions.',
        matchPercent: 75,
        tags: ['Analysis', 'Technology', 'Business Insight'],
      },
    ],
  };
}

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
  const key = getOpenRouterApiKey();
  const content = buildUserMessage(request.answers);
  let lastError: unknown = null;

  for (let modelIndex = 0; modelIndex < QUIZ_MODELS.length; modelIndex++) {
    const model = QUIZ_MODELS[modelIndex];

    for (let attempt = 0; attempt <= QUIZ_MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: buildOpenRouterHeaders(key),
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content }],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          const err = toOpenRouterError(res.status, text);
          lastError = err;

          logDebug(`[Quiz] OpenRouter response status: ${res.status} (${model}, attempt ${attempt + 1})`);

          const status = err.status;
          const isRetryable = status === 429 || status === 502 || status === 503 || status === 504;

          if (isRetryable && attempt < QUIZ_MAX_RETRIES_PER_MODEL) {
            const delayMs = getRetryDelay(attempt);
            logDebug(`[Quiz] Retry ${model} after ${status} in ${delayMs}ms...`);
            await sleep(delayMs);
            continue;
          }

          if ((status === 429 || status === 404) && modelIndex < QUIZ_MODELS.length - 1) {
            logDebug(`[Quiz] Model unavailable (status ${status}), switching to next model...`);
            break;
          }

          throw err;
        }

        const data = await res.json();
        const aiContent = data?.choices?.[0]?.message?.content?.trim();
        if (!aiContent) {
          throw new Error('Empty response from AI');
        }

        logDebug(`[Quiz] OpenRouter success with ${model}`);
        return parseContent(aiContent);
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number })?.status;
        const isRetryable = status === 429 || status === 502 || status === 503 || status === 504;

        if (!isRetryable) {
          logDebug(`[Quiz] Non-retryable error (${model}):`, err);
          throw err;
        }

        logDebug(`[Quiz] Retryable error (${model}, attempt ${attempt + 1}):`, err);
      }
    }
  }

  console.warn(`[Quiz] ⚠️ All OpenRouter models exhausted, using fallback response`);
  return request.answers.length >= 5
    ? generateFallbackResults()
    : generateFallbackQuestion(request.answers.length + 1);
}

/**
 * Get the next quiz step: first question (answers empty), next question, or results (after 5 answers).
 * Calls OpenRouter directly with multi-model failover and per-model exponential backoff retry.
 * Falls back to hardcoded questions/results if all models exhausted.
 */
export async function fetchQuizNext(request: QuizNextRequest): Promise<QuizNextResponse> {
  try {
    return await callOpenRouter(request);
  } catch (err) {
    console.error('[Quiz] All OpenRouter attempts failed:', err);
    // Fallback: return question or results without crashing
    return request.answers.length >= 5
      ? generateFallbackResults()
      : generateFallbackQuestion(request.answers.length + 1);
  }
}
