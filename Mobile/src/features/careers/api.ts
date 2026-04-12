/**
 * Careers API – Calls backend career recommendation endpoint
 * Uses hybrid approach: deterministic matching + AI explanations
 */

import type { CareerMatch } from './matching';
import type { Career } from './types';
import { getBackendApiBaseUrl } from '../../api/backend';
import { getQuizSession } from '../quiz/storage';

const BACKEND_API_URL = getBackendApiBaseUrl();

/**
 * Get personalized career recommendations from backend
 * Backend uses deterministic scoring + AI explanations
 */
export async function recommendCareers(
  quizSessionId: string,
  cvAnalysisId?: string
): Promise<CareerMatch[]> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }

    const quizSession = await getQuizSession().catch(() => null);
    const novaProfile = quizSession?.results?.novaProfile;

    const response = await fetch(`${BACKEND_API_URL}/career/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        quiz_session_id: quizSessionId,
        cv_analysis_id: cvAnalysisId,
        nova_profile: novaProfile,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get career recommendations');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Invalid response from server');
    }

    // Transform backend response to frontend format
    return data.data.map((match: any) => ({
      career: {
        id: match.career.id,
        title: match.career.title,
        description: match.career.description,
        category: match.career.category || 'General',
        required_skills: match.career.required_skills || [],
        average_salary: match.career.average_salary || match.career.salary_range_min || 0,
        growth_rate: match.career.growth_rate || 0,
        demand_level: match.career.demand_level || 'medium',
        created_at: match.career.created_at || new Date().toISOString(),
        updated_at: match.career.updated_at || new Date().toISOString(),
        skills: match.career.required_skills?.map((skill: string, idx: number) => ({
          id: `skill-${idx}`,
          name: skill,
          category: 'Required',
          created_at: new Date().toISOString(),
          importance: 'required' as const,
        })) || [],
      },
      score: match.match_score,
      matchReasons: match.match_reasons || [],
      aiInsight: match.ai_insights?.explanation || `Strong ${match.match_score}% match based on your profile.`,
    }));
  } catch (error: any) {
    console.error('[Careers] Failed to recommend careers:', error);
    throw error;
  }
}

/**
 * Get all available careers from database
 */
export async function getAllCareers(): Promise<Career[]> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }

    const response = await fetch(`${BACKEND_API_URL}/career/all`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch careers');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Invalid response from server');
    }

    return data.data.map((career: any) => ({
      id: career.id,
      title: career.title,
      description: career.description,
      category: career.category || 'General',
      required_skills: career.required_skills || [],
      average_salary: career.salary_range_min || career.average_salary || 0,
      growth_rate: career.growth_rate || 0,
      demand_level: career.demand_level || 'medium',
      created_at: career.created_at || new Date().toISOString(),
      updated_at: career.updated_at || new Date().toISOString(),
      skills: career.required_skills?.map((skill: string, idx: number) => ({
        id: `skill-${idx}`,
        name: skill,
        category: 'Required',
        created_at: new Date().toISOString(),
        importance: 'required' as const,
      })) || [],
    }));
  } catch (error: any) {
    console.error('[Careers] Failed to fetch careers:', error);
    throw error;
  }
}

import { supabase } from '../../api/supabase';

/**
 * Helper: Get a valid auth token from Supabase
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[Careers] Session error:', error.message);
      return null;
    }

    if (data.session?.access_token) {
      // Check expiration if available
      if (data.session.expires_at) {
        const expiresAt = data.session.expires_at * 1000;
        const now = Date.now();

        // Refresh if expiring in less than 5 minutes
        if (expiresAt - now < 5 * 60 * 1000) {
          console.log('[Careers] Token expiring soon, refreshing...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData.session?.access_token) {
            return refreshData.session.access_token;
          }
        }
      }
      return data.session.access_token;
    }

    // Try to refresh session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshData.session?.access_token) {
      return refreshData.session.access_token;
    }

    return null;
  } catch (error) {
    console.error('[Careers] Failed to get auth token:', error);
    return null;
  }
}
