# Vision-based PDF Parser Design

> Replace marker-pdf (Python + ML models) with a pure Node.js "PDF → Images → Vision LLM → Markdown" pipeline.

## Problem

EasyPaper currently uses `marker-pdf` for PDF parsing, which requires:
1. Python environment installed
2. `pip install marker-pdf`
3. Download of several GB of ML models

This setup friction is too high for a Node.js application distributed via npm.

## Requirements

- Support both text-based and scanned PDFs (OCR capability required)
- High parsing accuracy: formulas (LaTeX), tables (structured), images (described/positioned)
- Simple configuration only — user should NOT need to install additional software
- Leverage the AI API key the user has already configured

## Solution

Use `mupdf-js` (WASM) to render PDF pages to images, then send them to the user's Vision LLM for Markdown extraction.

```
Before:  PDF → child_process(python) → marker-pdf(ML models) → Markdown
After:   PDF → mupdf-js(WASM render) → page images → Vision LLM API → Markdown
```

## Architecture

### Module Changes

| File | Change |
|---|---|
| `src/lib/marker.ts` | **Delete** — no longer needed |
| `scripts/parse-pdf.py` | **Delete** — no longer needed |
| `src/lib/pdf-parser.ts` | **New** — PDF-to-image rendering + Vision LLM calling |
| `src/lib/prompts.ts` | Add `PDF_PARSE_PROMPT` for Vision-based extraction |
| `src/app/api/analyze/route.ts` | Replace `parsePdfWithMarker` with new parser |
| `src/lib/ai-client.ts` | Add Vision message format support (union `Message` type) |
| `src/lib/ai-config.ts` | **Extend** — return `visionModel` from settings/env |

### New Dependency

- `mupdf-js` (~5MB WASM) — Pure JavaScript PDF renderer, zero native compilation required

### Removed Dependencies

- Python runtime
- `marker-pdf` Python package and its ML models (several GB)

## Detailed Design

### 1. PDF to Images Rendering (`pdf-parser.ts`)

```
Input:  PDF file path
Output: { pages: Buffer[], pageCount: number }
```

Flow:
1. Read PDF file as `ArrayBuffer`
2. Load document with `mupdf-js`, get total page count
3. Render each page to PNG buffer at 200 DPI (1654x2339px for A4)
4. Return array of page image buffers

200 DPI balances readability for the Vision model against token consumption. Configurable if needed.

**Memory management:** Pages are rendered one at a time. Each page buffer is encoded to base64 and added to the message content array, then the raw PNG buffer is released. This avoids holding all raw buffers in memory simultaneously. Peak memory ≈ one page buffer (~1-3 MB) + accumulated base64 strings.

### 2. Vision LLM Parsing

Page images + a parsing prompt are sent to the Vision model. The `detail` parameter is set to `"high"` for accurate formula and table recognition.

```json
{
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "PDF_PARSE_PROMPT" },
      { "type": "image_url", "image_url": { "url": "data:image/png;base64,{page1}", "detail": "high" } },
      { "type": "image_url", "image_url": { "url": "data:image/png;base64,{page2}", "detail": "high" } }
    ]
  }],
  "max_tokens": 16384
}
```

**PDF_PARSE_PROMPT** instructs the model to:
- Convert the paper content to structured Markdown
- Preserve heading hierarchy
- Render formulas as LaTeX (`$...$` and `$$...$$`)
- Render tables as Markdown tables
- Describe images/figures with alt text
- Maintain original document order

**Response length management:** `max_tokens` is set to 16384 (or the model's maximum if known). After receiving the response, a truncation check is performed: if the output ends mid-sentence, mid-table, or mid-code-block, the result is NOT cached, and the user is warned that the model output may be incomplete.

**Batch strategy for long papers (>15 pages):** Split into batches of ~15 pages with 2-page overlap between batches. Each batch prompt notes its position (e.g., "This is pages 14-28 of a 40-page paper, continuing from the previous section"). Concatenation deduplicates overlapping content by matching the last ~200 characters of one batch against the start of the next.

**Timeout:** Each batch has a 120-second timeout. On timeout, the batch is retried once. If it fails again, the error is surfaced to the user via SSE.

### 3. ai-client.ts Type Extension

The `Message` type is extended to support Vision content:

```typescript
type TextContentPart = { type: 'text'; text: string };
type ImageContentPart = { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } };
type ContentPart = TextContentPart | ImageContentPart;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}
```

A new `completeVision` method is added to the AI client, which:
- Accepts `Message[]` with the union content type
- Sends `max_tokens` parameter
- Uses the `visionModel` instead of the default `model`

The existing `complete()` and `streamComplete()` remain unchanged (string content only).

### 4. ai-config.ts Extension

`getAIConfig()` is extended to also return `visionModel`:

```typescript
export async function getAIConfig() {
  // ... existing code ...
  const visionModel = (settings?.visionModel as string) || process.env.AI_VISION_MODEL || model;
  return { apiKey, baseUrl, model, visionModel };
}
```

Fallback chain: settings UI → `AI_VISION_MODEL` env var → same as `model` (the regular model).

### 5. Integration with analyze/route.ts

Minimal interface change:

```typescript
// Before
markdown = await parsePdfWithMarker(pdfPath, paperDir);

// After
const { visionModel } = await getAIConfig();
markdown = await parsePdfWithVision(pdfPath, paperDir, { baseUrl, apiKey, visionModel });
```

The caching mechanism (`parsed.md`) is fully reused. If cached content exists, parsing is skipped entirely.

### 6. SSE Progress Updates

- `"Rendering PDF pages..."` (during mupdf rendering)
- `"Parsing with Vision AI (page X/Y)..."` (during LLM call, with batch progress)

### 7. Settings

No new configuration UI needed. The existing `AI_VISION_MODEL` / `visionModel` setting drives the parser. The Settings page already has a Vision Model field.

## Compatibility

### WASM in Next.js

- The API route MUST use Node.js runtime (not Edge). Add `export const runtime = 'nodejs'` to the route if needed.
- `next.config.ts` may need `webpack.experiments.asyncWebAssembly = true` for `mupdf-js` WASM loading.
- The ~5MB WASM binary is loaded at runtime from `node_modules`, not bundled into the npm package's `files` list.

### Fallback for non-Vision models

If the user's configured model does not support Vision (API returns an error on image content):
1. Attempt a text-extraction fallback using `mupdf-js`'s built-in `page.toStructuredText()` method to extract text directly from the PDF.
2. This produces lower-quality output (no formula/table recognition), but is functional for text-based PDFs.
3. The SSE stream warns the user: "Vision model unavailable, using basic text extraction. For better results, configure a Vision-capable model."

This ensures the app remains functional even without a Vision model, though at reduced quality.

## Error Handling

- **Model doesn't support Vision:** Fall back to `mupdf-js` text extraction (see above)
- **Too many pages:** Batch processing with 15-page batches, 2-page overlap, real-time progress via SSE
- **Render failure on a page:** Skip the page, annotate in output
- **Response truncation:** Detect incomplete output, do NOT cache, warn user
- **API timeout:** 120s per batch, one retry, then surface error

## Cost Estimate

At 200 DPI with `detail: "high"`, each page image uses ~2500-3000 tokens (based on OpenAI's tile formula for 1654x2339 images). A typical 10-30 page paper costs approximately:
- 10 pages: ~$0.08-0.10
- 20 pages: ~$0.15-0.20
- 30 pages: ~$0.25-0.35

Acceptable for academic research use. Users can reduce cost by using `detail: "low"` (85 tokens/page) at the expense of accuracy, though this is not exposed as a setting in v1.

## Migration

- `marker.ts` and `scripts/parse-pdf.py` are deleted
- No data migration needed — `parsed.md` cache format stays the same (Markdown)
- Users who had marker-pdf installed can uninstall it (optional)
