/**
 * Backend Configuration - Centralized backend URL & endpoints
 * 
 * All AI operations use environment variable EXPO_PUBLIC_BACKEND_URL
 * If not set, the app will fail with a clear error message
 */

// Get backend URL from environment, fail if missing
const BACKEND_URL = (() => {
  const url = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  
  if (!url) {
    const errorMsg = 
      '[AI_CONFIG] ERROR: EXPO_PUBLIC_BACKEND_URL not set in .env\n' +
      'Please add: EXPO_PUBLIC_BACKEND_URL=http://your-backend:8000\n' +
      'Mobile app cannot start without backend URL configured';
    
    console.error(errorMsg);
    throw new Error('EXPO_PUBLIC_BACKEND_URL is required');
  }
  
  // Remove trailing slash if present
  return url.replace(/\/$/, '');
})();

// Log backend configuration on startup
console.log('[AI_CONFIG] Backend URL configured:', BACKEND_URL);

/**
 * Backend API Endpoint Helper
 * Constructs full URLs for backend AI endpoints
 */
export const BackendConfig = {
  // Base URL
  baseUrl: BACKEND_URL,

  // AI Endpoints for Mobile App
  endpoints: {
    // Quiz generation - returns next question or results
    // POST /quiz/next-question (new adaptive endpoint)
    quiz: () => `${BACKEND_URL}/quiz/next-question`,

    // Career matching - combines quiz + CV + skills analysis
    // POST /career-matching
    careerMatching: () => `${BACKEND_URL}/career-matching`,

    // Roadmap generation - creates learning path for target career
    // POST /generate-roadmap
    roadmap: () => `${BACKEND_URL}/generate-roadmap`,

    // CV analysis - analyzes uploaded CV
    // POST /analyze-cv
    cvAnalysis: () => `${BACKEND_URL}/analyze-cv`,

    // Health check - verify backend is available
    // GET /health
    health: () => `${BACKEND_URL}/health`,
  },

  // Helper to create authorization headers
  getHeaders: (token?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  },

  // Helper to log API calls with [AI_ONLY] prefix
  logCall: (operation: string, endpoint: string, details?: any) => {
    console.log(`[AI_ONLY] ${operation}: POST ${endpoint}`, details);
  },

  // Helper to log errors with [AI_ONLY] prefix
  logError: (operation: string, error: any) => {
    console.error(`[AI_ONLY] ERROR ${operation}:`, error);
  },

  // Helper to log successful calls
  logSuccess: (operation: string, details?: any) => {
    console.log(`[AI_ONLY] ✅ ${operation} succeeded`, details);
  },
};

/**
 * Verify backend is accessible on app startup
 */
export async function initializeBackendConnection(): Promise<boolean> {
  try {
    console.log('[AI_CONFIG] Verifying backend connection...');

    const response = await fetch(BackendConfig.endpoints.health(), {
      method: 'GET',
      timeout: 5000,
    });

    if (response.ok) {
      console.log('[AI_CONFIG] ✅ Backend is healthy and accessible');
      return true;
    } else {
      console.warn(`[AI_CONFIG] ⚠️ Backend returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('[AI_CONFIG] ⚠️ Failed to connect to backend:', error);
    return false;
  }
}

export default BackendConfig;
