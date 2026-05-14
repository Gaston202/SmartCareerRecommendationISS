import { useEffect, useState } from 'react';
import {
  fetchMentors,
  fetchMentorById,
  fetchMentorByUserId,
  fetchUserProfile,
  fetchGroupChats,
  fetchGroupChatById,
  fetchChatMessages,
  sendChatMessage,
  joinGroupChat,
  leaveGroupChat,
  submitMentorReview,
  fetchMentorReviews,
  scheduleMentorSession,
  fetchMentorSessions,
  fetchMentorAllSessions,
  confirmMentorSession,
  rejectMentorSession,
  completeMentorSession,
  fetchMentorAvailability,
  saveMentorAvailability,
} from '../../api/mentor';
import { supabase } from '../../api/supabase';
import { sendNotification } from '../../api/notifications';
import {
  Mentor,
  MentorWithSpecialties,
  GroupChat,
  ChatMessage,
  MentorFilters,
  MentorReview,
  MentorSession,
  MentorAvailabilityRule,
} from '../../types/mentor';

// Hook to fetch mentors
export function useMentors(filters?: MentorFilters) {
  const [mentors, setMentors] = useState<MentorWithSpecialties[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchMentors(filters);
        setMentors(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters?.specialty, filters?.minRating, filters?.isVerified]);

  const refetch = async () => {
    try {
      const data = await fetchMentors(filters);
      setMentors(data);
    } catch (err) {
      setError(err as Error);
    }
  };

  return { mentors, loading, error, refetch };
}

// Hook to fetch single mentor
export function useMentor(mentorId: string) {
  const [mentor, setMentor] = useState<MentorWithSpecialties | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!mentorId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorById(mentorId);
        setMentor(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mentorId]);

  return { mentor, loading, error };
}

// Hook to fetch mentor by user_id (for chat participants)
export function useMentorByUserId(userId: string) {
  const [mentor, setMentor] = useState<MentorWithSpecialties | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorByUserId(userId);
        setMentor(data);
      } catch (err) {
        setError(err as Error);
        setMentor(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  return { mentor, loading, error };
}

// Hook to fetch user profile by ID (for regular users)
export function useUserProfile(userId: string) {
  const [user, setUser] = useState<{ id: string; email?: string; name?: string; avatar?: string; bio?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchUserProfile(userId);
        setUser(data);
      } catch (err) {
        setError(err as Error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  return { user, loading, error };
}

// Hook to fetch group chats
export function useGroupChats(specialty?: string) {
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchGroupChats(specialty);
        setChats(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [specialty]);

  const refetch = async () => {
    try {
      const data = await fetchGroupChats(specialty);
      setChats(data);
    } catch (err) {
      setError(err as Error);
    }
  };

  return { chats, loading, error, refetch };
}

// Hook to fetch group chat details
export function useGroupChat(chatId: string) {
  const [chat, setChat] = useState<GroupChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!chatId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchGroupChatById(chatId);
        setChat(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [chatId]);

  return { chat, loading, error };
}

// Hook to fetch chat messages
export function useChatMessages(chatId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!chatId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchChatMessages(chatId);
        setMessages(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [chatId]);

  const sendMessage = async (
    senderId: string,
    senderName: string,
    senderAvatar: string | undefined,
    message: string
  ) => {
    try {
      const newMessage = await sendChatMessage(chatId, senderId, senderName, senderAvatar, message);
      setMessages([...messages, newMessage]);
      
      // Notify other participants in the chat
      const uniqueRecipients = new Set(messages.map(m => m.sender_id).filter(id => id && id !== senderId));
      uniqueRecipients.forEach((id) => {
        sendNotification(
          id,
          "New Group Chat Message",
          `New message from ${senderName} in your group chat.`,
          "chat_message",
          `GroupChat:${chatId}`
        );
      });

      return newMessage;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const refetch = async () => {
    try {
      const data = await fetchChatMessages(chatId);
      setMessages(data);
    } catch (err) {
      setError(err as Error);
    }
  };

  return { messages, loading, error, sendMessage, refetch };
}

// Hook for group chat operations
export function useGroupChatOperations(chatId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const join = async (userId: string) => {
    try {
      setLoading(true);
      await joinGroupChat(chatId, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const leave = async (userId: string) => {
    try {
      setLoading(true);
      await leaveGroupChat(chatId, userId);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { join, leave, loading, error };
}

// Hook for mentor reviews
export function useMentorReviews(mentorId: string) {
  const [reviews, setReviews] = useState<MentorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!mentorId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorReviews(mentorId);
        setReviews(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mentorId]);

  const submitReview = async (reviewerId: string, rating: number, comment?: string) => {
    try {
      const newReview = await submitMentorReview(mentorId, reviewerId, rating, comment);
      setReviews([...reviews, newReview]);
      return newReview;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const refetch = async () => {
    try {
      const data = await fetchMentorReviews(mentorId);
      setReviews(data);
    } catch (err) {
      setError(err as Error);
    }
  };

  return { reviews, loading, error, submitReview, refetch };
}

// Hook for mentor sessions
export function useMentorSessions(userId: string) {
  const [sessions, setSessions] = useState<MentorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorSessions(userId);
        setSessions(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const scheduleSession = async (
    mentorId: string,
    title: string,
    description: string | undefined,
    scheduledAt: string,
    durationMinutes = 30
  ) => {
    try {
      const newSession = await scheduleMentorSession(
        mentorId,
        userId,
        title,
        description,
        scheduledAt,
        durationMinutes
      );
      setSessions([...sessions, newSession]);

      // Notify the mentor
      supabase.from('mentors').select('user_id').eq('id', mentorId).single().then(({ data }) => {
        if (data?.user_id) {
          sendNotification(
            data.user_id,
            "New Session Booked",
            `${title} was just scheduled.`,
            "mentor_session",
            "MentorSessions"
          );
        }
      });

      return newSession;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const refetch = async () => {
    try {
      const data = await fetchMentorSessions(userId);
      setSessions(data);
    } catch (err) {
      setError(err as Error);
    }
  };

  return { sessions, loading, error, scheduleSession, refetch };
}

export function useMentorSessionManagement(mentorId: string) {
  const [sessions, setSessions] = useState<MentorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!mentorId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorAllSessions(mentorId);
        setSessions(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mentorId]);

  const confirmSession = async (sessionId: string) => {
    const updated = await confirmMentorSession(sessionId);
    setSessions(sessions.map(s => s.id === sessionId ? updated : s));
  };

  const rejectSession = async (sessionId: string) => {
    const updated = await rejectMentorSession(sessionId);
    setSessions(sessions.map(s => s.id === sessionId ? updated : s));
  };

  const completeSession = async (sessionId: string) => {
    const updated = await completeMentorSession(sessionId);
    setSessions(sessions.map(s => s.id === sessionId ? updated : s));
  };

  const refetch = async () => {
    const data = await fetchMentorAllSessions(mentorId);
    setSessions(data);
  };

  return { sessions, loading, error, confirmSession, rejectSession, completeSession, refetch };
}

export function useMentorAvailability(mentorId: string) {
  const [rules, setRules] = useState<MentorAvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!mentorId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchMentorAvailability(mentorId);
        setRules(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mentorId]);

  const saveRules = async (newRules: Omit<MentorAvailabilityRule, 'id' | 'mentor_id' | 'created_at'>[]) => {
    await saveMentorAvailability(mentorId, newRules);
    const data = await fetchMentorAvailability(mentorId);
    setRules(data);
  };

  return { rules, loading, error, saveRules };
}
