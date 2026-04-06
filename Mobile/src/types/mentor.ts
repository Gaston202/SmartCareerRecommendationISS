export interface Mentor {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  years_of_experience: number;
  company?: string;
  role?: string;
  rating: number;
  total_reviews: number;
  is_verified: boolean;
  status: 'active' | 'inactive' | 'suspended';
  created_at?: string;
  updated_at?: string;
}

export interface MentorSpecialty {
  id: string;
  mentor_id: string;
  specialty: string;
  is_primary: boolean;
  created_at?: string;
}

export interface MentorWithSpecialties extends Mentor {
  mentor_specialties?: MentorSpecialty[];
  specialties?: MentorSpecialty[];
  mentor_reviews?: MentorReview[];
}

export interface GroupChat {
  id: string;
  specialty: string;
  title: string;
  description?: string;
  mentor_id: string;
  is_moderated: boolean;
  created_at?: string;
  updated_at?: string;
  mentor?: Mentor;
}

export interface ChatMessage {
  id: string;
  group_chat_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  message: string;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MentorReview {
  id: string;
  mentor_id: string;
  reviewer_id: string;
  rating: number;
  comment?: string;
  created_at?: string;
}

export interface MentorAvailabilityRule {
  id: string;
  mentor_id: string;
  day_of_week: number; // 0=Sun, 1=Mon, ... 6=Sat
  start_time: string; // "09:00:00"
  end_time: string; // "17:00:00"
  created_at?: string;
}

export interface MentorSession {
  id: string;
  mentor_id: string;
  user_id: string;
  title: string;
  description?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  confirmation_status: 'pending' | 'confirmed' | 'rejected';
  meeting_link?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MentorFilters {
  specialty?: string;
  minRating?: number;
  isVerified?: boolean;
}
