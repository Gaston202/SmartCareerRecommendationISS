import {
  buildOpenRouterHeaders,
  getOpenRouterApiKey,
  OPENROUTER_URL,
  toOpenRouterError,
} from '../../api/openrouter';
import { getLatestCvAnalysisFromBackend } from '../cv/api-backend';
import { getQuizSession } from '../quiz/storage';
import type {
  LearningRoadmap,
  LearningRoadmapNode,
  LearningCourse,
  LearningSkill,
  GraphNode,
  GraphEdge,
  LearningRoadmapGraph,
} from './types';

const LEARNING_ROADMAP_MODEL = 'arcee-ai/trinity-large-preview:free';

async function buildLearningRoadmapUserProfile(): Promise<{
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

function buildLearningRoadmapPrompt(
  careerTitle: string,
  careerDescription: string,
  userProfile: { skills?: string[]; novaProfile?: any; cvSummary?: string },
): string {
  return `
You are an expert learning path architect. Create a detailed skill-based learning roadmap for someone pursuing a ${careerTitle} career.

CAREER TARGET:
- Title: ${careerTitle}
- Description: ${careerDescription}

USER PROFILE:
- Existing Skills: ${userProfile.skills?.join(', ') || 'unknown'}
- CV Summary: ${userProfile.cvSummary || 'not available'}
- Learning Profile: ${userProfile.novaProfile ? JSON.stringify(userProfile.novaProfile) : 'not available'}

RESPONSE FORMAT:
Return ONLY valid JSON, no markdown, with this EXACT structure:
{
  "skills": [
    {
      "id": "unique-skill-id",
      "name": "Skill Name",
      "description": "Brief description of what this skill is",
      "level": "beginner|intermediate|advanced",
      "duration_hours": 40,
      "category": "Backend|Frontend|DevOps|Data Science|etc",
      "importance": "critical|important|nice-to-have",
      "prerequisites": ["skill-id-1", "skill-id-2"],
      "courses": [
        {
          "title": "Course Title",
          "provider": "Khan Academy|Udemy|Coursera|freeCodeCamp|YouTube|etc",
          "url": "https://actual-course-url.com",
          "duration_hours": 20,
          "level": "beginner|intermediate|advanced",
          "rating": 4.8,
          "free": true,
          "course_type": "video|interactive|text|project-based|live"
        }
      ]
    }
  ],
  "dependencies": [
    {
      "from_skill_id": "prerequisite-skill-id",
      "to_skill_id": "skill-that-requires-it",
      "dependency_type": "required|recommended"
    }
  ]
}

REQUIREMENTS:
- Include 8-15 core skills for the career path
- Start with foundational skills (e.g., fundamentals)
- Progress to specialized skills
- Include DevOps/tools/soft skills
- For each skill, include AT LEAST 2 REAL courses with actual URLs
- Prioritize FREE courses first, but include paid options for advanced topics
- Use REAL providers (Khan Academy, Udemy, Coursera, freeCodeCamp, YouTube channels)
- Include actual course URLs that are verifiable (e.g., Khan Academy tracks, Udemy courses, etc.)
- Level: beginner (~20-40h), intermediate (~40-80h), advanced (~80-150h)
- Importance: critical = required, important = recommended, nice-to-have = optional
- Dependencies: show skill prerequisites (e.g., "Git" is prerequisite for "CI/CD")
- For linear algebra: include Khan Academy Linear Algebra course
- For web development: include freeCodeCamp, Udacity, GeeksforGeeks
- For AI/ML: include Andrew Ng courses, Fast.ai, Hugging Face tutorials
- Always include real URLs that can be clicked and visited

EXAMPLE DEPENDENCIES:
- CI/CD depends on: Git, Testing, Scripting
- React depends on: JavaScript fundamentals, HTML/CSS
- Docker depends on: Linux basics, Command line
- Database Design depends on: SQL fundamentals
`;
}

function parseSkillsResponse(content: string): {
  skills: Array<{
    id: string;
    name: string;
    description: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    duration_hours: number;
    category: string;
    importance: 'critical' | 'important' | 'nice-to-have';
    prerequisites: string[];
    courses: Array<{
      title: string;
      provider: string;
      url: string;
      duration_hours: number;
      level: string;
      rating: number;
      free: boolean;
      course_type: string;
    }>;
  }>;
  dependencies: Array<{
    from_skill_id: string;
    to_skill_id: string;
    dependency_type: 'required' | 'recommended';
  }>;
} {
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

  const parsed = JSON.parse(jsonStr);
  if (!parsed.skills || !Array.isArray(parsed.skills) || parsed.skills.length === 0) {
    throw new Error('AI response did not contain valid skills array');
  }
  if (!parsed.dependencies || !Array.isArray(parsed.dependencies)) {
    throw new Error('AI response did not contain valid dependencies array');
  }

  return parsed;
}

export async function generateLearningRoadmap(
  careerTitle: string,
  careerDescription: string,
  careerId?: string,
): Promise<LearningRoadmap> {
  const key = getOpenRouterApiKey();
  const userProfile = await buildLearningRoadmapUserProfile();

  const content = buildLearningRoadmapPrompt(careerTitle, careerDescription, userProfile);

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: buildOpenRouterHeaders(key),
    body: JSON.stringify({
      model: LEARNING_ROADMAP_MODEL,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw toOpenRouterError(res.status, text);
  }

  const data = await res.json();
  const aiContent: string | undefined = data?.choices?.[0]?.message?.content?.trim();

  if (!aiContent) {
    throw new Error('Empty response from AI when generating learning roadmap');
  }

  const skillsData = parseSkillsResponse(aiContent);

  // Transform to LearningRoadmapNode array
  const skillMap = new Map<string, LearningSkill>();

  // Create skill objects
  skillsData.skills.forEach((skillData: any) => {
    const skill: LearningSkill = {
      id: skillData.id,
      name: skillData.name,
      description: skillData.description,
      level: skillData.level,
      duration_hours: skillData.duration_hours,
      prerequisites: skillData.prerequisites || [],
      category: skillData.category,
      importance: skillData.importance,
      created_at: new Date().toISOString(),
    };
    skillMap.set(skill.id, skill);
  });

  // Create nodes with courses
  const nodes: LearningRoadmapNode[] = skillsData.skills.map((skillData: any) => {
    const skill = skillMap.get(skillData.id)!;

    const courses: LearningCourse[] = (skillData.courses || []).map(
      (courseData: any, idx: number) => ({
        id: `${skillData.id}-course-${idx}`,
        skill_id: skillData.id,
        title: courseData.title,
        description: courseData.title,
        provider: courseData.provider,
        url: courseData.url,
        duration_hours: courseData.duration_hours,
        level: courseData.level,
        rating: courseData.rating || 4.5,
        students_count: undefined,
        free: courseData.free,
        course_type: courseData.course_type,
        created_at: new Date().toISOString(),
      })
    );

    const prerequisites = skill.prerequisites
      .map((prereqId) => skillMap.get(prereqId))
      .filter(Boolean) as LearningSkill[];

    return {
      skill,
      courses,
      dependencies: prerequisites,
    };
  });

  const totalHours = Array.from(skillMap.values()).reduce(
    (sum, skill) => sum + skill.duration_hours,
    0
  );
  const estimatedWeeks = Math.ceil(totalHours / 20);

  const roadmap: LearningRoadmap = {
    id: `learning-roadmap-${careerId}-${Date.now()}`,
    user_id: '',
    career_id: careerId || '',
    career_title: careerTitle,
    title: `Learning Path: ${careerTitle}`,
    description: `A comprehensive skill-based learning roadmap to become a ${careerTitle}`,
    skills: nodes,
    total_duration_hours: totalHours,
    estimated_weeks: estimatedWeeks,
    skill_count: nodes.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return roadmap;
}

export function buildGraphVisualization(roadmap: LearningRoadmap): LearningRoadmapGraph {
  const nodes: GraphNode[] = roadmap.skills.map((node, index) => ({
    id: node.skill.id,
    label: node.skill.name,
    level: node.skill.level,
    duration: node.skill.duration_hours,
    isPrerequisite: node.dependencies.length > 0,
    // Simple layout: arrange in levels
    x: (index % 3) * 100 + 50,
    y: Math.floor(index / 3) * 100 + 50,
  }));

  const edges: GraphEdge[] = [];
  roadmap.skills.forEach((node) => {
    node.dependencies.forEach((dep) => {
      edges.push({
        from: dep.id,
        to: node.skill.id,
        type: 'required', // Can be enhanced to check dependency type
      });
    });
  });

  return { nodes, edges };
}
