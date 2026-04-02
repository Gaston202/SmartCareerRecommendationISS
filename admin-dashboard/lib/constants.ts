export const APP_NAME = "Smart Career Admin";
export const APP_DESCRIPTION = "Admin dashboard for Smart Career Recommendation System";

// API base URL - MUST be explicitly configured in environment (.env.local)
// If not set, the app will fail to start with a clear error message
export const API_BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  
  if (!url) {
    throw new Error(
      '[CONFIG ERROR] NEXT_PUBLIC_API_URL not set\n' +
      'Add to .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000/api\n' +
      'Or for production: NEXT_PUBLIC_API_URL=https://your-backend.com/api'
    );
  }
  
  return url;
})();

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user",
} as const;

export const USER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
} as const;

export const RECOMMENDATION_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  VIEWED: "viewed",
} as const;
