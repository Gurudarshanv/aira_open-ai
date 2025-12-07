export interface Attachment {
  mimeType: string;
  data: string; // base64
  name?: string;
}

export type AppMode = 'chat' | 'thinking' | 'maps' | 'image' | 'video' | 'fast' | 'tts' | 'live';

export interface GenerationConfig {
  aspectRatio?: string;
  imageSize?: string; // 1K, 2K, 4K
  resolution?: string; // 720p for Veo
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isError?: boolean;
  attachments?: Attachment[];
  generatedImage?: string; // URL or base64
  generatedVideo?: string; // URL
  audioData?: string; // URL to blob (WAV)
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

// Helper to generate IDs
export const generateId = () => Math.random().toString(36).substring(2, 15);