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
import {
  getCachedCareerMatches,
  saveCareerMatchResults,
} from '../../database/quiz-matching.service';

export interface CareerMatch {
  career: CareerWithSkills;
  score: number; // 0-100
  matchReasons: string[];
}

export interface AiPoweredCareerMatch extends CareerMatch {
  aiInsights?: AiCareerMatchResult;
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
  cvAnalysis?: CvAnalysis,
  quizSessionId?: string | null
): Promise<AiPoweredCareerMatch[]> {
  try {
    if (cvAnalysis?.id && quizSessionId) {
      const cached = await getCachedCareerMatches(userId, cvAnalysis.id, quizSessionId);
      if (cached.length > 0) {
        const cachedMatches: AiPoweredCareerMatch[] = cached
          .map((entry) => {
            const career = allCareers.find((c) => c.id === entry.careerId);
            if (!career) return null;

            return {
              career,
              score: entry.matchScore,
              matchReasons: Array.isArray(entry.matchReasons) ? entry.matchReasons : [],
              aiInsights: entry.aiInsights as AiCareerMatchResult,
            } as AiPoweredCareerMatch;
          })
          .filter((m) => m !== null) as AiPoweredCareerMatch[];

        if (cachedMatches.length > 0) {
          console.log('[Matching] Using cached AI career matches from database');
          return cachedMatches;
        }
      }
    }

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

    // Convert AI results to CareerMatch format with AI insights
    const matches: AiPoweredCareerMatch[] = aiOutput.topMatches
      .map((aiResult) => {
        // Find the corresponding career in allCareers
        const career = allCareers.find(
          (c) => c.title.toLowerCase() === aiResult.careerTitle.toLowerCase()
        );

        if (!career) return null;

        return {
          career,
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

    if (cvAnalysis?.id && quizSessionId && matches.length > 0) {
      await saveCareerMatchResults(
        userId,
        cvAnalysis.id,
        quizSessionId,
        matches.map((match, index) => ({
          careerId: match.career.id,
          matchScore: match.score,
          matchReasons: match.matchReasons,
          aiInsights: match.aiInsights ?? {},
          ranking: index + 1,
        }))
      );
      console.log('[Matching] Cached AI career matches in database');
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
