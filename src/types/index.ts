export type PaperStatus = 'pending' | 'queued' | 'parsing' | 'analyzing' | 'analyzed' | 'error';

export type EmbeddingStatus = 'pending' | 'generating' | 'generated' | 'error';

export interface ChunkData {
  id: string;
  page: number;
  section: string;
  text: string;
  similarity?: number;
}

export interface EmbeddingsData {
  chunks: ChunkData[];
  embeddings: number[][];
  generatedAt: string;
  model: string;
}

export interface PaperMetadata {
  id: string;
  title: string;
  filename: string;
  pages: number;
  createdAt: string;
  status: PaperStatus;
  folderId?: string | null;
  sortIndex?: number;
  starred?: boolean;
  analysisProgress?: {
    step: 'queued' | 'parsing' | 'analyzing' | 'saving';
    message: string;
    updatedAt: string;
    queuePosition?: number;
    batchesDone?: number;
    totalBatches?: number;
  };
  embeddingStatus?: EmbeddingStatus;
  embeddingError?: string;
  embeddingGeneratedAt?: string;
  pdfMetadata?: PdfMetadata;
}

export type MetadataSource = 'pdf-properties' | 'text-extraction' | 'manual';

export interface PdfMetadata {
  title?: string;
  authors?: string[];
  date?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  fieldSources: Record<string, MetadataSource>;
  extractedAt: string;
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
  quote?: TextSelection;  // 新增：引用文本及位置信息
}

export interface ChatHistory {
  messages: ChatMessage[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AppSettings {
  baseUrl: string;
  apiKeyEncrypted: string;
  apiKeyIV: string;
  model: string;
  visionModel: string;
  embeddingModel?: string;
  useSameApiForEmbedding?: boolean;
  embeddingBaseUrl?: string;
  embeddingApiKeyEncrypted?: string;
  embeddingApiKeyIV?: string;
  maxConcurrent?: number;
  staleThresholdMinutes?: number;
  zoteroDataDir?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type AnalyzeEvent =
  | { step: 'queued'; message?: string; queuePosition?: number }
  | { step: 'parsing'; message?: string }
  | { step: 'analyzing'; message?: string }
  | { step: 'saving'; message?: string }
  | { type: 'parse_batch_done'; batchIndex: number; totalBatches: number; content: string }
  | { type: 'parse_chunk'; batchIndex: number; chunk: string }
  | { section: string; content: string }
  | { done: true }
  | { error: string };

export type ChatEvent =
  | { content: string }
  | { done: true; sessionId: string };

export interface PaperListItem {
  id: string;
  title: string;
  createdAt: string;
  status: PaperStatus;
  folderId?: string | null;
  sortIndex?: number;
  starred?: boolean;
  pdfDate?: string;
}

export interface PaperData {
  metadata: PaperMetadata;
  analysis: PaperAnalysis | null;
  parsedContent: string | null;
  chatHistory?: ChatHistory;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export type NoteTag = 'important' | 'question' | 'todo' | 'idea' | 'summary';

export interface HighlightRect {
  left: number;    // Percentage (0-100) of page width
  top: number;     // Percentage (0-100) of page height
  width: number;   // Percentage (0-100) of page width
  height: number;  // Percentage (0-100) of page height
}

export interface TextSelection {
  text: string;              // The selected text content
  rects: HighlightRect[];    // Rectangle positions as percentages
  page: number;              // Page number (1-indexed)
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: NoteTag[];
  page?: number;                    // Legacy: page-level reference (for existing notes)
  selection?: TextSelection;        // New: sentence-level selection
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  page: number;
  label?: string;
  createdAt: string;
}

export type ThemePreset = 'dark-minimal' | 'light-minimal' | 'warm-light' | 'warm-dark';

export interface ThemeSettings {
  preset: ThemePreset;
  customAccent: string | null;
}

export type PromptPresetKey = 'zh' | 'en';

export interface PromptConfig {
  preset: PromptPresetKey;
  custom: string;
}

export interface PromptSettings {
  vision: PromptConfig;
  analysis: PromptConfig;
  chat: PromptConfig;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

// Zotero Import Types
export interface ZoteroCollection {
  id: number;
  name: string;
  parentId: number | null;
  children: ZoteroCollection[];
}

export interface ZoteroItem {
  key: string;
  title: string;
  attachmentKey: string;
  pdfFilename: string;
  pdfSize: number;
  alreadyImported: boolean;
}

export interface ZoteroImportRequest {
  items: Array<{
    key: string;
    title: string;
    attachmentKey: string;
    pdfFilename: string;
  }>;
  folderId?: string;
}

export interface ZoteroImportResult {
  key: string;
  paperId?: string;
  status: 'success' | 'error';
  error?: string;
}
