# Vision Model Streaming Logs & Custom Prompts Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time streaming output for Vision Model PDF parsing with detailed progress, and a custom prompts system with Chinese/English presets.

**Architecture:** Two independent features sharing the same settings storage. Feature 1 modifies the Vision streaming pipeline (ai-client → pdf-parser → analyze route → frontend). Feature 2 adds a new prompts API/page and integrates custom prompts into existing AI call sites.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, SSE streaming

---

## File Structure

### New Files
- `src/app/api/prompts/route.ts` — GET/POST API for prompt configuration
- `src/app/prompts/page.tsx` — Prompt configuration page

### Modified Files
- `src/types/index.ts` — Add PromptSettings types, extend AnalyzeEvent
- `src/lib/ai-client.ts` — Add `streamCompleteVision()` method
- `src/lib/pdf-parser.ts` — Switch to streaming, add onChunk callback, console logs
- `src/lib/prompts.ts` — Add Chinese presets, export PROMPT_PRESETS
- `src/lib/storage.ts` — Add `getPromptSettings()` / `savePromptSettings()`
- `src/app/api/analyze/route.ts` — Forward vision_stream/vision_progress SSE events
- `src/app/api/chat/route.ts` — Use custom prompt if configured
- `src/components/analysis-panel.tsx` — Add streaming box UI during parsing
- `src/app/paper/[id]/page.tsx` — Handle new SSE event types
- `src/components/navbar.tsx` — Add "Prompts" link

---

## Chunk 1: Backend Foundation (Types, AI Client, Storage)

### Task 1: Add TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add PromptSettings types and extend AnalyzeEvent**

Add after the existing `ThemeSettings` interface (line 121):

```typescript
export type PromptPresetKey = 'zh' | 'en';

export interface PromptConfig {
  preset: PromptPresetKey;
  custom: string;
}

export interface PromptSettings {
  vision: PromptConfig;
  chat: PromptConfig;
}
```

Extend `AnalyzeEvent` (currently lines 72-76) to:

```typescript
export type AnalyzeEvent =
  | { step: 'parsing'; message?: string }
  | { step: 'analyzing'; message?: string }
  | { step: 'saving'; message?: string }
  | { type: 'vision_stream'; content: string }
  | { type: 'vision_progress'; batch: number; totalBatches: number; pages: string; elapsed: number }
  | { section: string; content: string }
  | { done: true }
  | { error: string };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from the types file (existing errors may be present).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add PromptSettings types and extend AnalyzeEvent for vision streaming"
```

---

### Task 2: Add `streamCompleteVision()` to AI Client

**Files:**
- Modify: `src/lib/ai-client.ts:81-101`

- [ ] **Step 1: Add `streamCompleteVision` method**

Add after the existing `completeVision` function (after line 98), before the `return` statement on line 100:

```typescript
  async function* streamCompleteVision(
    messages: VisionMessage[],
    maxTokens: number = 16384,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: true }),
      signal,
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
```

- [ ] **Step 2: Update the return statement**

Change line 100 from:
```typescript
  return { complete, streamComplete, completeVision };
```
to:
```typescript
  return { complete, streamComplete, completeVision, streamCompleteVision };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai-client.ts
git commit -m "feat: add streamCompleteVision method to AI client"
```

---

### Task 3: Add Prompt Presets and PROMPT_PRESETS Export

**Files:**
- Modify: `src/lib/prompts.ts`

**Note:** Line numbers below refer to the original file. Apply insertions bottom-to-top to avoid offset issues, or account for line shifts from earlier insertions.

- [ ] **Step 1: Add Chinese Vision prompt**

Add after the existing `PDF_PARSE_PROMPT` (after line 56):

```typescript
export const PDF_PARSE_PROMPT_ZH = `你是一个精确的学术文档转换器。将提供的PDF页面图片转换为结构良好的Markdown。

规则：
1. 使用 # ## ### 等保留文档的标题层级
2. 数学公式使用LaTeX：行内公式用 $...$，独立公式用 $$...$$
3. 表格渲染为Markdown表格，注意对齐
4. 图表描述为 ![图N: 描述](figure)，配以简洁的替代文本
5. 保持原始的阅读顺序
6. 不要添加任何评论、总结或解读——只转换你看到的内容
7. 仅输出Markdown内容，不要代码围栏或包装

使用与文档内容相同的语言回复。`;
```

- [ ] **Step 2: Add Chinese Batch prompt**

Add after the existing `PDF_PARSE_BATCH_PROMPT` (after line 70):

```typescript
export const PDF_PARSE_BATCH_PROMPT_ZH = `你正在继续将多部分学术PDF转换为Markdown。
这是{totalPages}页文档的第{startPage}-{endPage}页。
从上一节结束的地方继续。不要重复之前页面的内容。

规则：
1. 使用 # ## ### 等保留文档的标题层级
2. 数学公式使用LaTeX：行内用 $...$，独立用 $$...$$
3. 表格渲染为Markdown表格，注意对齐
4. 图表描述为 ![图N: 描述](figure)
5. 保持原始的阅读顺序
6. 仅输出Markdown内容，不要代码围栏或包装

使用与文档内容相同的语言回复。`;
```

- [ ] **Step 3: Add Chinese Chat prompt**

Add after the existing `CHAT_PROMPT` (after line 43):

```typescript
export const CHAT_PROMPT_ZH = `你是一个学术论文助手。根据提供的论文内容回答用户的问题。

使用与用户问题相同的语言回复。

论文内容：
{content}

之前的对话：
{history}

用户问题：{question}

根据论文内容提供清晰、准确的回答。`;
```

- [ ] **Step 4: Add PROMPT_PRESETS export**

Add at the end of the file:

```typescript
export const PROMPT_PRESETS = {
  vision: {
    en: { label: 'English', content: PDF_PARSE_PROMPT },
    zh: { label: '中文', content: PDF_PARSE_PROMPT_ZH },
  },
  chat: {
    en: { label: 'English', content: CHAT_PROMPT },
    zh: { label: '中文', content: CHAT_PROMPT_ZH },
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat: add Chinese prompt presets and PROMPT_PRESETS export"
```

---

### Task 4: Add Prompt Storage Methods

**Files:**
- Modify: `src/lib/storage.ts:221-234`

- [ ] **Step 1: Add getPromptSettings and savePromptSettings**

Add before the closing `};` of the `storage` object (before line 234):

```typescript
  async getPromptSettings(): Promise<PromptSettings | null> {
    const settings = await this.getSettings();
    if (!settings || !settings.prompts) return null;
    return settings.prompts as PromptSettings;
  },
  async savePromptSettings(prompts: PromptSettings): Promise<void> {
    const existing = (await this.getSettings()) || {};
    existing.prompts = prompts;
    await this.saveSettings(existing);
  },
```

- [ ] **Step 2: Add import for PromptSettings type**

Update the import at line 4:

```typescript
import type { PaperMetadata, PaperAnalysis, ChatHistory, ChatSession, ChatSessionMeta, PaperListItem, Note, Folder, PromptSettings } from '@/types';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add prompt settings storage methods"
```

---

## Chunk 2: Vision Model Streaming (Backend + Frontend)

### Task 5: Convert pdf-parser to Streaming

**Files:**
- Modify: `src/lib/pdf-parser.ts`

- [ ] **Step 1: Update ParseOptions interface and imports**

Change the `ParseOptions` interface (lines 13-15) to:

```typescript
interface ParseOptions {
  onProgress?: (message: string) => void;
  onVisionChunk?: (chunk: string) => void;
  onVisionProgress?: (info: { batch: number; totalBatches: number; pages: string; elapsed: number }) => void;
}
```

- [ ] **Step 2: Replace `callVisionWithRetry` with streaming version**

Replace the entire `callVisionWithRetry` function (lines 157-192) with:

```typescript
/**
 * Call Vision API with streaming and a single retry on timeout/abort.
 */
async function callVisionWithRetryStreaming(
  client: ReturnType<typeof createAIClient>,
  pageImages: string[],
  prompt: string,
  onChunk?: (chunk: string) => void,
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
      let result = '';
      let charsSinceLog = 0;
      for await (const chunk of client.streamCompleteVision(
        [{ role: 'user', content }],
        MAX_TOKENS,
        controller.signal,
      )) {
        result += chunk;
        charsSinceLog += chunk.length;
        if (onChunk) onChunk(chunk);
        // Log every ~500 chars
        if (charsSinceLog >= 500) {
          const preview = result.slice(-80).replace(/\n/g, '\\n');
          console.log(`[pdf-parser] Vision streaming: "...${preview}"`);
          charsSinceLog = 0;
        }
      }
      return result;
    } catch (err) {
      if (attempt === 0 && (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof TypeError && err.message.includes('fetch'))
      )) {
        console.warn('[pdf-parser] Vision API failed, retrying...', err instanceof Error ? err.message : err);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Vision API timed out after retry');
}
```

- [ ] **Step 3: Update `parsePdfWithVision` to use streaming**

Update the destructuring of options (line 49):

```typescript
  const { onProgress = () => {}, onVisionChunk, onVisionProgress } = options;
```

Update the single batch call (lines 88-90):

```typescript
    if (validImages.length <= BATCH_SIZE) {
      // Single batch
      const pages = `1-${validImages.length}`;
      onProgress(`Parsing with Vision AI (${validImages.length} pages)...`);
      if (onVisionProgress) onVisionProgress({ batch: 1, totalBatches: 1, pages, elapsed: 0 });
      console.log(`[pdf-parser] Vision stream started (batch 1/1, pages ${pages})`);
      const startTime = Date.now();
      result = await callVisionWithRetryStreaming(client, validImages, PDF_PARSE_PROMPT, onVisionChunk);
      const elapsed = (Date.now() - startTime) / 1000;
      const tokens = Math.ceil(result.length / 4);
      console.log(`[pdf-parser] Vision stream completed (batch 1/1, ${tokens} tokens, ${elapsed.toFixed(1)}s)`);
      if (onVisionProgress) onVisionProgress({ batch: 1, totalBatches: 1, pages, elapsed });
```

Update the multi-batch loop body (lines 101-113). Replace the inner loop body:

```typescript
        batchNum++;
        const pages = `${start + 1}-${end}`;
        onProgress(`Parsing with Vision AI (batch ${batchNum}/${totalBatches}, pages ${pages})...`);
        if (onVisionProgress) onVisionProgress({ batch: batchNum, totalBatches, pages, elapsed: 0 });
        console.log(`[pdf-parser] Vision stream started (batch ${batchNum}/${totalBatches}, pages ${pages})`);
        const startTime = Date.now();

        const prompt = start === 0
          ? PDF_PARSE_PROMPT
          : PDF_PARSE_BATCH_PROMPT
              .replace('{startPage}', String(start + 1))
              .replace('{endPage}', String(end))
              .replace('{totalPages}', String(validImages.length));

        const batchResult = await callVisionWithRetryStreaming(client, batchImages, prompt, onVisionChunk);
        const elapsed = (Date.now() - startTime) / 1000;
        const tokens = Math.ceil(batchResult.length / 4);
        console.log(`[pdf-parser] Vision stream completed (batch ${batchNum}/${totalBatches}, ${tokens} tokens, ${elapsed.toFixed(1)}s)`);
        if (onVisionProgress) onVisionProgress({ batch: batchNum, totalBatches, pages, elapsed });
        results.push(batchResult);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-parser.ts
git commit -m "feat: convert pdf-parser to streaming with progress callbacks and console logs"
```

---

### Task 6: Forward Vision Stream Events in Analyze Route

**Files:**
- Modify: `src/app/api/analyze/route.ts:32-34`

- [ ] **Step 1: Update parsePdfWithVision call to forward stream events**

Replace lines 32-34:

```typescript
            markdown = await parsePdfWithVision(pdfPath, { baseUrl, apiKey, visionModel }, {
              onProgress: (message) => send({ step: 'parsing', message }),
            });
```

with:

```typescript
            markdown = await parsePdfWithVision(pdfPath, { baseUrl, apiKey, visionModel }, {
              onProgress: (message) => send({ step: 'parsing', message }),
              onVisionChunk: (content) => send({ type: 'vision_stream', content }),
              onVisionProgress: (info) => send({ type: 'vision_progress', ...info }),
            });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: forward vision stream and progress events via SSE"
```

---

### Task 7: Add Vision Streaming UI to Analysis Panel

**Files:**
- Modify: `src/components/analysis-panel.tsx`
- Modify: `src/app/paper/[id]/page.tsx`

- [ ] **Step 1: Update AnalysisPanelProps interface**

Change the `AnalysisPanelProps` interface (lines 11-17) to:

```typescript
interface AnalysisPanelProps {
  analysis: PaperAnalysis | null;
  isAnalyzing?: boolean;
  analysisStep?: string | null;
  analysisMessage?: string | null;
  visionStreamContent?: string;
  visionProgress?: { batch: number; totalBatches: number; pages: string; elapsed: number } | null;
  onReAnalyze?: () => void;
}
```

- [ ] **Step 2: Add VisionStreamBox component**

Add after the `AnalysisProgress` function (after line 102), before the `AnalysisPanel` export:

```typescript
function VisionStreamBox({
  content,
  progress,
}: {
  content: string;
  progress: { batch: number; totalBatches: number; pages: string; elapsed: number } | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  const tokens = Math.ceil(content.length / 4);

  return (
    <div className="mx-4 mb-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
      {progress && (
        <div className="px-3 py-1.5 flex items-center gap-2 text-xs" style={{ background: 'var(--glass)', borderBottom: '1px solid var(--glass-border)' }}>
          <div
            className="animate-spin w-3 h-3 border-2 border-t-transparent rounded-full"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <span style={{ color: 'var(--accent)' }}>
            Batch {progress.batch}/{progress.totalBatches}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            Pages {progress.pages}
          </span>
          {progress.elapsed > 0 && (
            <span style={{ color: 'var(--text-tertiary)' }}>
              {progress.elapsed.toFixed(1)}s
            </span>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        className="overflow-y-auto font-mono text-xs leading-relaxed"
        style={{
          height: '200px',
          padding: '8px 12px',
          background: 'var(--bg)',
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content || 'Waiting for Vision Model output...'}
        <span className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse" style={{ background: 'var(--accent)' }} />
      </div>
      <div className="px-3 py-1 flex justify-between text-xs" style={{ background: 'var(--glass)', borderTop: '1px solid var(--glass-border)', color: 'var(--text-tertiary)' }}>
        <span>~{tokens.toLocaleString()} tokens</span>
        {progress && progress.elapsed > 0 && <span>{progress.elapsed.toFixed(1)}s</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add useRef and useEffect imports at top of file**

Update line 3 from `import { useState } from 'react';` to:

```typescript
import { useState, useRef, useEffect } from 'react';
```

- [ ] **Step 4: Update AnalysisPanel to show VisionStreamBox**

Update the destructuring in the `AnalysisPanel` function (lines 104-110):

```typescript
export function AnalysisPanel({
  analysis,
  isAnalyzing,
  analysisStep,
  analysisMessage,
  visionStreamContent,
  visionProgress,
  onReAnalyze,
}: AnalysisPanelProps) {
```

Update the `isAnalyzing` rendering block (lines 114-121). Replace:

```typescript
  if (isAnalyzing) {
    return (
      <div className="flex flex-col h-full">
        <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
        <AnalysisProgress step={analysisStep || null} message={analysisMessage || null} />
      </div>
    );
  }
```

with:

```typescript
  if (isAnalyzing) {
    return (
      <div className="flex flex-col h-full">
        <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
        <AnalysisProgress step={analysisStep || null} message={analysisMessage || null} />
        {analysisStep === 'parsing' && visionStreamContent !== undefined && visionStreamContent.length > 0 && (
          <VisionStreamBox content={visionStreamContent} progress={visionProgress || null} />
        )}
      </div>
    );
  }
```

- [ ] **Step 5: Update paper detail page to pass vision stream state**

In `src/app/paper/[id]/page.tsx`, add state variables after line 25 (where `analysisMessage` state is declared):

```typescript
const [visionStreamContent, setVisionStreamContent] = useState('');
const [visionProgress, setVisionProgress] = useState<{ batch: number; totalBatches: number; pages: string; elapsed: number } | null>(null);
```

In the SSE `onMessage` handler (lines 100-131), add handling for the new event types inside the callback, after the existing `if ('step' in event)` block (after line 105):

```typescript
        if ('type' in event && event.type === 'vision_stream') {
          setVisionStreamContent(prev => prev + (event.content as string));
        }
        if ('type' in event && event.type === 'vision_progress') {
          setVisionProgress({
            batch: event.batch as number,
            totalBatches: event.totalBatches as number,
            pages: event.pages as string,
            elapsed: event.elapsed as number,
          });
        }
```

Reset the vision state in `handleAnalyze` (lines 133-139). Add after line 137 (`setAnalysisMessage(null);`):

```typescript
    setVisionStreamContent('');
    setVisionProgress(null);
```

Update the `AnalysisPanel` JSX (lines 469-475) to pass the new props:

```typescript
                <AnalysisPanel
                  analysis={displayAnalysis}
                  isAnalyzing={isAnalyzing}
                  analysisStep={analysisStep}
                  analysisMessage={analysisMessage}
                  visionStreamContent={visionStreamContent}
                  visionProgress={visionProgress}
                  onReAnalyze={handleAnalyze}
                />
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/components/analysis-panel.tsx src/app/paper/[id]/page.tsx
git commit -m "feat: add vision streaming box UI to analysis panel"
```

---

## Chunk 3: Custom Prompts System

### Task 8: Create Prompts API Endpoint

**Files:**
- Create: `src/app/api/prompts/route.ts`

- [ ] **Step 1: Create the prompts API route**

```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { PROMPT_PRESETS } from '@/lib/prompts';
import type { PromptSettings, PromptPresetKey } from '@/types';

export async function GET() {
  try {
    const current = await storage.getPromptSettings();
    return NextResponse.json({
      current,
      presets: PROMPT_PRESETS,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load prompt settings' }, { status: 500 });
  }
}

const MAX_PROMPT_LENGTH = 10000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const existing = await storage.getPromptSettings();

    const merged: PromptSettings = existing || {
      vision: { preset: 'en', custom: PROMPT_PRESETS.vision.en.content },
      chat: { preset: 'en', custom: PROMPT_PRESETS.chat.en.content },
    };

    if (body.vision) {
      if (body.vision.custom && body.vision.custom.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json({ error: 'Vision prompt exceeds maximum length' }, { status: 400 });
      }
      merged.vision = {
        preset: (body.vision.preset as PromptPresetKey) || merged.vision.preset,
        custom: body.vision.custom ?? merged.vision.custom,
      };
    }

    if (body.chat) {
      if (body.chat.custom && body.chat.custom.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json({ error: 'Chat prompt exceeds maximum length' }, { status: 400 });
      }
      merged.chat = {
        preset: (body.chat.preset as PromptPresetKey) || merged.chat.preset,
        custom: body.chat.custom ?? merged.chat.custom,
      };
    }

    await storage.savePromptSettings(merged);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save prompt settings' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/prompts/route.ts
git commit -m "feat: add GET/POST /api/prompts endpoint"
```

---

### Task 9: Integrate Custom Prompts into AI Calls

**Files:**
- Modify: `src/lib/pdf-parser.ts` (import custom prompt)
- Modify: `src/app/api/analyze/route.ts` (pass custom prompt to parser)
- Modify: `src/app/api/chat/route.ts` (use custom chat prompt)

- [ ] **Step 1: Update pdf-parser to accept custom prompts**

Update the `ParseOptions` interface in `pdf-parser.ts`:

```typescript
interface ParseOptions {
  onProgress?: (message: string) => void;
  onVisionChunk?: (chunk: string) => void;
  onVisionProgress?: (info: { batch: number; totalBatches: number; pages: string; elapsed: number }) => void;
  customVisionPrompt?: string;
}
```

Update the destructuring:

```typescript
  const { onProgress = () => {}, onVisionChunk, onVisionProgress, customVisionPrompt } = options;
```

Update all references to `PDF_PARSE_PROMPT` in `parsePdfWithVision`:
- In single batch: replace `PDF_PARSE_PROMPT` with `customVisionPrompt || PDF_PARSE_PROMPT`
- In multi-batch first batch: same replacement
- Keep `PDF_PARSE_BATCH_PROMPT` for continuation batches (per spec: batch prompt is auto-derived)

- [ ] **Step 2: Update analyze route to load and pass custom prompt**

In `src/app/api/analyze/route.ts`, `storage` is already imported on line 1. Inside the stream `start` callback, before the parse call (before line 32), add:

```typescript
            const promptSettings = await storage.getPromptSettings();
            const customVisionPrompt = promptSettings?.vision?.custom;
```

Update the `parsePdfWithVision` call to include `customVisionPrompt`:

```typescript
            markdown = await parsePdfWithVision(pdfPath, { baseUrl, apiKey, visionModel }, {
              onProgress: (message) => send({ step: 'parsing', message }),
              onVisionChunk: (content) => send({ type: 'vision_stream', content }),
              onVisionProgress: (info) => send({ type: 'vision_progress', ...info }),
              customVisionPrompt,
            });
```

- [ ] **Step 3: Update chat route to use custom prompt**

In `src/app/api/chat/route.ts`, update import:

```typescript
import { CHAT_PROMPT } from '@/lib/prompts';
```

Before the prompt construction (before line 31), add:

```typescript
    const promptSettings = await storage.getPromptSettings();
    const chatPromptTemplate = promptSettings?.chat?.custom || CHAT_PROMPT;
    const prompt = chatPromptTemplate.replaceAll('{content}', parsedContent || '').replaceAll('{history}', historyStr).replaceAll('{question}', message);
```

And remove the old line 31 that used `CHAT_PROMPT` directly.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-parser.ts src/app/api/analyze/route.ts src/app/api/chat/route.ts
git commit -m "feat: integrate custom prompts into vision parsing and chat"
```

---

### Task 10: Create Prompt Configuration Page

**Files:**
- Create: `src/app/prompts/page.tsx`

- [ ] **Step 1: Create the prompts page**

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface PresetOption {
  label: string;
  content: string;
}

interface PromptConfig {
  preset: string;
  custom: string;
}

interface PromptsData {
  current: { vision: PromptConfig; chat: PromptConfig } | null;
  presets: {
    vision: Record<string, PresetOption>;
    chat: Record<string, PresetOption>;
  };
}

function PromptEditor({
  title,
  type,
  config,
  presets,
  onChange,
}: {
  title: string;
  type: 'vision' | 'chat';
  config: PromptConfig;
  presets: Record<string, PresetOption>;
  onChange: (config: PromptConfig) => void;
}) {
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const currentPresetContent = presets[config.preset]?.content || '';
  const isModified = config.custom !== currentPresetContent;

  const handlePresetSwitch = (key: string) => {
    if (key === config.preset) return;
    if (isModified) {
      setShowConfirm(key);
    } else {
      onChange({ preset: key, custom: presets[key].content });
    }
  };

  const confirmSwitch = () => {
    if (showConfirm) {
      onChange({ preset: showConfirm, custom: presets[showConfirm].content });
      setShowConfirm(null);
    }
  };

  const restorePreset = () => {
    if (!showRestoreConfirm) {
      setShowRestoreConfirm(true);
      return;
    }
    onChange({ preset: config.preset, custom: currentPresetContent });
    setShowRestoreConfirm(false);
  };

  const requiredPlaceholders = type === 'chat' ? ['{content}', '{history}', '{question}'] : [];

  const missingPlaceholders = requiredPlaceholders.filter(p => !config.custom.includes(p));

  return (
    <div className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {type === 'chat' && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Required placeholders: {'{content}'}, {'{history}'}, {'{question}'}
          </p>
        )}
      </div>

      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        {Object.entries(presets).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => handlePresetSwitch(key)}
            className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors"
            style={
              config.preset === key
                ? { background: 'var(--accent)', color: 'var(--bg)' }
                : { background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }
            }
          >
            {preset.label}
          </button>
        ))}
        {isModified && (
          <span className="ml-2 text-xs" style={{ color: 'var(--accent)' }}>
            (modified)
          </span>
        )}
      </div>

      {showConfirm && (
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Switching preset will replace your customizations. Continue?
          </span>
          <div className="flex gap-2">
            <button onClick={() => setShowConfirm(null)} className="px-3 py-1 text-xs cursor-pointer" style={{ color: 'var(--text-tertiary)' }}>Cancel</button>
            <button onClick={confirmSwitch} className="px-3 py-1 text-xs font-medium rounded-md cursor-pointer" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Continue</button>
          </div>
        </div>
      )}

      <div className="p-5">
        <textarea
          value={config.custom}
          onChange={(e) => onChange({ ...config, custom: e.target.value })}
          className="w-full font-mono text-xs leading-relaxed rounded-lg resize-y"
          style={{
            minHeight: '240px',
            padding: '12px',
            background: 'var(--bg)',
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
            outline: 'none',
          }}
        />
        {missingPlaceholders.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: 'var(--warning, #eab308)' }}>
            Missing placeholders: {missingPlaceholders.join(', ')}
          </p>
        )}
      </div>

      <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={restorePreset}
          disabled={!isModified}
          className="px-4 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}
        >
          Restore Preset
        </button>
      </div>
    </div>
  );
}

export default function PromptsPage() {
  const [data, setData] = useState<PromptsData | null>(null);
  const [vision, setVision] = useState<PromptConfig | null>(null);
  const [chat, setChat] = useState<PromptConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savedVision, setSavedVision] = useState<PromptConfig | null>(null);
  const [savedChat, setSavedChat] = useState<PromptConfig | null>(null);

  const hasUnsavedChanges = (vision && savedVision && (vision.custom !== savedVision.custom || vision.preset !== savedVision.preset))
    || (chat && savedChat && (chat.custom !== savedChat.custom || chat.preset !== savedChat.preset));

  useEffect(() => {
    fetch('/api/prompts')
      .then(r => r.json())
      .then((d: PromptsData) => {
        setData(d);
        const v = d.current?.vision || { preset: 'en', custom: d.presets.vision.en.content };
        const c = d.current?.chat || { preset: 'en', custom: d.presets.chat.en.content };
        setVision(v);
        setChat(c);
        setSavedVision(v);
        setSavedChat(c);
      });
      });
  }, []);

  const handleSave = useCallback(async () => {
    if (!vision || !chat) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vision, chat }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      setMessage({ type: 'success', text: 'Prompts saved successfully' });
      setSavedVision({ ...vision });
      setSavedChat({ ...chat });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }, [vision, chat]);

  if (!data || !vision || !chat) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <a href="/" className="text-sm" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>EasyPaper</a>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Prompts</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Customize the AI prompts used for PDF parsing and chat.
          </p>
        </div>

        <div className="space-y-6">
          <PromptEditor
            title="Vision Model Prompt"
            type="vision"
            config={vision}
            presets={data.presets.vision}
            onChange={setVision}
          />
          <PromptEditor
            title="Chat Prompt"
            type="chat"
            config={chat}
            presets={data.presets.chat}
            onChange={setChat}
          />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {message && (
              <span className="text-xs" style={{ color: message.type === 'success' ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)' }}>
                {message.text}
              </span>
            )}
            {hasUnsavedChanges && !message && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                Unsaved changes
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors disabled:opacity-50"
            style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
          >
            {saving ? 'Saving...' : 'Save Prompts'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/prompts/page.tsx
git commit -m "feat: add prompt configuration page at /prompts"
```

---

### Task 11: Add Prompts Link to Navigation

**Files:**
- Modify: `src/components/navbar.tsx:53-71`

- [ ] **Step 1: Add Prompts button**

After the Settings button (after line 71 `</button>`), add:

```typescript
          <a
            href="/prompts"
            className="rounded-lg transition-colors flex items-center gap-1.5"
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Prompts
          </a>
```

- [ ] **Step 2: Verify page renders**

Run: `npm run dev` and check that:
1. "Prompts" link appears in the navbar
2. Clicking it navigates to `/prompts`
3. The prompts page loads and shows two editors

- [ ] **Step 3: Commit**

```bash
git add src/components/navbar.tsx
git commit -m "feat: add Prompts link to navigation bar"
```

---

## Chunk 4: Final Verification

### Task 12: End-to-End Verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors related to our changes.

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Manual smoke test checklist**

1. Start dev server: `npm run dev`
2. Open `/prompts` — verify both editors load with English preset
3. Switch Vision preset to 中文 — verify Chinese prompt loads
4. Edit prompt text, verify "modified" indicator appears
5. Click "Restore Preset" — verify prompt reverts
6. Save prompts — verify success message
7. Upload a PDF and click Analyze — verify:
   - Step 1 shows streaming box with live Vision Model output
   - Console shows `[pdf-parser] Vision stream started/streaming/completed` logs
   - Streaming box has fixed height (~200px) with scrolling
   - Progress bar shows batch info
8. Open chat — verify chat uses custom prompt (if modified)

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```
