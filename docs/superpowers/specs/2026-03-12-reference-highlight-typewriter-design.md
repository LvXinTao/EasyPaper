# Design: Reference Highlight & Typewriter Effect

## Overview

Two UX improvements for the EasyPaper paper detail page:

1. **Reference Click → PDF Text Highlight**: Clicking a reference in the analysis panel navigates to the corresponding PDF page and highlights the quoted text.
2. **Typewriter Effect for Chat**: AI chat responses render with a character-by-character typewriter animation instead of appearing in chunks.

## Feature 1: Reference Click → PDF Text Highlight

### Problem

Currently, clicking a `[p.X]` reference link in the analysis panel navigates to the correct PDF page but provides no visual indication of where the referenced text is located. Users must scan the page manually.

### Solution

Add a pdfjs-dist TextLayer overlay on the PDF canvas and highlight matched text when a reference is clicked.

### Changes

| File | Change |
|------|--------|
| `src/components/pdf-viewer.tsx` | Add TextLayer rendering; accept `highlightText` prop; search and highlight matching text |
| `src/components/analysis-panel.tsx` | Change `onReferenceClick` callback type from `(page: number) => void` to `(ref: { page: number; text: string }) => void`. Update all prop-drilling sites: `AnalysisPanelProps.onReferenceClick`, `ReferenceLink.onClick`, `SectionContent.onReferenceClick` |
| `src/app/paper/[id]/page.tsx` | Update `handleReferenceClick` to accept `{ page, text }` and set both `currentPage` and `highlightText` state |

### Implementation Details

**TextLayer Rendering**

- Overlay a `<div>` container on top of the canvas with matching dimensions, using `position: absolute` to align with the canvas
- Use pdfjs-dist `TextLayer` API to render transparent, selectable text spans
- Write TextLayer CSS inline or in a scoped style block (pdfjs requires `.textLayer` class with `position: absolute`, matching font sizes, and `opacity: 0.25` for transparent text)
- TextLayer must re-render whenever `pdf`, `page`, or `scale` changes — same dependency array as the canvas render effect
- Follow the existing `cancelled` flag pattern for render cancellation to prevent stale TextLayer renders on rapid page navigation

**Highlight Logic**

- When `highlightText` prop changes, iterate through TextLayer `<span>` elements
- Use normalized matching: trim whitespace, case-insensitive substring search to handle AI paraphrasing differences from raw PDF text
- Find spans whose `textContent` matches (or contains) the reference text
- Add a CSS class (e.g., `highlight-active`) to matched spans, styled with semi-transparent yellow background (`bg-yellow-200/70`) and smooth transition animation
- **Clearing highlights**: `page.tsx` owns the `highlightText` state. It is set to `null` when: (a) user navigates pages via toolbar prev/next buttons, (b) a new reference is clicked (old highlight replaced), (c) user clicks on the PDF canvas background. PdfViewer calls an `onHighlightClear?.()` callback on canvas click, and page.tsx resets `highlightText` to `null`.

**Data Flow**

```
ReferenceLink click
  → onReferenceClick({ page, text })
    → page.tsx sets currentPage + highlightText
      → PdfViewer navigates to page, renders TextLayer, highlights matched text

Canvas click / page nav via toolbar
  → onHighlightClear()
    → page.tsx sets highlightText = null
      → PdfViewer clears highlight classes
```

### Edge Cases

- If reference text spans multiple TextLayer spans, highlight all matching spans
- If no match is found (e.g., scanned PDF with no text layer), silently fall back to page navigation only
- Clear previous highlights before applying new ones
- Scale changes re-render TextLayer and re-apply active highlight if `highlightText` is still set

## Feature 2: Typewriter Effect for Chat

### Problem

Current SSE streaming displays text in chunks as received from the API. This feels abrupt. A character-by-character typewriter effect provides a smoother, more natural reading experience.

### Solution

Create a `useTypewriter` hook that buffers incoming text and releases it character-by-character using `requestAnimationFrame`.

### Changes

| File | Change |
|------|--------|
| `src/hooks/use-typewriter.ts` | New hook: buffer + character-by-character output via RAF |
| `src/components/chat-messages.tsx` | Use `useTypewriter` for streaming content display |

### Implementation Details

**`useTypewriter` Hook API**

```typescript
function useTypewriter(text: string, options?: {
  speed?: number;        // base characters per frame (default: 1)
  isStreaming?: boolean;  // when false, flush remaining buffer immediately
}): {
  displayedText: string;
  isTyping: boolean;
}
```

**Buffer Mechanism**

- Maintain an internal `displayedText` state that grows character by character
- When input `text` grows (SSE receives new chunks), new characters enter the buffer
- `requestAnimationFrame` loop takes `speed` characters per frame from the buffer (default: 1)
- **Dynamic acceleration**: characters per frame = `Math.min(Math.ceil(backlog / 10), 8)` when buffer backlog > 20 characters, preventing lag accumulation
- When `isStreaming` becomes `false`, flush all remaining buffer immediately
- When buffer is empty and no more input expected, `isTyping` becomes `false`
- Note: this operates on raw text only; markdown rendering is not in scope

**Integration in ChatMessages**

```tsx
// Before
<div>{streamingContent}</div>

// After
const { displayedText, isTyping } = useTypewriter(streamingContent, {
  isStreaming: isChatStreaming,
});
<div>{displayedText}</div>
{isTyping && <span className="cursor-blink" />}
```

**Performance**

- Use `useRef` for buffer and RAF handle to avoid unnecessary re-renders
- Clean up RAF on component unmount

### Edge Cases

- Very fast AI responses: dynamic acceleration prevents buffer buildup
- User navigates away mid-stream: RAF cleanup prevents memory leaks
- Empty responses: hook returns empty string, no animation triggered
