import {
  buildOpenRouterHeaders,
  getOpenRouterApiKey,
  OPENROUTER_URL,
  toOpenRouterError,
} from '../../api/openrouter';
import { getQuizSession } from '../quiz/storage';
import type { SavedRoadmap, RoadmapStep } from './types';
import { getLatestCvAnalysisFromBackend } from '../cv/api-backend';
import { assertRoadmapPrerequisites } from './prerequisites';

const ROADMAP_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

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
  await assertRoadmapPrerequisites();
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

  const steps = parseRoadmapResponse(aiContent);

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
