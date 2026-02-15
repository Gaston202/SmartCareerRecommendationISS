/**
 * Career and Roadmap types
 */

export interface Career {
  id: string;
  title: string;
  description: string;
  category: string;
  required_skills: string[];
  average_salary: number;
  growth_rate: number;
  demand_level: 'low' | 'medium' | 'high' | 'very-high';
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  description?: string;
  related_careers?: string[];
  created_at: string;
}

export interface CareerSkill {
  career_id: string;
  skill_id: string;
  importance: 'required' | 'preferred' | 'optional';
  created_at: string;
}

export interface CareerWithSkills extends Career {
  skills: Array<Skill & { importance: CareerSkill['importance'] }>;
}
