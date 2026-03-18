# Vision-based PDF Parser Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace marker-pdf (Python) with a pure Node.js "PDF → mupdf-js WASM → Vision LLM → Markdown" pipeline.

**Architecture:** Use `mupdf-js` to render PDF pages to PNG images, send them to the user's Vision LLM via the OpenAI-compatible API, and receive structured Markdown. Falls back to `mupdf-js` text extraction if Vision is unavailable.

**Tech Stack:** mupdf-js (WASM PDF renderer), OpenAI-compatible Vision API, Next.js API routes (Node.js runtime)

**Spec:** `docs/superpowers/specs/2026-03-18-vision-pdf-parser-design.md`

**Note:** The spec shows `parsePdfWithVision(pdfPath, paperDir, { ... })` with a `paperDir` parameter. This plan intentionally omits `paperDir` because the Vision parser does not write intermediate files to disk (unlike marker-pdf which wrote images to `paperDir/images/`).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/ai-client.ts` | Modify | Extend `Message` type to union, add `completeVision` method with `AbortSignal` support |
| `src/lib/ai-config.ts` | Modify | Return `visionModel` from settings/env |
| `src/lib/prompts.ts` | Modify | Add `PDF_PARSE_PROMPT` and `PDF_PARSE_BATCH_PROMPT` |
| `src/lib/pdf-parser.ts` | Create | PDF→images rendering + Vision LLM orchestration + fallback |
| `src/app/api/analyze/route.ts` | Modify | Replace `parsePdfWithMarker` with `parsePdfWithVision` |
| `next.config.ts` | Modify | Enable WASM support for mupdf-js |
| `src/lib/marker.ts` | Delete | No longer needed |
| `scripts/parse-pdf.py` | Delete | No longer needed |
| `__tests__/lib/ai-client.test.ts` | Modify | Add tests for `completeVision` |
| `__tests__/lib/ai-config.test.ts` | Create | Test `visionModel` return |
| `__tests__/lib/pdf-parser.test.ts` | Create | Test PDF parsing orchestration |
| `__tests__/lib/marker.test.ts` | Delete | No longer needed |
| `__tests__/api/analyze.test.ts` | Modify | Update mock from `marker` to `pdf-parser` |

---

## Chunk 1: Foundation — Dependencies, Types, Config

### Task 1: Install mupdf-js and configure WASM

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Install mupdf-js**

Run: `npm install mupdf-js`

- [ ] **Step 2: Verify installation**

Run: `node -e "require('mupdf-js')"`
Expected: No error (module loads successfully)

- [ ] **Step 3: Configure Next.js for WASM**

Update `next.config.ts` to enable async WASM loading:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
```

- [ ] **Step 4: Verify build still works**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore: add mupdf-js WASM dependency and configure Next.js webpack"
```

---

### Task 2: Extend ai-config.ts to return visionModel

**Files:**
- Modify: `src/lib/ai-config.ts`
- Create: `__tests__/lib/ai-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ai-config.test.ts`:

```typescript
import { getAIConfig } from '@/lib/ai-config';

jest.mock('@/lib/storage', () => ({
  storage: { getSettings: jest.fn().mockResolvedValue(null) },
}));
jest.mock('@/lib/crypto', () => ({
  decryptApiKey: jest.fn(),
}));

describe('getAIConfig', () => {
  beforeEach(() => {
    delete process.env.AI_VISION_MODEL;
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_BASE_URL = 'https://api.test.com/v1';
    process.env.AI_MODEL = 'gpt-4o';
  });

  it('returns visionModel from env var', async () => {
    process.env.AI_VISION_MODEL = 'gpt-4o-vision';
    const config = await getAIConfig();
    expect(config.visionModel).toBe('gpt-4o-vision');
  });

  it('falls back to model when visionModel is not set', async () => {
    const config = await getAIConfig();
    expect(config.visionModel).toBe('gpt-4o');
  });

  it('prefers settings visionModel over env var', async () => {
    const { storage } = require('@/lib/storage');
    (storage.getSettings as jest.Mock).mockResolvedValue({
      visionModel: 'from-settings',
      baseUrl: 'https://api.test.com/v1',
      model: 'test-model',
    });
    process.env.AI_VISION_MODEL = 'from-env';
    const config = await getAIConfig();
    expect(config.visionModel).toBe('from-settings');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/ai-config.test.ts -v`
Expected: FAIL — `visionModel` is not returned by `getAIConfig()`

- [ ] **Step 3: Implement — extend getAIConfig()**

Replace `src/lib/ai-config.ts` entirely:

```typescript
import { storage } from '@/lib/storage';
import { decryptApiKey } from '@/lib/crypto';

export async function getAIConfig() {
  const settings = await storage.getSettings();
  let apiKey = process.env.AI_API_KEY || '';
  const baseUrl = (settings?.baseUrl as string) || process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = (settings?.model as string) || process.env.AI_MODEL || 'gpt-4o';
  const visionModel = (settings?.visionModel as string) || process.env.AI_VISION_MODEL || model;
  if (settings?.apiKeyEncrypted && settings?.apiKeyIV) {
    try {
      apiKey = decryptApiKey(settings.apiKeyEncrypted as string, settings.apiKeyIV as string);
    } catch { /* Fall back to env var */ }
  }
  return { apiKey, baseUrl, model, visionModel };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/ai-config.test.ts -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-config.ts __tests__/lib/ai-config.test.ts
git commit -m "feat: extend getAIConfig to return visionModel"
```

---

### Task 3: Extend ai-client.ts with Vision support

**Files:**
- Modify: `src/lib/ai-client.ts`
- Modify: `__tests__/lib/ai-client.test.ts`

- [ ] **Step 1: Write the failing tests for completeVision**

Add to the end of `__tests__/lib/ai-client.test.ts` (inside the outer `describe`):

```typescript
describe('completeVision', () => {
  it('sends vision messages with image_url content and max_tokens', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '# Paper Title\n\nContent here' } }] }),
    });
    const visionClient = createAIClient({ baseUrl: 'https://api.test.com/v1', apiKey: 'sk-test', model: 'gpt-4o' });
    const result = await visionClient.completeVision([{
      role: 'user',
      content: [
        { type: 'text', text: 'Parse this PDF' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123', detail: 'high' } },
      ],
    }]);
    expect(result).toBe('# Paper Title\n\nContent here');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(16384);
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'Parse this PDF' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123', detail: 'high' } },
    ]);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 400, statusText: 'Bad Request',
      text: async () => '{"error":{"message":"Invalid image"}}',
    });
    const visionClient = createAIClient({ baseUrl: 'https://api.test.com/v1', apiKey: 'sk-test', model: 'gpt-4o' });
    await expect(visionClient.completeVision([{
      role: 'user',
      content: [{ type: 'text', text: 'test' }],
    }])).rejects.toThrow('API error 400');
  });

  it('supports AbortSignal for timeout', async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetch.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));
    const visionClient = createAIClient({ baseUrl: 'https://api.test.com/v1', apiKey: 'sk-test', model: 'gpt-4o' });
    await expect(visionClient.completeVision(
      [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      16384,
      controller.signal,
    )).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/ai-client.test.ts -v`
Expected: FAIL — `completeVision` is not a function

- [ ] **Step 3: Implement — extend types and add completeVision**

Replace `src/lib/ai-client.ts` entirely:

```typescript
type TextContentPart = { type: 'text'; text: string };
type ImageContentPart = { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } };
type ContentPart = TextContentPart | ImageContentPart;

interface AIClientConfig { baseUrl: string; apiKey: string; model: string; }
interface Message { role: 'system' | 'user' | 'assistant'; content: string; }
interface VisionMessage { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[]; }

function parseAPIError(status: number, errorText: string, url: string, model: string): string {
  let detail = '';
  try {
    const parsed = JSON.parse(errorText);
    detail = parsed.error?.message || parsed.message || errorText;
  } catch {
    detail = errorText;
  }

  const hints: string[] = [];
  if (status === 401) hints.push('Check your API key in Settings');
  if (status === 404) hints.push(`Model "${model}" may not exist on this provider`);
  if (status === 429) hints.push('Rate limit exceeded - wait and try again');
  if (status === 500) hints.push(`Server error from ${new URL(url).hostname} - the model "${model}" may be unavailable or the input may be too long`);
  if (status === 413 || detail.toLowerCase().includes('too long') || detail.toLowerCase().includes('context')) {
    hints.push('The paper content may exceed the model context window');
  }

  const hintStr = hints.length > 0 ? ` [Hint: ${hints.join('; ')}]` : '';
  return `API error ${status}: ${detail}${hintStr}`;
}

export function createAIClient(config: AIClientConfig) {
  const { baseUrl, apiKey, model } = config;

  async function complete(messages: Message[]): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseAPIError(response.status, errorText, `${baseUrl}/chat/completions`, model));
    }
    const data = await response.json();
    return data.choices[0].message.content;
  }

  async function* streamComplete(messages: Message[]): AsyncGenerator<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseAPIError(response.status, errorText, `${baseUrl}/chat/completions`, model));
    }
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* Skip malformed lines */ }
      }
    }
  }

  async function completeVision(
    messages: VisionMessage[],
    maxTokens: number = 16384,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: false }),
      signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseAPIError(response.status, errorText, `${baseUrl}/chat/completions`, model));
    }
    const data = await response.json();
    return data.choices[0].message.content;
  }

  return { complete, streamComplete, completeVision };
}

export type { ContentPart, TextContentPart, ImageContentPart, VisionMessage };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/ai-client.test.ts -v`
Expected: PASS (all tests including new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-client.ts __tests__/lib/ai-client.test.ts
git commit -m "feat: add completeVision method with AbortSignal support to ai-client"
```

---

### Task 4: Add PDF parse prompts to prompts.ts

**Files:**
- Modify: `src/lib/prompts.ts`

- [ ] **Step 1: Add the prompts**

Append to the end of `src/lib/prompts.ts`:

```typescript
export const PDF_PARSE_PROMPT = `You are a precise academic document converter. Convert the provided PDF page images into well-structured Markdown.

Rules:
1. Preserve the document's heading hierarchy using # ## ### etc.
2. Render mathematical formulas as LaTeX: inline formulas with $...$ and display formulas with $$...$$
3. Render tables as Markdown tables with proper alignment
4. For figures/charts: describe them as ![Figure N: description](figure) with a concise alt text
5. Preserve the original reading order across pages
6. Do NOT add any commentary, summary, or interpretation — only convert what you see
7. Output ONLY the Markdown content, no code fences or wrapper

Respond in the SAME LANGUAGE as the document content.`;

export const PDF_PARSE_BATCH_PROMPT = `You are continuing to convert a multi-part academic PDF into Markdown.
This is pages {startPage}-{endPage} of a {totalPages}-page document.
Continue from where the previous section ended. Do NOT repeat content from earlier pages.

Rules:
1. Preserve the document's heading hierarchy using # ## ### etc.
2. Render mathematical formulas as LaTeX: inline with $...$ and display with $$...$$
3. Render tables as Markdown tables with proper alignment
4. For figures/charts: describe them as ![Figure N: description](figure)
5. Preserve the original reading order
6. Output ONLY the Markdown content, no code fences or wrapper

Respond in the SAME LANGUAGE as the document content.`;
```

- [ ] **Step 2: Verify no type errors**

Run: `npx jest __tests__/lib/ai-client.test.ts -v`
Expected: PASS (existing tests still work, no import breakage)

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat: add PDF_PARSE_PROMPT for Vision-based PDF extraction"
```

---

## Chunk 2: Core — PDF Parser Module

### Task 5: Create pdf-parser.ts — PDF rendering and Vision LLM orchestration

**Files:**
- Create: `src/lib/pdf-parser.ts`
- Create: `__tests__/lib/pdf-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/pdf-parser.test.ts`:

```typescript
import { parsePdfWithVision, detectTruncation } from '@/lib/pdf-parser';

// Mock mupdf-js
const mockMupdf = {
  load: jest.fn().mockReturnValue('doc-handle'),
  pageCount: jest.fn().mockReturnValue(2),
  drawPageAsPNG: jest.fn().mockReturnValue(Buffer.from('fake-png').toString('base64')),
  getPageText: jest.fn().mockReturnValue('Fallback text content from page'),
  freeDocument: jest.fn(),
};
jest.mock('mupdf-js', () => ({
  createMuPdf: jest.fn().mockResolvedValue(mockMupdf),
}));

// Mock ai-client
const mockCompleteVision = jest.fn();
jest.mock('@/lib/ai-client', () => ({
  createAIClient: jest.fn().mockReturnValue({
    completeVision: mockCompleteVision,
  }),
}));

// Mock fs
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-bytes')),
}));

describe('parsePdfWithVision', () => {
  const config = { baseUrl: 'https://api.test.com/v1', apiKey: 'sk-test', visionModel: 'gpt-4o' };

  afterEach(() => {
    mockCompleteVision.mockReset();
    mockMupdf.drawPageAsPNG.mockReturnValue(Buffer.from('fake-png').toString('base64'));
    mockMupdf.pageCount.mockReturnValue(2);
  });

  it('renders PDF pages and sends to Vision LLM', async () => {
    mockCompleteVision.mockResolvedValue('# Paper Title\n\nParsed content.');

    const result = await parsePdfWithVision('/test.pdf', config);

    expect(result).toBe('# Paper Title\n\nParsed content.');
    const callArgs = mockCompleteVision.mock.calls[0][0];
    // 1 text prompt + 2 images
    expect(callArgs[0].content).toHaveLength(3);
    expect(callArgs[0].content[0].type).toBe('text');
    expect(callArgs[0].content[1].type).toBe('image_url');
    expect(callArgs[0].content[2].type).toBe('image_url');
  });

  it('falls back to text extraction when Vision fails', async () => {
    mockCompleteVision.mockRejectedValue(new Error('API error 400: model does not support images'));

    const result = await parsePdfWithVision('/test.pdf', config);

    expect(result).toContain('Fallback text content from page');
  });

  it('reports progress via callback', async () => {
    mockCompleteVision.mockResolvedValue('# Content.');
    const progress: string[] = [];

    await parsePdfWithVision('/test.pdf', config, {
      onProgress: (msg) => progress.push(msg),
    });

    expect(progress.some(p => p.includes('Rendering'))).toBe(true);
    expect(progress.some(p => p.includes('Vision AI'))).toBe(true);
  });

  it('skips pages that fail to render and annotates output', async () => {
    mockMupdf.drawPageAsPNG
      .mockReturnValueOnce(Buffer.from('ok-png').toString('base64'))
      .mockImplementationOnce(() => { throw new Error('render crash'); });

    mockCompleteVision.mockResolvedValue('# Page 1 content.');

    const result = await parsePdfWithVision('/test.pdf', config);

    // Should still succeed with 1 page
    expect(result).toContain('Page 1 content');
  });

  it('batches long papers with overlap', async () => {
    mockMupdf.pageCount.mockReturnValue(20);
    // Return base64 for all 20 pages
    mockMupdf.drawPageAsPNG.mockReturnValue(Buffer.from('page-png').toString('base64'));
    mockCompleteVision
      .mockResolvedValueOnce('# Batch 1 content ending here.')
      .mockResolvedValueOnce('# Batch 2 content.');

    await parsePdfWithVision('/test.pdf', config);

    // Should have been called twice (15 + remaining pages with overlap)
    expect(mockCompleteVision).toHaveBeenCalledTimes(2);
  });

  it('warns on truncated output but still returns it', async () => {
    mockCompleteVision.mockResolvedValue('# Paper Title\n\nContent starts but ends mid-sen');
    const warnings: string[] = [];

    const result = await parsePdfWithVision('/test.pdf', config, {
      onProgress: (msg) => warnings.push(msg),
    });

    expect(result).toContain('mid-sen');
    expect(warnings.some(w => w.toLowerCase().includes('truncat') || w.toLowerCase().includes('incomplete'))).toBe(true);
  });
});

describe('detectTruncation', () => {
  it('detects unclosed code fence', () => {
    expect(detectTruncation('```python\ncode here')).toBe(true);
  });

  it('detects unclosed table', () => {
    expect(detectTruncation('| col1 | col2\n| val1 |')).toBe(true);
  });

  it('returns false for complete text', () => {
    expect(detectTruncation('# Title\n\nComplete paragraph here.')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/pdf-parser.test.ts -v`
Expected: FAIL — module `@/lib/pdf-parser` does not exist

- [ ] **Step 3: Implement pdf-parser.ts**

Create `src/lib/pdf-parser.ts`:

```typescript
import fs from 'fs/promises';
import { createMuPdf } from 'mupdf-js';
import { createAIClient } from '@/lib/ai-client';
import { PDF_PARSE_PROMPT, PDF_PARSE_BATCH_PROMPT } from '@/lib/prompts';
import type { ContentPart } from '@/lib/ai-client';

interface ParseConfig {
  baseUrl: string;
  apiKey: string;
  visionModel: string;
}

interface ParseOptions {
  onProgress?: (message: string) => void;
}

const BATCH_SIZE = 15;
const BATCH_OVERLAP = 2;
const MAX_TOKENS = 16384;
const TIMEOUT_MS = 120_000;

/**
 * Detect if model output appears truncated (unclosed code fences, tables, mid-word ending).
 */
export function detectTruncation(text: string): boolean {
  const trimmed = text.trimEnd();
  // Unclosed code fence
  const fenceCount = (trimmed.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) return true;
  // Unclosed table row (line starts with | but doesn't end with |)
  const lines = trimmed.split('\n');
  const lastLine = lines[lines.length - 1].trim();
  if (lastLine.startsWith('|') && !lastLine.endsWith('|')) return true;
  // Ends mid-word (no sentence-ending punctuation and last char is a letter)
  if (/[a-zA-Z]$/.test(trimmed) && !/[.!?:;。！？：；]$/.test(trimmed)) {
    // Check it's not a heading or list item
    if (!/^#+\s/.test(lastLine) && !/^[-*]\s/.test(lastLine)) return true;
  }
  return false;
}

export async function parsePdfWithVision(
  pdfPath: string,
  config: ParseConfig,
  options: ParseOptions = {},
): Promise<string> {
  const { onProgress = () => {} } = options;

  // 1. Load PDF with mupdf-js
  const mupdf = await createMuPdf();
  const fileBuffer = await fs.readFile(pdfPath);
  const doc = mupdf.load(new Uint8Array(fileBuffer));
  const pageCount = mupdf.pageCount(doc);

  onProgress(`Rendering ${pageCount} PDF pages...`);

  // 2. Render pages to base64 PNG — one at a time for memory efficiency
  // Pages that fail to render are stored as null and skipped in the API call
  const pageImages: (string | null)[] = [];
  for (let i = 1; i <= pageCount; i++) {
    try {
      const pngBase64 = mupdf.drawPageAsPNG(doc, i, 200);
      pageImages.push(pngBase64);
    } catch (err) {
      console.warn(`[pdf-parser] Failed to render page ${i}:`, err instanceof Error ? err.message : err);
      pageImages.push(null);
    }
  }

  const validImages = pageImages.filter((img): img is string => img !== null);
  if (validImages.length === 0) {
    // All pages failed to render, try text extraction
    onProgress('All pages failed to render, using text extraction...');
    return extractTextFallback(mupdf, doc, pageCount);
  }

  // 3. Send to Vision LLM
  const client = createAIClient({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.visionModel });

  try {
    let result: string;

    if (validImages.length <= BATCH_SIZE) {
      // Single batch
      onProgress(`Parsing with Vision AI (${validImages.length} pages)...`);
      result = await callVisionWithRetry(client, validImages, PDF_PARSE_PROMPT);
    } else {
      // Multi-batch with overlap
      const results: string[] = [];
      let start = 0;
      let batchNum = 0;
      const totalBatches = Math.ceil(validImages.length / (BATCH_SIZE - BATCH_OVERLAP));

      while (start < validImages.length) {
        const end = Math.min(start + BATCH_SIZE, validImages.length);
        const batchImages = validImages.slice(start, end);
        batchNum++;

        onProgress(`Parsing with Vision AI (batch ${batchNum}/${totalBatches}, pages ${start + 1}-${end})...`);

        const prompt = start === 0
          ? PDF_PARSE_PROMPT
          : PDF_PARSE_BATCH_PROMPT
              .replace('{startPage}', String(start + 1))
              .replace('{endPage}', String(end))
              .replace('{totalPages}', String(validImages.length));

        const batchResult = await callVisionWithRetry(client, batchImages, prompt);
        results.push(batchResult);

        // Advance with overlap (except on last batch)
        start += end >= validImages.length ? validImages.length : BATCH_SIZE - BATCH_OVERLAP;
      }

      result = deduplicateAndJoin(results);
    }

    // Check for truncation
    if (detectTruncation(result)) {
      onProgress('Warning: AI output may be incomplete (truncated). Consider re-analyzing.');
    }

    mupdf.freeDocument(doc);
    return result;
  } catch (error) {
    // Fallback: text extraction via mupdf
    console.warn('[pdf-parser] Vision LLM failed, falling back to text extraction:', error instanceof Error ? error.message : error);
    onProgress('Vision model unavailable, using basic text extraction. For better results, configure a Vision-capable model.');

    const text = extractTextFallback(mupdf, doc, pageCount);
    mupdf.freeDocument(doc);
    return text;
  }
}

function extractTextFallback(
  mupdf: Awaited<ReturnType<typeof createMuPdf>>,
  doc: ReturnType<Awaited<ReturnType<typeof createMuPdf>>['load']>,
  pageCount: number,
): string {
  const textPages: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    try {
      textPages.push(mupdf.getPageText(doc, i));
    } catch {
      textPages.push(`[Page ${i}: text extraction failed]`);
    }
  }
  return textPages.join('\n\n---\n\n');
}

/**
 * Call Vision API with a single retry on timeout/abort.
 */
async function callVisionWithRetry(
  client: ReturnType<typeof createAIClient>,
  pageImages: string[],
  prompt: string,
): Promise<string> {
  const content: ContentPart[] = [
    { type: 'text', text: prompt },
    ...pageImages.map((base64): ContentPart => ({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' },
    })),
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const result = await client.completeVision(
        [{ role: 'user', content }],
        MAX_TOKENS,
        controller.signal,
      );
      return result;
    } catch (err) {
      if (attempt === 0 && err instanceof DOMException && err.name === 'AbortError') {
        console.warn('[pdf-parser] Vision API timed out, retrying...');
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Vision API timed out after retry');
}

/**
 * Join batch results, deduplicating overlapping content between batches.
 * Uses the last ~200 characters of one batch to find overlap with the next.
 */
function deduplicateAndJoin(results: string[]): string {
  if (results.length <= 1) return results[0] || '';

  const joined: string[] = [results[0]];

  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const next = results[i];
    const tail = prev.slice(-200).trim();

    // Try to find the overlap point in the next batch
    const overlapIdx = next.indexOf(tail.slice(-80));
    if (overlapIdx > 0 && overlapIdx < 500) {
      // Found overlap — skip the duplicated portion
      joined.push(next.slice(overlapIdx + tail.slice(-80).length));
    } else {
      // No overlap found — just concatenate with separator
      joined.push(next);
    }
  }

  return joined.join('\n\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/pdf-parser.test.ts -v`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-parser.ts __tests__/lib/pdf-parser.test.ts
git commit -m "feat: add Vision-based PDF parser with batching, fallback, and truncation detection"
```

---

## Chunk 3: Integration — Route Update and Cleanup

### Task 6: Update analyze/route.ts to use new parser

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `__tests__/api/analyze.test.ts`

- [ ] **Step 1: Update the analyze test mock**

In `__tests__/api/analyze.test.ts`, replace the marker mock line:

```typescript
// Replace:
jest.mock('@/lib/marker', () => ({ parsePdfWithMarker: jest.fn() }));
// With:
jest.mock('@/lib/pdf-parser', () => ({ parsePdfWithVision: jest.fn() }));
```

- [ ] **Step 2: Run test to verify existing tests still pass**

Run: `npx jest __tests__/api/analyze.test.ts -v`
Expected: PASS (existing tests mock `paperExists` to false or no API key, so they never reach the parser)

- [ ] **Step 3: Update analyze/route.ts**

In `src/app/api/analyze/route.ts`:

Replace import (line 2):
```typescript
// Remove:
import { parsePdfWithMarker } from '@/lib/marker';
// Add:
import { parsePdfWithVision } from '@/lib/pdf-parser';
```

Update `getAIConfig` destructure (line 15):
```typescript
// Before:
const { apiKey, baseUrl, model } = await getAIConfig();
// After:
const { apiKey, baseUrl, model, visionModel } = await getAIConfig();
```

Replace the parsing block (lines 29-36, inside the `else` branch after the cache check):
```typescript
// Before:
send({ step: 'parsing', message: 'Parsing PDF with Marker...' });
await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'parsing' });
const pdfPath = storage.getPdfPath(paperId);
const paperDir = pdfPath.replace('/original.pdf', '');
markdown = await parsePdfWithMarker(pdfPath, paperDir);

// After:
await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'parsing' });
const pdfPath = storage.getPdfPath(paperId);
markdown = await parsePdfWithVision(pdfPath, { baseUrl, apiKey, visionModel }, {
  onProgress: (message) => send({ step: 'parsing', message }),
});
```

- [ ] **Step 4: Run all tests**

Run: `npx jest -v`
Expected: All tests pass except `__tests__/lib/marker.test.ts` (import of deleted module — cleaned up next)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analyze/route.ts __tests__/api/analyze.test.ts
git commit -m "feat: integrate Vision-based PDF parser into analyze route"
```

---

### Task 7: Delete marker-pdf files and tests

**Files:**
- Delete: `src/lib/marker.ts`
- Delete: `scripts/parse-pdf.py`
- Delete: `__tests__/lib/marker.test.ts`

- [ ] **Step 1: Delete old files**

```bash
rm src/lib/marker.ts scripts/parse-pdf.py __tests__/lib/marker.test.ts
```

- [ ] **Step 2: Check for remaining import references**

Run: `grep -rn "from.*marker\|import.*marker\|require.*marker" src/ __tests__/ --include="*.ts" --include="*.tsx"`
Expected: No results

- [ ] **Step 3: Run all tests**

Run: `npx jest -v`
Expected: All tests pass

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove marker-pdf Python dependency and related files"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test (optional)**

Run: `npm run dev`
1. Open http://localhost:3000
2. Upload a PDF
3. Click "Analyze" — should see "Rendering PDF pages..." then "Parsing with Vision AI..."
4. Verify the parsed Markdown and analysis are correct
