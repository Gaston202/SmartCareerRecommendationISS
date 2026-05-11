import React, { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getToken } from "next-auth/jwt";
import apiClient from "@/services/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatResponse {
  message: string;
  action_taken: string | null;
  data: {
    thread_id: string;
    booking_confirmed: boolean;
    search_results_count: number;
  };
  intent: string;
  session_id: string | null;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function useChatbot() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      // Get token from session - try multiple approaches for NextAuth v5
      let token: string | null = null;

      // Try to get token from session token property
      if ((session?.token as Record<string, unknown>)?.accessToken) {
        token = (session.token as Record<string, unknown>).accessToken as string;
      }
      // Try from user object if it was added there
      else if ((session?.user as Record<string, unknown>)?.accessToken) {
        token = (session.user as Record<string, unknown>).accessToken as string;
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const { data } = await apiClient.post(
        "/chatbot/message",
        null,
        {
          params: { message, thread_id: threadId },
          headers,
        }
      );
      return data as ChatResponse;
    },
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await sendMessageMutation.mutateAsync(content);

        if (response.data?.thread_id) {
          setThreadId(response.data.thread_id);
        }

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        return response;
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        throw error;
      }
    },
    [sendMessageMutation, threadId]
  );

  const resetConversation = useCallback(async () => {
    try {
      let token: string | null = null;
      if ((session?.token as Record<string, unknown>)?.accessToken) {
        token = (session.token as Record<string, unknown>).accessToken as string;
      } else if ((session?.user as Record<string, unknown>)?.accessToken) {
        token = (session.user as Record<string, unknown>).accessToken as string;
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await apiClient.post(
        "/chatbot/reset",
        null,
        {
          params: { thread_id: threadId },
          headers,
        }
      );
      setMessages([]);
      setThreadId(null);
    } catch (error) {
      console.error("Failed to reset conversation:", error);
    }
  }, [threadId, session]);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    messages,
    isOpen,
    isLoading: sendMessageMutation.isPending,
    error: sendMessageMutation.error,
    sendMessage,
    resetConversation,
    toggleChat,
    openChat,
    closeChat,
  };
}