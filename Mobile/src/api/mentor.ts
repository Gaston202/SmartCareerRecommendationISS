import { supabase } from './supabase';
import { MentorAvailabilityRule, MentorSession, MentorReview, GroupChat, ChatMessage, MentorWithSpecialties, MentorFilters } from '../types/mentor';

export const fetchMentors = async (filters?: MentorFilters): Promise<MentorWithSpecialties[]> => {
  try {
    let query = supabase
      .from('mentors')
      .select(`
        *,
        mentor_specialties (*)
      `)
      .eq('status', 'active');

    if (filters?.specialty) {
      query = query.contains('mentor_specialties', [{ specialty: filters.specialty }]);
    }

    if (filters?.minRating) {
      query = query.gte('rating', filters.minRating);
    }

    if (filters?.isVerified) {
      query = query.eq('is_verified', filters.isVerified);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data as MentorWithSpecialties[]) || [];
  } catch (error) {
    console.error('Error fetching mentors:', error);
    throw error;
  }
};

export const fetchMentorById = async (mentorId: string): Promise<MentorWithSpecialties> => {
  try {
    const { data, error } = await supabase
      .from('mentors')
      .select(`
        *,
        mentor_specialties (*),
        mentor_reviews (*)
      `)
      .eq('id', mentorId)
      .single();

    if (error) throw error;
    return data as MentorWithSpecialties;
  } catch (error) {
    console.error('Error fetching mentor:', error);
    throw error;
  }
};

export const fetchMentorByUserId = async (userId: string): Promise<MentorWithSpecialties | null> => {
  try {
    const { data, error } = await supabase
      .from('mentors')
      .select(`
        *,
        mentor_specialties (*),
        mentor_reviews (*)
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return (data as MentorWithSpecialties) || null;
  } catch (error) {
    console.error('Error fetching mentor by user_id:', error);
    return null;
  }
};

export const fetchUserProfile = async (userId: string): Promise<{ id: string; email?: string; name?: string; avatar?: string; bio?: string } | null> => {
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

export const fetchGroupChats = async (specialty?: string): Promise<GroupChat[]> => {
  try {
    let query = supabase
      .from('group_chats')
      .select(`
        *,
        mentors (*)
      `);

    if (specialty) {
      query = query.eq('specialty', specialty);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data as GroupChat[]) || [];
  } catch (error) {
    console.error('Error fetching group chats:', error);
    throw error;
  }
};

export const fetchGroupChatById = async (chatId: string): Promise<GroupChat> => {
  try {
    const { data, error } = await supabase
      .from('group_chats')
      .select(`
        *,
        mentors (*)
      `)
      .eq('id', chatId)
      .single();

    if (error) throw error;
    return data as GroupChat;
  } catch (error) {
    console.error('Error fetching group chat:', error);
    throw error;
  }
};

export const fetchChatMessages = async (
  chatId: string,
  limit = 50,
  offset = 0
): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('group_chat_id', chatId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data as ChatMessage[]) || [];
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
  message: string
): Promise<ChatMessage> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          group_chat_id: chatId,
          sender_id: senderId,
          sender_name: senderName,
          sender_avatar: senderAvatar,
          message,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as ChatMessage;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

export const pinMessage = async (messageId: string, isPinned: boolean): Promise<void> => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_pinned: isPinned })
      .eq('id', messageId);

    if (error) throw error;
  } catch (error) {
    console.error('Error pinning message:', error);
    throw error;
  }
};

export const checkGroupChatMembership = async (
  chatId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('group_chat_members')
      .select('id')
      .eq('group_chat_id', chatId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking membership:', error);
    return false;
  }
};

export const fetchJoinedGroupChatIds = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('group_chat_members')
      .select('group_chat_id')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map((row: any) => row.group_chat_id);
  } catch (error) {
    console.error('Error fetching joined chats:', error);
    return [];
  }
};

export const joinGroupChat = async (
  chatId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('group_chat_members')
      .insert([
        {
          group_chat_id: chatId,
          user_id: userId,
        },
      ]);

    if (error && error.code !== 'PGRST116') throw error;
  } catch (error) {
    console.error('Error joining group chat:', error);
    throw error;
  }
};

export const leaveGroupChat = async (chatId: string, userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('group_chat_members')
      .delete()
      .eq('group_chat_id', chatId)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error leaving group chat:', error);
    throw error;
  }
};

export const submitMentorReview = async (
  mentorId: string,
  reviewerId: string,
  rating: number,
  comment?: string
): Promise<MentorReview> => {
  try {
    const { data, error } = await supabase
      .from('mentor_reviews')
      .insert([
        {
          mentor_id: mentorId,
          reviewer_id: reviewerId,
          rating,
          comment,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as MentorReview;
  } catch (error) {
    console.error('Error submitting review:', error);
    throw error;
  }
};

export const fetchMentorReviews = async (mentorId: string): Promise<MentorReview[]> => {
  try {
    const { data, error } = await supabase
      .from('mentor_reviews')
      .select('*')
      .eq('mentor_id', mentorId);

    if (error) throw error;
    return (data as MentorReview[]) || [];
  } catch (error) {
    console.error('Error fetching reviews:', error);
    throw error;
  }
};

export const scheduleMentorSession = async (
  mentorId: string,
  userId: string,
  title: string,
  description: string | undefined,
  scheduledAt: string,
  durationMinutes = 30
): Promise<MentorSession> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .insert([
        {
          mentor_id: mentorId,
          user_id: userId,
          title,
          description,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          status: 'pending',
          confirmation_status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as MentorSession;
  } catch (error) {
    console.error('Error scheduling session:', error);
    throw error;
  }
};

export const fetchMentorSessions = async (userId: string): Promise<MentorSession[]> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return (data as MentorSession[]) || [];
  } catch (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }
};

export const fetchMentorPendingSessions = async (mentorId: string): Promise<MentorSession[]> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('mentor_id', mentorId)
      .eq('confirmation_status', 'pending')
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return (data as MentorSession[]) || [];
  } catch (error) {
    console.error('Error fetching pending sessions:', error);
    throw error;
  }
};

export const fetchMentorAllSessions = async (mentorId: string): Promise<MentorSession[]> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('mentor_id', mentorId)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return (data as MentorSession[]) || [];
  } catch (error) {
    console.error('Error fetching all mentor sessions:', error);
    throw error;
  }
};

export const confirmMentorSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .update({ confirmation_status: 'confirmed', status: 'scheduled' })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data as MentorSession;
  } catch (error) {
    console.error('Error confirming session:', error);
    throw error;
  }
};

export const rejectMentorSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .update({ confirmation_status: 'rejected', status: 'cancelled' })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data as MentorSession;
  } catch (error) {
    console.error('Error rejecting session:', error);
    throw error;
  }
};

export const cancelMentorSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .update({ status: 'cancelled', confirmation_status: 'rejected' })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data as MentorSession;
  } catch (error) {
    console.error('Error cancelling session:', error);
    throw error;
  }
};

export const completeMentorSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data as MentorSession;
  } catch (error) {
    console.error('Error completing session:', error);
    throw error;
  }
};

export const markNoShowSession = async (sessionId: string): Promise<MentorSession> => {
  try {
    const { data, error } = await supabase
      .from('mentor_sessions')
      .update({ status: 'no-show' })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data as MentorSession;
  } catch (error) {
    console.error('Error marking no-show session:', error);
    throw error;
  }
};

export const fetchMentorAvailability = async (mentorId: string): Promise<MentorAvailabilityRule[]> => {
  try {
    const { data, error } = await supabase
      .from('mentor_availability_rules')
      .select('*')
      .eq('mentor_id', mentorId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;
    return (data as MentorAvailabilityRule[]) || [];
  } catch (error) {
    console.error('Error fetching availability:', error);
    throw error;
  }
};

export const saveMentorAvailability = async (
  mentorId: string,
  rules: Omit<MentorAvailabilityRule, 'id' | 'mentor_id' | 'created_at'>[]
): Promise<void> => {
  try {
    await supabase.from('mentor_availability_rules').delete().eq('mentor_id', mentorId);

    if (rules.length > 0) {
      const { error } = await supabase
        .from('mentor_availability_rules')
        .insert(rules.map((r) => ({ ...r, mentor_id: mentorId })));

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error saving availability:', error);
    throw error;
  }
};

export const fetchAvailableSlots = async (
  mentorId: string,
  targetDate: string
): Promise<{ date: string; startTime: string; endTime: string }[]> => {
  try {
    const slotDuration = 30;
    const day = new Date(targetDate).getDay();

    const { data: rules, error: rulesError } = await supabase
      .from('mentor_availability_rules')
      .select('*')
      .eq('mentor_id', mentorId)
      .eq('day_of_week', day);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) return [];

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: sessions, error: sessionsError } = await supabase
      .from('mentor_sessions')
      .select('scheduled_at, duration_minutes, confirmation_status')
      .eq('mentor_id', mentorId)
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString());

    if (sessionsError) throw sessionsError;

    const bookedSlots = new Set<string>();

    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        if (session.scheduled_at && session.confirmation_status !== 'rejected') {
          const sessionStart = new Date(session.scheduled_at);
          const sessionEnd = new Date(sessionStart.getTime() + (session.duration_minutes ?? 30) * 60000);
          const slotStart = new Date(sessionStart);
          while (slotStart < sessionEnd) {
            bookedSlots.add(slotStart.toISOString());
            slotStart.setMinutes(slotStart.getMinutes() + slotDuration);
          }
        }
      }
    }

    const availableSlots: { date: string; startTime: string; endTime: string }[] = [];

    for (const rule of rules) {
      const [startHour, startMinute] = rule.start_time.split(':').map(Number);
      const [endHour, endMinute] = rule.end_time.split(':').map(Number);

      const targetYear = dayStart.getFullYear();
      const targetMonth = dayStart.getMonth();
      const targetDay = dayStart.getDate();

      let currentTime = new Date(targetYear, targetMonth, targetDay, startHour, startMinute);
      const endTime = new Date(targetYear, targetMonth, targetDay, endHour, endMinute);

      while (currentTime < endTime) {
        if (!bookedSlots.has(currentTime.toISOString())) {
          const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
          if (slotEnd <= endTime) {
            availableSlots.push({
              date: targetDate,
              startTime: currentTime.toTimeString().slice(0, 5),
              endTime: slotEnd.toTimeString().slice(0, 5),
            });
          }
        }
        currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
      }
    }

    return availableSlots;
  } catch (error) {
    console.error('Error fetching available slots:', error);
    throw error;
  }
};
