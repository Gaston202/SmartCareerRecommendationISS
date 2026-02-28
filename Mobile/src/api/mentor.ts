import { supabase } from './supabase';
import {
  Mentor,
  MentorWithSpecialties,
  GroupChat,
  ChatMessage,
  MentorReview,
  MentorFilters,
  MentorSession,
} from '../types/mentor';

// Fetch all mentors
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

// Fetch single mentor by mentor id
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

// Fetch single mentor by user_id (for chat participants)
// Returns null if user is not a mentor
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

// Fetch user profile by ID
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

// Fetch group chats
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

// Fetch group chat by ID
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

// Fetch messages in a group chat with pagination
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

// Send message to group chat
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

// Delete message
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

// Pin message
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

// Join group chat
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

    if (error && error.code !== 'PGRST116') throw error; // Ignore unique constraint error
  } catch (error) {
    console.error('Error joining group chat:', error);
    throw error;
  }
};

// Leave group chat
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

// Submit mentor review
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

// Fetch mentor reviews
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

// Schedule mentor session
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

// Fetch user's mentor sessions
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
