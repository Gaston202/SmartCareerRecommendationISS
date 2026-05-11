export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
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
