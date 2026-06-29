import { apiClient } from './client';

export interface ChatSession {
  session_id: string;
  welcome_message: string;
  step: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatMessageResponse {
  session_id: string;
  bot_message: string;
  step: string;
  hiring_request?: Record<string, unknown>;
  workflow_triggered: boolean;
  workflow_session_id?: string;
  jd_content?: string;
}

export interface SessionHistory {
  session_id: string;
  step: string;
  messages: ChatMessage[];
  hiring_request: Record<string, unknown>;
  jd_content?: string;
  workflow_session_id?: string;
}

export const chatbotApi = {
  startSession: async (): Promise<ChatSession> => {
    const response = await apiClient.post<ChatSession>('/chatbot/start');
    return response.data;
  },

  sendMessage: async (sessionId: string, message: string): Promise<ChatMessageResponse> => {
    const response = await apiClient.post<ChatMessageResponse>('/chatbot/message', {
      session_id: sessionId,
      message,
    });
    return response.data;
  },

  getSession: async (sessionId: string): Promise<SessionHistory> => {
    const response = await apiClient.get<SessionHistory>(`/chatbot/session/${sessionId}`);
    return response.data;
  },

  approveJD: async (sessionId: string, approved: boolean, feedback?: string) => {
    const response = await apiClient.post('/chatbot/approve-jd', {
      session_id: sessionId,
      approved,
      feedback,
    });
    return response.data;
  },
};
