export interface Career {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  averageSalary: number;
  growthRate: number;
  demandLevel: "low" | "medium" | "high" | "very-high";
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  description?: string;
  relatedCareers: string[];
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  provider: string;
  description: string;
  skillsTargeted: string[];
  duration: string;
  level: "beginner" | "intermediate" | "advanced";
  url: string;
  price?: number;
  rating?: number;
}

export interface Recommendation {
  id: string;
  userId: string;
  careers: Career[];
  courses: Course[];
  matchScore: number;
  generatedAt: string;
  status: "pending" | "sent" | "viewed";
}
