import {
  buildOpenRouterHeaders,
  getOpenRouterApiKey,
  OPENROUTER_URL,
  toOpenRouterError,
} from '../../api/openrouter';
import { getQuizSession } from '../quiz/storage';
import type { SavedRoadmap, RoadmapStep } from './types';
import { getLatestCvAnalysisFromBackend } from '../cv/api-backend';

const ROADMAP_MODEL = 'arcee-ai/trinity-large-preview:free';

async function buildRoadmapUserProfile(): Promise<{
  skills?: string[];
  novaProfile?: any;
  cvSummary?: string;
}> {
  const [quizSession, cvAnalysis] = await Promise.all([
    getQuizSession().catch(() => null),
    getLatestCvAnalysisFromBackend().catch(() => null),
  ]);

  const quizNovaProfile = quizSession?.results?.novaProfile;

  const extractedSkills = Array.isArray(cvAnalysis?.extracted_skills)
    ? cvAnalysis.extracted_skills
    : [];
  const extractedInterests = Array.isArray(cvAnalysis?.extracted_interests)
    ? cvAnalysis.extracted_interests
    : [];

  const uniqueSkills = Array.from(
    new Set([...extractedSkills, ...extractedInterests].filter(Boolean)),
  );

  const cvSummaryParts = [
    typeof cvAnalysis?.ats_score === 'number'
      ? `ATS score: ${cvAnalysis.ats_score}/100.`
      : null,
    uniqueSkills.length > 0
      ? `Extracted strengths: ${uniqueSkills.slice(0, 12).join(', ')}.`
      : null,
  ].filter(Boolean) as string[];

  return {
    skills: uniqueSkills,
    novaProfile: quizNovaProfile,
    cvSummary: cvSummaryParts.join(' '),
  };
}

function buildUserMessage(
  careerTitle: string,
  careerDescription: string,
  tags: string[] | undefined,
  userProfile: { skills?: string[]; novaProfile?: any; cvSummary?: string },
): string {
  return `
You are an expert career coach. Create a clear, actionable learning and experience roadmap for this target career.

TARGET CAREER:
- Title: ${careerTitle}
- Description: ${careerDescription}
- Tags: ${tags && tags.length > 0 ? tags.join(', ') : 'none'}

USER PROFILE:
- Skills: ${userProfile.skills?.join(', ') || 'unknown'}
- CV Summary: ${userProfile.cvSummary || 'not available'}
- Nova Profile: ${userProfile.novaProfile ? JSON.stringify(userProfile.novaProfile) : 'not available'}

RESPONSE FORMAT:
Return ONLY valid JSON, no markdown, with this exact structure:
{
  "steps": [
    {
      "title": "Short step title",
      "description": "2-3 sentences with concrete actions and resources.",
      "timeframe": "Suggested timeframe, e.g. 1-3 months"
    }
  ]
}

RULES:
- 5 to 7 steps maximum
- Start from beginner level and progress to getting a first job in this career
- Be realistic for a student or early-career person
`.trim();
}

function parseRoadmapResponse(content: string): RoadmapStep[] {
  let jsonStr = content.trim();

  // Strip markdown fences if present
  if (jsonStr.startsWith('```')) {
    const firstNewline = jsonStr.indexOf('\n');
    if (firstNewline !== -1) {
      jsonStr = jsonStr.slice(firstNewline + 1);
    }
    const fenceIndex = jsonStr.lastIndexOf('```');
    if (fenceIndex !== -1) {
      jsonStr = jsonStr.slice(0, fenceIndex);
    }
    jsonStr = jsonStr.trim();
  }

  const parsed = JSON.parse(jsonStr) as { steps?: RoadmapStep[] };
  if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error('AI response did not contain steps');
  }
  return parsed.steps;
}

export async function generateCareerRoadmap(
  careerTitle: string,
  careerDescription: string,
  tags?: string[],
  matchPercent?: number,
  careerId?: string,
): Promise<SavedRoadmap> {
  const key = getOpenRouterApiKey();
  const userProfile = await buildRoadmapUserProfile();

  // Load latest quiz session to give more context (if available)
  const quizSession = await getQuizSession();

  const quizSummary = quizSession
    ? quizSession.questionsWithAnswers
        .map(
          (q) =>
            `Q${q.questionNumber}: ${q.question}\nAnswer: ${q.selectedOption}`,
        )
        .join('\n\n')
    : 'No quiz context available.';

  const content = `${buildUserMessage(careerTitle, careerDescription, tags, userProfile)}

ADDITIONAL USER CONTEXT FROM QUIZ:
${quizSummary}
`;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: buildOpenRouterHeaders(key),
    body: JSON.stringify({
      model: ROADMAP_MODEL,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw toOpenRouterError(res.status, text);
  }

  const data = await res.json();
  const aiContent: string | undefined =
    data?.choices?.[0]?.message?.content?.trim();

  if (!aiContent) {
    throw new Error('Empty response from AI when generating roadmap');
  }

  let steps: RoadmapStep[];
  try {
    steps = parseRoadmapResponse(aiContent);
  } catch (error) {
    console.warn('[roadmaps] Failed to parse AI roadmap JSON, falling back', error);
    steps = [
      {
        title: 'Explore the career basics',
        description:
          'Research what this career does day-to-day, required skills, and typical entry roles. Watch 3–5 YouTube videos and read 2–3 articles from trusted sources.',
        timeframe: '1-2 weeks',
      },
      {
        title: 'Build core fundamentals',
        description:
          'Create a study plan to learn the essential theory and tools for this career using free online courses (Coursera, edX, Udemy, etc.). Take notes and complete at least one beginner course.',
        timeframe: '1-2 months',
      },
      {
        title: 'Start a small project',
        description:
          'Choose a simple project related to this career and complete it end-to-end. Document what you did and what you learned so it can be added to your CV or portfolio.',
        timeframe: '1 month',
      },
      {
        title: 'Grow your portfolio',
        description:
          'Add 1–2 more projects that show different skills (teamwork, problem-solving, tools). Publish them on GitHub or a simple online portfolio.',
        timeframe: '2-3 months',
      },
      {
        title: 'Prepare for internships or entry roles',
        description:
          'Update your CV, optimize your LinkedIn, and apply to internships, freelance gigs, or entry-level roles in this field. Practice interview questions and talk to professionals.',
        timeframe: '1-3 months',
      },
    ];
  }

  const roadmap: SavedRoadmap = {
    id: `${careerTitle}-${Date.now()}`,
    careerId,
    careerTitle,
    careerDescription,
    matchPercent,
    tags,
    createdAt: new Date().toISOString(),
    steps,
  };

  return roadmap;
}

