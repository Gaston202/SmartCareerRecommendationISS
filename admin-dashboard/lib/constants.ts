export const APP_NAME = "Smart Career Admin";
export const APP_DESCRIPTION = "Admin dashboard for Smart Career Recommendation System";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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
