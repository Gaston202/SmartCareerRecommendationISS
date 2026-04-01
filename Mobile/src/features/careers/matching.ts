/**
 * Career Matching Service
 * Combines quiz results, CV analysis, and user skills to calculate career match scores
 * Now with AI-powered matching using OpenRouter for comprehensive analysis
 */

import type { CareerWithSkills } from './types';
import type { QuizResults, QuestionWithAnswer } from '../quiz/types';
import type { CvAnalysis } from '../cv/types';
import {
  generateAiCareerMatches,
  type AiCareerMatchingInput,
  type AiCareerMatchingOutput,
  type AiCareerMatchResult,
} from './ai-matching.service';

export interface CareerMatch {
  career: CareerWithSkills;
  score: number; // 0-100
  matchReasons: string[];
}

export interface AiPoweredCareerMatch extends CareerMatch {
  aiInsights?: AiCareerMatchResult;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
}

function toDemandLevel(value: string | undefined): CareerWithSkills['demand_level'] {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'very-high') {
    return value;
  }
  return 'high';
}

function toAverageSalary(salaryRange: string | undefined): number {
  if (!salaryRange) return 85000;

  const numbers = salaryRange
    .replace(/,/g, '')
    .match(/\d{2,6}/g)
    ?.map((n) => Number(n))
    .filter((n) => Number.isFinite(n)) || [];

  if (numbers.length === 0) return 85000;
  if (numbers.length === 1) return numbers[0];
  return Math.round((numbers[0] + numbers[1]) / 2);
}

function buildGeneratedCareer(aiResult: AiCareerMatchResult, index: number): CareerWithSkills {
  const now = new Date().toISOString();
  const generatedSkills = (aiResult.requiredSkills || []).slice(0, 8);

  return {
    id: `ai-generated-${index + 1}-${slugify(aiResult.careerTitle) || 'career'}`,
    title: aiResult.careerTitle,
    description: aiResult.careerDescription,
    category: aiResult.careerCategory || 'AI Recommended',
    required_skills: generatedSkills,
    average_salary: toAverageSalary(aiResult.estimatedSalaryRange),
    growth_rate: Math.max(0, Math.min(40, Math.round(aiResult.growthRatePercent || 15))),
    demand_level: toDemandLevel(aiResult.demandLevel),
    created_at: now,
    updated_at: now,
    skills: generatedSkills.map((skill, skillIndex) => ({
      id: `ai-skill-${index + 1}-${skillIndex + 1}-${slugify(skill) || 'skill'}`,
      name: skill,
      category: 'AI Suggested',
      created_at: now,
      importance: 'required',
    })),
  };
}

function normalizeScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateSkillOverlapScore(
  userSkills: string[],
  careerRequiredSkills: string[]
): { score: number; matched: number; total: number } {
  if (!careerRequiredSkills || careerRequiredSkills.length === 0) {
    return { score: 100, matched: 0, total: 0 };
  }

  const userSkillsNorm = userSkills.map((s) => s.toLowerCase().trim());
  let matched = 0;

  for (const required of careerRequiredSkills) {
    const requiredNorm = required.toLowerCase().trim();
    if (
      userSkillsNorm.some((s) =>
        s.includes(requiredNorm) || requiredNorm.includes(s)
      )
    ) {
      matched++;
    }
  }

  const score = (matched / careerRequiredSkills.length) * 100;
  return { score, matched, total: careerRequiredSkills.length };
}

function extractCareerTitlesFromQuiz(
  quizResults: QuizResults
): Map<string, number> {
  const careerScores = new Map<string, number>();

  for (const career of quizResults.careers) {
    const title = career.title.toLowerCase().trim();
    careerScores.set(title, career.matchPercent);
  }

  return careerScores;
}

function extractCareerTitlesFromCv(cvAnalysis: CvAnalysis): Map<string, number> {
  const careerScores = new Map<string, number>();

  if (cvAnalysis.career_suggestions && Array.isArray(cvAnalysis.career_suggestions)) {
    for (const career of cvAnalysis.career_suggestions) {
      const title = (career as any).title?.toLowerCase().trim();
      const score = (career as any).match_score ?? 0;
      if (title) {
        careerScores.set(title, score);
      }
    }
  }

  return careerScores;
}

export function calculateCareerMatches(
  allCareers: CareerWithSkills[],
  userSkills: string[],
  quizResults?: QuizResults,
  cvAnalysis?: CvAnalysis
): CareerMatch[] {
  const quizCareerScores = quizResults
    ? extractCareerTitlesFromQuiz(quizResults)
    : new Map();
  const cvCareerScores = cvAnalysis
    ? extractCareerTitlesFromCv(cvAnalysis)
    : new Map();

  const matches: CareerMatch[] = allCareers.map((career) => {
    const careerTitleLower = career.title.toLowerCase().trim();
    let totalScore = 0;
    let componentCount = 0;
    const reasons: string[] = [];

    // 1. Skill overlap (40% weight)
    const skillOverlap = calculateSkillOverlapScore(
      userSkills,
      career.required_skills || []
    );
    if (skillOverlap.total > 0) {
      totalScore += skillOverlap.score * 0.4;
      componentCount += 0.4;
      if (skillOverlap.matched > 0) {
        reasons.push(`${skillOverlap.matched}/${skillOverlap.total} required skills matched`);
      } else {
        reasons.push('Skills to learn for this role');
      }
    } else {
      totalScore += 100 * 0.4;
      componentCount += 0.4;
    }

    // 2. Quiz match (35% weight)
    const quizScore =
      Array.from(quizCareerScores.entries()).find(
        ([title]) =>
          title.includes(careerTitleLower) ||
          careerTitleLower.includes(title)
      )?.[1] ?? null;

    if (quizScore !== null) {
      totalScore += quizScore * 0.35;
      componentCount += 0.35;
      reasons.push(`Quiz match: ${quizScore}%`);
    }

    // 3. CV analysis match (25% weight)
    const cvScore =
      Array.from(cvCareerScores.entries()).find(
        ([title]) =>
          title.includes(careerTitleLower) ||
          careerTitleLower.includes(title)
      )?.[1] ?? null;

    if (cvScore !== null) {
      totalScore += cvScore * 0.25;
      componentCount += 0.25;
      reasons.push(`CV analysis match: ${cvScore}%`);
    }

    // Normalize based on available components
    const finalScore =
      componentCount > 0 ? normalizeScore(totalScore / componentCount) : 70;

    return {
      career,
      score: finalScore,
      matchReasons: reasons,
    };
  });

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * AI-Powered Career Matching - Uses OpenRouter to analyze comprehensive user data
 * @param userId User ID
 * @param allCareers All available careers to consider
 * @param questionsWithAnswers Quiz questions with user's answers
 * @param userSkills User's confirmed skills
 * @param cvAnalysis CV analysis data
 * @returns TOP 5 careers ranked by AI with detailed match insights
 */
export async function calculateAiPoweredCareerMatches(
  userId: string,
  allCareers: CareerWithSkills[],
  questionsWithAnswers: QuestionWithAnswer[],
  userSkills: string[],
  quizResults?: QuizResults,
  cvAnalysis?: CvAnalysis,
  quizSessionId?: string | null
): Promise<AiPoweredCareerMatch[]> {
  try {
    // Prepare input for AI matching service
    const aiInput: AiCareerMatchingInput = {
      userId,
      userSkills,
      quizQuestions: questionsWithAnswers.map((q) => ({
        questionNumber: q.questionNumber,
        question: q.question,
        selectedOption: q.selectedOption,
        allOptions: q.allOptions,
      })),
      novaProfile: quizResults?.novaProfile
        ? {
            headline: quizResults.novaProfile.headline,
            professionalIdentity: quizResults.novaProfile.professionalIdentity,
            primaryStyle: quizResults.novaProfile.behavior?.primaryStyle,
            topMotivators: quizResults.novaProfile.motivations?.topMotivators || [],
            decisionStyle: quizResults.novaProfile.cognition?.decisionStyle,
            learningStyle: quizResults.novaProfile.cognition?.learningStyle,
            communicationStyle: quizResults.novaProfile.cognition?.communicationStyle,
            bestFitEnvironments: quizResults.novaProfile.careerProjection?.bestFitEnvironments || [],
            watchouts: quizResults.novaProfile.careerProjection?.watchouts || [],
            recommendedDevelopmentAxes: quizResults.novaProfile.recommendedDevelopmentAxes || [],
          }
        : undefined,
      availableCareers: allCareers.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        required_skills: c.required_skills || [],
        average_salary: c.average_salary,
        growth_rate: c.growth_rate,
        demand_level: c.demand_level,
      })),
      cvAnalysis: cvAnalysis
        ? {
            atsScore: cvAnalysis.ats_score || 0,
            extractedSkills: Array.isArray(cvAnalysis.extracted_skills)
              ? cvAnalysis.extracted_skills
              : [],
            extractedInterests: Array.isArray(cvAnalysis.extracted_interests)
              ? cvAnalysis.extracted_interests
              : [],
            careerSuggestions: Array.isArray(cvAnalysis.career_suggestions)
              ? cvAnalysis.career_suggestions.map((c: any) => ({
                  title: c.title || "",
                  match_score: c.match_score || c.why || 0,
                }))
              : [],
          }
        : undefined,
    };

    // Call AI matching service
    const aiOutput: AiCareerMatchingOutput = await generateAiCareerMatches(aiInput);

    // Convert AI results directly to generated careers (not constrained to DB entries)
    const matches: AiPoweredCareerMatch[] = aiOutput.topMatches
      .map((aiResult, index) => {
        return {
          career: buildGeneratedCareer(aiResult, index),
          score: aiResult.matchScore,
          matchReasons: [
            aiResult.matchingFactors.quizAlignment,
            aiResult.matchingFactors.skillsMatch,
            ...(aiResult.matchingFactors.cvAnalysisMatch
              ? [aiResult.matchingFactors.cvAnalysisMatch]
              : []),
          ].filter(Boolean),
          aiInsights: aiResult,
        } as AiPoweredCareerMatch;
      })
      .filter((m) => m !== null) as AiPoweredCareerMatch[];

    if (matches.length === 0 && aiOutput.topMatches.length > 0) {
      console.warn('[Matching] AI returned empty generated matches; falling back to legacy ranking');
      return getTopMatchedCareers(calculateCareerMatches(allCareers, userSkills, undefined, cvAnalysis), 5);
    }

    if (quizSessionId) {
      console.log('[Matching] Generated AI careers from Nova + Quiz + CV context', {
        quizSessionId,
        userId,
        generatedCount: matches.length,
      });
    }

    return matches;
  } catch (error) {
    console.error("[AI_ONLY] Career matching failed:", error);
    throw error; // IMPORTANT: do NOT fallback anymore
  }
}

export function getTopMatchedCareers(
  matches: CareerMatch[],
  limit: number = 5
): CareerMatch[] {
  return matches.slice(0, limit);
}
