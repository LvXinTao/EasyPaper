# PDF Paragraph Highlight & User Annotations Design

## Overview

Two enhancements to the EasyPaper PDF viewer:

1. **Paragraph Rectangle Highlight**: Replace per-span text highlighting on reference click with a rectangle box that frames the entire paragraph containing the matched text.
2. **User Text Selection Highlight + Comments**: Allow users to select text on the PDF, highlight it in a chosen color, and attach comments. Highlights and comments are persisted to disk and manageable via a dedicated Annotations panel.

## Scope Boundary

These two features are **independent subsystems** that share the PDF viewer component but have no runtime dependency on each other. They will be developed as separate chunks within a single plan.

### Feature Interaction

Both features share the PDF viewer DOM space but do not conflict:

- **Feature 1's overlay `<div>`** uses `pointer-events: none`, so it does not block TextLayer interaction. Users can still select text on the TextLayer even when a paragraph rectangle is visible.
- **Visual layering**: The paragraph rectangle overlay sits between the canvas and TextLayer. User highlights (CSS classes on TextLayer spans) render above the paragraph box. This is the correct visual priority — user annotations take precedence over reference highlights.

---

## Feature 1: Paragraph Rectangle Highlight

### Problem

Currently, clicking a `[p.N]` reference in the analysis panel highlights individual TextLayer spans with a yellow background. This produces fragmented, inconsistent highlights because PDF text is split across many small spans. The user wants a cleaner visual: a single rectangle box framing the entire paragraph.

### Design

**Approach:** Canvas/div overlay drawing a rectangle around the detected paragraph.

#### Paragraph Detection Algorithm

TextLayer renders text as individual `<span>` elements with absolute positioning. There is no paragraph concept. We detect paragraphs by analyzing span geometry:

1. **Find matched spans**: Use existing `normalizeText` + `buildTextMap` to locate the search text, identify which spans contain matched characters.
2. **Group spans into lines**: Sort all spans by their `top` (Y) coordinate. Spans within a Y-tolerance (±3px) are considered the same line.
3. **Identify paragraph boundary**: Starting from the line(s) containing matched spans, expand upward and downward. Two consecutive lines belong to the same paragraph if their vertical gap is less than `lineHeight × 1.5`. Stop expanding when the gap exceeds `lineHeight × 2.0` or the page boundary is reached.
4. **Compute bounding box**: Calculate the union rectangle of all spans in the detected paragraph — `min(left)`, `min(top)`, `max(right)`, `max(bottom)`.

#### Overlay Rendering

- Add a `<div>` overlay layer between the canvas and TextLayer, sized to match the viewport.
- The overlay renders an absolutely-positioned `<div>` for each highlight rectangle.
- On zoom/scale change, recalculate positions (the render `useEffect` already reruns on scale change, so overlay rectangles are redrawn naturally).

#### Visual Style

```css
.paragraph-highlight-box {
  position: absolute;
  border: 2.5px solid rgba(234, 179, 8, 0.9);
  border-radius: 4px;
  background: rgba(250, 204, 21, 0.15);
  box-shadow: 0 0 8px rgba(250, 204, 21, 0.3);
  pointer-events: none;
  transition: opacity 0.3s ease-in-out;
}
```

#### Interaction Flow

1. User clicks `[p.N]` reference in analysis panel.
2. Parent component sets `currentPage` and `highlightText` props.
3. PDF viewer navigates to the page, renders TextLayer.
4. `applyHighlight` is replaced by `applyParagraphHighlight`:
   - Finds matched text in the page.
   - Detects the enclosing paragraph boundary.
   - Draws a rectangle overlay around the paragraph.
   - Scrolls the rectangle into view.
5. Clicking the canvas background clears the rectangle.
6. Zooming re-renders the page and redraws the rectangle at the new scale.

#### Changes to Existing Code

- **`src/lib/pdf-highlight.ts`**: Keep `normalizeText` and `buildTextMap` (reused by Feature 2). Replace `applyHighlight` with `findMatchRange` (returns match indices without modifying DOM) and add `detectParagraph` (returns bounding box). Add `applyParagraphHighlight` that combines both.
- **`src/components/pdf-viewer.tsx`**: Replace `applyHighlight` call with `applyParagraphHighlight`. Add overlay `<div>` layer. Update highlight CSS.
- **Remove**: The `highlight-active` CSS class and per-span highlight logic.

---

## Feature 2: User Text Selection Highlight + Comments

### Problem

Users want to mark up the PDF with their own highlights and notes while reading, similar to a physical highlighter + margin notes.

### Design

**Approach:** Browser Selection API on TextLayer + floating toolbar + popover comment box.

#### Interaction Flow

1. **Select text**: User drags to select text on the TextLayer (native browser text selection).
2. **Toolbar appears**: A floating toolbar appears near the selection with:
   - 4 color circles: yellow, green, blue, pink
   - A comment button (💬 icon)
   - Separated by a divider
3. **Click color**: Text is immediately highlighted with a semi-transparent background + bottom border in the chosen color. The toolbar disappears. The annotation is saved.
4. **Click comment button**: A popover appears with:
   - The selected text (truncated, italic preview)
   - A textarea for the comment
   - Cancel / Save buttons
   - Saving creates the highlight AND the comment together.
5. **Click existing highlight**: The toolbar reappears, allowing color change, comment edit, or delete.
6. **Click elsewhere**: Toolbar/popover dismisses.

#### Highlight Rendering

User highlights are applied by adding CSS classes to the matching TextLayer spans:

```css
.user-highlight {
  border-radius: 2px;
  padding: 0 1px;
  cursor: pointer;
}
.user-highlight-yellow { background: rgba(250, 204, 21, 0.4); border-bottom: 2px solid rgba(234, 179, 8, 0.6); }
.user-highlight-green  { background: rgba(74, 222, 128, 0.4); border-bottom: 2px solid rgba(34, 197, 94, 0.6); }
.user-highlight-blue   { background: rgba(96, 165, 250, 0.4); border-bottom: 2px solid rgba(59, 130, 246, 0.6); }
.user-highlight-pink   { background: rgba(244, 114, 182, 0.4); border-bottom: 2px solid rgba(236, 72, 153, 0.6); }
```

When a page is rendered, saved annotations for that page are restored by re-matching the text and applying the appropriate color class.

#### Floating Toolbar Component

```
┌──────────────────────────────────┐
│  🟡  🟢  🔵  🩷  │  💬          │
└──────────────────────────────────┘
```

- Positioned below the last line of the selection, centered horizontally on the selection midpoint.
- Positioned relative to the PDF container (scrolls with content, not fixed to viewport).
- Viewport clamping: if the toolbar would overflow the container's right or bottom edge, shift it inward.
- Dark background (`#1e293b`), rounded corners, shadow.
- Disappears on click outside or after action.

#### Comment Popover Component

```
┌─────────────────────────────┐
│  Add Comment              × │
├─────────────────────────────┤
│  "selected text preview..." │
│  ┌─────────────────────┐    │
│  │ Your comment...      │    │
│  └─────────────────────┘    │
│              [Cancel] [Save]│
└─────────────────────────────┘
```

- UI language: English (consistent with rest of the application).
- White background, rounded corners, shadow.
- Header with yellow accent background.
- Textarea for comment input (max 2000 characters, with client-side validation).
- Cancel dismisses without saving; Save persists.

#### Annotations Panel

A new tab in the right-side panel (alongside Analysis and Chat):

The Annotations tab is a **top-level panel selector** — not a sub-tab within the existing `SectionTabs`. The paper detail page adds a top-level toggle between "Analysis" and "Annotations" views. When "Analysis" is selected, the existing `AnalysisPanel` (with its SectionTabs sub-tabs) renders. When "Annotations" is selected, the `AnnotationsPanel` renders instead. This avoids coupling annotations into the analysis-specific tab structure.

The Annotations tab is always available, even before analysis is run.

**Empty state:** When no annotations exist, show a placeholder: an icon and message "No annotations yet. Select text on the PDF to add highlights and comments."

- Tab label: **Annotations**
- Lists all annotations sorted by page number, then creation time.
- Each item shows:
  - Page number badge
  - Highlighted text (truncated)
  - Comment preview (if any)
  - Delete button (trash icon)
  - Left border color matching the highlight color
- Clicking an item navigates to the page and scrolls to the highlight.

#### Data Model

**File:** `data/papers/{id}/annotations.json`

```typescript
interface Annotation {
  id: string;           // UUID
  page: number;         // 1-indexed page number
  text: string;         // Selected text content
  color: 'yellow' | 'green' | 'blue' | 'pink';
  comment: string;      // Empty string if no comment (max 2000 chars)
  spanRange: {
    startIdx: number;   // Start index in the raw (unnormalized) fullText from buildTextMap
    endIdx: number;     // End index in the raw (unnormalized) fullText from buildTextMap
  };
  createdAt: string;    // ISO 8601 timestamp
  updatedAt: string;    // ISO 8601 timestamp, updated on every modification
}

interface AnnotationsFile {
  annotations: Annotation[];
}
```

#### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/papers/[id]/annotations` | List all annotations for a paper |
| POST | `/api/papers/[id]/annotations` | Create a new annotation |
| PUT | `/api/papers/[id]/annotations/[annotationId]` | Update annotation (color, comment) |
| DELETE | `/api/papers/[id]/annotations/[annotationId]` | Delete an annotation |

All endpoints use `src/lib/storage.ts` patterns for file-based I/O.

#### Annotation Restoration on Page Render

Annotations are stored in React state (not DOM) and re-applied on every TextLayer rebuild (page change, zoom, etc.).

When a page renders:

1. Annotations are loaded once on component mount (via GET API) into React state.
2. After `await textLayer.render()` completes (within the existing page render `useEffect`), for each annotation on the current page:
   - Use `buildTextMap` to get the page's full text.
   - Match the annotation's `text` at `spanRange.startIdx` in the raw `fullText` (with fallback to normalized text search if indices no longer match).
   - Apply the color CSS class to the matched spans.
   - Attach a click handler to open the toolbar on click.
3. On zoom: TextLayer is destroyed and rebuilt. Annotations survive in React state and are re-applied after the new TextLayer renders.

#### Validation & Errors

- API endpoints use the existing error response pattern from the codebase.
- POST/PUT validate required fields: `page` (positive integer), `text` (non-empty string), `color` (one of the four allowed values), `comment` (string, max 2000 chars).
- Return 404 for nonexistent paper or annotation ID.
- File-level locking is not required for the MVP. Concurrent writes to `annotations.json` are a known limitation (same as existing `metadata.json` pattern).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/pdf-highlight.ts` | Keep `normalizeText`, `buildTextMap`. Replace `applyHighlight` with `findMatchRange`, `detectParagraph`, `applyParagraphHighlight`. |
| Create | `src/lib/pdf-annotations.ts` | User annotation rendering: `applyUserHighlights`, `getSelectionInfo`, color/class mapping. |
| Modify | `src/components/pdf-viewer.tsx` | Add overlay layer, integrate paragraph highlight, add selection event handling, render toolbar/popover. |
| Create | `src/components/highlight-toolbar.tsx` | Floating toolbar component (color circles + comment button). |
| Create | `src/components/comment-popover.tsx` | Comment input popover component. |
| Create | `src/components/annotations-panel.tsx` | Annotations tab panel for listing/managing highlights. |
| Modify | `src/app/paper/[id]/page.tsx` | Add Annotations tab, manage annotation state, wire up API calls. |
| Create | `src/app/api/papers/[id]/annotations/route.ts` | GET/POST annotation endpoints. |
| Create | `src/app/api/papers/[id]/annotations/[annotationId]/route.ts` | PUT/DELETE annotation endpoints. |
| Modify | `src/types/index.ts` | Add `Annotation`, `AnnotationsFile` types. |
| Modify | `src/lib/storage.ts` | Add annotation read/write helpers. |
| Create | `__tests__/lib/pdf-highlight.test.ts` | Update tests for refactored highlight functions. |
| Create | `__tests__/lib/pdf-annotations.test.ts` | Tests for annotation rendering logic. |
| Create | `__tests__/api/annotations.test.ts` | Tests for annotation API endpoints. |

---

## Testing Strategy

- **Unit tests**: `normalizeText`, `buildTextMap`, `findMatchRange`, `detectParagraph` (pure functions, jsdom).
- **Unit tests**: Annotation rendering helpers (`applyUserHighlights`, `getSelectionInfo`).
- **API tests**: Annotation CRUD endpoints (file I/O with temp directories).
- **Manual tests**: Visual verification of paragraph highlight, text selection workflow, annotation persistence across page loads and zoom changes.

## Edge Cases

- **Empty TextLayer**: Some PDF pages have no extractable text (scanned images). Paragraph detection and user selection both gracefully no-op.
- **Overlapping annotations**: Multiple annotations on the same text are allowed. The last-applied color wins visually, but all annotations are stored and manageable in the panel.
- **Zoom**: Paragraph highlights are redrawn on zoom. User highlights are reapplied after TextLayer re-render.
- **Page navigation**: Paragraph highlight clears on page change. User highlights are restored per-page on render.
- **Deleted/moved text**: If PDF is re-uploaded and text layout changes, annotations use fallback text search (not just index-based matching).
