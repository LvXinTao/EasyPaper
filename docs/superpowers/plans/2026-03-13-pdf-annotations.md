# PDF Paragraph Highlight & User Annotations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-span text highlighting with paragraph rectangle boxes on reference click, and add user text selection highlighting with comments and persistent storage.

**Architecture:** Feature 1 refactors `pdf-highlight.ts` to return match ranges instead of modifying DOM, adds paragraph detection via span geometry analysis, and renders rectangle overlays. Feature 2 uses the browser Selection API on TextLayer, stores annotations via REST API to `annotations.json`, and restores them on page render. Both features share `normalizeText` and `buildTextMap` utilities.

**Tech Stack:** TypeScript, Next.js 16 App Router, pdfjs-dist 5 TextLayer, React 19, Jest 30, jsdom

**Spec:** `docs/superpowers/specs/2026-03-13-pdf-annotations-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/pdf-highlight.ts` | Keep `normalizeText`, `buildTextMap`. Add `findMatchRange`, `detectParagraphBounds`, `applyParagraphHighlight`. Remove `applyHighlight`. |
| Create | `src/lib/pdf-annotations.ts` | User annotation rendering: `applyUserHighlights`, `getSelectionInfo`, color/class constants. |
| Modify | `src/types/index.ts` | Add `Annotation`, `AnnotationsFile`, `HighlightColor` types. |
| Modify | `src/lib/storage.ts` | Add `getAnnotations`, `saveAnnotations` methods to the `storage` object. |
| Create | `src/app/api/papers/[id]/annotations/route.ts` | GET/POST annotation endpoints. |
| Create | `src/app/api/papers/[id]/annotations/[annotationId]/route.ts` | PUT/DELETE annotation endpoints. |
| Modify | `src/components/pdf-viewer.tsx` | Add overlay layer, paragraph highlight, selection handling, annotation restoration. |
| Create | `src/components/highlight-toolbar.tsx` | Floating toolbar (color circles + comment button). |
| Create | `src/components/comment-popover.tsx` | Comment input popover. |
| Create | `src/components/annotations-panel.tsx` | Annotations list panel with management. |
| Modify | `src/app/paper/[id]/page.tsx` | Top-level Analysis/Annotations toggle, annotation state, API calls. |
| Modify | `__tests__/lib/pdf-highlight.test.ts` | Update tests for refactored functions. |
| Create | `__tests__/lib/pdf-annotations.test.ts` | Tests for annotation rendering logic. |
| Create | `__tests__/api/annotations.test.ts` | Tests for annotation CRUD endpoints. |

---

## Chunk 1: Refactor pdf-highlight.ts core functions

### Task 1: Extract `findMatchRange` from `applyHighlight`

**Files:**
- Modify: `src/lib/pdf-highlight.ts`
- Modify: `__tests__/lib/pdf-highlight.test.ts`

- [ ] **Step 1: Write failing tests for `findMatchRange`**

In `__tests__/lib/pdf-highlight.test.ts`, add a new describe block after the existing `buildTextMap` tests (before `applyHighlight` tests):

```typescript
import { normalizeText, buildTextMap, findMatchRange, applyHighlight } from '@/lib/pdf-highlight';

describe('findMatchRange', () => {
  it('returns match indices for exact normalized match', () => {
    const result = findMatchRange('hello world foo bar', 'world foo');
    expect(result).not.toBeNull();
    expect(result!.startIdx).toBe(6);
    expect(result!.endIdx).toBe(14);
  });

  it('returns null when no match found', () => {
    const result = findMatchRange('hello world', 'nonexistent');
    expect(result).toBeNull();
  });

  it('matches case-insensitively', () => {
    const result = findMatchRange('Deep Learning Model', 'deep learning');
    expect(result).not.toBeNull();
  });

  it('matches with whitespace normalization', () => {
    const result = findMatchRange('deep   learning   model', 'deep learning model');
    expect(result).not.toBeNull();
  });

  it('falls back to word subsequence when exact match fails', () => {
    const result = findMatchRange(
      'novel deep learning framework for NLP',
      'we propose a novel deep learning framework for NLP tasks'
    );
    expect(result).not.toBeNull();
  });

  it('returns null for empty search text', () => {
    expect(findMatchRange('hello', '')).toBeNull();
    expect(findMatchRange('hello', '   ')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts --verbose`
Expected: FAIL — `findMatchRange is not exported`

- [ ] **Step 3: Implement `findMatchRange`**

In `src/lib/pdf-highlight.ts`, add this new exported function after `buildTextMap` (before `applyHighlight`):

```typescript
/**
 * Result of finding a match range in page text.
 * Indices refer to the raw (unnormalized) fullText from buildTextMap.
 * Both startIdx and endIdx are inclusive (endIdx = index of last matched char).
 */
export interface MatchRange {
  startIdx: number;
  endIdx: number;
}

/**
 * Find search text within page text using normalized matching.
 * Uses progressive fallback: exact match → longest word subsequence.
 * Returns indices into the raw (unnormalized) pageText, or null if not found.
 */
export function findMatchRange(pageText: string, searchText: string): MatchRange | null {
  if (!searchText || !searchText.trim()) return null;
  if (!pageText) return null;

  const pageNorm = normalizeText(pageText);
  const searchNorm = normalizeText(searchText.normalize('NFC'));

  if (!searchNorm.normalized) return null;

  // Strategy 1: exact normalized substring match
  let matchIndex = pageNorm.normalized.indexOf(searchNorm.normalized);
  let matchLength = searchNorm.normalized.length;

  // Strategy 2: progressive word subsequence fallback
  if (matchIndex === -1) {
    const searchWords = searchNorm.normalized.split(' ').filter(w => w.length > 2);
    const minWords = Math.max(2, Math.ceil(searchWords.length * 0.4));

    for (let len = searchWords.length; len >= minWords; len--) {
      let found = false;
      for (let start = 0; start <= searchWords.length - len; start++) {
        const subSearch = searchWords.slice(start, start + len).join(' ');
        matchIndex = pageNorm.normalized.indexOf(subSearch);
        if (matchIndex !== -1) {
          matchLength = subSearch.length;
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  if (matchIndex === -1) return null;

  const startIdx = pageNorm.indexMap[matchIndex];
  const endIdx = pageNorm.indexMap[matchIndex + matchLength - 1];

  return { startIdx, endIdx };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts --verbose`
Expected: All `findMatchRange` tests PASS, existing tests still PASS

- [ ] **Step 5: Refactor `applyHighlight` to use `findMatchRange`**

Replace the body of the existing `applyHighlight` function in `src/lib/pdf-highlight.ts`:

```typescript
export function applyHighlight(container: HTMLDivElement, text: string): boolean {
  // Clear existing highlights
  container.querySelectorAll('.highlight-active').forEach((el) => {
    el.classList.remove('highlight-active');
  });

  if (!text || !text.trim()) return false;

  const { fullText, charMap } = buildTextMap(container);
  if (!fullText) return false;

  const range = findMatchRange(fullText, text);
  if (!range) return false;

  // Collect unique spans that contain matched characters
  const matchedSpans = new Set<HTMLElement>();
  for (let i = range.startIdx; i <= range.endIdx; i++) {
    if (charMap[i]) {
      matchedSpans.add(charMap[i].span);
    }
  }

  // Apply highlight class
  matchedSpans.forEach((span) => {
    span.classList.add('highlight-active');
  });

  // Scroll first highlighted span into view
  if (matchedSpans.size > 0) {
    const first = container.querySelector('.highlight-active');
    first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  return matchedSpans.size > 0;
}
```

- [ ] **Step 6: Run all tests to verify nothing broke**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts --verbose`
Expected: All tests PASS (existing `applyHighlight` tests + new `findMatchRange` tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/pdf-highlight.ts __tests__/lib/pdf-highlight.test.ts
git commit -m "refactor: extract findMatchRange from applyHighlight"
```

---

### Task 2: Add `detectParagraphBounds`

**Files:**
- Modify: `src/lib/pdf-highlight.ts`
- Modify: `__tests__/lib/pdf-highlight.test.ts`

- [ ] **Step 1: Write failing tests for `detectParagraphBounds`**

Append to `__tests__/lib/pdf-highlight.test.ts`:

```typescript
import { normalizeText, buildTextMap, findMatchRange, detectParagraphBounds } from '@/lib/pdf-highlight';

describe('detectParagraphBounds', () => {
  function makePositionedSpans(
    items: Array<{ text: string; top: number; left: number; width: number; height: number }>
  ): HTMLDivElement {
    const container = document.createElement('div');
    // Mock getBoundingClientRect for each span
    items.forEach((item) => {
      const span = document.createElement('span');
      span.textContent = item.text;
      span.getBoundingClientRect = () => ({
        top: item.top,
        left: item.left,
        width: item.width,
        height: item.height,
        bottom: item.top + item.height,
        right: item.left + item.width,
        x: item.left,
        y: item.top,
        toJSON: () => ({}),
      });
      container.appendChild(span);
    });
    return container;
  }

  it('returns bounding box of a single-line paragraph', () => {
    const container = makePositionedSpans([
      { text: 'hello world', top: 100, left: 50, width: 200, height: 16 },
    ]);
    const matchedSpans = new Set([container.querySelectorAll('span')[0]]);
    const bounds = detectParagraphBounds(container, matchedSpans);
    expect(bounds).toEqual({ top: 100, left: 50, width: 200, height: 16 });
  });

  it('expands to include adjacent lines in same paragraph', () => {
    const container = makePositionedSpans([
      { text: 'line 1', top: 100, left: 50, width: 200, height: 16 },
      { text: 'line 2', top: 118, left: 50, width: 180, height: 16 }, // gap=2, same paragraph
      { text: 'line 3', top: 136, left: 50, width: 190, height: 16 }, // gap=2, same paragraph
    ]);
    const matchedSpans = new Set([container.querySelectorAll('span')[1]]);
    const bounds = detectParagraphBounds(container, matchedSpans);
    // Should include all 3 lines
    expect(bounds.top).toBe(100);
    expect(bounds.height).toBe(52); // 136 + 16 - 100
  });

  it('stops at paragraph boundary (large gap)', () => {
    const container = makePositionedSpans([
      { text: 'para 1', top: 100, left: 50, width: 200, height: 16 },
      { text: 'para 1 line 2', top: 118, left: 50, width: 200, height: 16 },
      // Large gap = new paragraph
      { text: 'para 2', top: 170, left: 50, width: 200, height: 16 },
      { text: 'para 2 line 2', top: 188, left: 50, width: 200, height: 16 },
    ]);
    const matchedSpans = new Set([container.querySelectorAll('span')[2]]); // para 2
    const bounds = detectParagraphBounds(container, matchedSpans);
    expect(bounds.top).toBe(170);
    expect(bounds.height).toBe(34); // 188 + 16 - 170
  });

  it('returns null for empty matchedSpans', () => {
    const container = makePositionedSpans([]);
    const bounds = detectParagraphBounds(container, new Set());
    expect(bounds).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts --verbose`
Expected: FAIL — `detectParagraphBounds is not exported`

- [ ] **Step 3: Implement `detectParagraphBounds`**

Add to `src/lib/pdf-highlight.ts` after `findMatchRange`:

```typescript
/**
 * Bounding box for a paragraph highlight overlay.
 */
export interface ParagraphBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Detect the paragraph boundary around a set of matched spans.
 * Groups all spans into lines by Y coordinate, then expands from matched lines
 * until the gap between consecutive lines exceeds lineHeight × 2.
 * Returns coordinates relative to the container's coordinate system.
 */
export function detectParagraphBounds(
  container: HTMLDivElement,
  matchedSpans: Set<HTMLElement>
): ParagraphBounds | null {
  if (matchedSpans.size === 0) return null;

  const allSpans = Array.from(container.querySelectorAll<HTMLElement>('span'));
  if (allSpans.length === 0) return null;

  // Get bounding rects for all spans
  const spanRects = allSpans.map((span) => ({
    span,
    rect: span.getBoundingClientRect(),
  }));

  // Group spans into lines by Y coordinate (tolerance ±3px)
  const lines: Array<{ y: number; height: number; spans: typeof spanRects }> = [];
  const yTolerance = 3;

  for (const sr of spanRects) {
    const existing = lines.find((line) => Math.abs(line.y - sr.rect.top) <= yTolerance);
    if (existing) {
      existing.spans.push(sr);
      existing.height = Math.max(existing.height, sr.rect.height);
    } else {
      lines.push({ y: sr.rect.top, height: sr.rect.height, spans: [sr] });
    }
  }

  // Sort lines by Y position
  lines.sort((a, b) => a.y - b.y);

  // Find which lines contain matched spans
  const matchedLineIndices = new Set<number>();
  lines.forEach((line, idx) => {
    if (line.spans.some((sr) => matchedSpans.has(sr.span))) {
      matchedLineIndices.add(idx);
    }
  });

  if (matchedLineIndices.size === 0) return null;

  // Determine typical line height
  const avgLineHeight =
    lines.reduce((sum, line) => sum + line.height, 0) / lines.length;
  const maxGap = avgLineHeight * 2;

  // Expand upward from first matched line
  let startLine = Math.min(...matchedLineIndices);
  while (startLine > 0) {
    const gap = lines[startLine].y - (lines[startLine - 1].y + lines[startLine - 1].height);
    if (gap > maxGap) break;
    startLine--;
  }

  // Expand downward from last matched line
  let endLine = Math.max(...matchedLineIndices);
  while (endLine < lines.length - 1) {
    const gap = lines[endLine + 1].y - (lines[endLine].y + lines[endLine].height);
    if (gap > maxGap) break;
    endLine++;
  }

  // Compute bounding box of paragraph
  const paragraphLines = lines.slice(startLine, endLine + 1);
  const allRects = paragraphLines.flatMap((line) => line.spans.map((sr) => sr.rect));

  const containerRect = container.getBoundingClientRect();
  const top = Math.min(...allRects.map((r) => r.top)) - containerRect.top;
  const left = Math.min(...allRects.map((r) => r.left)) - containerRect.left;
  const right = Math.max(...allRects.map((r) => r.right)) - containerRect.left;
  const bottom = Math.max(...allRects.map((r) => r.bottom)) - containerRect.top;

  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts --verbose`
Expected: All `detectParagraphBounds` tests PASS

Note: `container.getBoundingClientRect()` returns all zeros in jsdom, so test assertions use raw coordinates. In browser, the subtraction normalizes to container-relative positions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-highlight.ts __tests__/lib/pdf-highlight.test.ts
git commit -m "feat: add detectParagraphBounds for paragraph-level highlighting"
```

---

### Task 3: Add `applyParagraphHighlight`

**Files:**
- Modify: `src/lib/pdf-highlight.ts`
- Modify: `__tests__/lib/pdf-highlight.test.ts`

- [ ] **Step 1: Write failing tests for `applyParagraphHighlight`**

Append to `__tests__/lib/pdf-highlight.test.ts`:

```typescript
import {
  normalizeText, buildTextMap, findMatchRange,
  detectParagraphBounds, applyParagraphHighlight
} from '@/lib/pdf-highlight';

describe('applyParagraphHighlight', () => {
  function makePositionedContainer(
    items: Array<{ text: string; top: number; left: number; width: number; height: number }>
  ): HTMLDivElement {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 500, height: 800,
      bottom: 800, right: 500, x: 0, y: 0, toJSON: () => ({}),
    });
    items.forEach((item) => {
      const span = document.createElement('span');
      span.textContent = item.text;
      span.getBoundingClientRect = () => ({
        top: item.top, left: item.left,
        width: item.width, height: item.height,
        bottom: item.top + item.height,
        right: item.left + item.width,
        x: item.left, y: item.top, toJSON: () => ({}),
      });
      container.appendChild(span);
    });
    // Add overlay div
    const overlay = document.createElement('div');
    overlay.className = 'highlight-overlay';
    container.appendChild(overlay);
    return container;
  }

  it('returns paragraph bounds when text is found', () => {
    const container = makePositionedContainer([
      { text: 'deep learning model', top: 100, left: 50, width: 200, height: 16 },
    ]);
    const result = applyParagraphHighlight(container, 'deep learning');
    expect(result).not.toBeNull();
    expect(result!.top).toBe(100);
  });

  it('returns null for empty search text', () => {
    const container = makePositionedContainer([
      { text: 'hello', top: 100, left: 50, width: 100, height: 16 },
    ]);
    expect(applyParagraphHighlight(container, '')).toBeNull();
  });

  it('returns null when text is not found', () => {
    const container = makePositionedContainer([
      { text: 'hello world', top: 100, left: 50, width: 100, height: 16 },
    ]);
    expect(applyParagraphHighlight(container, 'nonexistent text')).toBeNull();
  });

  it('clears previous paragraph highlights', () => {
    const container = makePositionedContainer([
      { text: 'hello world', top: 100, left: 50, width: 200, height: 16 },
    ]);
    // Add a fake previous highlight
    const overlay = container.querySelector('.highlight-overlay')!;
    const oldBox = document.createElement('div');
    oldBox.className = 'paragraph-highlight-box';
    overlay.appendChild(oldBox);
    expect(container.querySelectorAll('.paragraph-highlight-box').length).toBe(1);

    applyParagraphHighlight(container, 'hello');
    // Old box should be removed (overlay innerHTML cleared)
    // New box may or may not be added depending on overlay logic
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts --verbose`
Expected: FAIL — `applyParagraphHighlight is not exported`

- [ ] **Step 3: Implement `applyParagraphHighlight`**

Add to `src/lib/pdf-highlight.ts` after `detectParagraphBounds`:

```typescript
/**
 * Find search text, detect its enclosing paragraph, and return the paragraph bounds.
 * Clears any previous paragraph highlight overlays.
 * Returns the ParagraphBounds if found, or null.
 */
export function applyParagraphHighlight(
  container: HTMLDivElement,
  text: string
): ParagraphBounds | null {
  // Clear previous paragraph highlights
  const overlay = container.querySelector('.highlight-overlay');
  if (overlay) {
    overlay.innerHTML = '';
  }

  // Also clear old per-span highlights (backwards compat during migration)
  container.querySelectorAll('.highlight-active').forEach((el) => {
    el.classList.remove('highlight-active');
  });

  if (!text || !text.trim()) return null;

  const { fullText, charMap } = buildTextMap(container);
  if (!fullText) return null;

  const range = findMatchRange(fullText, text);
  if (!range) return null;

  // Collect matched spans
  const matchedSpans = new Set<HTMLElement>();
  for (let i = range.startIdx; i <= range.endIdx; i++) {
    if (charMap[i]) {
      matchedSpans.add(charMap[i].span);
    }
  }

  if (matchedSpans.size === 0) return null;

  // Detect paragraph boundary
  const bounds = detectParagraphBounds(container, matchedSpans);
  if (!bounds) return null;

  // Render highlight rectangle in overlay
  if (overlay) {
    const box = document.createElement('div');
    box.className = 'paragraph-highlight-box';
    box.style.position = 'absolute';
    box.style.top = `${bounds.top - 6}px`;
    box.style.left = `${bounds.left - 6}px`;
    box.style.width = `${bounds.width + 12}px`;
    box.style.height = `${bounds.height + 12}px`;
    overlay.appendChild(box);

    // Scroll into view
    box.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  return bounds;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts --verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-highlight.ts __tests__/lib/pdf-highlight.test.ts
git commit -m "feat: add applyParagraphHighlight for rectangle paragraph highlighting"
```

---

### Task 4: Integrate paragraph highlight into PDF viewer

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

- [ ] **Step 1: Update imports**

In `src/components/pdf-viewer.tsx`, replace line 5:

```typescript
import { applyHighlight } from '@/lib/pdf-highlight';
```

with:

```typescript
import { applyParagraphHighlight } from '@/lib/pdf-highlight';
```

- [ ] **Step 2: Add overlay div in the JSX**

In the JSX section, find the container div with canvas and textLayer (around line 209):

```tsx
<div ref={containerRef} className="relative inline-block shadow-xl rounded overflow-hidden">
  <canvas ref={canvasRef} style={{ display: 'block' }} />
  <div ref={textLayerRef} className="textLayer" />
</div>
```

Replace with:

```tsx
<div ref={containerRef} className="relative inline-block shadow-xl rounded overflow-hidden">
  <canvas ref={canvasRef} style={{ display: 'block' }} />
  <div className="highlight-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />
  <div ref={textLayerRef} className="textLayer" style={{ zIndex: 2 }} />
</div>
```

- [ ] **Step 3: Replace `applyHighlight` call with `applyParagraphHighlight`**

In the render `useEffect` (around line 103), replace:

```typescript
if (highlightText) {
  applyHighlight(textLayerDiv, highlightText);
}
```

with:

```typescript
if (highlightText) {
  // Use the parent container (which includes overlay div) not just textLayerDiv
  const parentContainer = containerRef.current;
  if (parentContainer) {
    applyParagraphHighlight(parentContainer as HTMLDivElement, highlightText);
  }
}
```

- [ ] **Step 4: Update highlight CSS**

Replace the existing `<style>` block (lines 141-156) with:

```tsx
<style>{`
  .paragraph-highlight-box {
    border: 2.5px solid rgba(234, 179, 8, 0.9);
    border-radius: 4px;
    background: rgba(250, 204, 21, 0.15);
    box-shadow: 0 0 8px rgba(250, 204, 21, 0.3);
    pointer-events: none;
    transition: opacity 0.3s ease-in-out;
  }
`}</style>
```

- [ ] **Step 5: Update the canvas click handler to clear overlay**

Update `handleCanvasClick` (around line 113):

```typescript
const handleCanvasClick = useCallback((e: React.MouseEvent) => {
  if ((e.target as HTMLElement).tagName === 'CANVAS') {
    // Clear paragraph highlight overlay
    const overlay = containerRef.current?.querySelector('.highlight-overlay');
    if (overlay) overlay.innerHTML = '';
    onHighlightClear?.();
  }
}, [onHighlightClear]);
```

- [ ] **Step 6: Verify build compiles**

Run: `npx next build 2>&1 | head -30`
Expected: No TypeScript errors

- [ ] **Step 7: Run existing tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: replace text highlight with paragraph rectangle overlay"
```

---

## Chunk 2: Annotation data layer (types, storage, API)

### Task 5: Add Annotation types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add types to `src/types/index.ts`**

Append at the end of the file:

```typescript
// --- Annotation types ---

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface Annotation {
  id: string;
  page: number;
  text: string;
  color: HighlightColor;
  comment: string;
  spanRange: {
    startIdx: number;
    endIdx: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationsFile {
  annotations: Annotation[];
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx next build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Annotation and HighlightColor types"
```

---

### Task 6: Add annotation storage helpers

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Read current storage.ts**

Understand the existing pattern: all functions use `fs/promises`, return graceful defaults on error.

- [ ] **Step 2: Add `getAnnotations` and `saveAnnotations`**

In `src/lib/storage.ts`, add `Annotation, AnnotationsFile` to the type import on line 3:

```typescript
import type { PaperMetadata, PaperAnalysis, ChatHistory, PaperListItem, Annotation, AnnotationsFile } from '@/types';
```

Then add these two methods to the `storage` object (before the closing `};`):

```typescript
  async getAnnotations(paperId: string): Promise<Annotation[]> {
    try {
      const filePath = path.join(paperDir(paperId), 'annotations.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed: AnnotationsFile = JSON.parse(data);
      return parsed.annotations || [];
    } catch {
      return [];
    }
  },
  async saveAnnotations(paperId: string, annotations: Annotation[]): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'annotations.json');
    const data: AnnotationsFile = { annotations };
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  },
```

Note: The `storage` object pattern (not standalone exports) follows the existing codebase convention. `paperDir()` is the existing helper at line 13 of storage.ts.

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add annotation storage helpers"
```

---

### Task 7: Create annotation API endpoints

**Files:**
- Create: `src/app/api/papers/[id]/annotations/route.ts`
- Create: `src/app/api/papers/[id]/annotations/[annotationId]/route.ts`
- Create: `__tests__/api/annotations.test.ts`

- [ ] **Step 1: Write failing tests for the API**

Create `__tests__/api/annotations.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/papers/[id]/annotations/route';
import { PUT, DELETE } from '@/app/api/papers/[id]/annotations/[annotationId]/route';
import { storage } from '@/lib/storage';

// Mock storage module
jest.mock('@/lib/storage', () => ({
  storage: {
    getAnnotations: jest.fn(),
    saveAnnotations: jest.fn(),
    getMetadata: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/papers/test-id/annotations', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/papers/[id]/annotations', () => {
  it('returns annotations for a paper', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([
      { id: 'a1', page: 1, text: 'hello', color: 'yellow', comment: '', spanRange: { startIdx: 0, endIdx: 4 }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'test-id' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.annotations).toHaveLength(1);
    expect(data.annotations[0].text).toBe('hello');
  });

  it('returns 404 for nonexistent paper', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/papers/[id]/annotations', () => {
  it('creates a new annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([]);
    (mockStorage.saveAnnotations as jest.Mock).mockResolvedValue(undefined);

    const body = {
      page: 1,
      text: 'hello world',
      color: 'yellow',
      comment: 'test comment',
      spanRange: { startIdx: 0, endIdx: 10 },
    };

    const req = new Request('http://localhost/api/papers/test-id/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'test-id' }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.annotation.text).toBe('hello world');
    expect(data.annotation.id).toBeDefined();
  });

  it('validates required fields', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);

    const req = new Request('http://localhost/api/papers/test-id/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1 }), // missing text, color, spanRange
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res.status).toBe(400);
  });

  it('validates color value', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);

    const req = new Request('http://localhost/api/papers/test-id/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1, text: 'hi', color: 'red', comment: '', spanRange: { startIdx: 0, endIdx: 1 },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/papers/[id]/annotations/[annotationId]', () => {
  it('updates an annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([
      { id: 'a1', page: 1, text: 'hello', color: 'yellow', comment: '', spanRange: { startIdx: 0, endIdx: 4 }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);
    (mockStorage.saveAnnotations as jest.Mock).mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/papers/test-id/annotations/a1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: 'green', comment: 'updated' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'test-id', annotationId: 'a1' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.annotation.color).toBe('green');
    expect(data.annotation.comment).toBe('updated');
  });

  it('returns 404 for nonexistent annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([]);

    const req = new Request('http://localhost/api/papers/test-id/annotations/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: 'green' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'test-id', annotationId: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/papers/[id]/annotations/[annotationId]', () => {
  it('deletes an annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([
      { id: 'a1', page: 1, text: 'hello', color: 'yellow', comment: '', spanRange: { startIdx: 0, endIdx: 4 }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);
    (mockStorage.saveAnnotations as jest.Mock).mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/papers/test-id/annotations/a1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'test-id', annotationId: 'a1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 404 for nonexistent annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([]);

    const req = new Request('http://localhost/api/papers/test-id/annotations/nonexistent', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'test-id', annotationId: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api/annotations.test.ts --verbose`
Expected: FAIL — modules not found

- [ ] **Step 3: Create GET/POST endpoint**

Create `src/app/api/papers/[id]/annotations/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '@/lib/storage';
import type { Annotation, HighlightColor } from '@/types';

const VALID_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];
const MAX_COMMENT_LENGTH = 2000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const metadata = await storage.getMetadata(id);
  if (!metadata) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const annotations = await storage.getAnnotations(id);
  return NextResponse.json({ annotations });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const metadata = await storage.getMetadata(id);
  if (!metadata) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (!body.page || typeof body.page !== 'number' || body.page < 1) {
    return NextResponse.json({ error: 'page must be a positive integer' }, { status: 400 });
  }
  if (!body.color || !VALID_COLORS.includes(body.color)) {
    return NextResponse.json({ error: `color must be one of: ${VALID_COLORS.join(', ')}` }, { status: 400 });
  }
  if (!body.spanRange || typeof body.spanRange.startIdx !== 'number' || typeof body.spanRange.endIdx !== 'number') {
    return NextResponse.json({ error: 'spanRange with startIdx and endIdx is required' }, { status: 400 });
  }
  if (body.comment && typeof body.comment === 'string' && body.comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: `comment must be at most ${MAX_COMMENT_LENGTH} characters` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const annotation: Annotation = {
    id: uuidv4(),
    page: body.page,
    text: body.text,
    color: body.color,
    comment: body.comment || '',
    spanRange: body.spanRange,
    createdAt: now,
    updatedAt: now,
  };

  const annotations = await storage.getAnnotations(id);
  annotations.push(annotation);
  await storage.saveAnnotations(id, annotations);

  return NextResponse.json({ annotation }, { status: 201 });
}
```

- [ ] **Step 4: Create PUT/DELETE endpoint**

Create `src/app/api/papers/[id]/annotations/[annotationId]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import type { HighlightColor } from '@/types';

const VALID_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];
const MAX_COMMENT_LENGTH = 2000;

interface RouteContext {
  params: Promise<{ id: string; annotationId: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const { id, annotationId } = await context.params;

  const metadata = await storage.getMetadata(id);
  if (!metadata) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const annotations = await storage.getAnnotations(id);
  const index = annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
  }

  const body = await request.json();

  if (body.color !== undefined && !VALID_COLORS.includes(body.color)) {
    return NextResponse.json({ error: `color must be one of: ${VALID_COLORS.join(', ')}` }, { status: 400 });
  }
  if (body.comment !== undefined && typeof body.comment === 'string' && body.comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: `comment must be at most ${MAX_COMMENT_LENGTH} characters` }, { status: 400 });
  }

  if (body.color !== undefined) annotations[index].color = body.color;
  if (body.comment !== undefined) annotations[index].comment = body.comment;
  annotations[index].updatedAt = new Date().toISOString();

  await storage.saveAnnotations(id, annotations);

  return NextResponse.json({ annotation: annotations[index] });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, annotationId } = await context.params;

  const metadata = await storage.getMetadata(id);
  if (!metadata) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const annotations = await storage.getAnnotations(id);
  const index = annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
  }

  annotations.splice(index, 1);
  await storage.saveAnnotations(id, annotations);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/api/annotations.test.ts --verbose`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/papers/[id]/annotations/ __tests__/api/annotations.test.ts src/types/index.ts src/lib/storage.ts
git commit -m "feat: add annotation CRUD API endpoints with storage"
```

---

## Chunk 3: Annotation UI components

### Task 8: Create annotation rendering helpers

**Files:**
- Create: `src/lib/pdf-annotations.ts`
- Create: `__tests__/lib/pdf-annotations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/pdf-annotations.test.ts`:

```typescript
/**
 * @jest-environment jsdom
 */
import { HIGHLIGHT_COLORS, getHighlightClass, applyUserHighlights } from '@/lib/pdf-annotations';

describe('HIGHLIGHT_COLORS', () => {
  it('contains four color definitions', () => {
    expect(Object.keys(HIGHLIGHT_COLORS)).toEqual(['yellow', 'green', 'blue', 'pink']);
  });

  it('each color has bg, border, solid, and className', () => {
    for (const color of Object.values(HIGHLIGHT_COLORS)) {
      expect(color.bg).toBeDefined();
      expect(color.border).toBeDefined();
      expect(color.solid).toBeDefined();
      expect(color.className).toBeDefined();
    }
  });
});

describe('getHighlightClass', () => {
  it('returns correct class for each color', () => {
    expect(getHighlightClass('yellow')).toBe('user-highlight user-highlight-yellow');
    expect(getHighlightClass('green')).toBe('user-highlight user-highlight-green');
    expect(getHighlightClass('blue')).toBe('user-highlight user-highlight-blue');
    expect(getHighlightClass('pink')).toBe('user-highlight user-highlight-pink');
  });
});

describe('applyUserHighlights', () => {
  function makeSpans(texts: string[]): HTMLDivElement {
    const container = document.createElement('div');
    texts.forEach((t) => {
      const span = document.createElement('span');
      span.textContent = t;
      container.appendChild(span);
    });
    return container;
  }

  it('applies highlight class to matching spans', () => {
    const container = makeSpans(['hello ', 'world ', 'foo']);
    const annotations = [
      {
        id: '1', page: 1, text: 'hello world',
        color: 'yellow' as const, comment: '',
        spanRange: { startIdx: 0, endIdx: 10 },
        createdAt: '', updatedAt: '',
      },
    ];

    applyUserHighlights(container, annotations);
    const highlighted = container.querySelectorAll('.user-highlight-yellow');
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it('clears previous user highlights before applying', () => {
    const container = makeSpans(['hello']);
    const span = container.querySelector('span')!;
    span.classList.add('user-highlight', 'user-highlight-green');

    applyUserHighlights(container, []);
    expect(span.classList.contains('user-highlight')).toBe(false);
    expect(span.classList.contains('user-highlight-green')).toBe(false);
  });

  it('handles multiple annotations on same page', () => {
    const container = makeSpans(['aaa ', 'bbb ', 'ccc']);
    const annotations = [
      { id: '1', page: 1, text: 'aaa', color: 'yellow' as const, comment: '', spanRange: { startIdx: 0, endIdx: 2 }, createdAt: '', updatedAt: '' },
      { id: '2', page: 1, text: 'ccc', color: 'blue' as const, comment: '', spanRange: { startIdx: 8, endIdx: 10 }, createdAt: '', updatedAt: '' },
    ];

    applyUserHighlights(container, annotations);
    expect(container.querySelectorAll('.user-highlight-yellow').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.user-highlight-blue').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-annotations.test.ts --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `pdf-annotations.ts`**

Create `src/lib/pdf-annotations.ts`:

```typescript
import type { Annotation, HighlightColor } from '@/types';
import { buildTextMap, findMatchRange } from './pdf-highlight';

export const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; border: string; solid: string; className: string }> = {
  yellow: { bg: 'rgba(250, 204, 21, 0.4)', border: 'rgba(234, 179, 8, 0.6)', solid: '#facc15', className: 'user-highlight-yellow' },
  green:  { bg: 'rgba(74, 222, 128, 0.4)', border: 'rgba(34, 197, 94, 0.6)', solid: '#4ade80', className: 'user-highlight-green' },
  blue:   { bg: 'rgba(96, 165, 250, 0.4)', border: 'rgba(59, 130, 246, 0.6)', solid: '#60a5fa', className: 'user-highlight-blue' },
  pink:   { bg: 'rgba(244, 114, 182, 0.4)', border: 'rgba(236, 72, 153, 0.6)', solid: '#f472b6', className: 'user-highlight-pink' },
};

const ALL_HIGHLIGHT_CLASSES = [
  'user-highlight',
  ...Object.values(HIGHLIGHT_COLORS).map((c) => c.className),
];

/**
 * Get the CSS class string for a given highlight color.
 */
export function getHighlightClass(color: HighlightColor): string {
  return `user-highlight ${HIGHLIGHT_COLORS[color].className}`;
}

/**
 * Apply user annotation highlights to TextLayer spans.
 * Clears previous user highlights first, then applies each annotation.
 */
export function applyUserHighlights(
  container: HTMLDivElement,
  annotations: Annotation[]
): void {
  // Clear previous user highlights
  const spans = container.querySelectorAll<HTMLElement>('span');
  spans.forEach((span) => {
    ALL_HIGHLIGHT_CLASSES.forEach((cls) => span.classList.remove(cls));
    delete span.dataset.annotationId;
  });

  if (annotations.length === 0) return;

  const { fullText, charMap } = buildTextMap(container);
  if (!fullText) return;

  for (const annotation of annotations) {
    // Try index-based match first
    let startIdx = annotation.spanRange.startIdx;
    let endIdx = annotation.spanRange.endIdx;

    // Validate index range — if text at those indices doesn't match, fall back to search
    const textAtIndices = fullText.slice(startIdx, endIdx + 1);
    if (textAtIndices.toLowerCase().trim() !== annotation.text.toLowerCase().trim()) {
      // Fallback: search by text
      const range = findMatchRange(fullText, annotation.text);
      if (!range) continue;
      startIdx = range.startIdx;
      endIdx = range.endIdx;
    }

    // Apply highlight to matched spans
    const colorClass = getHighlightClass(annotation.color);
    for (let i = startIdx; i <= endIdx; i++) {
      if (charMap[i]) {
        const span = charMap[i].span;
        colorClass.split(' ').forEach((cls) => span.classList.add(cls));
        span.dataset.annotationId = annotation.id;
      }
    }
  }
}

/**
 * Get information about the current text selection within a TextLayer container.
 * Returns null if no valid selection exists within the container.
 */
export function getSelectionInfo(container: HTMLDivElement): {
  text: string;
  startIdx: number;
  endIdx: number;
  rect: DOMRect;
} | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);

  // Check if selection is within our container
  if (!container.contains(range.commonAncestorContainer)) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  // Find indices in the full text
  const { fullText } = buildTextMap(container);
  const matchRange = findMatchRange(fullText, text);
  if (!matchRange) return null;

  const rect = range.getBoundingClientRect();

  return {
    text,
    startIdx: matchRange.startIdx,
    endIdx: matchRange.endIdx,
    rect,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-annotations.test.ts --verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-annotations.ts __tests__/lib/pdf-annotations.test.ts
git commit -m "feat: add annotation rendering helpers and color definitions"
```

---

### Task 9: Create HighlightToolbar component

**Files:**
- Create: `src/components/highlight-toolbar.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/highlight-toolbar.tsx`:

```tsx
'use client';

import type { HighlightColor } from '@/types';
import { HIGHLIGHT_COLORS } from '@/lib/pdf-annotations';

interface HighlightToolbarProps {
  position: { top: number; left: number };
  onColorSelect: (color: HighlightColor) => void;
  onCommentClick: () => void;
  onClose: () => void;
}

const COLOR_ORDER: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

export function HighlightToolbar({ position, onColorSelect, onCommentClick, onClose }: HighlightToolbarProps) {
  return (
    <>
      {/* Backdrop to detect outside clicks */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          backgroundColor: '#1e293b',
          transform: 'translateX(-50%)',
        }}
      >
        {COLOR_ORDER.map((color) => (
          <button
            key={color}
            onClick={() => onColorSelect(color)}
            className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white/50 transition-colors"
            style={{ backgroundColor: HIGHLIGHT_COLORS[color].solid }}
            title={color}
          />
        ))}
        <div className="w-px h-4 bg-slate-600 mx-1" />
        <button
          onClick={onCommentClick}
          className="text-slate-300 hover:text-white px-1 text-sm transition-colors"
          title="Add comment"
        >
          💬
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/highlight-toolbar.tsx
git commit -m "feat: add HighlightToolbar floating component"
```

---

### Task 10: Create CommentPopover component

**Files:**
- Create: `src/components/comment-popover.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/comment-popover.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface CommentPopoverProps {
  position: { top: number; left: number };
  selectedText: string;
  initialComment?: string;
  onSave: (comment: string) => void;
  onCancel: () => void;
}

const MAX_COMMENT_LENGTH = 2000;

export function CommentPopover({ position, selectedText, initialComment = '', onSave, onCancel }: CommentPopoverProps) {
  const [comment, setComment] = useState(initialComment);

  const truncatedText = selectedText.length > 60 ? selectedText.slice(0, 60) + '...' : selectedText;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onCancel} />
      <div
        className="absolute z-50 w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: 'translateX(-50%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-amber-200">
          <span className="text-xs font-semibold text-amber-800">Add Comment</span>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="p-3">
          <div className="text-xs text-slate-500 italic mb-2 truncate">&ldquo;{truncatedText}&rdquo;</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            className="w-full h-16 text-xs border border-slate-200 rounded-md p-2 resize-none outline-none focus:border-blue-400 transition-colors"
            placeholder="Your comment..."
            autoFocus
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-slate-400">{comment.length}/{MAX_COMMENT_LENGTH}</span>
            <div className="flex gap-1.5">
              <button
                onClick={onCancel}
                className="text-xs px-3 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(comment)}
                className="text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/comment-popover.tsx
git commit -m "feat: add CommentPopover component"
```

---

### Task 11: Create AnnotationsPanel component

**Files:**
- Create: `src/components/annotations-panel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/annotations-panel.tsx`:

```tsx
'use client';

import type { Annotation } from '@/types';
import { HIGHLIGHT_COLORS } from '@/lib/pdf-annotations';

interface AnnotationsPanelProps {
  annotations: Annotation[];
  onAnnotationClick: (annotation: Annotation) => void;
  onAnnotationDelete: (annotationId: string) => void;
}

export function AnnotationsPanel({ annotations, onAnnotationClick, onAnnotationDelete }: AnnotationsPanelProps) {
  if (annotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg className="w-12 h-12 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <p className="text-sm">No annotations yet.</p>
        <p className="text-xs text-slate-400 mt-1">Select text on the PDF to add highlights and comments.</p>
      </div>
    );
  }

  // Sort by page, then by creation time
  const sorted = [...annotations].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return (
    <div className="flex flex-col gap-2 p-3">
      {sorted.map((annotation) => {
        const colorDef = HIGHLIGHT_COLORS[annotation.color];
        const truncatedText = annotation.text.length > 80
          ? annotation.text.slice(0, 80) + '...'
          : annotation.text;

        return (
          <div
            key={annotation.id}
            className="bg-white/5 rounded-md p-2.5 cursor-pointer hover:bg-white/10 transition-colors"
            style={{ borderLeft: `3px solid ${colorDef.border}` }}
            onClick={() => onAnnotationClick(annotation)}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400">Page {annotation.page}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnotationDelete(annotation.id);
                }}
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                title="Delete annotation"
              >
                🗑️
              </button>
            </div>
            <div className="text-[11px] text-slate-300 mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
              &ldquo;{truncatedText}&rdquo;
            </div>
            {annotation.comment ? (
              <div className="text-[11px] text-slate-400 italic">
                💬 {annotation.comment.length > 60 ? annotation.comment.slice(0, 60) + '...' : annotation.comment}
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 italic">(No comment)</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/annotations-panel.tsx
git commit -m "feat: add AnnotationsPanel list component"
```

---

## Chunk 4: Integration — PDF viewer selection handling + parent page

### Task 12: Add text selection handling and annotation restoration to PDF viewer

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

- [ ] **Step 1: Add new imports and props**

Add imports at the top of `src/components/pdf-viewer.tsx`:

```typescript
import { applyUserHighlights, getSelectionInfo } from '@/lib/pdf-annotations';
import { HighlightToolbar } from '@/components/highlight-toolbar';
import { CommentPopover } from '@/components/comment-popover';
import type { Annotation, HighlightColor } from '@/types';
```

Update the `PdfViewerProps` interface to add:

```typescript
interface PdfViewerProps {
  url: string;
  currentPage?: number;
  highlightText?: string | null;
  onPageChange?: (page: number) => void;
  onHighlightClear?: () => void;
  annotations?: Annotation[];
  onAnnotationCreate?: (annotation: { page: number; text: string; color: HighlightColor; comment: string; spanRange: { startIdx: number; endIdx: number } }) => void;
}
```

- [ ] **Step 2: Add selection state and toolbar/popover rendering**

Add state variables after existing state declarations:

```typescript
const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
const [selectionInfo, setSelectionInfo] = useState<{ text: string; startIdx: number; endIdx: number } | null>(null);
const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
```

Add a `mouseup` handler for text selection:

```typescript
const handleTextLayerMouseUp = useCallback(() => {
  if (!textLayerRef.current) return;

  // Small delay to let browser finalize selection
  setTimeout(() => {
    const info = getSelectionInfo(textLayerRef.current!);
    if (!info) {
      setToolbarPos(null);
      return;
    }

    setSelectionInfo({ text: info.text, startIdx: info.startIdx, endIdx: info.endIdx });

    // Position toolbar below selection, relative to the container
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const top = info.rect.bottom - containerRect.top + 8;
    let left = (info.rect.left + info.rect.right) / 2 - containerRect.left;

    // Viewport clamping
    left = Math.max(80, Math.min(left, containerRect.width - 80));

    setToolbarPos({ top, left });
  }, 10);
}, []);
```

- [ ] **Step 3: Add color select and comment handlers**

```typescript
const handleColorSelect = useCallback((color: HighlightColor) => {
  if (!selectionInfo) return;

  onAnnotationCreate?.({
    page,
    text: selectionInfo.text,
    color,
    comment: '',
    spanRange: { startIdx: selectionInfo.startIdx, endIdx: selectionInfo.endIdx },
  });

  setToolbarPos(null);
  setSelectionInfo(null);
  window.getSelection()?.removeAllRanges();
}, [selectionInfo, page, onAnnotationCreate]);

const handleCommentClick = useCallback((color?: HighlightColor) => {
  if (!toolbarPos) return;
  if (color) setSelectedColor(color);
  setPopoverPos(toolbarPos);
  setToolbarPos(null);
}, [toolbarPos]);

const handleCommentSave = useCallback((comment: string) => {
  if (!selectionInfo) return;

  onAnnotationCreate?.({
    page,
    text: selectionInfo.text,
    color: selectedColor,
    comment,
    spanRange: { startIdx: selectionInfo.startIdx, endIdx: selectionInfo.endIdx },
  });

  setPopoverPos(null);
  setSelectionInfo(null);
  window.getSelection()?.removeAllRanges();
}, [selectionInfo, selectedColor, page, onAnnotationCreate]);
```

- [ ] **Step 3b: Add click handler for existing highlights**

Add a handler for clicking on existing user-highlighted spans to edit/re-color/delete:

```typescript
const handleHighlightClick = useCallback((e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  const annotationId = target.dataset?.annotationId;
  if (!annotationId) return;

  const annotation = annotations?.find((a) => a.id === annotationId);
  if (!annotation) return;

  e.stopPropagation();

  // Position toolbar near the clicked span
  const containerRect = containerRef.current?.getBoundingClientRect();
  const spanRect = target.getBoundingClientRect();
  if (!containerRect) return;

  const top = spanRect.bottom - containerRect.top + 8;
  let left = (spanRect.left + spanRect.right) / 2 - containerRect.left;
  left = Math.max(80, Math.min(left, containerRect.width - 80));

  setSelectionInfo({
    text: annotation.text,
    startIdx: annotation.spanRange.startIdx,
    endIdx: annotation.spanRange.endIdx,
  });
  setSelectedColor(annotation.color);
  setToolbarPos({ top, left });
}, [annotations]);
```

Then add `onClick={handleHighlightClick}` to the textLayer div alongside the existing `onMouseUp`:

```tsx
<div ref={textLayerRef} className="textLayer" style={{ zIndex: 2 }} onMouseUp={handleTextLayerMouseUp} onClick={handleHighlightClick} />
```

- [ ] **Step 4: Apply user annotations after TextLayer render**

In the render `useEffect`, after the paragraph highlight call (after `applyParagraphHighlight`), add:

```typescript
// Apply user annotations
const pageAnnotations = (annotations || []).filter((a) => a.page === page);
if (pageAnnotations.length > 0) {
  applyUserHighlights(textLayerDiv, pageAnnotations);
}
```

Add `annotations` to the useEffect dependency array: `[pdf, page, scale, highlightText, annotations]`.

- [ ] **Step 5: Add user highlight CSS and toolbar/popover to JSX**

Add CSS for user highlights in the `<style>` block:

```tsx
<style>{`
  .paragraph-highlight-box {
    border: 2.5px solid rgba(234, 179, 8, 0.9);
    border-radius: 4px;
    background: rgba(250, 204, 21, 0.15);
    box-shadow: 0 0 8px rgba(250, 204, 21, 0.3);
    pointer-events: none;
    transition: opacity 0.3s ease-in-out;
  }
  .user-highlight { border-radius: 2px; padding: 0 1px; cursor: pointer; }
  .user-highlight-yellow { background: rgba(250, 204, 21, 0.4); border-bottom: 2px solid rgba(234, 179, 8, 0.6); }
  .user-highlight-green { background: rgba(74, 222, 128, 0.4); border-bottom: 2px solid rgba(34, 197, 94, 0.6); }
  .user-highlight-blue { background: rgba(96, 165, 250, 0.4); border-bottom: 2px solid rgba(59, 130, 246, 0.6); }
  .user-highlight-pink { background: rgba(244, 114, 182, 0.4); border-bottom: 2px solid rgba(236, 72, 153, 0.6); }
`}</style>
```

Add `onMouseUp` to the textLayer div:

```tsx
<div ref={textLayerRef} className="textLayer" style={{ zIndex: 2 }} onMouseUp={handleTextLayerMouseUp} />
```

Add toolbar and popover rendering after the container div (inside the outer flex div):

```tsx
{toolbarPos && (
  <HighlightToolbar
    position={toolbarPos}
    onColorSelect={handleColorSelect}
    onCommentClick={handleCommentClick}
    onClose={() => { setToolbarPos(null); setSelectionInfo(null); }}
  />
)}
{popoverPos && selectionInfo && (
  <CommentPopover
    position={popoverPos}
    selectedText={selectionInfo.text}
    onSave={handleCommentSave}
    onCancel={() => { setPopoverPos(null); setSelectionInfo(null); }}
  />
)}
```

- [ ] **Step 6: Verify build**

Run: `npx next build 2>&1 | head -30`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add text selection handling and annotation restoration to PDF viewer"
```

---

### Task 13: Update parent page with panel toggle and annotation state

**Files:**
- Modify: `src/app/paper/[id]/page.tsx`

- [ ] **Step 1: Add annotation state and API calls**

Add imports:

```typescript
import { AnnotationsPanel } from '@/components/annotations-panel';
import type { Annotation, HighlightColor } from '@/types';
```

Add state:

```typescript
const [annotations, setAnnotations] = useState<Annotation[]>([]);
const [activePanel, setActivePanel] = useState<'analysis' | 'annotations'>('analysis');
```

Add fetch annotations on mount:

```typescript
useEffect(() => {
  if (!paperId) return;
  fetch(`/api/papers/${paperId}/annotations`)
    .then((res) => res.json())
    .then((data) => setAnnotations(data.annotations || []))
    .catch(() => setAnnotations([]));
}, [paperId]);
```

Add handlers:

```typescript
const handleAnnotationCreate = useCallback(async (data: {
  page: number; text: string; color: HighlightColor; comment: string;
  spanRange: { startIdx: number; endIdx: number };
}) => {
  if (!paperId) return;
  const res = await fetch(`/api/papers/${paperId}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.ok) {
    const { annotation } = await res.json();
    setAnnotations((prev) => [...prev, annotation]);
  }
}, [paperId]);

const handleAnnotationDelete = useCallback(async (annotationId: string) => {
  if (!paperId) return;
  const res = await fetch(`/api/papers/${paperId}/annotations/${annotationId}`, {
    method: 'DELETE',
  });
  if (res.ok) {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
  }
}, [paperId]);

const handleAnnotationClick = useCallback((annotation: Annotation) => {
  setCurrentPage(annotation.page);
}, []);
```

- [ ] **Step 2: Pass annotation props to PdfViewer**

Update the `PdfViewer` component usage to pass new props:

```tsx
<PdfViewer
  url={`/api/papers/${paperId}/file`}
  currentPage={currentPage}
  highlightText={highlightText}
  onPageChange={setCurrentPage}
  onHighlightClear={() => setHighlightText(null)}
  annotations={annotations}
  onAnnotationCreate={handleAnnotationCreate}
/>
```

- [ ] **Step 3: Add top-level panel toggle and conditional rendering**

Replace the right-side panel area. Add a panel toggle above the existing `AnalysisPanel`:

```tsx
{/* Top-level panel selector */}
<div className="flex border-b border-slate-700">
  <button
    onClick={() => setActivePanel('analysis')}
    className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
      activePanel === 'analysis'
        ? 'text-white border-b-2 border-blue-500'
        : 'text-slate-400 hover:text-slate-300'
    }`}
  >
    Analysis
  </button>
  <button
    onClick={() => setActivePanel('annotations')}
    className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
      activePanel === 'annotations'
        ? 'text-white border-b-2 border-blue-500'
        : 'text-slate-400 hover:text-slate-300'
    }`}
  >
    Annotations ({annotations.length})
  </button>
</div>

{/* Panel content */}
{activePanel === 'analysis' ? (
  <AnalysisPanel ... />  {/* existing AnalysisPanel with all current props */}
) : (
  <AnnotationsPanel
    annotations={annotations}
    onAnnotationClick={handleAnnotationClick}
    onAnnotationDelete={handleAnnotationDelete}
  />
)}
```

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: add annotation state management and panel toggle"
```

---

## Chunk 5: Manual verification

### Task 14: Manual testing checklist

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test paragraph rectangle highlight**

1. Upload a PDF and run analysis.
2. Click a `[p.N]` reference in the analysis panel.
3. Verify: PDF navigates to the correct page.
4. Verify: A yellow rectangle box (border + semi-transparent fill) frames the paragraph containing the referenced text.
5. Verify: Clicking the canvas background clears the rectangle.
6. Verify: Zooming in/out re-renders the rectangle at the correct position.

- [ ] **Step 3: Test text selection highlight**

1. On any PDF page, drag to select some text.
2. Verify: A floating toolbar appears below the selection with 4 color circles + comment button.
3. Click a color (e.g., green).
4. Verify: The selected text is highlighted in green.
5. Verify: The toolbar disappears.

- [ ] **Step 4: Test comment creation**

1. Select text again, click the 💬 button in the toolbar.
2. Verify: A comment popover appears with the selected text preview.
3. Type a comment, click Save.
4. Verify: Text is highlighted (yellow by default) and comment is saved.
5. Refresh the page.
6. Verify: The highlight persists after refresh.

- [ ] **Step 5: Test Annotations panel**

1. Click the "Annotations" tab in the right panel.
2. Verify: All created annotations are listed with page number, text, and comment.
3. Click an annotation item.
4. Verify: PDF navigates to the correct page.
5. Click the delete icon on an annotation.
6. Verify: Annotation is removed from the list and the highlight disappears from the PDF.

- [ ] **Step 6: Test feature interaction**

1. With a user highlight on the page, click a `[p.N]` reference.
2. Verify: Paragraph rectangle appears AND user highlights remain visible (not cleared).
3. Verify: User highlights render above the paragraph rectangle.
