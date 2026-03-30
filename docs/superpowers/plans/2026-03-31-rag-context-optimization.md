# RAG Context Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement RAG retrieval to reduce token consumption when chatting with papers by sending only relevant chunks instead of full text.

**Architecture:** Chunk parsed.md into semantic sections, generate embeddings via API, store locally. On chat, retrieve top-k relevant chunks + analysis summary as context.

**Tech Stack:** TypeScript, Next.js API routes, OpenAI Embedding API, local JSON storage

---

## Chunk 1: Foundation - Types and Storage

### Task 1: Add Type Definitions

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add embedding-related types to `src/types/index.ts`**

Add after line 169 (end of file):

```typescript
// Embedding types for RAG context optimization
export type EmbeddingStatus = 'pending' | 'generating' | 'generated' | 'error';

export interface ChunkData {
  id: string;
  page: number;
  section: string;
  text: string;
  similarity?: number;  // Added during retrieval
}

export interface EmbeddingsData {
  chunks: ChunkData[];
  embeddings: number[][];
  generatedAt: string;
  model: string;
}
```

- [ ] **Step 2: Extend PaperMetadata interface**

Add embedding status fields to the existing `PaperMetadata` interface:

```typescript
export interface PaperMetadata {
  // ... existing fields ...
  // NEW: Embedding status fields
  embeddingStatus?: EmbeddingStatus;
  embeddingError?: string;
  embeddingGeneratedAt?: string;
}
```

- [ ] **Step 3: Extend AppSettings interface**

Add embedding config fields to the existing `AppSettings` interface:

```typescript
export interface AppSettings {
  // ... existing fields ...
  // NEW: Embedding settings
  embeddingModel?: string;
  useSameApiForEmbedding?: boolean;
  embeddingBaseUrl?: string;
  embeddingApiKeyEncrypted?: string;
  embeddingApiKeyIV?: string;
}
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No new type errors

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add embedding types for RAG optimization

- Add ChunkData, EmbeddingsData, EmbeddingStatus types
- Extend AppSettings with embedding model config
- Extend PaperMetadata with embedding status tracking"
```

### Task 2: Add Embeddings Storage Methods

**Files:**
- Modify: `src/lib/storage.ts`
- Create: `__tests__/lib/storage-embeddings.test.ts`

- [ ] **Step 1: Write failing test for getEmbeddings**

Create `__tests__/lib/storage-embeddings.test.ts`:

```typescript
import { storage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('storage embeddings', () => {
  const testPaperId = 'test-embed-paper';
  const dataDir = path.join(os.homedir(), '.easypaper', 'data', 'papers', testPaperId);

  beforeAll(async () => {
    await fs.mkdir(dataDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it('should return null when embeddings file does not exist', async () => {
    const result = await storage.getEmbeddings('non-existent-paper');
    expect(result).toBeNull();
  });

  it('should save and retrieve embeddings', async () => {
    const embeddingsData = {
      chunks: [{ id: 'chunk_1', page: 1, section: 'Intro', text: 'Test content' }],
      embeddings: [[0.1, 0.2, 0.3]],
      generatedAt: '2026-03-31T10:00:00Z',
      model: 'text-embedding-3-small',
    };

    await storage.saveEmbeddings(testPaperId, embeddingsData);
    const result = await storage.getEmbeddings(testPaperId);

    expect(result).toEqual(embeddingsData);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/storage-embeddings.test.ts -t "should return null"`
Expected: FAIL with "storage.getEmbeddings is not a function"

- [ ] **Step 3: Add getEmbeddings and saveEmbeddings methods**

Add to `src/lib/storage.ts` after the `savePromptSettings` method:

```typescript
  async getEmbeddings(paperId: string): Promise<EmbeddingsData | null> {
    try {
      const filePath = path.join(paperDir(paperId), 'embeddings.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return null; }
  },
  async saveEmbeddings(paperId: string, data: EmbeddingsData): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'embeddings.json');
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  },
```

Update import at top of `storage.ts`:
```typescript
import type { PaperMetadata, PaperAnalysis, ChatHistory, ChatSession, ChatSessionMeta, PaperListItem, Note, Folder, PromptSettings, Bookmark, EmbeddingsData } from '@/types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/storage-embeddings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts __tests__/lib/storage-embeddings.test.ts
git commit -m "feat(storage): add embeddings storage methods

- Add getEmbeddings() and saveEmbeddings() methods
- Store embeddings as JSON in paper directory
- Add tests for embeddings persistence"
```

---

## Chunk 2: Core Library - Chunker and Embedding

### Task 3: Implement Paper Chunker

**Files:**
- Create: `src/lib/chunker.ts`
- Create: `__tests__/lib/chunker.test.ts`

- [ ] **Step 1: Write failing test for chunker**

Create `__tests__/lib/chunker.test.ts`:

```typescript
import { splitIntoChunks, estimateTokens } from '@/lib/chunker';

describe('chunker', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      expect(estimateTokens('hello world')).toBeCloseTo(3, 0);
      expect(estimateTokens('a'.repeat(100))).toBeCloseTo(25, 0);
    });
  });

  describe('splitIntoChunks', () => {
    it('should split content by paragraphs', () => {
      const content = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
      const chunks = splitIntoChunks(content);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should extract page markers', () => {
      const content = '<!-- page 1 -->\n\nFirst paragraph.\n\n<!-- page 2 -->\n\nSecond paragraph.';
      const chunks = splitIntoChunks(content);
      expect(chunks.some(c => c.page === 1)).toBe(true);
      expect(chunks.some(c => c.page === 2)).toBe(true);
    });

    it('should extract section headers', () => {
      const content = '## Introduction\n\nSome intro text.\n\n## Methods\n\nMethod details.';
      const chunks = splitIntoChunks(content);
      expect(chunks.find(c => c.section === 'Introduction')).toBeDefined();
      expect(chunks.find(c => c.section === 'Methods')).toBeDefined();
    });

    it('should handle small content', () => {
      const shortContent = 'Short.';
      const chunks = splitIntoChunks(shortContent);
      expect(chunks.length).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/chunker.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement chunker**

Create `src/lib/chunker.ts`:

```typescript
import type { ChunkData } from '@/types';

const MIN_CHUNK_SIZE = 500; // Minimum tokens per chunk

/**
 * Estimate token count from text.
 * Uses character-based approximation: ~4 chars per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract page number from page marker comment.
 */
function extractPageNumber(text: string): number | null {
  const match = text.match(/<!-- page (\d+) -->/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract section title from markdown header.
 */
function extractSection(text: string): string | null {
  const match = text.match(/^#{1,3} (.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Generate unique chunk ID.
 */
function generateChunkId(index: number): string {
  return `chunk_${index}`;
}

/**
 * Split parsed markdown content into semantic chunks.
 */
export function splitIntoChunks(parsedContent: string): ChunkData[] {
  const blocks = parsedContent.split('\n\n');
  const chunks: ChunkData[] = [];

  let currentChunk = '';
  let currentPage = 1;
  let currentSection = '';
  let chunkIndex = 0;

  for (const block of blocks) {
    if (!block.trim()) continue;

    const pageNum = extractPageNumber(block);
    if (pageNum !== null) {
      currentPage = pageNum;
    }

    const section = extractSection(block);
    if (section !== null) {
      currentSection = section;
    }

    currentChunk += block + '\n\n';

    if (estimateTokens(currentChunk) >= MIN_CHUNK_SIZE) {
      chunks.push({
        id: generateChunkId(chunkIndex++),
        page: currentPage,
        section: currentSection,
        text: currentChunk.trim(),
      });
      currentChunk = '';
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: generateChunkId(chunkIndex),
      page: currentPage,
      section: currentSection,
      text: currentChunk.trim(),
    });
  }

  return chunks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/chunker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/chunker.ts __tests__/lib/chunker.test.ts
git commit -m "feat(chunker): implement paper chunking for RAG

- Split markdown by paragraph boundaries
- Extract page numbers and section headers
- Use token estimation for chunk sizing"
```

### Task 4: Implement Embedding Service

**Files:**
- Create: `src/lib/embedding.ts`
- Create: `__tests__/lib/embedding.test.ts`

- [ ] **Step 1: Write failing test for embedding service**

Create `__tests__/lib/embedding.test.ts`:

```typescript
import { getEmbeddingConfig, generateEmbeddings } from '@/lib/embedding';

// Mock storage module
jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: jest.fn().mockResolvedValue(null),
  },
}));

// Mock crypto module
jest.mock('@/lib/crypto', () => ({
  decryptApiKey: jest.fn(),
}));

global.fetch = jest.fn();

describe('embedding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEmbeddingConfig', () => {
    it('should return default embedding model', async () => {
      const config = await getEmbeddingConfig();
      expect(config.embeddingModel).toBe('text-embedding-3-small');
    });
  });

  describe('generateEmbeddings', () => {
    it('should call embedding API and return vectors', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateEmbeddings(['test text'], 'http://test', 'key', 'model');

      expect(result).toEqual([[0.1, 0.2, 0.3]]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/embedding.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement embedding service**

Create `src/lib/embedding.ts`:

```typescript
import { storage } from '@/lib/storage';
import { decryptApiKey } from '@/lib/crypto';
import type { EmbeddingsData } from '@/types';
import { splitIntoChunks } from './chunker';

interface EmbeddingConfig {
  embeddingModel: string;
  baseUrl: string;
  apiKey: string;
}

/**
 * Get embedding configuration from settings or environment.
 */
export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  const settings = await storage.getSettings();

  const embeddingModel = (settings?.embeddingModel as string) ||
    process.env.AI_EMBEDDING_MODEL ||
    'text-embedding-3-small';

  const useSameApi = settings?.useSameApiForEmbedding !== false;

  let baseUrl: string;
  let apiKey: string;

  if (useSameApi) {
    baseUrl = (settings?.baseUrl as string) || process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    apiKey = process.env.AI_API_KEY || '';
    if (settings?.apiKeyEncrypted && settings?.apiKeyIV) {
      try {
        apiKey = decryptApiKey(settings.apiKeyEncrypted as string, settings.apiKeyIV as string);
      } catch { }
    }
  } else {
    baseUrl = (settings?.embeddingBaseUrl as string) || process.env.AI_EMBEDDING_BASE_URL || 'https://api.openai.com/v1';
    apiKey = process.env.AI_EMBEDDING_API_KEY || '';
    if (settings?.embeddingApiKeyEncrypted && settings?.embeddingApiKeyIV) {
      try {
        apiKey = decryptApiKey(settings.embeddingApiKeyEncrypted as string, settings.embeddingApiKeyIV as string);
      } catch { }
    }
  }

  return { embeddingModel, baseUrl, apiKey };
}

/**
 * Generate embeddings for an array of texts.
 */
export async function generateEmbeddings(
  texts: string[],
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<number[][]> {
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding);
}

/**
 * Generate embeddings for a paper and save to storage.
 */
export async function generatePaperEmbeddings(paperId: string): Promise<EmbeddingsData> {
  await storage.updateMetadata(paperId, { embeddingStatus: 'generating' });

  try {
    const parsedContent = await storage.getParsedContent(paperId);
    if (!parsedContent) {
      throw new Error('No parsed content available');
    }

    const chunks = splitIntoChunks(parsedContent);
    const config = await getEmbeddingConfig();

    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.text);
      const embeddings = await generateEmbeddings(
        texts,
        config.baseUrl,
        config.apiKey,
        config.embeddingModel
      );
      allEmbeddings.push(...embeddings);
    }

    const embeddingsData: EmbeddingsData = {
      chunks,
      embeddings: allEmbeddings,
      generatedAt: new Date().toISOString(),
      model: config.embeddingModel,
    };

    await storage.saveEmbeddings(paperId, embeddingsData);
    await storage.updateMetadata(paperId, {
      embeddingStatus: 'generated',
      embeddingGeneratedAt: new Date().toISOString(),
      embeddingError: undefined,
    });

    return embeddingsData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await storage.updateMetadata(paperId, {
      embeddingStatus: 'error',
      embeddingError: errorMessage,
    });
    throw error;
  }
}

/**
 * Trigger embedding generation in background.
 */
export function triggerEmbeddingGeneration(paperId: string): void {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  fetch(`${baseUrl}/api/embed/${paperId}`, {
    method: 'POST',
  }).catch(err => {
    console.error('Failed to trigger embedding generation:', err);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/embedding.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/embedding.ts __tests__/lib/embedding.test.ts
git commit -m "feat(embedding): implement embedding service for RAG

- Add getEmbeddingConfig() for model/API settings
- Add generateEmbeddings() for API calls
- Add generatePaperEmbeddings() for full paper processing
- Support both same API and separate embedding API"
```

---

## Chunk 3: Retrieval Service

### Task 5: Implement Retrieval Service

**Files:**
- Create: `src/lib/retrieval.ts`
- Create: `__tests__/lib/retrieval.test.ts`

- [ ] **Step 1: Write failing test for retrieval service**

Create `__tests__/lib/retrieval.test.ts`:

```typescript
import {
  cosineSimilarity,
  search,
  buildRAGContext,
  ensureQuoteIncluded,
} from '@/lib/retrieval';
import type { ChunkData, EmbeddingsData, PaperAnalysis, TextSelection } from '@/types';

describe('retrieval', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    it('should return 0 for mismatched lengths', () => {
      expect(cosineSimilarity([1, 2], [1])).toBe(0);
    });
  });

  describe('search', () => {
    const mockEmbeddings: EmbeddingsData = {
      chunks: [
        { id: 'chunk_1', page: 1, section: 'Intro', text: 'Introduction text' },
        { id: 'chunk_2', page: 2, section: 'Methods', text: 'Methods text' },
        { id: 'chunk_3', page: 3, section: 'Results', text: 'Results text' },
      ],
      embeddings: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      generatedAt: '2026-03-31T10:00:00Z',
      model: 'text-embedding-3-small',
    };

    it('should return top-k chunks by similarity', async () => {
      const queryEmbedding = [0.9, 0.1, 0];
      const results = await search(queryEmbedding, mockEmbeddings, 2);

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('chunk_1');
      expect(results[0].similarity).toBeGreaterThan(0);
    });
  });

  describe('buildRAGContext', () => {
    it('should build context from analysis and chunks', () => {
      const analysis: PaperAnalysis = {
        summary: { content: 'Summary text' },
        contributions: { items: ['Contribution 1'] },
        methodology: { content: 'Method text' },
        experiments: { content: 'Experiment text' },
        conclusions: { content: 'Conclusion text' },
        generatedAt: '2026-03-31T10:00:00Z',
      };

      const chunks: ChunkData[] = [
        { id: 'chunk_1', page: 1, section: 'Intro', text: 'Some text' },
      ];

      const context = buildRAGContext(analysis, chunks);

      expect(context).toContain('[论文摘要]');
      expect(context).toContain('Summary text');
      expect(context).toContain('[与您问题相关的段落]');
    });

    it('should handle null analysis', () => {
      const chunks: ChunkData[] = [
        { id: 'chunk_1', page: 1, section: 'Intro', text: 'Some text' },
      ];

      const context = buildRAGContext(null, chunks);

      expect(context).not.toContain('[论文摘要]');
      expect(context).toContain('[与您问题相关的段落]');
    });
  });

  describe('ensureQuoteIncluded', () => {
    const chunks: ChunkData[] = [
      { id: 'chunk_1', page: 1, section: 'A', text: 'Hello world' },
      { id: 'chunk_2', page: 2, section: 'B', text: 'Foo bar baz' },
      { id: 'chunk_3', page: 3, section: 'C', text: 'Different content' },
    ];

    it('should replace lowest similarity chunk if quote not in results', () => {
      const relevantChunks: ChunkData[] = [
        { ...chunks[2], similarity: 0.9 },
        { ...chunks[1], similarity: 0.7 },
      ];

      const quote: TextSelection = {
        text: 'Hello world',
        page: 1,
        rects: [],
      };

      const result = ensureQuoteIncluded(relevantChunks, quote, chunks);

      expect(result.some(c => c.id === 'chunk_1')).toBe(true);
    });

    it('should not modify if quote already included', () => {
      const relevantChunks: ChunkData[] = [
        { ...chunks[0], similarity: 0.9 },
        { ...chunks[1], similarity: 0.7 },
      ];

      const quote: TextSelection = {
        text: 'Hello world',
        page: 1,
        rects: [],
      };

      const result = ensureQuoteIncluded(relevantChunks, quote, chunks);

      expect(result).toEqual(relevantChunks);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/retrieval.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement retrieval service**

Create `src/lib/retrieval.ts`:

```typescript
import type { ChunkData, EmbeddingsData, PaperAnalysis, TextSelection } from '@/types';

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Search for most relevant chunks given a query embedding.
 */
export async function search(
  queryEmbedding: number[],
  embeddingsData: EmbeddingsData,
  topK: number
): Promise<ChunkData[]> {
  const { chunks, embeddings } = embeddingsData;

  const similarities = embeddings.map((emb, index) => ({
    chunk: chunks[index],
    similarity: cosineSimilarity(queryEmbedding, emb),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, topK).map(item => ({
    ...item.chunk,
    similarity: item.similarity,
  }));
}

/**
 * Build RAG context string from analysis and chunks.
 */
export function buildRAGContext(
  analysis: PaperAnalysis | null,
  chunks: ChunkData[]
): string {
  const parts: string[] = [];

  if (analysis) {
    parts.push('[论文摘要]');
    parts.push(`- 核心思想：${analysis.summary.content}`);
    parts.push(`- 方法论：${analysis.methodology.content}`);
    parts.push(`- 实验：${analysis.experiments.content}`);
    parts.push(`- 结论：${analysis.conclusions.content}`);
    parts.push('');
  }

  parts.push('[与您问题相关的段落]');
  for (const chunk of chunks) {
    parts.push(`段落 (第${chunk.page}页，${chunk.section || '正文'})：`);
    parts.push(chunk.text);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Normalize text for comparison.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Calculate overlap ratio between two texts.
 */
function calculateOverlap(search: string, target: string): number {
  const searchWords = new Set(search.split(' '));
  const targetWords = target.split(' ');

  let matches = 0;
  for (const word of targetWords) {
    if (searchWords.has(word)) matches++;
  }

  return searchWords.size > 0 ? matches / searchWords.size : 0;
}

/**
 * Find chunk containing the quoted text.
 */
function findChunkByText(chunks: ChunkData[], searchText: string): ChunkData | null {
  const normalizedSearch = normalizeText(searchText);

  for (const chunk of chunks) {
    const normalizedChunk = normalizeText(chunk.text);
    const overlapRatio = calculateOverlap(normalizedSearch, normalizedChunk);
    if (overlapRatio >= 0.8) return chunk;
  }

  return null;
}

/**
 * Ensure the quoted chunk is included in relevant chunks.
 */
export function ensureQuoteIncluded(
  relevantChunks: ChunkData[],
  quote: TextSelection,
  allChunks: ChunkData[]
): ChunkData[] {
  const quotedChunk = findChunkByText(allChunks, quote.text);

  if (!quotedChunk) return relevantChunks;

  const alreadyIncluded = relevantChunks.some(c => c.id === quotedChunk.id);
  if (alreadyIncluded) return relevantChunks;

  const result = [...relevantChunks];
  result[result.length - 1] = { ...quotedChunk, similarity: 1 };
  return result;
}

/**
 * Low confidence threshold for retrieval.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.3;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/retrieval.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/retrieval.ts __tests__/lib/retrieval.test.ts
git commit -m "feat(retrieval): implement vector retrieval for RAG

- Add cosineSimilarity for vector comparison
- Add search() for top-k chunk retrieval
- Add buildRAGContext() for context assembly
- Add ensureQuoteIncluded() for quote handling"
```

---

## Chunk 4: API Endpoints

### Task 6: Create Embed API Endpoint

**Files:**
- Create: `src/app/api/embed/[id]/route.ts`
- Create: `__tests__/api/embed.test.ts`

- [ ] **Step 1: Write failing test for embed API**

Create `__tests__/api/embed.test.ts`:

```typescript
import { POST } from '@/app/api/embed/[id]/route';

// Mock dependencies
jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn().mockResolvedValue(true),
    getMetadata: jest.fn().mockResolvedValue({ id: 'test-id', status: 'analyzed' }),
    updateMetadata: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/lib/embedding', () => ({
  generatePaperEmbeddings: jest.fn().mockResolvedValue({
    chunks: [],
    embeddings: [],
    generatedAt: '2026-03-31T10:00:00Z',
    model: 'test-model',
  }),
}));

describe('/api/embed/[id]', () => {
  it('should generate embeddings for valid paper', async () => {
    const request = new Request('http://localhost/api/embed/test-id', {
      method: 'POST',
    });

    const response = await POST(request, { params: { id: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/embed.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement embed API endpoint**

Create `src/app/api/embed/[id]/route.ts`:

```typescript
import { storage } from '@/lib/storage';
import { generatePaperEmbeddings } from '@/lib/embedding';
import { createErrorResponse } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const paperId = params.id;

    const exists = await storage.paperExists(paperId);
    if (!exists) {
      return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    }

    const metadata = await storage.getMetadata(paperId);
    if (metadata.status !== 'analyzed') {
      return createErrorResponse('INVALID_STATUS', 'Paper must be analyzed first');
    }

    // Check if already generating
    if (metadata.embeddingStatus === 'generating') {
      return Response.json({ success: true, status: 'already_generating' });
    }

    const embeddingsData = await generatePaperEmbeddings(paperId);

    return Response.json({
      success: true,
      chunkCount: embeddingsData.chunks.length,
      model: embeddingsData.model,
    });
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return createErrorResponse(
      'EMBEDDING_FAILED',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const paperId = params.id;

    const exists = await storage.paperExists(paperId);
    if (!exists) {
      return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    }

    const metadata = await storage.getMetadata(paperId);
    const embeddings = await storage.getEmbeddings(paperId);

    return Response.json({
      status: metadata.embeddingStatus || 'pending',
      error: metadata.embeddingError,
      generatedAt: metadata.embeddingGeneratedAt,
      model: embeddings?.model,
      chunkCount: embeddings?.chunks.length,
    });
  } catch (error) {
    return createErrorResponse(
      'FETCH_FAILED',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/embed.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/embed/\[id\]/route.ts __tests__/api/embed.test.ts
git commit -m "feat(api): add embed endpoint for embedding generation

- POST triggers embedding generation
- GET returns embedding status
- Validates paper exists and is analyzed"
```

### Task 7: Create Regenerate All Endpoint

**Files:**
- Create: `src/app/api/embed/regenerate-all/route.ts`
- Create: `__tests__/api/regenerate-all.test.ts`

- [ ] **Step 1: Write failing test for regenerate-all endpoint**

Create `__tests__/api/regenerate-all.test.ts`:

```typescript
import { POST } from '@/app/api/embed/regenerate-all/route';

jest.mock('@/lib/storage', () => ({
  storage: {
    listPapers: jest.fn().mockResolvedValue([
      { id: 'paper-1', status: 'analyzed' },
      { id: 'paper-2', status: 'analyzed' },
    ]),
  },
}));

jest.mock('@/lib/embedding', () => ({
  generatePaperEmbeddings: jest.fn().mockResolvedValue({
    chunks: [],
    embeddings: [],
    generatedAt: '2026-03-31T10:00:00Z',
    model: 'test-model',
  }),
}));

describe('/api/embed/regenerate-all', () => {
  it('should regenerate embeddings for all analyzed papers', async () => {
    const request = new Request('http://localhost/api/embed/regenerate-all', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.total).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/regenerate-all.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement regenerate-all endpoint**

Create `src/app/api/embed/regenerate-all/route.ts`:

```typescript
import { storage } from '@/lib/storage';
import { generatePaperEmbeddings } from '@/lib/embedding';
import { createErrorResponse } from '@/lib/errors';

const BATCH_SIZE = 5;
const DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const papers = await storage.listPapers();
    const analyzedPapers = papers.filter(p => p.status === 'analyzed');

    let successCount = 0;
    let errorCount = 0;

    for (const batch of chunk(analyzedPapers, BATCH_SIZE)) {
      await Promise.all(batch.map(async (paper) => {
        // generatePaperEmbeddings handles all metadata updates internally:
        // - Sets embeddingStatus: 'generating' before starting
        // - Sets embeddingStatus: 'generated' + embeddingGeneratedAt on success
        // - Sets embeddingStatus: 'error' + embeddingError on failure
        try {
          await generatePaperEmbeddings(paper.id);
          successCount++;
        } catch (error) {
          console.error(`Failed to generate embeddings for ${paper.id}:`, error);
          errorCount++;
        }
      }));

      await sleep(DELAY_MS);
    }

    return Response.json({
      success: true,
      total: analyzedPapers.length,
      successCount,
      errorCount,
    });
  } catch (error) {
    return createErrorResponse(
      'REGENERATE_FAILED',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/regenerate-all.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/embed/regenerate-all/route.ts __tests__/api/regenerate-all.test.ts
git commit -m "feat(api): add regenerate-all endpoint for batch embedding

- Process papers in batches of 5
- Add 1s delay between batches for rate limiting
- Return success/error counts
- Note: generatePaperEmbeddings handles per-paper metadata updates"
```

---

## Chunk 5: Chat API Integration

### Task 8: Integrate RAG into Chat API

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Modify chat API to use RAG context**

Update `src/app/api/chat/route.ts`:

```typescript
import { storage } from '@/lib/storage';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { CHAT_PROMPT, buildQuoteContext } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';
import { generateEmbeddings, getEmbeddingConfig, triggerEmbeddingGeneration } from '@/lib/embedding';
import { search, buildRAGContext, ensureQuoteIncluded, LOW_CONFIDENCE_THRESHOLD } from '@/lib/retrieval';
import type { ChatSession, TextSelection } from '@/types';

export async function POST(request: Request) {
  try {
    const { paperId, sessionId, message, quote, expandContext } = await request.json() as {
      paperId: string;
      sessionId?: string;
      message: string;
      quote?: TextSelection;
      expandContext?: boolean;
    };
    if (!paperId) return createErrorResponse('VALIDATION_ERROR', 'paperId is required');
    if (!message) return createErrorResponse('VALIDATION_ERROR', 'message is required');
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

    // Resolve or create session
    let session: ChatSession;
    if (sessionId) {
      const existing = await storage.getChatSession(paperId, sessionId);
      if (!existing) return createErrorResponse('SESSION_NOT_FOUND', 'Session not found');
      session = existing;
    } else {
      session = await storage.createChatSession(paperId);
    }

    const { apiKey, baseUrl, model } = await getAIConfig();
    if (!apiKey) return createErrorResponse('API_KEY_MISSING', 'API key is not configured');

    // Get analysis and embeddings
    const analysis = await storage.getAnalysis(paperId);
    const embeddings = await storage.getEmbeddings(paperId);

    let contextContent: string;
    let lowConfidence = false;

    if (!embeddings) {
      // Fallback: trigger async generation, use full text for this query
      triggerEmbeddingGeneration(paperId);
      const parsedContent = await storage.getParsedContent(paperId);
      contextContent = parsedContent || '';
    } else {
      // RAG: embed query and retrieve relevant chunks
      const embeddingConfig = await getEmbeddingConfig();
      const [queryEmbedding] = await generateEmbeddings(
        [message],
        embeddingConfig.baseUrl,
        embeddingConfig.apiKey,
        embeddingConfig.embeddingModel
      );

      const topK = expandContext ? 8 : 3;
      let relevantChunks = await search(queryEmbedding, embeddings, topK);

      // Check low confidence
      if (relevantChunks.length > 0 && relevantChunks[0].similarity! < LOW_CONFIDENCE_THRESHOLD) {
        lowConfidence = true;
      }

      // Ensure quote is included if provided
      if (quote) {
        relevantChunks = ensureQuoteIncluded(relevantChunks, quote, embeddings.chunks);
      }

      contextContent = buildRAGContext(analysis, relevantChunks);
    }

    const historyStr = session.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const quoteContext = buildQuoteContext(quote);
    const promptSettings = await storage.getPromptSettings();
    let chatPromptTemplate = promptSettings?.chat?.custom || CHAT_PROMPT;

    // Inject quoteContext placeholder if not present
    if (!chatPromptTemplate.includes('{quoteContext}')) {
      if (chatPromptTemplate.includes('User question:')) {
        chatPromptTemplate = chatPromptTemplate.replace('User question:', '{quoteContext}\n\nUser question:');
      } else if (chatPromptTemplate.includes('{question}')) {
        chatPromptTemplate = chatPromptTemplate.replace('{question}', '{quoteContext}\n\n{question}');
      }
    }

    const prompt = chatPromptTemplate
      .replaceAll('{content}', contextContent)
      .replaceAll('{history}', historyStr)
      .replaceAll('{quoteContext}', quoteContext)
      .replaceAll('{question}', message);
    const client = createAIClient({ baseUrl, apiKey, model });
    const encoder = new TextEncoder();

    // Persist user message
    session.messages.push({ role: 'user', content: message, quote });
    if (session.title === 'New Chat') {
      session.title = message.slice(0, 30);
    }
    await storage.saveChatSession(paperId, session);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); }
          catch { }
        };
        try {
          let fullResponse = '';
          for await (const chunk of client.streamComplete([{ role: 'user', content: prompt }])) {
            fullResponse += chunk;
            send({ content: chunk });
          }
          session.messages.push({ role: 'assistant', content: fullResponse });
          await storage.saveChatSession(paperId, session);
          send({ done: true, sessionId: session.id, lowConfidence });
        } catch (error) { send({ error: error instanceof Error ? error.message : 'Chat failed' }); }
        finally { try { controller.close(); } catch { } }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  } catch (error) {
    return createErrorResponse('API_CALL_FAILED', `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

- [ ] **Step 2: Run existing chat tests**

Run: `npx jest __tests__/api/chat.test.ts`
Expected: PASS (existing tests should still pass)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(chat): integrate RAG for context optimization

- Use RAG context instead of full text when embeddings exist
- Fallback to full text if embeddings not available
- Add expandContext param for more chunks
- Add lowConfidence flag in SSE response
- Ensure quote chunk is included when quote provided"
```

---

## Chunk 6: Frontend Integration

### Task 9: Add Embedding Settings UI

**Files:**
- Modify: `src/components/settings-form.tsx`

- [ ] **Step 1: Add embedding settings to SettingsForm**

Update `src/components/settings-form.tsx` to add embedding fields:

**1. Update SettingsData interface:**
```typescript
interface SettingsData {
  baseUrl: string;
  model: string;
  visionModel: string;
  hasApiKey: boolean;
  // NEW
  embeddingModel: string;
  useSameApiForEmbedding: boolean;
}
```

**2. Update initial state in useState:**
```typescript
  const [settings, setSettings] = useState<SettingsData>({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    visionModel: 'gpt-4o',
    hasApiKey: false,
    embeddingModel: 'text-embedding-3-small',
    useSameApiForEmbedding: true,
  });
```

**3. Update loadSettings useEffect to include new fields:**
```typescript
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings({
          baseUrl: data.baseUrl || 'https://api.openai.com/v1',
          model: data.model || 'gpt-4o',
          visionModel: data.visionModel || 'gpt-4o',
          hasApiKey: data.hasApiKey || false,
          embeddingModel: data.embeddingModel || 'text-embedding-3-small',
          useSameApiForEmbedding: data.useSameApiForEmbedding !== false,
        });
      } catch {
        // Use defaults
      }
    }
    loadSettings();
  }, []);
```

**4. Add embedding model input after Vision Model input (around line 133):**
```tsx
      <div className="mb-6 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Embedding Settings</h3>

        <div className="mb-4">
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Embedding Model
          </label>
          <input
            type="text"
            value={settings.embeddingModel}
            onChange={(e) => setSettings({ ...settings, embeddingModel: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
            placeholder="text-embedding-3-small"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.useSameApiForEmbedding}
            onChange={(e) => setSettings({ ...settings, useSameApiForEmbedding: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Use same API for embeddings</span>
        </label>
      </div>
```

**5. Update handleSave to include embedding settings:**
```typescript
      const body: Record<string, string | boolean> = {
        baseUrl: settings.baseUrl,
        model: settings.model,
        visionModel: settings.visionModel,
        embeddingModel: settings.embeddingModel || 'text-embedding-3-small',
        useSameApiForEmbedding: settings.useSameApiForEmbedding,
      };
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings-form.tsx
git commit -m "feat(settings): add embedding model configuration UI

- Add embedding model text input with default
- Add 'use same API' checkbox (default checked)
- Include new fields in loadSettings and handleSave"
```

### Task 10: Add "Get More Context" Button to Chat

**Files:**
- Modify: `src/components/chat-messages.tsx`
- Modify: `src/app/paper/[id]/page.tsx` (actual path: verify with `ls src/app/paper`)

- [ ] **Step 1: Add expandContext support to ChatMessages**

Update `src/components/chat-messages.tsx`:

**1. Update interface:**
```typescript
interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent?: string;
  isStreaming?: boolean;
  onJumpToQuote?: (quote: TextSelection) => void;
  lowConfidence?: boolean;
  onExpandContext?: () => void;
}
```

**2. Update function signature:**
```typescript
export function ChatMessages({ messages, streamingContent, isStreaming, onJumpToQuote, lowConfidence, onExpandContext }: ChatMessagesProps) {
```

**3. Add button before the `<div ref={bottomRef} />` line (around line 85):**
```tsx
      {messages.length > 0 && !isStreaming && onExpandContext && (
        <div className="flex justify-start">
          <button
            onClick={onExpandContext}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-tertiary)',
            }}
          >
            📄 获取更多上下文
          </button>
        </div>
      )}
```

- [ ] **Step 2: Add expandContext handler in paper page**

Update `src/app/paper/[id]/page.tsx`:

**1. Add state for low confidence (around line 60):**
```typescript
  const [lowConfidence, setLowConfidence] = useState(false);
```

**2. Replace handleSendMessage function (lines 493-566) with updated version:**
```typescript
  const handleSendMessage = useCallback(
    async (message: string, expandContext: boolean = false) => {
      const sendingSessionId = activeSessionId;
      const quoteToSend = expandContext ? undefined : pendingQuote;
      setChatMessages((prev) => [...prev, { role: 'user', content: message, quote: !expandContext && quoteToSend ? quoteToSend : undefined }]);
      if (!expandContext) setPendingQuote(null);
      setIsChatStreaming(true);
      setStreamingContent('');
      setLowConfidence(false);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId, sessionId: activeSessionId, message, quote: quoteToSend, expandContext }),
        });
        if (!response.ok) throw new Error('Failed to send message');

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.content) {
                fullResponse += data.content;
                if (activeSessionIdRef.current === sendingSessionId) {
                  setStreamingContent(fullResponse);
                  setIsChatStreaming(true);
                }
              }
              if (data.done) {
                if (data.lowConfidence) {
                  setLowConfidence(true);
                }
                if (activeSessionIdRef.current === sendingSessionId) {
                  setChatMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: fullResponse },
                  ]);
                  setStreamingContent('');
                }
                if (data.sessionId && !sendingSessionId) {
                  setActiveSessionId(data.sessionId);
                }
                fetchSessions();
              }
            } catch { }
          }
        }
      } catch (error) {
        console.error('Chat error:', error);
      } finally {
        if (activeSessionIdRef.current === sendingSessionId) {
          setIsChatStreaming(false);
        }
      }
    },
    [paperId, activeSessionId, fetchSessions, pendingQuote]
  );

  const handleExpandContext = useCallback(() => {
    const lastUserMessage = [...chatMessages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content, true);
    }
  }, [chatMessages, handleSendMessage]);
```

**3. Update ChatMessages props (around line 926):**
```tsx
              <ChatMessages
                messages={chatMessages}
                streamingContent={streamingContent}
                isStreaming={isChatStreaming}
                onJumpToQuote={handleJumpToQuote}
                lowConfidence={lowConfidence}
                onExpandContext={handleExpandContext}
              />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat-messages.tsx src/app/paper/\[id\]/page.tsx
git commit -m "feat(chat): add 'Get more context' button

- Show button after AI response
- Re-send query with expandContext=true
- Display low confidence warning
- Retrieve 8 chunks instead of 3"
```

### Task 11: Trigger Embedding After Analysis

**Files:**
- Modify: `src/app/paper/[id]/page.tsx`

- [ ] **Step 1: Add useEffect to trigger embedding after analysis**

Add to `src/app/paper/[id]/page.tsx` after the refetch useEffect (around line 89):

```typescript
  // Trigger embedding generation after analysis completes
  useEffect(() => {
    if (data?.metadata.status === 'analyzed' && !data?.metadata.embeddingStatus) {
      fetch(`/api/embed/${paperId}`, { method: 'POST' }).catch(err => {
        console.error('Failed to trigger embedding generation:', err);
      });
    }
  }, [data?.metadata.status, data?.metadata.embeddingStatus, paperId]);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/paper/\[id\]/page.tsx
git commit -m "feat: auto-trigger embedding after analysis completes

- Check for analyzed status and missing embeddings
- Call embed API to generate embeddings in background"
```

---

## Chunk 7: Final Testing and Documentation

### Task 12: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Build project**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit (if any files were modified)**

```bash
# Only if there are uncommitted changes from fixes
git status
# Add specific files if needed, not -A
git commit -m "chore: fix any remaining issues for RAG implementation"
```

### Task 13: Update Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md with new architecture**

Add to Architecture section:

```markdown
### RAG Context Optimization

When users chat with a paper, the system uses RAG (Retrieval-Augmented Generation) to reduce token consumption:

1. **Embedding Generation**: After analysis, the parsed markdown is chunked and embedded via API
2. **Storage**: Embeddings stored in `~/.easypaper/papers/{id}/embeddings.json`
3. **Chat Query**: Query is embedded, top-k relevant chunks retrieved + analysis summary sent as context
4. **Fallback**: If no embeddings exist, falls back to full text temporarily

New modules:
- `src/lib/chunker.ts` — Paper chunking logic
- `src/lib/embedding.ts` — Embedding API calls
- `src/lib/retrieval.ts` — Vector similarity search

New API endpoints:
- `POST /api/embed/{id}` — Generate embeddings for a paper
- `GET /api/embed/{id}` — Get embedding status
- `POST /api/embed/regenerate-all` — Regenerate all paper embeddings
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with RAG architecture

- Document embedding flow and storage
- List new modules and API endpoints
- Explain fallback behavior"
```