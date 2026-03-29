# PDF Parsing Optimization & Viewer Replacement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speed up PDF parsing by parallelizing Vision API batches + lowering DPI, and replace the hand-written PDF viewer with react-pdf for reliable text selection.

**Architecture:** Phase 1 refactors `pdf-parser.ts` to send batches concurrently (max 3) instead of serially, lowers DPI from 150→120, replaces `onVisionChunk`/`onVisionProgress` with `onBatchDone`, and uses page-marker-based deduplication. Phase 2 replaces the 993-line hand-written `pdf-viewer.tsx` with `react-pdf` for built-in text layer handling.

**Tech Stack:** Next.js 16, React 19, TypeScript, mupdf (WASM), pdfjs-dist, react-pdf, Jest 30

**Spec:** `docs/superpowers/specs/2026-03-29-pdf-optimization-design.md`

---

## Chunk 1: Phase 1 — PDF Parsing Optimization

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/pdf-parser.ts` | Parallel batches, lower DPI, new callbacks, page-marker dedup |
| Modify | `src/lib/prompts.ts` | Add page-marker instructions to vision prompts |
| Modify | `src/app/api/analyze/route.ts` | Wire new callbacks, emit `parse_batch_done` SSE events |
| Modify | `src/app/paper/[id]/page.tsx` | Handle new SSE event type, remove old vision_stream/vision_progress |
| Modify | `src/components/analysis-panel.tsx` | Update props for batch progress display |
| Modify | `__tests__/lib/pdf-parser.test.ts` | Update tests for new interface and parallel behavior |
| Modify | `__tests__/api/analyze.test.ts` | Update for removed vision callbacks |
| Modify | `src/types/index.ts` | Update AnalyzeEvent type for new SSE events |

---

### Task 1: Update Vision Prompts with Page Markers

**Files:**
- Modify: `src/lib/prompts.ts:85-137`

- [ ] **Step 1: Write failing test for page marker in prompt**

Create a new test file to verify prompt content:

```typescript
// __tests__/lib/prompts.test.ts
import { PDF_PARSE_PROMPT, PDF_PARSE_BATCH_PROMPT, PDF_PARSE_PROMPT_ZH, PDF_PARSE_BATCH_PROMPT_ZH } from '@/lib/prompts';

describe('Vision prompts', () => {
  it('PDF_PARSE_PROMPT includes page marker instruction', () => {
    expect(PDF_PARSE_PROMPT).toContain('<!-- page');
  });

  it('PDF_PARSE_BATCH_PROMPT includes page marker instruction', () => {
    expect(PDF_PARSE_BATCH_PROMPT).toContain('<!-- page');
  });

  it('PDF_PARSE_PROMPT_ZH includes page marker instruction', () => {
    expect(PDF_PARSE_PROMPT_ZH).toContain('<!-- page');
  });

  it('PDF_PARSE_BATCH_PROMPT_ZH includes page marker instruction', () => {
    expect(PDF_PARSE_BATCH_PROMPT_ZH).toContain('<!-- page');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/prompts.test.ts -v`
Expected: FAIL — prompts don't contain page marker instructions yet.

- [ ] **Step 3: Add page marker rules to all four vision prompts**

In `src/lib/prompts.ts`, add this rule to `PDF_PARSE_PROMPT` (insert after rule 6, before rule 7):

```
7. At the start of each page's content, insert a marker comment: <!-- page N --> where N is the page number (starting from 1)
```

Renumber existing rule 7 to 8. Do the same for `PDF_PARSE_PROMPT_ZH`:

```
7. 在每页内容的开头插入标记注释: <!-- page N --> 其中 N 是页码（从1开始）
```

For `PDF_PARSE_BATCH_PROMPT`, add after rule 5:

```
6. At the start of each page's content, insert: <!-- page N --> where N is the absolute page number in the document
```

Renumber existing rule 6 to 7. Do the same for `PDF_PARSE_BATCH_PROMPT_ZH`:

```
6. 在每页内容的开头插入标记注释: <!-- page N --> 其中 N 是文档中的绝对页码
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/prompts.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/lib/prompts.test.ts src/lib/prompts.ts
git commit -m "feat: add page marker instructions to vision prompts for dedup"
```

---

### Task 2: Refactor ParseOptions Interface and Constants

**Files:**
- Modify: `src/lib/pdf-parser.ts:17-29`

- [ ] **Step 1: Update the ParseOptions interface and DPI constant**

In `src/lib/pdf-parser.ts`, replace the `ParseOptions` interface and `DPI` constant:

```typescript
interface ParseOptions {
  onProgress?: (message: string) => void;
  onBatchDone?: (batchIndex: number, totalBatches: number, content: string) => void;
  signal?: AbortSignal;
  customVisionPrompt?: string;  // Kept from old interface — used for custom vision prompts from settings
}

const BATCH_SIZE = 15;
const BATCH_OVERLAP = 2;
const MAX_TOKENS = 16384;
const TIMEOUT_MS = 180_000;
const DPI = 120;
const SCALE = DPI / 72;
const MAX_CONCURRENCY = 3;
```

This removes `onVisionChunk`, `onVisionProgress` and adds `onBatchDone`, `signal`, `MAX_CONCURRENCY`. Keeps `customVisionPrompt`. DPI changes from 150 to 120.

- [ ] **Step 2: Update the function signature to use new options**

In `parsePdfWithVision` (line 56), update the destructure:

```typescript
const { onProgress = () => {}, onBatchDone, signal, customVisionPrompt } = options;
```

- [ ] **Step 3: Run existing tests to confirm they need updating**

Run: `npx jest __tests__/lib/pdf-parser.test.ts -v`
Expected: Tests may fail due to changed interface — this is expected and will be fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf-parser.ts
git commit -m "refactor: update ParseOptions interface, lower DPI to 120"
```

---

### Task 3: Implement Page-Marker-Based Deduplication

> **Note:** This task adds the new `deduplicateByPageMarkers` function **alongside** the existing `deduplicateAndJoin` (don't delete it yet). Task 4 will switch the call site and remove the old function. This avoids an intermediate broken state.

**Files:**
- Modify: `src/lib/pdf-parser.ts` (add new function, keep old one temporarily)

- [ ] **Step 1: Write failing tests for page-marker dedup**

Add to `__tests__/lib/pdf-parser.test.ts`:

```typescript
// Import the function (we'll need to export it)
import { deduplicateByPageMarkers } from '@/lib/pdf-parser';

describe('deduplicateByPageMarkers', () => {
  it('joins single batch without modification', () => {
    const result = deduplicateByPageMarkers(['<!-- page 1 -->\nContent page 1\n<!-- page 2 -->\nContent page 2']);
    expect(result).toBe('<!-- page 1 -->\nContent page 1\n<!-- page 2 -->\nContent page 2');
  });

  it('deduplicates overlapping pages between batches', () => {
    const batch1 = '<!-- page 1 -->\nContent 1\n<!-- page 2 -->\nContent 2\n<!-- page 3 -->\nContent 3';
    const batch2 = '<!-- page 3 -->\nContent 3 different\n<!-- page 4 -->\nContent 4';
    const result = deduplicateByPageMarkers([batch1, batch2]);
    expect(result).toContain('Content 1');
    expect(result).toContain('Content 2');
    expect(result).toContain('Content 3');  // from batch1 (first wins)
    expect(result).toContain('Content 4');
    expect(result).not.toContain('Content 3 different');  // batch2 overlap discarded
  });

  it('handles batches without page markers (fallback join)', () => {
    const result = deduplicateByPageMarkers(['No markers batch 1', 'No markers batch 2']);
    expect(result).toBe('No markers batch 1\n\nNo markers batch 2');
  });

  it('handles empty results', () => {
    expect(deduplicateByPageMarkers([])).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-parser.test.ts -t "deduplicateByPageMarkers" -v`
Expected: FAIL — function not exported / doesn't exist yet.

- [ ] **Step 3: Implement deduplicateByPageMarkers**

In `src/lib/pdf-parser.ts`, replace the `deduplicateAndJoin` function with:

```typescript
/**
 * Parse page-marker-delimited content into a Map<pageNum, content>.
 */
function parsePageMarkers(text: string): Map<number, string> {
  const pages = new Map<number, string>();
  const markerRegex = /<!--\s*page\s+(\d+)\s*-->/g;
  let match: RegExpExecArray | null;
  const markers: { page: number; index: number }[] = [];

  while ((match = markerRegex.exec(text)) !== null) {
    markers.push({ page: parseInt(match[1], 10), index: match.index });
  }

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    pages.set(markers[i].page, text.slice(start, end).trimEnd());
  }

  return pages;
}

/**
 * Join batch results, deduplicating overlapping pages by page markers.
 * Falls back to simple newline join if no markers are found.
 */
export function deduplicateByPageMarkers(results: string[]): string {
  if (results.length === 0) return '';
  if (results.length === 1) return results[0];

  // Check if markers exist in first batch
  const hasMarkers = /<!--\s*page\s+\d+\s*-->/.test(results[0]);
  if (!hasMarkers) {
    return results.join('\n\n');
  }

  const merged = new Map<number, string>();

  for (const batch of results) {
    const pages = parsePageMarkers(batch);
    for (const [pageNum, content] of pages) {
      // First batch wins for overlapping pages
      if (!merged.has(pageNum)) {
        merged.set(pageNum, content);
      }
    }
  }

  // Sort by page number and join
  const sorted = [...merged.entries()].sort((a, b) => a[0] - b[0]);
  return sorted.map(([, content]) => content).join('\n\n');
}
```

- [ ] **Step 4: Run dedup tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-parser.test.ts -t "deduplicateByPageMarkers" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-parser.ts __tests__/lib/pdf-parser.test.ts
git commit -m "feat: implement page-marker-based deduplication for parallel batches"
```

---

### Task 4: Implement Parallel Batch Execution with Concurrency Control

**Files:**
- Modify: `src/lib/pdf-parser.ts:92-157` (replace the Vision LLM section)

- [ ] **Step 1: Write failing test for parallel execution**

Add to `__tests__/lib/pdf-parser.test.ts`:

```typescript
it('sends batches in parallel for large papers', async () => {
  mupdfMocks.mockCountPages.mockReturnValue(35);

  // Use mockResolvedValueOnce to avoid race conditions with shared counters
  mockCompleteVision
    .mockResolvedValueOnce('<!-- page 1 -->\nBatch 1 content.')
    .mockResolvedValueOnce('<!-- page 14 -->\nBatch 2 content.')
    .mockResolvedValueOnce('<!-- page 27 -->\nBatch 3 content.');

  await parsePdfWithVision('/test.pdf', config);

  // 35 pages = 3 batches (1-15, 14-28, 27-35)
  expect(mockCompleteVision).toHaveBeenCalledTimes(3);
});

it('calls onBatchDone for each completed batch', async () => {
  mupdfMocks.mockCountPages.mockReturnValue(20);
  mockCompleteVision
    .mockResolvedValueOnce('<!-- page 1 -->\nBatch 1.')
    .mockResolvedValueOnce('<!-- page 14 -->\nBatch 2.');

  const batchDones: Array<{ index: number; total: number }> = [];
  await parsePdfWithVision('/test.pdf', config, {
    onBatchDone: (idx, total) => batchDones.push({ index: idx, total }),
  });

  expect(batchDones).toHaveLength(2);
  expect(batchDones[0].total).toBe(2);
  expect(batchDones[1].total).toBe(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-parser.test.ts -t "parallel\|onBatchDone" -v`
Expected: FAIL

- [ ] **Step 3: Implement parallel batch execution**

Replace the Vision LLM section in `parsePdfWithVision` (lines 92-157 approximately) with:

```typescript
  try {
    let result: string;

    if (validImages.length <= BATCH_SIZE) {
      // Single batch — no parallelism needed
      onProgress(`Parsing with Vision AI (${validImages.length} pages)...`);
      const batchResult = await executeBatchWithRetry(client, validImages, customVisionPrompt || PDF_PARSE_PROMPT, signal);
      if (onBatchDone) onBatchDone(0, 1, batchResult);
      result = batchResult;
    } else {
      // Multi-batch: build batch list, then execute in parallel
      const batches: { images: string[]; startPage: number; endPage: number }[] = [];
      let start = 0;
      while (start < validImages.length) {
        const end = Math.min(start + BATCH_SIZE, validImages.length);
        batches.push({ images: validImages.slice(start, end), startPage: start + 1, endPage: end });
        start += end >= validImages.length ? validImages.length : BATCH_SIZE - BATCH_OVERLAP;
      }

      const totalBatches = batches.length;
      onProgress(`Parsing with Vision AI (${totalBatches} batches, ${validImages.length} pages)...`);

      // Parallel execution with concurrency limit and 429 pause support
      const batchResults: (string | null)[] = new Array(totalBatches).fill(null);
      let running = 0;
      let nextIdx = 0;
      let rateLimitPauseUntil = 0; // Timestamp; when > Date.now(), new launches are paused

      await new Promise<void>((resolve) => {
        let settled = 0;

        function launchNext() {
          // Pause if rate-limited
          if (rateLimitPauseUntil > Date.now()) {
            const delay = rateLimitPauseUntil - Date.now();
            setTimeout(launchNext, delay);
            return;
          }

          while (running < MAX_CONCURRENCY && nextIdx < totalBatches) {
            const idx = nextIdx++;
            const batch = batches[idx];
            running++;

            const prompt = idx === 0
              ? (customVisionPrompt || PDF_PARSE_PROMPT)
              : PDF_PARSE_BATCH_PROMPT
                  .replace('{startPage}', String(batch.startPage))
                  .replace('{endPage}', String(batch.endPage))
                  .replace('{totalPages}', String(validImages.length));

            executeBatchWithRetry(client, batch.images, prompt, signal, (retryAfterMs) => {
              // 429 callback: pause the pool
              rateLimitPauseUntil = Math.max(rateLimitPauseUntil, Date.now() + retryAfterMs);
            })
              .then((content) => {
                batchResults[idx] = content;
                if (onBatchDone) onBatchDone(idx, totalBatches, content);
                onProgress(`Parsed batch ${idx + 1}/${totalBatches} (pages ${batch.startPage}-${batch.endPage})`);
              })
              .catch((err) => {
                console.warn(`[pdf-parser] Batch ${idx + 1} failed:`, err instanceof Error ? err.message : err);
                batchResults[idx] = null; // Mark as failed
                onProgress(`Batch ${idx + 1}/${totalBatches} failed (pages ${batch.startPage}-${batch.endPage})`);
              })
              .finally(() => {
                running--;
                settled++;
                if (settled === totalBatches) {
                  resolve();
                } else {
                  launchNext();
                }
              });
          }
        }

        launchNext();

        // Edge case: 0 batches
        if (totalBatches === 0) resolve();
      });

      // Filter successful results and deduplicate
      const successResults = batchResults.filter((r): r is string => r !== null);
      if (successResults.length === 0) {
        throw new Error('All Vision API batches failed');
      }

      // Note which pages are missing
      const failedBatches = batchResults
        .map((r, i) => r === null ? batches[i] : null)
        .filter((b): b is NonNullable<typeof b> => b !== null);
      if (failedBatches.length > 0) {
        const ranges = failedBatches.map(b => `${b.startPage}-${b.endPage}`).join(', ');
        onProgress(`Warning: Pages ${ranges} could not be parsed.`);
      }

      result = deduplicateByPageMarkers(successResults);
    }

    // Check for truncation
    if (detectTruncation(result)) {
      onProgress('Warning: AI output may be incomplete (truncated). Consider re-analyzing.');
    }

    return result;
  } catch (error) {
    // Fallback: text extraction via mupdf
    console.warn('[pdf-parser] Vision LLM failed, falling back to text extraction:', error instanceof Error ? error.message : error);
    onProgress('Vision model unavailable, using basic text extraction. For better results, configure a Vision-capable model.');

    return extractTextFallback(doc, pageCount);
  }
```

- [ ] **Step 4: Implement the executeBatchWithRetry helper**

Replace `callVisionWithRetryStreaming` with:

```typescript
/**
 * Execute a single Vision API batch with retry, 429 rate-limit handling, and abort signal support.
 * @param onRateLimit Called when 429 is received, with the backoff delay in ms.
 *   The caller (concurrency pool) uses this to pause launching new batches.
 */
async function executeBatchWithRetry(
  client: ReturnType<typeof createAIClient>,
  pageImages: string[],
  prompt: string,
  externalSignal?: AbortSignal,
  onRateLimit?: (retryAfterMs: number) => void,
): Promise<string> {
  const content: ContentPart[] = [
    { type: 'text', text: prompt },
    ...pageImages.map((base64): ContentPart => ({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' },
    })),
  ];

  let backoffMs = 2000; // Initial backoff for 429, doubles each retry

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Merge external signal with timeout
    const mergedSignal = externalSignal
      ? AbortSignal.any([externalSignal, controller.signal])
      : controller.signal;

    try {
      let result = '';
      for await (const chunk of client.streamCompleteVision(
        [{ role: 'user', content }],
        MAX_TOKENS,
        mergedSignal,
      )) {
        result += chunk;
      }
      return result;
    } catch (err) {
      // If external signal was aborted, don't retry
      if (externalSignal?.aborted) throw err;

      // Handle 429 rate limit
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('429')) {
        // Parse Retry-After from error message if available (API error format: "API error 429: ...")
        const retryMatch = errMsg.match(/[Rr]etry-?[Aa]fter[:\s]+(\d+)/);
        const retryAfterMs = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : backoffMs;
        console.warn(`[pdf-parser] Rate limited (429), waiting ${retryAfterMs}ms before retry...`);
        if (onRateLimit) onRateLimit(retryAfterMs);
        await new Promise(r => setTimeout(r, retryAfterMs));
        backoffMs *= 2; // Exponential backoff
        continue;
      }

      // Handle timeout/network errors (single retry)
      if (attempt === 0 && (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof TypeError && errMsg.includes('fetch'))
      )) {
        console.warn('[pdf-parser] Vision batch failed, retrying...', errMsg);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Vision API failed after retries');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-parser.test.ts -v`
Expected: Some tests may still fail if they reference old callbacks — fix in Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pdf-parser.ts __tests__/lib/pdf-parser.test.ts
git commit -m "feat: implement parallel batch execution with concurrency control"
```

---

### Task 5: Update Existing pdf-parser Tests for New Interface

**Files:**
- Modify: `__tests__/lib/pdf-parser.test.ts`

- [ ] **Step 1: Update mock setup for streamCompleteVision**

The mock needs to handle being called concurrently for parallel tests. The current mock uses `mockCompleteVision` sequentially via `mockResolvedValueOnce`. This still works because `Promise.allSettled` calls them in order. No structural mock change needed.

- [ ] **Step 2: Update the 'renders PDF pages' test**

```typescript
it('renders PDF pages and sends to Vision LLM', async () => {
  mockCompleteVision.mockResolvedValue('<!-- page 1 -->\n# Paper Title\n<!-- page 2 -->\nParsed content.');

  const result = await parsePdfWithVision('/test.pdf', config);

  expect(result).toContain('Paper Title');
  expect(result).toContain('Parsed content');
  const callArgs = streamCompleteVision.mock.calls[0][0];
  expect(callArgs[0].content).toHaveLength(3); // prompt + 2 images
  expect(callArgs[0].content[0].type).toBe('text');
  expect(callArgs[0].content[1].type).toBe('image_url');
});
```

- [ ] **Step 3: Update the 'batches long papers' test**

```typescript
it('batches long papers and deduplicates by page markers', async () => {
  mupdfMocks.mockCountPages.mockReturnValue(20);
  mockCompleteVision
    .mockResolvedValueOnce('<!-- page 1 -->\nBatch 1 ending.\n<!-- page 14 -->\nOverlap page.')
    .mockResolvedValueOnce('<!-- page 14 -->\nOverlap different.\n<!-- page 20 -->\nBatch 2 content.');

  const result = await parsePdfWithVision('/test.pdf', config);

  expect(mockCompleteVision).toHaveBeenCalledTimes(2);
  expect(result).toContain('Batch 1 ending');
  expect(result).toContain('Batch 2 content');
  // Page 14 should come from first batch (first wins)
  expect(result).toContain('Overlap page');
  expect(result).not.toContain('Overlap different');
});
```

- [ ] **Step 4: Update progress test (remove onVisionChunk/onVisionProgress references)**

```typescript
it('reports progress via callback', async () => {
  mockCompleteVision.mockResolvedValue('<!-- page 1 -->\n# Content.');
  const progress: string[] = [];

  await parsePdfWithVision('/test.pdf', config, {
    onProgress: (msg) => progress.push(msg),
  });

  expect(progress.some(p => p.includes('Rendering'))).toBe(true);
  expect(progress.some(p => p.includes('Vision AI'))).toBe(true);
});
```

- [ ] **Step 5: Run all pdf-parser tests**

Run: `npx jest __tests__/lib/pdf-parser.test.ts -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add __tests__/lib/pdf-parser.test.ts
git commit -m "test: update pdf-parser tests for parallel batch interface"
```

---

### Task 6: Update analyze Route for New Callbacks

**Files:**
- Modify: `src/app/api/analyze/route.ts:32-42`

- [ ] **Step 1: Replace onVisionChunk/onVisionProgress with onBatchDone**

In `src/app/api/analyze/route.ts`, replace lines 32-42:

```typescript
// Before (old):
//   onVisionChunk: (content) => send({ type: 'vision_stream', content }),
//   onVisionProgress: (info) => send({ type: 'vision_progress', ...info }),

// After (new):
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
        customVisionPrompt,
      });
```

- [ ] **Step 2: Run analyze tests**

Run: `npx jest __tests__/api/analyze.test.ts -v`
Expected: PASS (tests don't check SSE event content, only HTTP response structure)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: wire onBatchDone callback in analyze route, emit parse_batch_done SSE"
```

---

### Task 7: Update AnalyzeEvent Type and Frontend SSE Handling

**Files:**
- Modify: `src/types/index.ts:78-84` (update AnalyzeEvent union type)
- Modify: `src/app/paper/[id]/page.tsx:29-30,222-229`
- Modify: `src/components/analysis-panel.tsx:11-18`

- [ ] **Step 0: Update AnalyzeEvent type in src/types/index.ts**

In `src/types/index.ts`, replace the `vision_stream` and `vision_progress` variants in the `AnalyzeEvent` type:

```typescript
// Remove:
//   | { type: 'vision_stream'; content: string }
//   | { type: 'vision_progress'; batch: number; totalBatches: number; pages: string; elapsed: number }
// Add:
  | { type: 'parse_batch_done'; batchIndex: number; totalBatches: number; content: string }
```

- [ ] **Step 1: Update page.tsx SSE event handling**

In `src/app/paper/[id]/page.tsx`:

Replace the `visionStreamContent` and `visionProgress` state (lines 29-30):
```typescript
const [parseBatchProgress, setParseBatchProgress] = useState<{ done: number; total: number } | null>(null);
```

Replace the SSE event handlers (lines 222-229):
```typescript
              if (event.type === 'parse_batch_done') {
                setParseBatchProgress({ done: event.batchIndex + 1, total: event.totalBatches });
              }
```

Remove the old `vision_stream` and `vision_progress` handlers.

Update the `AnalysisPanel` usage:
```typescript
<AnalysisPanel
  analysis={displayAnalysis}
  isAnalyzing={effectiveIsAnalyzing}
  analysisStep={effectiveStep}
  analysisMessage={effectiveMessage}
  parseBatchProgress={parseBatchProgress}
  onReAnalyze={handleAnalyze}
/>
```

- [ ] **Step 2: Update AnalysisPanel props**

In `src/components/analysis-panel.tsx`, replace the `visionStreamContent` and `visionProgress` props:

```typescript
interface AnalysisPanelProps {
  analysis: PaperAnalysis | null;
  isAnalyzing?: boolean;
  analysisStep?: string | null;
  analysisMessage?: string | null;
  parseBatchProgress?: { done: number; total: number } | null;
  onReAnalyze?: () => void;
}
```

Update the component to display batch progress where it previously showed vision stream content. Show a progress bar like "Parsed 2/3 batches" instead of streaming raw vision output.

- [ ] **Step 3: Run build to verify no type errors**

Run: `npm run build`
Expected: Build succeeds (or fix any remaining type issues)

- [ ] **Step 4: Commit**

```bash
git add src/app/paper/[id]/page.tsx src/components/analysis-panel.tsx
git commit -m "feat: update frontend to handle parse_batch_done SSE events"
```

---

### Task 8: Run Full Test Suite and Lint

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Fix any failures found in steps 1-2**

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve test/lint issues from Phase 1 refactoring"
```

---

## Chunk 2: Phase 2 — PDF Viewer Replacement with react-pdf

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Verify | `package.json` | Install react-pdf, verify pdfjs-dist compat |
| Rewrite | `src/components/pdf-viewer.tsx` | New react-pdf based viewer |
| Modify | `src/app/paper/[id]/page.tsx` | Dynamic import for SSR-safe loading |
| Remove | References to `pdf_viewer.css` in pdf-viewer | No longer needed for text layer |

---

### Task 9: Install react-pdf and Verify Compatibility

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Check react-pdf version compatibility**

Run: `npm info react-pdf peerDependencies`
Check that it works with `pdfjs-dist@^4.10.38`. If not, note the required version.

- [ ] **Step 2: Install react-pdf**

Run: `npm install react-pdf`

- [ ] **Step 3: Verify installation and peer deps**

Run: `npm ls react-pdf pdfjs-dist`
Expected: Both listed, no peer dependency warnings.

If there's a pdfjs-dist version conflict, resolve it:
Run: `npm install pdfjs-dist@<required-version>`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: install react-pdf for PDF viewer replacement"
```

---

### Task 10: Rewrite PDF Viewer Component

**Files:**
- Rewrite: `src/components/pdf-viewer.tsx` (993 lines → ~400 lines)

- [ ] **Step 1: Write the new PDF viewer component**

Replace the entire contents of `src/components/pdf-viewer.tsx` with a react-pdf implementation. The component must preserve:
- Same `PdfViewerProps` interface (url, currentPage, onPageChange, bookmarks, onAddBookmark, onRemoveBookmark, onBookmarksChange)
- Same visual layout: toolbar (nav + zoom + bookmark + shortcuts) → canvas area → progress bar
- Keyboard shortcuts (ArrowLeft/Right, PageUp/Down, Home/End, +/-, Up/Down for scroll)
- Progress bar with drag, hover thumbnail preview, bookmark markers
- Bookmark popover, context menu

Core structure:

```typescript
'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import type { Bookmark } from '@/types';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ... (keep THUMBNAIL constants)

interface PdfViewerProps {
  url: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  bookmarks?: Bookmark[];
  onAddBookmark?: (page: number, label?: string) => void;
  onRemoveBookmark?: (bookmarkId: string) => void;
  onBookmarksChange?: () => void;
}

export function PdfViewer({ /* same props */ }: PdfViewerProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(currentPage);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);

  // ... reuse all toolbar/navigation/bookmark/context-menu/progress-bar logic unchanged

  return (
    <div ref={viewerRef} className="flex flex-col h-full" tabIndex={-1}>
      {/* Toolbar — identical to current */}
      {/* ... */}

      {/* Canvas + TextLayer via react-pdf */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4" style={{ background: 'var(--bg-deep)' }}
        onContextMenu={handleContextMenu}
      >
        <div className="text-center">
          <div className="inline-block shadow-xl rounded overflow-hidden">
            <Document
              file={url}
              onLoadSuccess={({ numPages }) => { setTotalPages(numPages); setLoading(false); }}
              loading={null}
            >
              <Page
                pageNumber={page}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        </div>
      </div>

      {/* Progress Bar — identical to current */}
      {/* ... */}

      {/* Context Menu — identical to current */}
      {/* ... */}
    </div>
  );
}
```

Key changes from current implementation:
- Remove: `canvasRef`, `textLayerRef`, `textLayerInstanceRef`, `highlightRects`, `wrapperRef`, `rafIdRef`, `canvasOpacity`, `animationGenRef`, `skipAnimationRef`
- Remove: Manual `pdfPage.render()` + TextLayer setup (lines 98-161)
- Remove: `selectionchange` listener + pixel scanning (lines 496-621)
- Remove: Custom highlight overlay (lines 825-841)
- Remove: `<link rel="stylesheet" href="/pdf_viewer.css" />`
- Add: `<Document>` + `<Page>` from react-pdf
- Add: react-pdf CSS imports
- Keep: All toolbar, navigation, zoom, bookmark, progress bar, thumbnail, keyboard shortcut code

The thumbnail rendering needs updating — instead of using `pdf.getPage()` directly, use a small `<Page width={80}>` rendered off-screen, or keep the existing canvas-based approach by accessing the pdfjs document from react-pdf's `onLoadSuccess`.

For thumbnails, use the Document's internal pdfjs instance:

```typescript
const [pdfDoc, setPdfDoc] = useState<any>(null);

// In Document onLoadSuccess:
onLoadSuccess={(pdf) => { setTotalPages(pdf.numPages); setPdfDoc(pdf); setLoading(false); }}

// Keep existing renderThumbnail using pdfDoc (same as current `pdf`)
```

- [ ] **Step 2: Verify the component renders**

Run: `npm run dev`
Navigate to a paper page and check:
- PDF renders correctly
- Text is selectable
- Toolbar works
- Page navigation works

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: rewrite PDF viewer using react-pdf for reliable text selection"
```

---

### Task 11: Update Page.tsx Dynamic Import

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:6`

- [ ] **Step 1: Check if react-pdf needs dynamic import**

react-pdf accesses browser APIs. With Next.js App Router + `'use client'`, it should work in client components. However, if the build fails with SSR errors, add dynamic import:

In `src/app/paper/[id]/page.tsx`, if needed, replace:
```typescript
import { PdfViewer } from '@/components/pdf-viewer';
```
with:
```typescript
import dynamic from 'next/dynamic';
const PdfViewer = dynamic(() => import('@/components/pdf-viewer').then(m => m.PdfViewer), { ssr: false });
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit if any changes were made**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "fix: use dynamic import for PdfViewer to avoid SSR issues"
```

---

### Task 12: Clean Up Old CSS and Unused Code

**Files:**
- Modify: `public/pdf_viewer.css` (remove unused `.textLayer` custom rules if react-pdf provides its own)

- [ ] **Step 1: Determine which css rules are still needed**

The `pdf_viewer.css` file was loaded via `<link>` in the old viewer. react-pdf provides its own TextLayer.css. Check if anything else in the app uses `pdf_viewer.css`. If not, it can be removed. If other components reference it, keep it but remove the `.textLayer` sections.

Run: `grep -r "pdf_viewer.css" src/`
If only the old pdf-viewer referenced it and that reference is now removed, delete the file.

- [ ] **Step 2: Remove or trim the file**

If unused:
```bash
rm public/pdf_viewer.css
```

If partially used, edit to remove `.textLayer` styles (lines 583-709 of the file).

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore: remove unused pdf_viewer.css after react-pdf migration"
```

---

### Task 13: Full Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual testing checklist**

Start dev server: `npm run dev`

- [ ] Text selection: select text on a PDF page — highlight should follow text accurately
- [ ] Zoom: use +/- or toolbar buttons, verify 0.5x to 3x range works
- [ ] Navigation: ArrowLeft/Right, PageUp/Down, Home/End, toolbar prev/next
- [ ] Page number input: click page number, type a number, press Enter
- [ ] Progress bar: click to jump, drag handle, hover for thumbnail preview
- [ ] Bookmarks: add (toolbar button), add (right-click menu), remove, markers on progress bar
- [ ] Analyze: upload a new paper, trigger analysis, verify batch progress shows
- [ ] Large paper (30+ pages): verify parsing uses parallel batches (check console logs)

- [ ] **Step 5: Commit any final fixes**

```bash
git add -u
git commit -m "fix: final adjustments from manual testing"
```
