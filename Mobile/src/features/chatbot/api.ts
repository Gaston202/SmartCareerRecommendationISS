import { supabase } from '../../api/supabase';
import { fetchBackend } from '../../api/backend';
import type { ChatResponse } from './types';

export async function sendChatbotMessage(
  message: string,
  threadId?: string | null
): Promise<ChatResponse> {
  const token = await getAuthToken();
  console.log('[Chatbot API] Token present:', !!token);
  if (!token) {
    throw new Error('Not authenticated. Please log in.');
  }

  const queryParams = new URLSearchParams();
  queryParams.append('message', message);
  if (threadId) {
    queryParams.append('thread_id', threadId);
  }

  const response = await fetchBackend(`/chatbot/message?${queryParams.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[Chatbot API] Error response:', response.status, errorText.slice(0, 300));
    let error;
    try { error = JSON.parse(errorText); } catch { error = {}; }
    const msg = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(msg);
  }

  const data = await response.json();
  return data as ChatResponse;
}

export async function resetChatbotConversation(threadId?: string | null): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated. Please log in.');
  }

  const queryParams = new URLSearchParams();
  if (threadId) {
    queryParams.append('thread_id', threadId);
  }

  const response = await fetchBackend(`/chatbot/reset?${queryParams.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(msg);
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[Chatbot] Session error:', error.message);
      return null;
    }

    if (data.session?.access_token) {
      if (data.session.expires_at) {
        const expiresAt = data.session.expires_at * 1000;
        const now = Date.now();
        if (expiresAt - now < 5 * 60 * 1000) {
          console.log('[Chatbot] Token expiring soon, refreshing...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData.session?.access_token) {
            return refreshData.session.access_token;
          }
        }
      }
      return data.session.access_token;
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshData.session?.access_token) {
      return refreshData.session.access_token;
    }

    return null;
  } catch (error) {
    console.error('[Chatbot] Failed to get auth token:', error);
    return null;
  }
}
