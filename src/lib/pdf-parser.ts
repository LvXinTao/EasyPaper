import fs from 'fs/promises';
import { createAIClient } from '@/lib/ai-client';
import { PDF_PARSE_PROMPT, PDF_PARSE_BATCH_PROMPT } from '@/lib/prompts';
import type { ContentPart } from '@/lib/ai-client';

// Dynamic import to avoid Turbopack rewriting the ESM+WASM package name
async function loadMupdf() {
  return await import('mupdf');
}

interface ParseConfig {
  baseUrl: string;
  apiKey: string;
  visionModel: string;
}

interface ParseOptions {
  onProgress?: (message: string) => void;
  onBatchDone?: (batchIndex: number, totalBatches: number, content: string) => void;
  signal?: AbortSignal;
  customVisionPrompt?: string;
}

const BATCH_SIZE = 15;
const BATCH_OVERLAP = 2;
const MAX_TOKENS = 16384;
const TIMEOUT_MS = 300_000; // 5 minutes max - but actual timeout is based on idle time
const IDLE_TIMEOUT_MS = 60_000; // Abort if no chunk received for 60 seconds
const DPI = 120;
const SCALE = DPI / 72;
const MAX_CONCURRENCY = 1; // Reduced to avoid multiple simultaneous 429s

// Retry configuration for rate limit handling
const MAX_RETRIES = 5; // Increased from 3 to give upstream more time to recover
const INITIAL_BACKOFF_MS = 4000; // Increased from 2000ms since "retry shortly" may need seconds
const MAX_BACKOFF_MS = 60000; // Cap backoff to avoid excessive waits (1 minute max)

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
  const { onProgress = () => {}, onBatchDone, signal, customVisionPrompt } = options;

  // 1. Load PDF with mupdf (dynamic import to avoid Turbopack ESM/WASM issues)
  const mupdf = await loadMupdf();
  const fileBuffer = await fs.readFile(pdfPath);
  const doc = mupdf.Document.openDocument(fileBuffer, 'application/pdf');
  const pageCount = doc.countPages();

  onProgress(`Rendering ${pageCount} PDF pages...`);

  // 2. Render pages to base64 PNG — one at a time for memory efficiency
  // Pages that fail to render are stored as null and skipped in the API call
  const pageImages: (string | null)[] = [];
  const matrix = mupdf.Matrix.scale(SCALE, SCALE);

  for (let i = 0; i < pageCount; i++) {
    try {
      const page = doc.loadPage(i);
      const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
      const pngBuffer = pixmap.asPNG();
      pageImages.push(Buffer.from(pngBuffer).toString('base64'));
    } catch (err) {
      console.warn(`[pdf-parser] Failed to render page ${i + 1}:`, err instanceof Error ? err.message : err);
      pageImages.push(null);
    }
  }

  const validImages = pageImages.filter((img): img is string => img !== null);
  if (validImages.length === 0) {
    onProgress('All pages failed to render, using text extraction...');
    return extractTextFallback(doc, pageCount);
  }

  // 3. Send to Vision LLM
  const client = createAIClient({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.visionModel });

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
}

function extractTextFallback(
  doc: { loadPage(i: number): { toStructuredText(): { asText(): string } } },
  pageCount: number,
): string {
  const textPages: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    try {
      const page = doc.loadPage(i);
      const text = page.toStructuredText().asText();
      textPages.push(text);
    } catch {
      textPages.push(`[Page ${i + 1}: text extraction failed]`);
    }
  }
  return textPages.join('\n\n---\n\n');
}

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

  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    let idleTimeout: NodeJS.Timeout | null = null;
    let lastChunkTime = Date.now();

    // Reset idle timeout whenever we receive a chunk
    const resetIdleTimeout = () => {
      lastChunkTime = Date.now();
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        console.warn(`[pdf-parser] No chunk received for ${IDLE_TIMEOUT_MS}ms, aborting...`);
        controller.abort();
      }, IDLE_TIMEOUT_MS);
    };

    // Merge external signal with idle timeout controller
    const mergedSignal = externalSignal
      ? AbortSignal.any([externalSignal, controller.signal])
      : controller.signal;

    try {
      let result = '';
      resetIdleTimeout(); // Start idle timer

      for await (const chunk of client.streamCompleteVision(
        [{ role: 'user', content }],
        MAX_TOKENS,
        mergedSignal,
      )) {
        result += chunk;
        resetIdleTimeout(); // Reset timer on each chunk
      }

      if (idleTimeout) clearTimeout(idleTimeout);
      return result;
    } catch (err) {
      // If external signal was aborted, don't retry
      if (externalSignal?.aborted) throw err;

      // Handle 429 rate limit
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('429')) {
        // Use backoff with cap, since API doesn't provide Retry-After value
        const retryAfterMs = Math.min(backoffMs, MAX_BACKOFF_MS);
        console.warn(`[pdf-parser] Rate limited (429), attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${retryAfterMs}ms before retry...`);
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
      if (idleTimeout) clearTimeout(idleTimeout);
    }
  }

  throw new Error(`Vision API failed after ${MAX_RETRIES} retries`);
}

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
