/**
 * CV Analysis Feature Types
 * Shared types for CV upload, analysis, and skills extraction
 */

export type SkillStatus = "pending" | "confirmed" | "edited" | "removed";
export type SkillSource = "cv_extraction" | "user_added";

export type UserSkill = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  source: SkillSource;
  confidence: number | null;
  status: SkillStatus;
  created_at: string;
  updated_at: string;
};

export type CvUploadStatus = "uploaded" | "processing" | "done" | "failed";

export type CvUpload = {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  status: CvUploadStatus;
  error: string | null;
  created_at: string;
};

export type AtsIssue = {
  title: string;
  impact: "low" | "medium" | "high";
  fix: string;
};

export type AtsImprovement = {
  section: string;
  suggestion: string;
  example?: string;
};

export type CareerSuggestion = {
  title: string;
  why: string;
  missing_skills: string[];
  learning_plan: string[];
};

export type CvAnalysis = {
  id: string;
  cv_upload_id: string;
  user_id: string;
  ats_score: number;
  ats_issues: AtsIssue[];
  ats_suggestions: AtsImprovement[];
  career_suggestions: CareerSuggestion[];
  created_at: string;
};

// Draft skill for local editing before saving
export type DraftSkill = UserSkill & {
  isNew?: boolean;
};

// Batch save payload
export type SkillsUpdatePayload = {
  toInsert: Array<Omit<UserSkill, "id" | "user_id" | "created_at" | "updated_at">>;
  toUpdate: Array<Pick<UserSkill, "id" | "name" | "category" | "status">>;
};
