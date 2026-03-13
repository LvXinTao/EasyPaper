# PDF Highlight Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PDF text highlighting so it matches the correct text across span boundaries, and persists through zoom changes.

**Architecture:** Extract pure highlight-matching logic (`normalizeText`, `buildTextMap`, `applyHighlight`) into a standalone utility module (`src/lib/pdf-highlight.ts`) so it can be unit tested without DOM mocking. The React component (`pdf-viewer.tsx`) imports and calls these functions, and its render effect is adjusted to make highlight application non-cancellable.

**Tech Stack:** TypeScript, pdfjs-dist TextLayer DOM, Jest

**Spec:** `docs/superpowers/specs/2026-03-13-pdf-highlight-fix-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/pdf-highlight.ts` | Pure functions: `normalizeText`, `buildTextMap`, `applyHighlight` |
| Create | `__tests__/lib/pdf-highlight.test.ts` | Unit tests for all three functions |
| Modify | `src/components/pdf-viewer.tsx` | Import helpers, remove old `applyHighlight`, fix zoom cancellation |

---

## Chunk 1: Core highlight logic and tests

### Task 1: Write `normalizeText` with tests

**Files:**
- Create: `src/lib/pdf-highlight.ts`
- Create: `__tests__/lib/pdf-highlight.test.ts`

- [ ] **Step 1: Write the failing tests for `normalizeText`**

In `__tests__/lib/pdf-highlight.test.ts`:

```typescript
import { normalizeText } from '@/lib/pdf-highlight';

describe('normalizeText', () => {
  it('collapses consecutive whitespace into single space', () => {
    const result = normalizeText('deep   learning   model');
    expect(result.normalized).toBe('deep learning model');
  });

  it('maps normalized indices back to original positions', () => {
    // "a  b" → "a b"
    // index 0='a' → orig 0, index 1=' ' → orig 1, index 2='b' → orig 3
    const result = normalizeText('a  b');
    expect(result.normalized).toBe('a b');
    expect(result.indexMap).toEqual([0, 1, 3]);
  });

  it('converts to lowercase', () => {
    const result = normalizeText('Deep Learning');
    expect(result.normalized).toBe('deep learning');
  });

  it('trims leading and trailing whitespace', () => {
    const result = normalizeText('  hello world  ');
    expect(result.normalized).toBe('hello world');
  });

  it('handles tabs and newlines as whitespace', () => {
    const result = normalizeText("line1\n\tline2");
    expect(result.normalized).toBe('line1 line2');
  });

  it('works correctly with pre-NFC-normalized input', () => {
    // normalizeText expects NFC input; callers handle NFC normalization
    const precomposed = '\u00e9'; // é (NFC)
    const result = normalizeText(precomposed);
    expect(result.normalized).toBe('\u00e9');
    expect(result.indexMap).toEqual([0]);
  });

  it('returns empty indexMap for empty string', () => {
    const result = normalizeText('');
    expect(result.normalized).toBe('');
    expect(result.indexMap).toEqual([]);
  });

  it('handles whitespace-only string', () => {
    const result = normalizeText('   ');
    expect(result.normalized).toBe('');
    expect(result.indexMap).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts -v`
Expected: FAIL — `Cannot find module '@/lib/pdf-highlight'`

- [ ] **Step 3: Implement `normalizeText`**

Create `src/lib/pdf-highlight.ts`:

```typescript
/**
 * Result of normalizing text for highlight matching.
 * indexMap[i] = position of normalized char i in the original string.
 */
export interface NormalizeResult {
  normalized: string;
  indexMap: number[];
}

/**
 * Normalize text for comparison: lowercase, collapse whitespace, trim.
 * Input MUST already be NFC-normalized (buildTextMap handles this).
 * Returns a mapping from each normalized char index to its position in the input.
 */
export function normalizeText(text: string): NormalizeResult {
  const normalized: string[] = [];
  const indexMap: number[] = [];
  let prevWasSpace = true; // true to trim leading whitespace

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!prevWasSpace) {
        normalized.push(' ');
        indexMap.push(i);
        prevWasSpace = true;
      }
    } else {
      normalized.push(ch.toLowerCase());
      indexMap.push(i);
      prevWasSpace = false;
    }
  }

  // Trim trailing space
  if (normalized.length > 0 && normalized[normalized.length - 1] === ' ') {
    normalized.pop();
    indexMap.pop();
  }

  return { normalized: normalized.join(''), indexMap };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts -v`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-highlight.ts __tests__/lib/pdf-highlight.test.ts
git commit -m "feat: add normalizeText for PDF highlight matching"
```

---

### Task 2: Write `buildTextMap` with tests

**Files:**
- Modify: `src/lib/pdf-highlight.ts`
- Modify: `__tests__/lib/pdf-highlight.test.ts`

- [ ] **Step 1: Write the failing tests for `buildTextMap`**

Append to `__tests__/lib/pdf-highlight.test.ts`:

```typescript
import { normalizeText, buildTextMap } from '@/lib/pdf-highlight';

describe('buildTextMap', () => {
  function makeSpans(texts: string[]): { container: HTMLDivElement; spans: HTMLSpanElement[] } {
    const container = document.createElement('div');
    const spans = texts.map((t) => {
      const span = document.createElement('span');
      span.textContent = t;
      container.appendChild(span);
      return span;
    });
    return { container, spans };
  }

  it('concatenates span texts into fullText', () => {
    const { container } = makeSpans(['hello ', 'world']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('hello world');
  });

  it('maps each character back to its source span', () => {
    const { container, spans } = makeSpans(['ab', 'cd']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('abcd');
    expect(result.charMap[0].span).toBe(spans[0]); // 'a'
    expect(result.charMap[1].span).toBe(spans[0]); // 'b'
    expect(result.charMap[2].span).toBe(spans[1]); // 'c'
    expect(result.charMap[3].span).toBe(spans[1]); // 'd'
  });

  it('tracks offsetInSpan correctly', () => {
    const { container } = makeSpans(['abc']);
    const result = buildTextMap(container);
    expect(result.charMap[0].offsetInSpan).toBe(0);
    expect(result.charMap[1].offsetInSpan).toBe(1);
    expect(result.charMap[2].offsetInSpan).toBe(2);
  });

  it('handles empty container', () => {
    const container = document.createElement('div');
    const result = buildTextMap(container);
    expect(result.fullText).toBe('');
    expect(result.charMap).toEqual([]);
  });

  it('handles spans with empty text', () => {
    const { container } = makeSpans(['', 'hello', '']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('hello');
    expect(result.charMap.length).toBe(5);
  });

  it('concatenates without inserting separators between spans', () => {
    const { container } = makeSpans(['hello', 'world']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('helloworld');
  });

  it('NFC-normalizes span text content', () => {
    // e + combining acute → precomposed é
    const { container } = makeSpans(['e\u0301']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('\u00e9');
    expect(result.charMap.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts -v`
Expected: FAIL — `buildTextMap is not exported` or `document is not defined`

Note: The test environment is `node`. These tests use `document.createElement` which requires `jsdom`. We need to add a docblock to set the test environment:

Add at the very top of `__tests__/lib/pdf-highlight.test.ts`:
```typescript
/**
 * @jest-environment jsdom
 */
```

- [ ] **Step 3: Implement `buildTextMap`**

Append to `src/lib/pdf-highlight.ts`:

```typescript
/**
 * A character in the full page text mapped back to its source span.
 */
export interface CharMapping {
  span: HTMLElement;
  offsetInSpan: number;
}

/**
 * Build a full-text string from all spans in the container,
 * with a character-to-span mapping for traceback.
 * Text is NFC-normalized so indices align with normalizeText output.
 */
export function buildTextMap(container: HTMLDivElement): { fullText: string; charMap: CharMapping[] } {
  const spans = container.querySelectorAll<HTMLElement>('span');
  const chars: string[] = [];
  const charMap: CharMapping[] = [];

  spans.forEach((span) => {
    const text = (span.textContent || '').normalize('NFC');
    for (let i = 0; i < text.length; i++) {
      chars.push(text[i]);
      charMap.push({ span, offsetInSpan: i });
    }
  });

  return { fullText: chars.join(''), charMap };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts -v`
Expected: All 15 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-highlight.ts __tests__/lib/pdf-highlight.test.ts
git commit -m "feat: add buildTextMap for character-to-span mapping"
```

---

### Task 3: Write `applyHighlight` with tests

**Files:**
- Modify: `src/lib/pdf-highlight.ts`
- Modify: `__tests__/lib/pdf-highlight.test.ts`

- [ ] **Step 1: Write the failing tests for `applyHighlight`**

Append to `__tests__/lib/pdf-highlight.test.ts`:

```typescript
import { normalizeText, buildTextMap, applyHighlight } from '@/lib/pdf-highlight';

describe('applyHighlight', () => {
  function makeSpans(texts: string[]): HTMLDivElement {
    const container = document.createElement('div');
    texts.forEach((t) => {
      const span = document.createElement('span');
      span.textContent = t;
      container.appendChild(span);
    });
    return container;
  }

  function getHighlighted(container: HTMLDivElement): string[] {
    return Array.from(container.querySelectorAll('.highlight-active'))
      .map((el) => el.textContent || '');
  }

  it('highlights a single span that contains the search text', () => {
    const container = makeSpans(['deep learning model']);
    applyHighlight(container, 'deep learning');
    expect(getHighlighted(container)).toEqual(['deep learning model']);
  });

  it('highlights multiple spans when search text crosses span boundaries', () => {
    const container = makeSpans(['deep ', 'learning ', 'model']);
    applyHighlight(container, 'deep learning model');
    expect(getHighlighted(container)).toEqual(['deep ', 'learning ', 'model']);
  });

  it('handles whitespace differences between search and page text', () => {
    const container = makeSpans(['deep  ', ' learning']);
    applyHighlight(container, 'deep learning');
    expect(getHighlighted(container)).toEqual(['deep  ', ' learning']);
  });

  it('is case-insensitive', () => {
    const container = makeSpans(['Deep Learning']);
    applyHighlight(container, 'deep learning');
    expect(getHighlighted(container)).toEqual(['Deep Learning']);
  });

  it('does not highlight when text is not found', () => {
    const container = makeSpans(['hello world']);
    applyHighlight(container, 'nonexistent');
    expect(getHighlighted(container)).toEqual([]);
  });

  it('clears previous highlights before applying new ones', () => {
    const container = makeSpans(['hello', ' world']);
    applyHighlight(container, 'hello');
    expect(getHighlighted(container)).toEqual(['hello']);

    applyHighlight(container, 'world');
    expect(getHighlighted(container)).toEqual([' world']);
  });

  it('does nothing for empty search text', () => {
    const container = makeSpans(['hello']);
    applyHighlight(container, '');
    expect(getHighlighted(container)).toEqual([]);
  });

  it('does nothing for whitespace-only search text', () => {
    const container = makeSpans(['hello']);
    applyHighlight(container, '   ');
    expect(getHighlighted(container)).toEqual([]);
  });

  it('highlights partial span match (search text within a longer span)', () => {
    // When the match covers part of a span, we highlight the entire span
    // since we can't split span elements
    const container = makeSpans(['the deep learning model is powerful']);
    applyHighlight(container, 'deep learning model');
    expect(getHighlighted(container)).toEqual(['the deep learning model is powerful']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts -v`
Expected: FAIL — `applyHighlight is not exported`

- [ ] **Step 3: Implement `applyHighlight`**

Append to `src/lib/pdf-highlight.ts`:

```typescript
/**
 * Find search text within page text using normalized matching.
 * Returns true if any spans were highlighted.
 */
export function applyHighlight(container: HTMLDivElement, text: string): boolean {
  // Clear existing highlights
  container.querySelectorAll('.highlight-active').forEach((el) => {
    el.classList.remove('highlight-active');
  });

  if (!text || !text.trim()) return false;

  // Build full page text with span mapping (already NFC-normalized)
  const { fullText, charMap } = buildTextMap(container);
  if (!fullText) return false;

  // Normalize both texts (NFC is already applied by buildTextMap for page text)
  const pageNorm = normalizeText(fullText);
  const searchNorm = normalizeText(text.normalize('NFC'));

  if (!searchNorm.normalized) return false;

  // Find match position in normalized page text
  const matchIndex = pageNorm.normalized.indexOf(searchNorm.normalized);
  if (matchIndex === -1) return false;

  // Map normalized match range back to original charMap indices
  const origStart = pageNorm.indexMap[matchIndex];
  const origEnd = pageNorm.indexMap[matchIndex + searchNorm.normalized.length - 1];

  // Collect unique spans that contain matched characters
  const matchedSpans = new Set<HTMLElement>();
  for (let i = origStart; i <= origEnd; i++) {
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pdf-highlight.test.ts -v`
Expected: All 24 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-highlight.ts __tests__/lib/pdf-highlight.test.ts
git commit -m "feat: add applyHighlight with full-page text search"
```

---

## Chunk 2: Integration into PDF viewer

### Task 4: Replace old highlight logic in `pdf-viewer.tsx` and fix zoom

**Files:**
- Modify: `src/components/pdf-viewer.tsx:1-145`

- [ ] **Step 1: Import `applyHighlight` from the new module and remove the old `useCallback`**

In `src/components/pdf-viewer.tsx`:

Replace the import line (line 3):
```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
```
with:
```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { applyHighlight } from '@/lib/pdf-highlight';
```

Delete the entire old `applyHighlight` `useCallback` block (lines 111-145):
```typescript
  // Apply highlight when highlightText changes (but page/scale don't)
  const applyHighlight = useCallback((container: HTMLDivElement, text: string) => {
    // ... entire block ...
  }, []);
```

- [ ] **Step 2: Fix the render `useEffect` to make highlight non-cancellable**

Replace the render `useEffect` (lines 54-109) with this updated version. The key change: the `cancelled` guard at line 99 is removed so highlights are applied even during rapid re-renders. The `textLayerDiv` reference is checked instead — if a newer render has cleared it, `applyHighlight` finds no spans (safe no-op).

Replace the entire `useEffect` block:

```typescript
  // Render current page (canvas + text layer)
  useEffect(() => {
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;

    let cancelled = false;

    // Cancel previous text layer render
    if (textLayerInstanceRef.current) {
      textLayerInstanceRef.current.cancel();
      textLayerInstanceRef.current = null;
    }

    async function renderPage() {
      const pdfPage = await pdf!.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (cancelled) return;

      await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;

      if (cancelled) return;

      // Render text layer
      const textLayerDiv = textLayerRef.current!;
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;

      const textContent = await pdfPage.getTextContent();
      if (cancelled) return;

      const { TextLayer } = await import('pdfjs-dist');
      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });

      textLayerInstanceRef.current = textLayer;
      await textLayer.render();

      // Apply highlight unconditionally after TextLayer render completes.
      // No `cancelled` guard here — if a newer render has already cleared
      // textLayerDiv.innerHTML, applyHighlight finds no spans (safe no-op).
      if (highlightText) {
        applyHighlight(textLayerDiv, highlightText);
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [pdf, page, scale, highlightText]);
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx next build 2>&1 | head -30`
Expected: No TypeScript errors related to `pdf-viewer.tsx` or `pdf-highlight.ts`

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass (existing + new highlight tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "fix: replace per-span highlight with full-page text search and fix zoom persistence"
```

---

## Chunk 3: Manual verification

### Task 5: Manual testing checklist

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Upload a PDF and run analysis**

Open `http://localhost:3000`, upload an academic PDF, click "Analyze".

- [ ] **Step 3: Test highlight accuracy**

Click a reference link `[p.N]` in the analysis panel. Verify:
- The PDF navigates to the correct page
- The highlighted text corresponds to the referenced content
- Highlights span across multiple TextLayer spans correctly

- [ ] **Step 4: Test zoom with active highlight**

With a highlight active:
- Click zoom in (+) — highlight should persist and stay aligned
- Click zoom out (-) — highlight should persist and stay aligned
- Rapidly click zoom multiple times — highlight should still appear after settling

- [ ] **Step 5: Test highlight clearing**

- Click the canvas background — highlight should clear
- Navigate to a different page — highlight should clear
- Click a different reference — old highlight clears, new one appears
