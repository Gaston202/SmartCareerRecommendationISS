/**
 * Zod schemas for CV and Skills features
 * Used for form validation and AI response parsing
 */

import { z } from "zod";

// Skill form validation
export const skillFormSchema = z.object({
  name: z.string().min(2, "Skill name must be at least 2 characters").max(100),
  category: z.string().optional().nullable(),
});

export type SkillFormValues = z.infer<typeof skillFormSchema>;

// Skill status form (for confirming/editing status)
export const skillStatusSchema = z.object({
  status: z.enum(["confirmed", "edited", "removed"]),
});

export type SkillStatusValues = z.infer<typeof skillStatusSchema>;

// AI ATS issue schema
export const atsIssueSchema = z.object({
  title: z.string(),
  impact: z.enum(["low", "medium", "high"]),
  fix: z.string(),
});

// AI ATS improvement schema
export const atsImprovementSchema = z.object({
  section: z.string(),
  suggestion: z.string(),
  example: z.string().optional(),
});

// AI career suggestion schema
export const careerSuggestionSchema = z.object({
  title: z.string(),
  why: z.string(),
  missing_skills: z.array(z.string()).default([]),
  learning_plan: z.array(z.string()).default([]),
});

// Complete CV AI result schema (what comes from Edge Function)
export const cvAiResultSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
  ),
  career_orientation: z.object({
    suggested_roles: z.array(careerSuggestionSchema),
  }),
  ats: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(atsIssueSchema),
    improvements: z.array(atsImprovementSchema),
    keywords_to_add: z.array(z.string()).optional(),
    formatting_tips: z.array(z.string()).optional(),
  }),
});

export type CvAiResult = z.infer<typeof cvAiResultSchema>;
