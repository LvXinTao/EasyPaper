# 全局并发解析限制实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 限制同时解析的论文数量为 3 篇（可配置），超限请求进入排队状态，完成后自动触发下一个。

**Architecture:** 内存队列管理模块 + 分析核心逻辑抽取 + API 改动集成。基于单进程假设，内存状态只在单个 Next.js 进程内共享。

**Tech Stack:** Next.js App Router, TypeScript, SSE (Server-Sent Events), File-based storage

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/analysis-queue.ts` | 内存队列管理：init, tryAcquire, release, cancelQueued |
| `src/lib/analysis-runner.ts` | 分析核心逻辑：从 route 抽取，支持可选 onProgress 回调 |
| `src/app/api/analyze/route.ts` | 集成队列检查：幂等性、排队状态返回、SSE stream |
| `src/app/api/analyze/queue/route.ts` | 队列 API：GET 查询状态、DELETE 取消排队 |
| `src/types/index.ts` | 类型定义：添加 'queued' status，更新 AnalysisProgress |
| `src/components/paper-row.tsx` | 前端：显示 'queued' 状态标签 |
| `src/hooks/use-analysis-polling.ts` | 前端：轮询时处理 'queued' 状态 |
| `src/components/settings-form.tsx` | 前端：添加 maxConcurrent 配置项 |

---

## Chunk 1: Types and Storage

### Task 1: Update Type Definitions

**Files:**
- Modify: `src/types/index.ts:1-42`

- [ ] **Step 1: Update PaperStatus type**

Edit line 1 to add 'queued':

```typescript
export type PaperStatus = 'pending' | 'queued' | 'parsing' | 'analyzing' | 'analyzed' | 'error';
```

- [ ] **Step 2: Update AnalysisProgress interface**

Edit lines 30-36 to add 'queued' step and queuePosition:

```typescript
  analysisProgress?: {
    step: 'queued' | 'parsing' | 'analyzing' | 'saving';
    message: string;
    updatedAt: string;
    queuePosition?: number;
    batchesDone?: number;
    totalBatches?: number;
  };
```

- [ ] **Step 3: Update AnalyzeEvent type**

Edit lines 106-114 to add queued event:

```typescript
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
```

- [ ] **Step 4: Run lint to verify**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add 'queued' status and queuePosition for analysis concurrency"
```

---

## Chunk 2: Analysis Queue Module

### Task 2: Create Analysis Queue Module

**Files:**
- Create: `src/lib/analysis-queue.ts`

- [ ] **Step 1: Write the module skeleton**

```typescript
import { storage } from '@/lib/storage';
import { getAIConfig } from '@/lib/ai-config';
import { runAnalysisCore } from '@/lib/analysis-runner';

type AIConfig = Awaited<ReturnType<typeof getAIConfig>>;

interface QueueState {
  activeCount: number;
  activePaperIds: Set<string>;
  maxConcurrent: number;
  initPromise: Promise<void> | null;
  lock: Promise<void>;
}

const state: QueueState = {
  activeCount: 0,
  activePaperIds: new Set(),
  maxConcurrent: 3,
  initPromise: null,
  lock: Promise.resolve(),
};

export const analysisQueue = {
  async init(): Promise<void> {
    if (state.initPromise) return state.initPromise;
    state.initPromise = doInit();
    return state.initPromise;
  },

  async tryAcquire(paperId: string): Promise<boolean> {
    await state.lock;
    let resolveLock: () => void;
    state.lock = new Promise<void>((resolve) => { resolveLock = resolve; });
    try {
      if (state.activeCount < state.maxConcurrent) {
        state.activeCount++;
        state.activePaperIds.add(paperId);
        return true;
      }
      return false;
    } finally {
      resolveLock!();
    }
  },

  async release(paperId: string): Promise<void> {
    state.activePaperIds.delete(paperId);
    state.activeCount--;

    const queuedPapers = await getQueuedPapers();
    if (queuedPapers.length > 0) {
      const next = queuedPapers[0];
      const exists = await storage.paperExists(next.id);
      if (!exists) {
        return this.release(paperId);
      }
      await this.tryAcquire(next.id);
      runAnalysisCore(next.id, await getAIConfig()).catch(console.error);
    }
  },

  async getQueuedPapers(): Promise<{ id: string; queuedAt: string }[]> {
    const papers = await storage.listPapers();
    const queued: { id: string; queuedAt: string }[] = [];
    for (const paper of papers) {
      const meta = await storage.getMetadata(paper.id);
      if (meta?.status === 'queued' && meta.analysisProgress?.step === 'queued') {
        queued.push({ id: paper.id, queuedAt: meta.analysisProgress.updatedAt });
      }
    }
    return queued.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
  },

  getStatus(): { active: number; max: number; queued: number } {
    return {
      active: state.activeCount,
      max: state.maxConcurrent,
      queued: state.activePaperIds.size,
    };
  },

  async cancelQueued(paperId: string): Promise<boolean> {
    const meta = await storage.getMetadata(paperId);
    if (meta?.status !== 'queued') return false;
    await storage.updateMetadata(paperId, { status: 'pending', analysisProgress: undefined });
    return true;
  },
};

async function doInit(): Promise<void> {
  const settings = await storage.getSettings();
  state.maxConcurrent = (settings?.maxConcurrent as number) || 3;

  const papers = await storage.listPapers();
  const staleThresholdMs = ((settings?.staleThresholdMinutes as number) || 10) * 60 * 1000;

  for (const paper of papers) {
    const meta = await storage.getMetadata(paper.id);
    if (meta?.status === 'parsing' || meta?.status === 'analyzing') {
      const updatedAt = new Date(meta.analysisProgress?.updatedAt || 0).getTime();
      const ageMs = Date.now() - updatedAt;

      if (ageMs > staleThresholdMs) {
        await storage.updateMetadata(paper.id, { status: 'pending' });
      } else {
        state.activePaperIds.add(paper.id);
        state.activeCount++;
      }
    }
  }
}
```

- [ ] **Step 2: Run lint to verify**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/analysis-queue.ts
git commit -m "feat(queue): add analysis queue module for concurrency control"
```

---

### Task 3: Create Analysis Runner Module

**Files:**
- Create: `src/lib/analysis-runner.ts`
- Modify: `src/app/api/analyze/route.ts` (reference only)

- [ ] **Step 1: Extract runAnalysis logic from route.ts**

Create `src/lib/analysis-runner.ts` with the extracted logic:

```typescript
import { storage } from '@/lib/storage';
import { parsePdfWithVision } from '@/lib/pdf-parser';
import { createAIClient } from '@/lib/ai-client';
import { ANALYSIS_PROMPT } from '@/lib/prompts';
import { analysisQueue } from '@/lib/analysis-queue';
import type { PaperAnalysis } from '@/types';

type AIConfig = Awaited<ReturnType<typeof import('@/lib/ai-config').getAIConfig>>;
type SendFn = (data: Record<string, unknown>) => void;

export async function runAnalysisCore(
  paperId: string,
  config: AIConfig,
  onProgress?: SendFn
): Promise<void> {
  const send: SendFn = onProgress || (() => {});
  const { apiKey, baseUrl, model, visionModel } = config;

  try {
    const promptSettings = await storage.getPromptSettings();

    // Step 1: Parse PDF
    let markdown = await storage.getParsedContent(paperId);
    if (markdown) {
      console.log(`[analyze] Paper ${paperId}: Using cached parsed content`);
      send({ step: 'parsing', message: 'Using cached parsed content...' });
    } else {
      console.log(`[analyze] Paper ${paperId}: Starting PDF parsing...`);
      await storage.updateMetadata(paperId, {
        status: 'parsing',
        analysisProgress: { step: 'parsing', message: 'Starting PDF parsing...', updatedAt: new Date().toISOString() },
      });
      const pdfPath = storage.getPdfPath(paperId);
      const customVisionPrompt = promptSettings?.vision?.custom;
      markdown = await parsePdfWithVision(pdfPath, { baseUrl, apiKey, visionModel }, {
        onProgress: (message) => {
          send({ step: 'parsing', message });
          storage.updateMetadata(paperId, {
            analysisProgress: { step: 'parsing', message, updatedAt: new Date().toISOString() },
          }).catch(() => {});
        },
        onBatchDone: (batchIndex, totalBatches, content) => {
          send({ type: 'parse_batch_done', batchIndex, totalBatches, content });
          storage.updateMetadata(paperId, {
            analysisProgress: {
              step: 'parsing',
              message: `Parsed batch ${batchIndex + 1}/${totalBatches}`,
              updatedAt: new Date().toISOString(),
              batchesDone: batchIndex + 1,
              totalBatches,
            },
          }).catch(() => {});
        },
        onChunk: (batchIndex, chunk) => {
          send({ type: 'parse_chunk', batchIndex, chunk });
        },
        customVisionPrompt,
      });
      await storage.saveParsedContent(paperId, markdown);
    }

    // Step 2: AI Analysis
    const analysisPromptTemplate = promptSettings?.analysis?.custom || ANALYSIS_PROMPT;
    const prompt = analysisPromptTemplate.replaceAll('{content}', markdown);
    const promptLength = prompt.length;
    const estimatedTokens = Math.ceil(promptLength / 4);
    console.log(`[analyze] Paper ${paperId}: Sending to AI for analysis`);
    const analyzingMessage = `Analyzing with AI (${model}, ~${estimatedTokens} tokens)...`;
    send({ step: 'analyzing', message: analyzingMessage });
    await storage.updateMetadata(paperId, {
      status: 'analyzing',
      analysisProgress: { step: 'analyzing', message: analyzingMessage, updatedAt: new Date().toISOString() },
    });

    const client = createAIClient({ baseUrl, apiKey, model });
    const heartbeat = setInterval(async () => {
      try {
        const current = await storage.getMetadata(paperId);
        if (current?.analysisProgress) {
          await storage.updateMetadata(paperId, {
            analysisProgress: { ...current.analysisProgress, updatedAt: new Date().toISOString() },
          });
        }
      } catch {}
    }, 60_000);

    let result: string;
    try {
      result = await client.complete([{ role: 'user', content: prompt }]);
    } finally {
      clearInterval(heartbeat);
    }

    // Step 3: Save results
    send({ step: 'saving', message: 'Saving results...' });
    await storage.updateMetadata(paperId, {
      analysisProgress: { step: 'saving', message: 'Saving results...', updatedAt: new Date().toISOString() },
    });

    const analysis: PaperAnalysis = { ...JSON.parse(result), generatedAt: new Date().toISOString() };
    await storage.saveAnalysis(paperId, analysis);

    for (const section of ['summary', 'contributions', 'methodology', 'experiments', 'conclusions'] as const) {
      const sectionData = analysis[section];
      let content: string;
      if (typeof sectionData === 'string') {
        content = sectionData;
      } else if (sectionData && typeof sectionData === 'object') {
        content = 'content' in sectionData ? String(sectionData.content) : JSON.stringify(sectionData);
      } else {
        content = String(sectionData || '');
      }
      send({ section, content });
    }

    const finalMeta = await storage.getMetadata(paperId);
    if (finalMeta) {
      delete finalMeta.analysisProgress;
      finalMeta.status = 'analyzed';
      await storage.saveMetadata(paperId, finalMeta);
    }
    send({ done: true });
  } catch (error) {
    console.error(`[analyze] Paper ${paperId}: Error -`, error instanceof Error ? error.message : error);
    const errMeta = await storage.getMetadata(paperId);
    if (errMeta) {
      delete errMeta.analysisProgress;
      errMeta.status = 'error';
      await storage.saveMetadata(paperId, errMeta);
    }
    send({ error: error instanceof Error ? error.message : 'Analysis failed' });
  } finally {
    await analysisQueue.release(paperId);
  }
}
```

- [ ] **Step 2: Run lint to verify**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/analysis-runner.ts
git commit -m "feat(runner): extract analysis core logic from route for reuse"
```

---

## Chunk 3: API Routes

### Task 4: Modify Analyze Route

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Import queue and runner modules**

Add imports at top (line 1):

```typescript
import { analysisQueue } from '@/lib/analysis-queue';
import { runAnalysisCore } from '@/lib/analysis-runner';
```

- [ ] **Step 2: Remove local runAnalysis function**

Delete lines 12-144 (the local `runAnalysis` function). Keep the imports and POST function.

- [ ] **Step 3: Update POST handler to integrate queue**

Replace the entire POST function (lines 146-198) with:

```typescript
export async function POST(request: Request) {
  try {
    const { paperId, force } = await request.json();
    if (!paperId) return createErrorResponse('PAPER_NOT_FOUND', 'paperId is required');
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    const config = await getAIConfig();
    if (!config.apiKey) return createErrorResponse('API_KEY_MISSING', 'API key is not configured');

    // Initialize queue (once)
    await analysisQueue.init();

    // Check current status for idempotency
    const metadata = await storage.getMetadata(paperId);
    if (metadata?.status === 'queued') {
      const queuedPapers = await analysisQueue.getQueuedPapers();
      const position = queuedPapers.findIndex(p => p.id === paperId) + 1;
      return new Response(JSON.stringify({ status: 'already_queued', queuePosition: position }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (metadata && (metadata.status === 'parsing' || metadata.status === 'analyzing') && metadata.analysisProgress) {
      const updatedAt = new Date(metadata.analysisProgress.updatedAt).getTime();
      const ageMs = Date.now() - updatedAt;
      const tenMinMs = 10 * 60 * 1000;

      if (ageMs < tenMinMs && !force) {
        return new Response(JSON.stringify({ status: 'already_running' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Stale or force: reset to pending
      const resetMeta = await storage.getMetadata(paperId);
      if (resetMeta) {
        delete resetMeta.analysisProgress;
        resetMeta.status = 'pending';
        await storage.saveMetadata(paperId, resetMeta);
      }
    }

    // Try to acquire slot
    if (!(await analysisQueue.tryAcquire(paperId))) {
      const status = analysisQueue.getStatus();
      const queuePosition = status.queued + 1;
      await storage.updateMetadata(paperId, {
        status: 'queued',
        analysisProgress: {
          step: 'queued',
          message: `Waiting in queue (position: ${queuePosition})...`,
          updatedAt: new Date().toISOString(),
          queuePosition,
        },
      });
      return new Response(JSON.stringify({ status: 'queued', queuePosition }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send: SendFn = (data) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };
        await runAnalysisCore(paperId, config, send);
        try { controller.close(); } catch {}
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (error) {
    return createErrorResponse('ANALYSIS_FAILED', `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

- [ ] **Step 4: Remove unused imports**

Remove the unused imports that were only for runAnalysis:
- Remove `parsePdfWithVision` import (line 2)
- Remove `createAIClient` import (line 3)
- Remove `ANALYSIS_PROMPT` import (line 5)
- Remove `PaperAnalysis` type import (line 7)

- [ ] **Step 5: Run lint to verify**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(analyze): integrate queue for concurrency control"
```

---

### Task 5: Create Queue API Route

**Files:**
- Create: `src/app/api/analyze/queue/route.ts`

- [ ] **Step 1: Write GET handler for queue status**

```typescript
import { analysisQueue } from '@/lib/analysis-queue';
import { createErrorResponse } from '@/lib/errors';

export async function GET() {
  await analysisQueue.init();
  const status = analysisQueue.getStatus();
  const queuedPapers = await analysisQueue.getQueuedPapers();

  return new Response(JSON.stringify({
    ...status,
    queuedPapers: queuedPapers.map((p, i) => ({
      id: p.id,
      position: i + 1,
      queuedAt: p.queuedAt,
    })),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get('paperId');

  if (!paperId) {
    return createErrorResponse('PAPER_ID_REQUIRED', 'paperId is required');
  }

  const cancelled = await analysisQueue.cancelQueued(paperId);
  if (!cancelled) {
    return createErrorResponse('NOT_QUEUED', 'Paper is not in queue');
  }

  return new Response(JSON.stringify({ status: 'cancelled' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Run lint to verify**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/queue/route.ts
git commit -m "feat(api): add queue status and cancel endpoints"
```

---

## Chunk 4: Frontend Updates

### Task 6: Update PaperRow Component

**Files:**
- Modify: `src/components/paper-row.tsx:14-20`

- [ ] **Step 1: Add 'queued' to statusConfig**

Edit lines 14-20 to add queued status:

```typescript
const statusConfig: Record<string, { label: string; className: string }> = {
  analyzed: { label: '✓ Analyzed', className: 'analyzed' },
  pending: { label: 'Pending', className: 'pending' },
  queued: { label: 'Queued...', className: 'queued' },
  parsing: { label: 'Parsing...', className: 'parsing' },
  analyzing: { label: 'Analyzing...', className: 'analyzing' },
  error: { label: 'Error', className: 'error' },
};
```

- [ ] **Step 2: Update status badge styling**

Edit lines 66-73 to include queued styling:

```typescript
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                background: status.className === 'analyzed' ? 'var(--green-subtle)' :
                            status.className === 'error' ? 'var(--rose-subtle)' :
                            status.className === 'parsing' || status.className === 'analyzing' ? 'var(--blue-subtle)' :
                            status.className === 'queued' ? 'var(--gray-subtle)' :
                            'var(--amber-subtle)',
                color: status.className === 'analyzed' ? 'var(--green)' :
                       status.className === 'error' ? 'var(--rose)' :
                       status.className === 'parsing' || status.className === 'analyzing' ? 'var(--blue)' :
                       status.className === 'queued' ? 'var(--gray)' :
                       'var(--amber)',
              }}
```

- [ ] **Step 3: Run lint to verify**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/paper-row.tsx
git commit -m "feat(ui): add 'queued' status display in paper row"
```

---

### Task 7: Update Analysis Polling Hook

**Files:**
- Modify: `src/hooks/use-analysis-polling.ts:52-63, 116-127`

- [ ] **Step 1: Add 'queued' to auto-start polling condition**

Edit lines 116-127 to include queued status:

```typescript
  useEffect(() => {
    if ((initialStatus === 'queued' || initialStatus === 'parsing' || initialStatus === 'analyzing') && !activeRef.current) {
      // Start polling inline to avoid setState-in-effect warning
      activeRef.current = true;
      setState(prev => ({
        ...prev,
        isPolling: true,
        isStale: false,
        completedStatus: null,
      }));
      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }
  }, [initialStatus, poll]);
```

- [ ] **Step 2: Update completion check to handle queued->parsing transition**

Edit lines 52-63, no change needed - the existing logic already handles the transition correctly (when status changes from queued to parsing, polling continues).

- [ ] **Step 3: Run lint to verify**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-analysis-polling.ts
git commit -m "feat(hook): auto-start polling for queued status"
```

---

### Task 8: Add maxConcurrent to Settings Form

**Files:**
- Modify: `src/components/settings-form.tsx:6-27, 91-96`

- [ ] **Step 1: Add maxConcurrent to SettingsData interface**

Edit lines 6-15 to add maxConcurrent:

```typescript
interface SettingsData {
  baseUrl: string;
  model: string;
  visionModel: string;
  hasApiKey: boolean;
  embeddingModel: string;
  useSameApiForEmbedding: boolean;
  embeddingBaseUrl: string;
  hasEmbeddingApiKey: boolean;
  maxConcurrent: number;
}
```

- [ ] **Step 2: Add maxConcurrent to initial state**

Edit lines 17-27 to add maxConcurrent:

```typescript
  const [settings, setSettings] = useState<SettingsData>({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    visionModel: 'gpt-4o',
    hasApiKey: false,
    embeddingModel: 'text-embedding-3-small',
    useSameApiForEmbedding: true,
    embeddingBaseUrl: 'https://api.openai.com/v1',
    hasEmbeddingApiKey: false,
    maxConcurrent: 3,
  });
```

- [ ] **Step 3: Add maxConcurrent to handleSave body**

Edit lines 51-66 to include maxConcurrent:

```typescript
      const body: Record<string, string | boolean | number> = {
        baseUrl: settings.baseUrl,
        model: settings.model,
        visionModel: settings.visionModel,
        embeddingModel: settings.embeddingModel,
        useSameApiForEmbedding: settings.useSameApiForEmbedding,
        maxConcurrent: settings.maxConcurrent,
      };
```

- [ ] **Step 4: Add maxConcurrent input field in UI**

Add after line 155 (after Vision Model input):

```typescript
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          Max Concurrent Analyses
        </label>
        <input
          type="number"
          min="1"
          max="10"
          value={settings.maxConcurrent}
          onChange={(e) => setSettings({ ...settings, maxConcurrent: parseInt(e.target.value) || 3 })}
          className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
          style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
          placeholder="3"
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Maximum number of papers analyzed simultaneously (default: 3)
        </p>
      </div>
```

- [ ] **Step 5: Run lint to verify**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/settings-form.tsx
git commit -m "feat(settings): add maxConcurrent configuration option"
```

---

## Chunk 5: Testing and Verification

### Task 9: Manual Testing

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on localhost:3000

- [ ] **Step 2: Test queue behavior**

1. Upload 4+ papers
2. Click "Analyze" on first paper → should start immediately
3. Click "Analyze" on second paper → should start immediately (if maxConcurrent=3)
4. Click "Analyze" on fourth paper → should return `{ status: 'queued', queuePosition: 1 }`
5. Wait for one analysis to complete → queued paper should auto-start

- [ ] **Step 3: Test queue status API**

Run: `curl http://localhost:3000/api/analyze/queue`
Expected: JSON with active, max, queued counts

- [ ] **Step 4: Test cancel queued**

Run: `curl -X DELETE "http://localhost:3000/api/analyze/queue?paperId=<queued_paper_id>"`
Expected: `{ status: 'cancelled' }`

- [ ] **Step 5: Test settings UI**

Navigate to `/settings`, verify maxConcurrent input exists and saves correctly.

---

### Task 10: Final Commit

- [ ] **Step 1: Run build to verify**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Create summary commit if needed**

If there are uncommitted changes:

```bash
git add -A
git commit -m "feat: complete global analysis concurrency limit implementation"
```

---

## Summary

This plan implements:
- Memory-based queue with Promise lock for atomic operations
- Automatic queue triggering on task completion
- SSE reconnection via polling for queued papers
- Settings UI for maxConcurrent configuration
- Queue status and cancel API endpoints