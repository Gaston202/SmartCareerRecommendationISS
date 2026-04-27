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

export const STATIC_NOVA_QUESTIONS: QuizQuestion[] = [
  {
    type: 'question',
    question: 'Do you prefer working independently or as part of a team?',
    questionNumber: 1,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'I do my best work alone, focused and self-directed', icon: 'code' },
      { id: 'green', label: 'I enjoy teamwork but also value some independent tasks', icon: 'people' },
      { id: 'red', label: 'I thrive in teams, especially when leading or competing', icon: 'target' },
      { id: 'yellow', label: 'I prefer spontaneous collaborations over structured teamwork', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    question: 'What kind of work environment helps you thrive most?',
    questionNumber: 2,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'A quiet, structured office with clear processes', icon: 'construct' },
      { id: 'green', label: 'A collaborative team space where I can support others', icon: 'handshake' },
      { id: 'red', label: 'A fast-paced, competitive setting with rapid decisions', icon: 'flash' },
      { id: 'yellow', label: 'A flexible, dynamic environment with variety and experimentation', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    question: 'What type of problems do you enjoy solving?',
    questionNumber: 3,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Complex analytical problems that require research and data', icon: 'analytics' },
      { id: 'green', label: 'People problems: conflicts, relationships, team dynamics', icon: 'people' },
      { id: 'red', label: 'Action problems: quick decisions, crisis management, obstacles to overcome', icon: 'business' },
      { id: 'yellow', label: 'Creative problems: designing, innovating, brainstorming new ideas', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    question: 'How important is it for your job to directly help or serve others?',
    questionNumber: 4,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Not important; I prefer technical or analytical work', icon: 'analytics' },
      { id: 'green', label: 'Very important; I want to make a positive difference in people\'s lives', icon: 'people' },
      { id: 'red', label: 'Somewhat important; helping others should align with achieving results', icon: 'target' },
      { id: 'yellow', label: 'It depends; I enjoy inspiring or entertaining others in creative ways', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    question: 'Do you prefer clear instructions and structure or freedom to innovate?',
    questionNumber: 5,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Clear instructions and well-defined processes are essential', icon: 'construct' },
      { id: 'green', label: 'I like some structure but also room to adapt and collaborate', icon: 'handshake' },
      { id: 'red', label: 'I want freedom to make decisions and chart my own course', icon: 'flash' },
      { id: 'yellow', label: 'Give me the vision and let me innovate freely with minimal rules', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    question: 'Which of these work activities sounds most appealing to you?',
    questionNumber: 6,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Analyzing data, writing reports, ensuring quality and accuracy', icon: 'analytics' },
      { id: 'green', label: 'Supporting, mentoring, or caring for people in some way', icon: 'people' },
      { id: 'red', label: 'Leading projects, meeting targets, making strategic decisions', icon: 'business' },
      { id: 'yellow', label: 'Creating designs, developing new concepts, expressing ideas', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    question: 'What is your preferred pace of work?',
    questionNumber: 7,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Steady, methodical pace with time to perfect my work', icon: 'construct' },
      { id: 'green', label: 'Moderate pace that allows for collaboration and relationship-building', icon: 'handshake' },
      { id: 'red', label: 'Fast-paced with quick turnarounds and high energy', icon: 'flash' },
      { id: 'yellow', label: 'Variable pace; sometimes intense bursts, sometimes relaxed exploration', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    question: 'When choosing a job, what matters most to you?',
    questionNumber: 8,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Job security, stability, and clear career progression path', icon: 'ribbon' },
      { id: 'green', label: 'Positive workplace culture and strong relationships with colleagues', icon: 'people' },
      { id: 'red', label: 'High salary, advancement opportunities, and visible recognition', icon: 'trophy' },
      { id: 'yellow', label: 'Creative freedom, variety of tasks, and opportunity to experiment', icon: 'brush' },
    ],
  },
  {
    type: 'question',
    question: 'What kind of people do you enjoy working with most?',
    questionNumber: 9,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Detail-oriented experts who value precision and quality', icon: 'analytics' },
      { id: 'green', label: 'Supportive, empathetic team players who create positive environments', icon: 'people' },
      { id: 'red', label: 'Ambitious, driven go-getters who push for results', icon: 'target' },
      { id: 'yellow', label: 'Creative, energetic innovators who think outside the box', icon: 'globe' },
    ],
  },
  {
    type: 'question',
    question: 'How do you like to receive feedback on your work?',
    questionNumber: 10,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    options: [
      { id: 'blue', label: 'Detailed, specific feedback with clear examples and data', icon: 'analytics' },
      { id: 'green', label: 'Encouraging, supportive feedback that considers my feelings', icon: 'people' },
      { id: 'red', label: 'Direct, concise feedback focused on results and improvement', icon: 'business' },
      { id: 'yellow', label: 'Brainstorming sessions where feedback flows as creative dialogue', icon: 'brush' },
    ],
  },
];

const INSTRUCTIONS = `You are an expert career coach generating quiz questions to discover a person's ideal job characteristics and work preferences.

CRITICAL: Output ONLY valid JSON. No markdown. No code fences. No explanations before or after. No extra text. Just the raw JSON object.

If answers.length < ${QUIZ_TOTAL_QUESTIONS}, return ONE question:
{"type":"question","questionNumber":{{questionNumber}},"totalQuestions":10,"question":"...","options":[{"id":"red|blue|green|yellow","label":"...","icon":"..."},{...},{...},{...}]}

If answers.length === ${QUIZ_TOTAL_QUESTIONS}, return results:
{"type":"results","careers":[{"title":"...","description":"...","matchPercent":85,"tags":["Tag1","Tag2"]},{"title":"...","description":"...","matchPercent":82,"tags":["Tag1","Tag2"]},{"title":"...","description":"...","matchPercent":80,"tags":["Tag1","Tag2"]}],"novaProfile":{"headline":"...","professionalIdentity":"...","behavior":{"primaryStyle":"...","secondaryStyle":"...","traits":["..."],"discBlend":"...","discPercentages":{"red":25,"yellow":25,"green":25,"blue":25}},"styleComparison":{"naturalStyleSummary":"...","adaptedStyleSummary":"...","adaptationDrivers":["..."],"stressSignals":["..."]},"motivations":{"topMotivators":["..."],"demotivators":["..."],"valuesSummary":"..."},"cognition":{"decisionStyle":"...","thinkingStyle":"...","learningStyle":"...","communicationStyle":"..."},"careerProjection":{"bestFitEnvironments":["..."],"leadershipStyle":"...","watchouts":["..."],"futureFocus":"..."},"recommendedDevelopmentAxes":["...","...","..."]}}

QUESTION GENERATION RULES:
1. ONLY ask about work PREFERENCES and DESIRES. DO NOT ask about:
   - Resumes, CVs, cover letters, job applications, interviews
   - Past experiences or education
   - Stress reactions or pressure situations
   - Personality under stress

2. ONLY ask about these topics:
   - Teamwork vs independent work
   - Work environment (office, remote, field, pace)
   - Types of tasks (analytical, creative, administrative, technical, helping)
   - Interaction with people (client-facing, collaborative, solo)
   - Work values (achievement, creativity, stability, income, impact, balance)
   - Decision-making freedom vs structure
   - Learning preferences
   - Problem-solving interests
   - Career goals and motivations

3. Example good questions:
   - "Do you prefer working alone or in a team?"
   - "What kind of problems do you find most satisfying?"
   - "How important is helping others in your job?"
   - "Do you like fast-paced or steady work?"
   - "What motivates you more: money, creativity, or making a difference?"

4. Each question MUST have:
   - questionNumber (the current number)
   - totalQuestions (always 10)
   - clear question text
   - exactly 4 options with id (red/blue/green/yellow), label, and icon

5. Use previous answers to adapt: if they like analytical tasks, ask about data; if they like helping, ask about people-focused work; if they like creativity, ask about design/innovation.

6. Map options to DISC colors for later psychometric analysis:
   - red: action-oriented, decisive, competitive, results-focused
   - blue: analytical, precise, quality-focused, systematic
   - green: collaborative, supportive, harmonious
   - yellow: innovative, expressive, spontaneous, big-picture

NEVER stray from career preference questions.`;

export interface QuizNextRequest {
  answers: string[];
}

const QUIZ_MAX_RETRIES_PER_MODEL = 2;
const QUIZ_BASE_RETRY_DELAY_MS = 1500;
const QUIZ_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
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
  const question = STATIC_NOVA_QUESTIONS[normedQuestion] as QuizNextResponse;
  // Ensure questionNumber and totalQuestions are correctly set
  return {
    ...question,
    questionNumber,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
  };
}

function getDiscFromOptionId(optionId: string): DiscColor {
  if (optionId === 'red' || optionId === 'yellow' || optionId === 'green' || optionId === 'blue') {
    return optionId;
  }
  return 'blue';
}

export function computeDiscPercentages(answers: string[]): {
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

export function generateFallbackResults(disc?: ReturnType<typeof computeDiscPercentages>): QuizNextResponse {
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

  // Try to extract from code block first (markdown)
  const start = content.indexOf('```');
  if (start >= 0) {
    const end = content.indexOf('```', start + 3);
    if (end >= 0) {
      jsonStr = content.slice(start + 3, end).trim();
      if (jsonStr.startsWith('json')) jsonStr = jsonStr.slice(4).trim();
      try {
        return JSON.parse(jsonStr) as QuizNextResponse;
      } catch (e) {
        console.warn('Failed to parse JSON from code block, trying other methods', e);
      }
    }
  }

  // Find first { and parse character by character to find matching closing brace
  const firstBrace = content.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = firstBrace; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' || char === "'") {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            jsonStr = content.substring(firstBrace, i + 1).trim();
            try {
              return JSON.parse(jsonStr) as QuizNextResponse;
            } catch (e) {
              console.warn('Failed to parse extracted JSON', e);
            }
          }
        }
      }
    }
  }

  // If content itself looks like JSON, try parsing it directly
  try {
    const trimmed = content.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return JSON.parse(trimmed) as QuizNextResponse;
    }
  } catch (e) {
    // ignore
  }

  throw new Error(`Could not extract valid JSON from AI response. Content preview: ${content.substring(0, 200)}...`);
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
 * Falls back to hardcoded questions/results only if all AI models fail and retries exhausted.
 */
export async function fetchQuizNext(request: QuizNextRequest): Promise<QuizNextResponse> {
  try {
    return await callOpenRouter(request);
  } catch (err) {
    console.error('[Quiz] OpenRouter failed:', err);
    if (request.answers.length < QUIZ_TOTAL_QUESTIONS) {
      return generateFallbackQuestion(request.answers.length + 1);
    }
    return generateFallbackResults(computeDiscPercentages(request.answers));
  }
}
