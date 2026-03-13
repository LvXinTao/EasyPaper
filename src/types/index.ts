export type PaperStatus = 'pending' | 'parsing' | 'analyzing' | 'analyzed' | 'error';

export interface PaperMetadata {
  id: string;
  title: string;
  filename: string;
  pages: number;
  createdAt: string;
  status: PaperStatus;
}

export interface AnalysisSection {
  content: string;
}

export interface ContributionsSection {
  items: string[];
}

export interface PaperAnalysis {
  summary: AnalysisSection;
  contributions: ContributionsSection;
  methodology: AnalysisSection;
  experiments: AnalysisSection;
  conclusions: AnalysisSection;
  generatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatHistory {
  messages: ChatMessage[];
}

export interface AppSettings {
  baseUrl: string;
  apiKeyEncrypted: string;
  apiKeyIV: string;
  model: string;
  visionModel: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type AnalyzeEvent =
  | { step: 'parsing' }
  | { step: 'analyzing' }
  | { section: string; content: string }
  | { done: true };

export type ChatEvent =
  | { content: string }
  | { done: true };

export interface PaperListItem {
  id: string;
  title: string;
  createdAt: string;
  status: PaperStatus;
}

export interface PaperData {
  metadata: PaperMetadata;
  analysis: PaperAnalysis | null;
  parsedContent: string | null;
  chatHistory: ChatHistory;
}
