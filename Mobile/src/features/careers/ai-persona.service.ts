import {
  buildOpenRouterHeaders,
  getOpenRouterApiKey,
  OPENROUTER_URL,
  toOpenRouterError,
} from '../../api/openrouter';
import { getQuizSession } from '../quiz/storage';
import { getLatestCvAnalysisFromBackend } from '../cv/api-backend';
import type { NovaBehaviorProfile } from '../quiz/types';

const PERSONA_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

/**
 * DISC profile to archetype mapping
 * Each DISC color corresponds to a base persona type
 */
const DISC_ARCHETYPES: Record<string, { title: string; baseDescription: string }> = {
  red: {
    title: 'The Strategic Executor',
    baseDescription: 'You are a results-driven leader who sees the big picture and drives decisive action.',
  },
  yellow: {
    title: 'The Creative Catalyst',
    baseDescription: 'You spark innovation and inspire others through vision and enthusiasm.',
  },
  blue: {
    title: 'The Analytical Architect',
    baseDescription: 'You build systems with precision, turning complexity into elegant solutions.',
  },
  green: {
    title: 'The Empathetic Connector',
    baseDescription: 'You bridge people and perspectives, creating harmony and collaboration.',
  },
};

/**
 * Get the dominant DISC color from profile
 */
function getDominantDiscColor(
  discPercentages?: { red: number; yellow: number; green: number; blue: number }
): 'red' | 'yellow' | 'blue' | 'green' {
  if (!discPercentages) return 'blue';

  const colors = Object.entries(discPercentages)
    .sort(([, a], [, b]) => b - a);

  return colors[0]?.[0] as any || 'blue';
}

/**
 * Build user profile from quiz and CV data
 */
async function buildUserProfile(): Promise<{
  discProfile?: NovaBehaviorProfile;
  cvSummary?: string;
  discColor?: string;
  traits?: string[];
}> {
  const [quizSession, cvAnalysis] = await Promise.all([
    getQuizSession().catch(() => null),
    getLatestCvAnalysisFromBackend().catch(() => null),
  ]);

  const discProfile = quizSession?.results?.novaProfile?.behavior;
  const cvSummaryParts: string[] = [];

  // Safely extract and handle skills
  if (cvAnalysis && Array.isArray(cvAnalysis.extracted_skills) && cvAnalysis.extracted_skills.length > 0) {
    const skillsToAdd = cvAnalysis.extracted_skills.slice(0, 5);
    if (skillsToAdd.length > 0) {
      const skillsList = skillsToAdd.map((s: any) => typeof s === 'string' ? s : s?.name || '').filter(Boolean).join(', ');
      if (skillsList) {
        cvSummaryParts.push(`Key skills: ${skillsList}`);
      }
    }
  }

  if (typeof cvAnalysis?.ats_score === 'number') {
    cvSummaryParts.push(`Profile strength: ${cvAnalysis.ats_score}/100`);
  }

  const dominantColor = discProfile
    ? getDominantDiscColor(discProfile.discPercentages)
    : 'blue';

  return {
    discProfile,
    cvSummary: cvSummaryParts.join('. '),
    discColor: dominantColor,
    traits: discProfile?.traits || [],
  };
}

/**
 * Generate AI-powered persona description
 */
async function generatePersonaDescription(
  discColor: string,
  archetype: { title: string; baseDescription: string },
  userProfile: {
    discProfile?: NovaBehaviorProfile;
    cvSummary?: string;
    traits?: string[];
  }
): Promise<string> {
  const traits = Array.isArray(userProfile.traits) ? userProfile.traits : [];

  const prompt = `You are an expert career coach specializing in personality-based career guidance. 
  
Generate a compelling, personal persona description for someone with the following profile:

DISC Profile: ${discColor.toUpperCase()} personality style
Base Archetype: ${archetype.title}
Key Traits: ${traits.slice(0, 5).join(', ') || 'not available'}
CV Strengths: ${userProfile.cvSummary || 'not available'}
Primary Style: ${userProfile.discProfile?.primaryStyle || 'analytical'}
Secondary Style: ${userProfile.discProfile?.secondaryStyle || 'none'}

IMPORTANT: Generate ONLY a 1-2 sentence persona description (max 150 characters). 
It should:
1. Be highly personalized to their DISC style
2. Reflect their unique combination of traits
3. Sound inspirational and empowering
4. NOT include the archetype title

Respond with ONLY the persona description, nothing else.`;

  try {
    const apiKey = getOpenRouterApiKey();
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: buildOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model: PERSONA_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw toOpenRouterError(response.status, responseText);
    }

    const data = (await response.json()) as any;
    const description = data.choices?.[0]?.message?.content?.trim();

    return description || archetype.baseDescription;
  } catch (error) {
    console.warn('[persona] AI generation failed, using fallback', error);
    return archetype.baseDescription;
  }
}

/**
 * Main function: Generate complete persona with AI
 */
export async function generatePersona(): Promise<{
  title: string;
  description: string;
  archetype: string;
  discColor: string;
  traits: string[];
}> {
  try {
    const userProfile = await buildUserProfile();
    const discColor = userProfile.discColor || 'blue';
    const archetype = DISC_ARCHETYPES[discColor] || DISC_ARCHETYPES.blue;

    // Generate AI description
    const aiDescription = await generatePersonaDescription(discColor, archetype, userProfile);

    return {
      title: archetype.title,
      description: aiDescription,
      archetype: archetype.title,
      discColor: discColor,
      traits: userProfile.traits || [],
    };
  } catch (error) {
    console.warn('[persona] Failed to generate persona', error);

    // Fallback persona
    return {
      title: 'The Strategic Visionary',
      description: 'You bridge the gap between abstract systems and human experience, seeing patterns where others see chaos.',
      archetype: 'Strategic Visionary',
      discColor: 'blue',
      traits: ['Systems Thinking', 'User Empathy', 'Technical Synthesis'],
    };
  }
}

/**
 * Get persona skills/traits from DISC profile
 */
export function getPersonaTraits(discColor: string, customTraits?: string[]): string[] {
  if (customTraits && customTraits.length > 0) {
    return customTraits;
  }

  const traitMap: Record<string, string[]> = {
    red: ['Leadership', 'Decision-Making', 'Strategic Thinking', 'Competitive Drive'],
    yellow: ['Creativity', 'Communication', 'Adaptability', 'Vision'],
    blue: ['Analysis', 'Problem-Solving', 'Precision', 'Logical Thinking'],
    green: ['Collaboration', 'Empathy', 'Support', 'Relationship-Building'],
  };

  return traitMap[discColor] || traitMap.blue;
}
