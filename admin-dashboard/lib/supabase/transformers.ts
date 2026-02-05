import { Career, Skill, Course, Recommendation } from "@/types/career";
import { User } from "@/types/user";

// Transform Supabase user data to match TypeScript interface
export function transformUser(data: any, includePassword: boolean = false): User {
  const user: User = {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    status: data.status,
    createdAt: data.created_at || data.createdAt,
    updatedAt: data.updated_at || data.updatedAt,
    avatar: data.avatar,
    phone: data.phone,
  };
  
  // Only include password if explicitly requested (for internal auth checks)
  if (includePassword && data.password) {
    user.password = data.password;
  }
  
  return user;
}

// Transform Supabase career data to match TypeScript interface
export function transformCareer(data: any): Career {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    category: data.category,
    requiredSkills: data.required_skills || data.requiredSkills || [],
    averageSalary: data.average_salary || data.averageSalary || 0,
    growthRate: data.growth_rate || data.growthRate || 0,
    demandLevel: data.demand_level || data.demandLevel || "medium",
    createdAt: data.created_at || data.createdAt,
    updatedAt: data.updated_at || data.updatedAt,
  };
}

// Transform Supabase skill data to match TypeScript interface
export function transformSkill(data: any): Skill {
  return {
    id: data.id,
    name: data.name,
    category: data.category,
    description: data.description,
    relatedCareers: data.related_careers || data.relatedCareers || [],
    createdAt: data.created_at || data.createdAt,
  };
}

// Transform Supabase course data to match TypeScript interface
export function transformCourse(data: any): Course {
  return {
    id: data.id,
    title: data.title,
    provider: data.provider,
    description: data.description,
    skillsTargeted: data.skills_targeted || data.skillsTargeted || [],
    duration: data.duration,
    level: data.level,
    url: data.url,
    price: data.price,
    rating: data.rating,
  };
}

// Transform Supabase recommendation data to match TypeScript interface
export function transformRecommendation(data: any): Recommendation {
  // Handle careers - could be array of objects or array of IDs
  let careers: Career[] = []
  if (Array.isArray(data.careers)) {
    careers = data.careers.map((c: any) => 
      typeof c === 'object' ? transformCareer(c) : null
    ).filter((c: any) => c !== null)
  }

  // Handle courses - could be array of objects or array of IDs
  let courses: Course[] = []
  if (Array.isArray(data.courses)) {
    courses = data.courses.map((c: any) => 
      typeof c === 'object' ? transformCourse(c) : null
    ).filter((c: any) => c !== null)
  }

  return {
    id: data.id,
    userId: data.user_id || data.userId,
    careers,
    courses,
    matchScore: data.match_score || data.matchScore || 0,
    generatedAt: data.generated_at || data.generatedAt,
    status: data.status,
  };
}

