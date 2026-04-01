/**
 * Quiz API – calls OpenRouter directly (no Supabase Edge Function).
 * Add EXPO_PUBLIC_OPENROUTER_API_KEY to .env. Get key at https://openrouter.ai/keys
 */
import type { QuizNextResponse, QuizQuestion } from './types';
import {
  buildOpenRouterHeaders,
  getOpenRouterApiKey,
  OPENROUTER_URL,
  toOpenRouterError,
} from '../../api/openrouter';

const QUIZ_TOTAL_QUESTIONS = 10;

type DiscColor = 'red' | 'yellow' | 'green' | 'blue';

const STATIC_NOVA_QUESTIONS: QuizQuestion[] = [
  {
    type: 'question',
    question: 'When facing a professional challenge, what is your most natural reaction?',
    questionNumber: 1,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'red', label: 'I move straight to action and decide quickly', icon: 'flash' },
      { id: 'blue', label: 'I analyze carefully before acting', icon: 'analytics' },
      { id: 'green', label: 'I consult others and seek alignment', icon: 'people' },
      { id: 'yellow', label: 'I generate fresh ideas and options', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    question: 'In a trusted environment, your natural work style is mostly:',
    questionNumber: 2,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'red', label: 'Fast pace with ambitious targets', icon: 'target' },
      { id: 'blue', label: 'Structured framework with clear methods', icon: 'construct' },
      { id: 'green', label: 'Strong collaboration and team harmony', icon: 'handshake' },
      { id: 'yellow', label: 'Flexible rhythm with experimentation', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    question: 'Under pressure (deadlines, stakes, company culture), your adapted style becomes:',
    questionNumber: 3,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'red', label: 'More directive, I take control', icon: 'business' },
      { id: 'blue', label: 'More cautious, I reduce risk', icon: 'analytics' },
      { id: 'green', label: 'More diplomatic, I protect team balance', icon: 'people' },
      { id: 'yellow', label: 'More opportunistic, I pivot quickly', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    question: 'Which deep motivation (your core why) drives your long-term career progress?',
    questionNumber: 4,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'red', label: 'Achievement, status, and visible impact', icon: 'trophy' },
      { id: 'green', label: 'Purpose, contribution, and meaning', icon: 'flash' },
      { id: 'blue', label: 'Mastery, quality, and professional growth', icon: 'code' },
      { id: 'yellow', label: 'Freedom, autonomy, and variety', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    question: 'How do you prefer making an important decision?',
    questionNumber: 5,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'I gather evidence and compare options', icon: 'analytics' },
      { id: 'red', label: 'I decide quickly on what matters most', icon: 'flash' },
      { id: 'green', label: 'I discuss and align key stakeholders', icon: 'people' },
      { id: 'yellow', label: 'I prioritize vision and intuition', icon: 'target' },
    ],
  },
  {
    type: 'question',
    question: 'Your preferred communication style in a team is:',
    questionNumber: 6,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'red', label: 'Clear, direct, and outcome-focused', icon: 'business' },
      { id: 'blue', label: 'Precise, detailed, and structured', icon: 'construct' },
      { id: 'green', label: 'Empathetic, calm, and relational', icon: 'people' },
      { id: 'yellow', label: 'Inspiring, energetic, and expressive', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    question: 'When major change happens at work, your usual reaction is:',
    questionNumber: 7,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'red', label: 'I lead the change immediately', icon: 'flash' },
      { id: 'blue', label: 'I assess risks before committing', icon: 'analytics' },
      { id: 'green', label: 'I support others through the transition', icon: 'handshake' },
      { id: 'yellow', label: 'I explore new opportunities quickly', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    question: 'Which future professional path fits you best?',
    questionNumber: 8,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Domain expert with deep mastery', icon: 'code' },
      { id: 'red', label: 'Strategic leader focused on performance', icon: 'business' },
      { id: 'green', label: 'People manager and talent developer', icon: 'people' },
      { id: 'yellow', label: 'Intrapreneur or entrepreneurial innovator', icon: 'trophy' },
    ],
  },
  {
    type: 'question',
    question: 'In learning situations, you progress the most when:',
    questionNumber: 9,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'red', label: 'I am challenged with concrete goals', icon: 'target' },
      { id: 'blue', label: 'Content is structured and demanding', icon: 'analytics' },
      { id: 'green', label: 'I receive regular coaching and feedback', icon: 'handshake' },
      { id: 'yellow', label: 'I can experiment creatively and iteratively', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    question: 'When conflict appears in your team, your first reflex is:',
    questionNumber: 10,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'red', label: 'Reset direction quickly to move forward', icon: 'business' },
      { id: 'blue', label: 'Clarify facts, roles, and rules', icon: 'construct' },
      { id: 'green', label: 'De-escalate and rebuild trust', icon: 'people' },
      { id: 'yellow', label: 'Reframe positively and mobilize energy', icon: 'flash' },
    ],
  },
];

const INSTRUCTIONS = `You are an AI Career Assistant specialized in Nova-style psychometric profiling for professional career futures.
Output ONLY valid JSON. No markdown. No code fences.

If answers.length === ${QUIZ_TOTAL_QUESTIONS}, return results:
{"type":"results","careers":[{"title":"...","description":"...","matchPercent":85,"tags":["Tag1","Tag2"]},{"title":"...","description":"...","matchPercent":82,"tags":["Tag1","Tag2"]},{"title":"...","description":"...","matchPercent":80,"tags":["Tag1","Tag2"]}],"novaProfile":{"headline":"...","professionalIdentity":"...","behavior":{"primaryStyle":"...","secondaryStyle":"...","traits":["..."],"discBlend":"..."},"styleComparison":{"naturalStyleSummary":"...","adaptedStyleSummary":"...","adaptationDrivers":["..."],"stressSignals":["..."]},"motivations":{"topMotivators":["..."],"demotivators":["..."],"valuesSummary":"..."},"cognition":{"decisionStyle":"...","thinkingStyle":"...","learningStyle":"...","communicationStyle":"..."},"careerProjection":{"bestFitEnvironments":["..."],"leadershipStyle":"...","watchouts":["..."],"futureFocus":"..."},"recommendedDevelopmentAxes":["...","...","..."]}}

Rules:
- Ask Nova-style psychometric questions across behavior, motivations, cognition, communication, adaptation, and leadership potential.
- Tailor wording to professional context (career fit, team dynamics, growth trajectory, future role alignment).
- Exactly 3 careers. matchPercent between 75 and 98.
- Include 2-4 tags per career.
- Keep novaProfile concise, practical, and career-oriented.
- Icons allowed: brush, people, globe, business, ribbon, flash, trophy, construct, target, handshake, analytics, code.`;

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
  const normedQuestion = Math.max(0, Math.min(questionNumber - 1, STATIC_NOVA_QUESTIONS.length - 1));
  return STATIC_NOVA_QUESTIONS[normedQuestion] as QuizNextResponse;
}

function getDiscFromOptionId(optionId: string): DiscColor {
  if (optionId === 'red' || optionId === 'yellow' || optionId === 'green' || optionId === 'blue') {
    return optionId;
  }
  return 'blue';
}

function computeDiscPercentages(answers: string[]): {
  red: number;
  yellow: number;
  green: number;
  blue: number;
  dominant: DiscColor;
} {
  const answeredCount = Math.max(0, Math.min(answers.length, STATIC_NOVA_QUESTIONS.length));
  const scores = { red: 20, yellow: 20, green: 20, blue: 20 };

  // Each selected style reinforces one color strongly and related colors moderately.
  // Percentages are independent intensity indicators, not a forced 100% distribution.
  const contributionMap: Record<DiscColor, Record<DiscColor, number>> = {
    red: { red: 10, yellow: 4, green: 1, blue: 2 },
    yellow: { red: 3, yellow: 10, green: 4, blue: 2 },
    green: { red: 1, yellow: 4, green: 10, blue: 3 },
    blue: { red: 2, yellow: 2, green: 3, blue: 10 },
  };

  for (let i = 0; i < answeredCount; i++) {
    const selectedLabel = answers[i];
    const q = STATIC_NOVA_QUESTIONS[i];
    const selected = q.options.find((opt) => opt.label === selectedLabel);
    if (!selected) continue;

    const selectedColor = getDiscFromOptionId(selected.id);
    const weights = contributionMap[selectedColor];
    scores.red += weights.red;
    scores.yellow += weights.yellow;
    scores.green += weights.green;
    scores.blue += weights.blue;
  }

  const maxScorePerColor = 20 + answeredCount * 10;
  const normalize = (score: number) => Math.max(0, Math.min(100, Math.round((score / Math.max(1, maxScorePerColor)) * 100)));

  const percentages = {
    red: normalize(scores.red),
    yellow: normalize(scores.yellow),
    green: normalize(scores.green),
    blue: normalize(scores.blue),
  };

  const ordered = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
  const dominant = (ordered[0]?.[0] ?? 'blue') as DiscColor;

  return { ...percentages, dominant };
}

function generateFallbackResults(disc?: ReturnType<typeof computeDiscPercentages>): QuizNextResponse {
  const discData =
    disc ?? ({ red: 25, yellow: 25, green: 25, blue: 25, dominant: 'blue' } as ReturnType<typeof computeDiscPercentages>);
  return {
    type: 'results',
    careers: [
      {
        title: 'Software Engineer',
        description: 'Design, build, and maintain robust technical solutions.',
        matchPercent: 82,
        tags: ['Technology', 'Problem Solving', 'Continuous Learning'],
      },
      {
        title: 'Product Manager',
        description: 'Lead product vision and coordinate cross-functional teams.',
        matchPercent: 78,
        tags: ['Leadership', 'Strategy', 'Communication'],
      },
      {
        title: 'Data Analyst',
        description: 'Transform data into actionable recommendations for decisions.',
        matchPercent: 75,
        tags: ['Analytics', 'Data', 'Business Decisions'],
      },
    ],
    novaProfile: {
      headline: 'Nova Profile: high potential in evolving professional environments',
      professionalIdentity: 'You combine high standards, strong interpersonal awareness, and adaptability. Your style fits roles with increasing responsibility.',
      behavior: {
        primaryStyle:
          discData.dominant === 'red'
            ? 'Dominance (Red)'
            : discData.dominant === 'yellow'
              ? 'Influence (Yellow)'
              : discData.dominant === 'green'
                ? 'Steadiness (Green)'
                : 'Conscientiousness (Blue)',
        secondaryStyle: 'Secondary style activated under pressure',
        traits: ['Reliable', 'Conscientious', 'Collaborative', 'Growth-oriented'],
        discBlend: `R${discData.red} / Y${discData.yellow} / G${discData.green} / B${discData.blue}`,
        discPercentages: {
          red: discData.red,
          yellow: discData.yellow,
          green: discData.green,
          blue: discData.blue,
        },
      },
      styleComparison: {
        naturalStyleSummary: 'Natural style: structured execution, steady pace, and quality focus.',
        adaptedStyleSummary: 'Adapted style: faster decisions and more direct communication under pressure.',
        adaptationDrivers: ['Tight deadlines', 'High performance expectations', 'Ambiguous environments'],
        stressSignals: ['Mental overload', 'Over-controlling', 'Difficulty delegating'],
      },
      motivations: {
        topMotivators: ['Meaningful impact', 'Continuous progress', 'Recognition of outcomes'],
        demotivators: ['Unclear priorities', 'Low autonomy', 'Lack of growth paths'],
        valuesSummary: 'You perform best when your work has meaning, high standards, and measurable impact.',
      },
      cognition: {
        decisionStyle: 'Hybrid decision style: evidence plus pragmatism',
        thinkingStyle: 'Analytical thinking with strategic projection',
        learningStyle: 'Hands-on learning through feedback and iteration',
        communicationStyle: 'Clear, respectful, solution-oriented communication',
      },
      careerProjection: {
        bestFitEnvironments: ['Demanding project teams', 'Transformation contexts', 'Learning-oriented collaborative cultures'],
        leadershipStyle: 'Structured leadership: human support plus clear expectations',
        watchouts: ['Perfectionism under stress', 'Scattering across too many priorities'],
        futureFocus: 'Strong trajectory toward leadership, senior expertise, or management roles.',
      },
      recommendedDevelopmentAxes: [
        'Strengthen prioritization under uncertainty',
        'Develop cross-functional influence',
        'Improve delegation and coaching structure',
      ],
    },
  };
}

function clampPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeResults(
  response: QuizNextResponse,
  disc: ReturnType<typeof computeDiscPercentages>
): QuizNextResponse {
  if (response.type !== 'results') {
    return response;
  }

  const careers = Array.isArray(response.careers)
    ? response.careers.slice(0, 3).map((career) => ({
        ...career,
        matchPercent: clampPercent(career.matchPercent, 75, 98),
        tags: asStringArray(career.tags).slice(0, 4),
      }))
    : [];

  const fallbackNova = (generateFallbackResults(disc) as Extract<QuizNextResponse, { type: 'results' }>).novaProfile;

  return {
    ...response,
    careers,
    novaProfile: {
      ...(response.novaProfile ?? fallbackNova),
      behavior: {
        ...(response.novaProfile?.behavior ?? fallbackNova?.behavior),
        discPercentages: {
          red: disc.red,
          yellow: disc.yellow,
          green: disc.green,
          blue: disc.blue,
        },
        discBlend: `R${disc.red} / Y${disc.yellow} / G${disc.green} / B${disc.blue}`,
      },
    },
  };
}

function buildUserMessage(answers: string[]): string {
  const pairedAnswers = answers
    .map((answer, idx) => `Q${idx + 1}: ${STATIC_NOVA_QUESTIONS[idx]?.question}\nAnswer: ${answer}`)
    .join('\n\n');

  return `${INSTRUCTIONS}\n\nWe have ${QUIZ_TOTAL_QUESTIONS} static answers from a professional Nova-style quiz.\n\n${pairedAnswers}\n\nReturn results with careers and novaProfile.`;
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
        const disc = computeDiscPercentages(request.answers);
        return normalizeResults(parseContent(aiContent), disc);
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
  return generateFallbackResults(computeDiscPercentages(request.answers));
}

/**
 * Get the next quiz step: first question (answers empty), next question, or results.
 * Calls OpenRouter directly with multi-model failover and per-model exponential backoff retry.
 * Falls back to hardcoded questions/results if all models exhausted.
 */
export async function fetchQuizNext(request: QuizNextRequest): Promise<QuizNextResponse> {
  if (request.answers.length < QUIZ_TOTAL_QUESTIONS) {
    return generateFallbackQuestion(request.answers.length + 1);
  }

  try {
    return await callOpenRouter(request);
  } catch (err) {
    console.error('[Quiz] All OpenRouter attempts failed:', err);
    return generateFallbackResults(computeDiscPercentages(request.answers));
  }
}
