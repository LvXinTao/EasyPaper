# PDF Highlight Fix Design

## Problem

Two related issues with PDF text highlighting in EasyPaper:

1. **Wrong text highlighted**: AI analysis references quote text from `marker-pdf` parsed Markdown, but highlighting searches through `pdfjs-dist` TextLayer spans. These two text representations differ in whitespace, formatting, and span boundaries, causing incorrect matches.

2. **Highlights lost on zoom**: When the user changes the zoom scale, highlights disappear or become mispositioned during the TextLayer rebuild.

## Root Cause

### Wrong Text Match

The current `applyHighlight` function (`pdf-viewer.tsx:112-145`) iterates over individual TextLayer spans and checks each one independently with `spanText.includes(searchText)`. This fails because:

- pdfjs splits text into multiple spans based on font, position, and rendering rules
- A search phrase like "deep learning model" might span across 3+ spans: `["deep ", "learning ", "model"]`
- The AI's quoted text comes from the Markdown representation (parsed by `marker-pdf`), which has different whitespace and segmentation than pdfjs TextLayer output
- The bidirectional match (`normalizedSearch.includes(spanText)`) is too loose — it highlights any span whose text is a substring of the search text, even if unrelated

### Highlights Lost on Zoom

The render `useEffect` depends on `[pdf, page, scale, highlightText]`. When `scale` changes, the cleanup function sets `cancelled = true`, which gates both the TextLayer render and the subsequent highlight application (`if (cancelled) return;` at line 99). If a scale change fires while the previous render's `textLayer.render()` is still awaited, the cancellation prevents the highlight from being applied. The new render then starts, but if `textLayer.render()` rejects or the promise chain is interrupted by cancellation, the highlight application at lines 102-104 is skipped entirely.

## Solution: Full-Page Text Search with Span Mapping

### Algorithm

1. **Build text map**: Collect all TextLayer spans in DOM order. Concatenate their `textContent` into a single page string, tracking each character's source span and offset:

   ```typescript
   interface CharMapping {
     span: HTMLElement;
     offsetInSpan: number;
   }

   function buildTextMap(container: HTMLDivElement): { fullText: string; charMap: CharMapping[] }
   ```

2. **Normalize and search**: Normalize both the search text and full page text (collapse whitespace, lowercase, trim). Find the best match position in the normalized full text. Map back to original character positions.

   ```typescript
   function normalizeText(text: string): { normalized: string; indexMap: number[] }
   ```

   The `indexMap` maps each character position in the normalized string back to the original string position, allowing us to trace matches back to specific spans.

3. **Highlight spans**: Using the character mapping, identify all spans that contain matched characters. Add `highlight-active` class to those spans.

### Normalization Strategy

- Collapse consecutive whitespace (spaces, tabs, newlines) into a single space
- Trim leading/trailing whitespace
- Convert to lowercase
- Apply Unicode NFC normalization to handle composed vs decomposed characters
- Preserve all other characters as-is

The `indexMap` array maps each character in the normalized string back to the index of its **first corresponding character** in the original string. When whitespace is collapsed (e.g., `"deep  learning"` → `"deep learning"`), the normalized space maps to the position of the first original space. This ensures span boundary calculations are deterministic.

This handles the primary sources of mismatch: different whitespace treatment between marker-pdf Markdown and pdfjs TextLayer, and Unicode normalization differences in academic PDFs (accented characters, ligatures).

### Zoom Fix

The root issue is the `cancelled` flag pattern in the render `useEffect`. When a scale change triggers cleanup, `cancelled` becomes `true`, which can prevent the highlight application in the previous render from executing. The new render should then apply highlights, but rapid scale changes can cause a cascade of cancellations.

**Fix:** Wrap the highlight application in a separate, non-cancellable step. After `textLayer.render()` completes, apply highlights unconditionally (outside the `cancelled` guard). The `cancelled` flag should only prevent starting new async operations (canvas render, text content fetch), not applying highlights to an already-rendered TextLayer. If the TextLayer div has been cleared by a newer render, `applyHighlight` will simply find no spans — a safe no-op.

## Changes

**Single file**: `src/components/pdf-viewer.tsx`

### Functions to Add

- `buildTextMap(container)`: Builds character-to-span mapping from TextLayer DOM
- `normalizeText(text)`: Normalizes text with index mapping for traceback

### Functions to Modify

- `applyHighlight(container, text)`: Rewrite to use full-page text search instead of per-span matching

### Functions Unchanged

- PDF loading, page rendering, canvas rendering — all untouched
- TextLayer creation via pdfjs `TextLayer` class — untouched
- Parent component (`page.tsx`), analysis panel, prompts — all untouched

## Testing

- Manual test with a real PDF: click analysis references, verify correct text is highlighted
- Test with multi-span text (phrases that cross span boundaries)
- Test zoom in/out while highlight is active — highlight should persist
- Test page navigation: highlight should clear when changing pages, reappear when navigating back with a reference click
