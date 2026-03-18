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
}

const BATCH_SIZE = 15;
const BATCH_OVERLAP = 2;
const MAX_TOKENS = 16384;
const TIMEOUT_MS = 180_000;
const DPI = 150;
const SCALE = DPI / 72;

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
 */
function deduplicateAndJoin(results: string[]): string {
  if (results.length <= 1) return results[0] || '';

  const joined: string[] = [results[0]];

  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const next = results[i];
    const tail = prev.slice(-200).trim();

    // Try to find the overlap point in the next batch
    const searchStr = tail.slice(-80);
    const overlapIdx = next.indexOf(searchStr);
    if (overlapIdx > 0 && overlapIdx < 500) {
      joined.push(next.slice(overlapIdx + searchStr.length));
    } else {
      joined.push(next);
    }
  }

  return joined.join('\n\n');
}
