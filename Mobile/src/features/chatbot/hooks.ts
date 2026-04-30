import React, { useState, useCallback } from 'react';
import type { ChatMessage, ChatResponse } from './types';
import { sendChatbotMessage, resetChatbotConversation } from './api';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function useChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response: ChatResponse = await sendChatbotMessage(content, threadId);

        if (response.data?.thread_id) {
          setThreadId(response.data.thread_id);
        }

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        return response;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMsg}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setError(err instanceof Error ? err : new Error(errorMsg));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [threadId]
  );

  const resetConversation = useCallback(async () => {
    try {
      await resetChatbotConversation(threadId);
      setMessages([]);
      setThreadId(null);
      setError(null);
    } catch (err) {
      console.error('Failed to reset conversation:', err);
    }
  }, [threadId]);

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
    isLoading,
    error,
    sendMessage,
    resetConversation,
    toggleChat,
    openChat,
    closeChat,
  };
}
