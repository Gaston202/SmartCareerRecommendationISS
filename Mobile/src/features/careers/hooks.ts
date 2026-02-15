/**
 * React Query hooks for Careers and Roadmaps
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../api/supabase";
import type { Career, CareerWithSkills, Skill, CareerSkill } from "./types";

// Query keys
export const careersQueryKeys = {
  all: ["careers"] as const,
  list: () => [...careersQueryKeys.all, "list"] as const,
  detail: (id: string) => [...careersQueryKeys.all, "detail", id] as const,
  withSkills: () => [...careersQueryKeys.all, "withSkills"] as const,
};

// Sample careers data as fallback
const SAMPLE_CAREERS: Career[] = [
  {
    id: "e15b6518-78d0-4a23-8538-94976537089d",
    title: "Frontend Developer",
    description: "Build user interfaces and client-side applications using modern web technologies",
    category: "Technology",
    required_skills: [],
    average_salary: 95000,
    growth_rate: 12,
    demand_level: "very-high",
    created_at: "2026-01-06 19:25:26.875149+00",
    updated_at: "2026-01-21 19:25:26.875149+00"
  },
  {
    id: "378836e4-ef78-4fa9-a8eb-d87fa2ce4049",
    title: "Backend Developer",
    description: "Develop server-side applications and APIs using various programming languages and frameworks",
    category: "Technology",
    required_skills: [],
    average_salary: 105000,
    growth_rate: 15,
    demand_level: "very-high",
    created_at: "2026-01-06 19:25:26.875149+00",
    updated_at: "2026-01-21 19:25:26.875149+00"
  },
  {
    id: "f02e72f9-c473-4791-9123-e6080b99c92e",
    title: "Data Scientist",
    description: "Analyze data, build predictive models, and provide insights for business decisions",
    category: "Technology",
    required_skills: [],
    average_salary: 115000,
    growth_rate: 25,
    demand_level: "very-high",
    created_at: "2026-01-06 19:25:26.875149+00",
    updated_at: "2026-01-21 19:25:26.875149+00"
  },
  {
    id: "a36ae0e7-faae-4486-8438-ace79841a313",
    title: "Product Manager",
    description: "Define product strategy, manage roadmaps, and lead cross-functional teams",
    category: "Business",
    required_skills: [],
    average_salary: 125000,
    growth_rate: 10,
    demand_level: "high",
    created_at: "2026-01-06 19:25:26.875149+00",
    updated_at: "2026-01-21 19:25:26.875149+00"
  },
  {
    id: "e03ef88e-5d16-4d94-b9fa-6fa06a5b304f",
    title: "AI/ML Engineer",
    description: "Design and implement machine learning models and AI solutions",
    category: "Technology",
    required_skills: [],
    average_salary: 130000,
    growth_rate: 35,
    demand_level: "very-high",
    created_at: "2026-01-06 19:25:26.875149+00",
    updated_at: "2026-01-21 19:25:26.875149+00"
  },
  {
    id: "e8ce0164-020c-4e79-89d0-ac12231a66b6",
    title: "UX/UI Designer",
    description: "Design beautiful and intuitive user experiences and interfaces",
    category: "Design",
    required_skills: [],
    average_salary: 85000,
    growth_rate: 14,
    demand_level: "high",
    created_at: "2026-01-06 19:25:26.875149+00",
    updated_at: "2026-01-21 19:25:26.875149+00"
  },
  {
    id: "eb610777-3c64-45d1-b62b-a96ba3752756",
    title: "DevOps Engineer",
    description: "Manage infrastructure, deployment pipelines, and system reliability",
    category: "Technology",
    required_skills: [],
    average_salary: 110000,
    growth_rate: 18,
    demand_level: "high",
    created_at: "2026-01-06 19:25:26.875149+00",
    updated_at: "2026-01-21 19:25:26.875149+00"
  },
  {
    id: "1c76b56b-2870-4246-b0d2-075a789ee844",
    title: "Cybersecurity Specialist",
    description: "Protect systems and data from security threats and vulnerabilities",
    category: "Technology",
    required_skills: [],
    average_salary: 120000,
    growth_rate: 20,
    demand_level: "very-high",
    created_at: "2026-01-06 19:25:26.875149+00",
    updated_at: "2026-01-21 19:25:26.875149+00"
  },
  {
    id: "c5dd1557-9ad2-414b-93f9-8de192b0abfc",
    title: "Full Stack Developer",
    description: "Develop both frontend and backend components of web applications",
    category: "Technology",
    required_skills: [],
    average_salary: 100000,
    growth_rate: 16,
    demand_level: "very-high",
    created_at: "2026-01-11 19:25:26.875149+00",
    updated_at: "2026-01-26 19:25:26.875149+00"
  },
  {
    id: "76cb58fb-bb29-4d84-80e2-4bf9897f45ba",
    title: "Mobile App Developer",
    description: "Create mobile applications for iOS and Android platforms",
    category: "Technology",
    required_skills: [],
    average_salary: 98000,
    growth_rate: 13,
    demand_level: "high",
    created_at: "2026-01-11 19:25:26.875149+00",
    updated_at: "2026-01-26 19:25:26.875149+00"
  },
  {
    id: "9172bd48-b4c7-413e-9025-611f720df7cb",
    title: "Cloud Architect",
    description: "Design and implement cloud infrastructure solutions",
    category: "Technology",
    required_skills: [],
    average_salary: 135000,
    growth_rate: 22,
    demand_level: "very-high",
    created_at: "2026-01-11 19:25:26.875149+00",
    updated_at: "2026-01-26 19:25:26.875149+00"
  },
  {
    id: "9db6db9d-4b29-45eb-84f9-fe333a3b7a59",
    title: "Software Architect",
    description: "Design high-level software solutions and system architecture",
    category: "Technology",
    required_skills: [],
    average_salary: 140000,
    growth_rate: 12,
    demand_level: "high",
    created_at: "2026-01-16 19:25:26.875149+00",
    updated_at: "2026-01-31 19:25:26.875149+00"
  }
];

/**
 * Fetch all careers
 */
export function useCareers() {
  return useQuery({
    queryKey: careersQueryKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("careers")
        .select("*")
        .order("title", { ascending: true });

      if (error) throw error;
      return (data as Career[]) || [];
    },
  });
}

/**
 * Fetch a single career by ID
 */
export function useCareer(id: string) {
  return useQuery({
    queryKey: careersQueryKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("careers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Career;
    },
    enabled: !!id,
  });
}

/**
 * Fetch all careers with their associated skills
 */
export function useCareersWithSkills() {
  return useQuery({
    queryKey: careersQueryKeys.withSkills(),
    queryFn: async () => {
      try {
        // First, get all careers from database
        const { data: careers, error: careersError } = await supabase
          .from("careers")
          .select("*")
          .order("title", { ascending: true });

        // If table doesn't exist or error, use sample data
        if (careersError) {
          console.warn("Careers table not found, using sample data:", careersError.message);
          return SAMPLE_CAREERS.map((career) => ({
            ...career,
            skills: [],
          }));
        }

        if (!careers || careers.length === 0) {
          console.log("No careers in database, using sample data");
          return SAMPLE_CAREERS.map((career) => ({
            ...career,
            skills: [],
          }));
        }

        // Try to get career-skill relationships (might not exist)
        const { data: careerSkills, error: csError } = await supabase
          .from("career_skills")
          .select("*");

        // If career_skills table doesn't exist, return careers without skills
        if (csError) {
          console.warn("Career skills table not found, returning careers without skills:", csError.message);
          return (careers as Career[]).map((career) => ({
            ...career,
            skills: [],
          }));
        }

        // Try to get all skills (might not exist)
        const { data: skills, error: skillsError } = await supabase
          .from("skills")
          .select("*");

        // If skills table doesn't exist, return careers without skills
        if (skillsError) {
          console.warn("Skills table not found, returning careers without skills:", skillsError.message);
          return (careers as Career[]).map((career) => ({
            ...career,
            skills: [],
          }));
        }

        // Create a map of skills by ID for quick lookup
        const skillsMap = new Map<string, Skill>();
        (skills || []).forEach((skill: Skill) => {
          skillsMap.set(skill.id, skill);
        });

        // Map careers with their skills
        const careersWithSkills: CareerWithSkills[] = (careers as Career[]).map((career) => {
          const careerSkillRelations = (careerSkills || []).filter(
            (cs: CareerSkill) => cs.career_id === career.id
          );

          const associatedSkills = careerSkillRelations
            .map((cs: CareerSkill) => {
              const skill = skillsMap.get(cs.skill_id);
              if (!skill) return null;
              return {
                ...skill,
                importance: cs.importance,
              };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null);

          return {
            ...career,
            skills: associatedSkills,
          };
        });

        return careersWithSkills;
      } catch (error) {
        console.error("Unexpected error fetching careers:", error);
        // Return sample data as ultimate fallback
        return SAMPLE_CAREERS.map((career) => ({
          ...career,
          skills: [],
        }));
      }
    },
  });
}
