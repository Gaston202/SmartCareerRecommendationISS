import { fetchBackend } from './backend';
import { supabase } from './supabase';
import {
  MentorAvailabilityRule,
  MentorSession,
  MentorReview,
  GroupChat,
  ChatMessage,
  MentorWithSpecialties,
  MentorFilters,
} from '../types/mentor';

// ---------------------------------------------------------------------------
// Avatar normalization — keeps generated/placeholder avatars replaced with
// real human photos so the UI always looks polished.
// ---------------------------------------------------------------------------

const REAL_HUMAN_AVATARS = [
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1557862921-37829c790f19?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
];

const GENERATED_AVATAR_PATTERNS = [
  /dicebear/i,
  /ui-avatars/i,
  /robohash/i,
  /multiavatar/i,
  /identicon/i,
  /jdenticon/i,
  /avatar-generator/i,
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isGeneratedAvatar(url?: string): boolean {
  if (!url) return true;
  return GENERATED_AVATAR_PATTERNS.some((pattern) => pattern.test(url));
}

function pickRealHumanAvatar(seed: string): string {
  const index = hashString(seed) % REAL_HUMAN_AVATARS.length;
  return REAL_HUMAN_AVATARS[index];
}

function normalizeMentorAvatar<T extends { id?: string; user_id?: string; name?: string; avatar?: string }>(
  mentor: T,
): T {
  const seed = mentor.id || mentor.user_id || mentor.name || 'mentor';
  if (!isGeneratedAvatar(mentor.avatar)) return mentor;
  return { ...mentor, avatar: pickRealHumanAvatar(seed) };
}

// ---------------------------------------------------------------------------
// Internal helper — wraps fetchBackend, throws on HTTP errors
// ---------------------------------------------------------------------------

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchBackend(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Mentors
// ---------------------------------------------------------------------------

export const fetchMentors = async (filters?: MentorFilters): Promise<MentorWithSpecialties[]> => {
  try {
    const params = new URLSearchParams();
    if (filters?.specialty) params.set('specialty', filters.specialty);
    if (filters?.minRating != null) params.set('min_rating', String(filters.minRating));
    if (filters?.isVerified != null) params.set('is_verified', String(filters.isVerified));
    const qs = params.toString();
    const data = await api<MentorWithSpecialties[]>(`/mentors${qs ? `?${qs}` : ''}`);
    return (data || []).map(normalizeMentorAvatar);
  } catch (error) {
    console.error('Error fetching mentors:', error);
    throw error;
  }
};

export const fetchMentorById = async (mentorId: string): Promise<MentorWithSpecialties> => {
  try {
    const data = await api<MentorWithSpecialties>(`/mentors/${mentorId}`);
    return normalizeMentorAvatar(data);
  } catch (error) {
    console.error('Error fetching mentor:', error);
    throw error;
  }
};

export const fetchMentorByUserId = async (userId: string): Promise<MentorWithSpecialties | null> => {
  try {
    const data = await api<MentorWithSpecialties>(`/mentors/by-user/${userId}`);
    return data ? normalizeMentorAvatar(data) : null;
  } catch (error: any) {
    if (error?.message?.includes('404') || error?.message?.includes('not found')) return null;
    console.error('Error fetching mentor by user_id:', error);
    return null;
  }
};

// fetchUserProfile stays on Supabase — no dedicated backend endpoint
export const fetchUserProfile = async (
  userId: string,
): Promise<{ id: string; email?: string; name?: string; avatar?: string; bio?: string } | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, avatar, bio')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    return data || null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Group chats
// ---------------------------------------------------------------------------

export const fetchGroupChats = async (specialty?: string): Promise<GroupChat[]> => {
  try {
    const qs = specialty ? `?specialty=${encodeURIComponent(specialty)}` : '';
    const data = await api<any[]>(`/mentors/group-chats${qs}`);
    return (data || []).map((chat) => {
      if (chat?.mentors) return { ...chat, mentor: normalizeMentorAvatar(chat.mentors) } as GroupChat;
      if (chat?.mentor) return { ...chat, mentor: normalizeMentorAvatar(chat.mentor) } as GroupChat;
      return chat as GroupChat;
    });
  } catch (error) {
    console.error('Error fetching group chats:', error);
    throw error;
  }
};

export const fetchGroupChatById = async (chatId: string): Promise<GroupChat> => {
  try {
    const chat = await api<any>(`/mentors/group-chats/${chatId}`);
    if (chat?.mentors) return { ...chat, mentor: normalizeMentorAvatar(chat.mentors) } as GroupChat;
    if (chat?.mentor) return { ...chat, mentor: normalizeMentorAvatar(chat.mentor) } as GroupChat;
    return chat as GroupChat;
  } catch (error) {
    console.error('Error fetching group chat:', error);
    throw error;
  }
};

export const fetchChatMessages = async (
  chatId: string,
  limit = 50,
  offset = 0,
): Promise<ChatMessage[]> => {
  try {
    const data = await api<ChatMessage[]>(
      `/mentors/group-chats/${chatId}/messages?limit=${limit}&offset=${offset}`,
    );
    return data || [];
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }
};

export const sendChatMessage = async (
  chatId: string,
  senderId: string,
  senderName: string,
  senderAvatar: string | undefined,
  message: string,
): Promise<ChatMessage> => {
  try {
    return await api<ChatMessage>(`/mentors/group-chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: senderId, sender_name: senderName, sender_avatar: senderAvatar, message }),
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  try {
    // chat_id is required by the route but not used by the service — "_" is a safe placeholder
    const res = await fetchBackend(`/mentors/group-chats/_/messages/${messageId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || `HTTP ${res.status}`);
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

export const pinMessage = async (messageId: string, isPinned: boolean): Promise<void> => {
  try {
    const res = await fetchBackend(`/mentors/group-chats/_/messages/${messageId}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: isPinned }),
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || `HTTP ${res.status}`);
    }
  } catch (error) {
    console.error('Error pinning message:', error);
    throw error;
  }
};

export const checkGroupChatMembership = async (chatId: string, userId: string): Promise<boolean> => {
  try {
    const data = await api<{ is_member: boolean }>(
      `/mentors/group-chats/${chatId}/membership?user_id=${encodeURIComponent(userId)}`,
    );
    return data?.is_member ?? false;
  } catch (error) {
    console.error('Error checking membership:', error);
    return false;
  }
};

export const fetchJoinedGroupChatIds = async (userId: string): Promise<string[]> => {
  try {
    const data = await api<string[]>(`/mentors/group-chats/joined?user_id=${encodeURIComponent(userId)}`);
    return data || [];
  } catch (error) {
    console.error('Error fetching joined chats:', error);
    return [];
  }
};

export const joinGroupChat = async (chatId: string, userId: string): Promise<void> => {
  try {
    const res = await fetchBackend(
      `/mentors/group-chats/${chatId}/join?user_id=${encodeURIComponent(userId)}`,
      { method: 'POST' },
    );
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || `HTTP ${res.status}`);
    }
  } catch (error) {
    console.error('Error joining group chat:', error);
    throw error;
  }
};

export const leaveGroupChat = async (chatId: string, userId: string): Promise<void> => {
  try {
    const res = await fetchBackend(
      `/mentors/group-chats/${chatId}/leave?user_id=${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || `HTTP ${res.status}`);
    }
  } catch (error) {
    console.error('Error leaving group chat:', error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const submitMentorReview = async (
  mentorId: string,
  reviewerId: string,
  rating: number,
  comment?: string,
): Promise<MentorReview> => {
  try {
    return await api<MentorReview>('/mentors/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentor_id: mentorId, reviewer_id: reviewerId, rating, comment }),
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    throw error;
  }
};

export const fetchMentorReviews = async (mentorId: string): Promise<MentorReview[]> => {
  try {
    const data = await api<MentorReview[]>(`/mentors/${mentorId}/reviews`);
    return data || [];
  } catch (error) {
    console.error('Error fetching reviews:', error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const scheduleMentorSession = async (
  mentorId: string,
  userId: string,
  title: string,
  description: string | undefined,
  scheduledAt: string,
  durationMinutes = 30,
): Promise<MentorSession> => {
  try {
    return await api<MentorSession>('/mentors/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mentor_id: mentorId,
        user_id: userId,
        title,
        description,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
      }),
    });
  } catch (error) {
    console.error('Error scheduling session:', error);
    throw error;
  }
};

export const fetchMentorSessions = async (userId: string): Promise<MentorSession[]> => {
  try {
    const data = await api<MentorSession[]>(`/mentors/sessions/user?user_id=${encodeURIComponent(userId)}`);
    return data || [];
  } catch (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }
};

export const fetchMentorPendingSessions = async (mentorId: string): Promise<MentorSession[]> => {
  try {
    const data = await api<MentorSession[]>(`/mentors/${mentorId}/sessions/pending`);
    return data || [];
  } catch (error) {
    console.error('Error fetching pending sessions:', error);
    throw error;
  }
};

export const fetchMentorAllSessions = async (mentorId: string): Promise<MentorSession[]> => {
  try {
    const data = await api<MentorSession[]>(`/mentors/${mentorId}/sessions`);
    return data || [];
  } catch (error) {
    console.error('Error fetching all mentor sessions:', error);
    throw error;
  }
};

export const confirmMentorSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    return await api<MentorSession>(`/mentors/sessions/${sessionId}/confirm`, { method: 'PATCH' });
  } catch (error) {
    console.error('Error confirming session:', error);
    throw error;
  }
};

export const rejectMentorSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    return await api<MentorSession>(`/mentors/sessions/${sessionId}/reject`, { method: 'PATCH' });
  } catch (error) {
    console.error('Error rejecting session:', error);
    throw error;
  }
};

export const cancelMentorSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    return await api<MentorSession>(`/mentors/sessions/${sessionId}/cancel`, { method: 'PATCH' });
  } catch (error) {
    console.error('Error cancelling session:', error);
    throw error;
  }
};

export const completeMentorSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    return await api<MentorSession>(`/mentors/sessions/${sessionId}/complete`, { method: 'PATCH' });
  } catch (error) {
    console.error('Error completing session:', error);
    throw error;
  }
};

export const markNoShowSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    return await api<MentorSession>(`/mentors/sessions/${sessionId}/no-show`, { method: 'PATCH' });
  } catch (error) {
    console.error('Error marking no-show session:', error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export const fetchMentorAvailability = async (mentorId: string): Promise<MentorAvailabilityRule[]> => {
  try {
    const data = await api<MentorAvailabilityRule[]>(`/mentors/${mentorId}/availability`);
    return data || [];
  } catch (error) {
    console.error('Error fetching availability:', error);
    throw error;
  }
};

export const saveMentorAvailability = async (
  mentorId: string,
  rules: Omit<MentorAvailabilityRule, 'id' | 'mentor_id' | 'created_at'>[],
): Promise<void> => {
  try {
    const res = await fetchBackend(`/mentors/${mentorId}/availability`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || `HTTP ${res.status}`);
    }
  } catch (error) {
    console.error('Error saving availability:', error);
    throw error;
  }
};

export const fetchAvailableSlots = async (
  mentorId: string,
  targetDate: string,
): Promise<{ date: string; startTime: string; endTime: string }[]> => {
  try {
    const data = await api<{ date: string; start_time: string; end_time: string }[]>(
      `/mentors/${mentorId}/availability/slots?date=${encodeURIComponent(targetDate)}`,
    );
    // Map snake_case from backend to camelCase expected by the frontend
    return (data || []).map((slot) => ({
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
    }));
  } catch (error) {
    console.error('Error fetching available slots:', error);
    throw error;
  }
};
