# Sentence-Level Notes Design

## Overview

Extend the existing page-level notes feature to support sentence-level notes tied to specific text selections in the PDF. Users can select text, add notes via a floating button, and the notes are displayed with persistent highlights and annotation bubbles in the PDF viewer.

## Data Model

### Extended Types

```typescript
export interface HighlightRect {
  left: number;    // Percentage (0-100) of page width
  top: number;     // Percentage (0-100) of page height
  width: number;   // Percentage (0-100) of page width
  height: number;  // Percentage (0-100) of page height
}

export interface TextSelection {
  text: string;              // The selected text content
  rects: HighlightRect[];    // Rectangle positions as percentages
  page: number;              // Page number (1-indexed)
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: NoteTag[];
  page?: number;                    // Legacy: page-level reference (for existing notes)
  selection?: TextSelection;        // New: sentence-level selection
  createdAt: string;
  updatedAt: string;
}
```

### Coordinate System

Coordinates are stored as **percentages (0-100)** of page dimensions at scale 1.0. This ensures:

- **Zoom independence:** Highlights align correctly at any zoom level
- **Device independence:** Works across different screen sizes
- **Conversion formula:**
  - Capture: `percent = (viewportCoord / pageSize) * 100`
  - Render: `pixel = (percent / 100) * renderedPageSize * scale`

### Key Decisions

- `page` remains optional for backward compatibility with existing notes
- `selection` is optional - if present, it's a sentence-level note; if absent, it's a page-level note
- `selection.rects` stores coordinates as percentages for zoom independence
- A note with `selection` implicitly has `page = selection.page`

### Storage

No change to storage structure - notes still stored in `data/papers/{paperId}/notes.json` with the optional new `selection` field.

## API

No new routes needed. Existing `/api/paper/[id]/notes` handles all operations.

### Validation Rules

**Selection field validation:**
- `selection.text`: Required, max 1000 characters, trimmed
- `selection.rects`: Required, non-empty array, each rect has `left`, `top`, `width`, `height` in range [0, 100]
- `selection.page`: Required, integer ≥ 1
- If both `page` and `selection.page` provided, they should match (server ignores `page` if mismatch)

**Error response format:**
```typescript
{ error: { code: 'VALIDATION_ERROR', message: 'selection.text is required' } }
```

### Request/Response Changes

**POST/PUT body:**
```typescript
{
  title: string;
  content: string;
  tags: NoteTag[];
  page?: number;
  selection?: {
    text: string;
    rects: HighlightRect[];
    page: number;
  };
}
```

**GET response:** Returns `Note[]` with `selection` field populated when present.

## PDF Viewer UI Components

### SelectionToolbar

Floating button that appears when user selects text in PDF.

- **Position:** Centered above the selection, anchored to the middle of the topmost selection rectangle
- **Content:** Single button with note icon (📝) and label "添加笔记"
- **Behavior:**
  - Click → opens InlineNoteEditor in 'create' mode
  - Auto-hides when selection is cleared or user clicks elsewhere
- **Styling:** Compact rounded button, subtle shadow, uses theme variables

### AnnotationBubble

Persistent marker for notes with selection.

- **Position:** Right edge of the rightmost selection rectangle, 8px offset
- **Content:** Title (truncated if >25 chars) + tag pills (compact, pill style)
- **Width:** Max 180px
- **Behavior:**
  - Click → opens InlineNoteEditor in 'edit' mode
  - Hover → shows tooltip with full title
- **Styling:** Background `var(--surface)` with border, shadow

### InlineNoteEditor

Compact editor opened from SelectionToolbar or AnnotationBubble.

- **Position:** Anchored near trigger element, auto-adjusted to stay within viewport
- **Content:**
  - Title input (single line, auto-filled with selected text on create)
  - Page input (auto-filled with current page)
  - Tags row (same colors as NoteEditor, compact)
  - Content textarea (markdown, smaller)
  - Save/Cancel buttons
  - Delete button (only on edit mode)
- **Styling:** Card-like popup, shadow, matches existing form styling

### Persistent Highlight Rendering

- **Container:** Sibling div to the text layer, positioned absolutely within the page wrapper
- **z-index:** Below text layer (z-index: 0) to allow text selection to pass through
- **Color:** Warm yellow `rgba(250, 204, 21, 0.35)` (distinct from blue temporary highlights)
- **Persistence:** Re-rendered on page load/change from notes data
- **Interaction:** Click on highlighted text opens InlineNoteEditor (click detected on text layer, check if click position overlaps a highlight rect)
- **pointer-events:** `none` on highlight divs to let clicks pass through to text layer; click detection via coordinate comparison

## PDF Viewer Integration

### Selection Capture Method

When user selects text in the PDF, capture the selection data:

1. **Listen for selection:** `document.addEventListener('selectionchange', handler)`
2. **Check selection target:** Verify anchor/focus node is within the text layer div
3. **Get selection rectangles:** `range.getClientRects()` returns viewport-relative coordinates
4. **Convert to percentages:**
   ```typescript
   // wrapperRef points to the .react-pdf__Page__canvas container (the rendered page)
   // This is the same container used by react-pdf for the canvas and text layer
   const pageElement = wrapperRef.current;  // .react-pdf__Page element
   const pageRect = pageElement.getBoundingClientRect();

   const rects = Array.from(range.getClientRects()).map(rect => ({
     left: ((rect.left - pageRect.left) / pageRect.width) * 100,
     top: ((rect.top - pageRect.top) / pageRect.height) * 100,
     width: (rect.width / pageRect.width) * 100,
     height: (rect.height / pageRect.height) * 100,
   }));
   ```
   **Note:** The `.react-pdf__Page` element is used because it represents the rendered page dimensions regardless of PDF paper size. Different paper sizes (A4, Letter, etc.) will have different dimensions, but percentage coordinates work correctly in all cases.
5. **Get selected text:** `selection.toString()` returns the text content

### New Props

```typescript
interface PdfViewerProps {
  // ... existing props
  notes?: Note[];
  // Callbacks: PdfViewer invokes these; parent page.tsx handles API calls and state updates
  onNoteCreate?: (data: { title: string; content: string; tags: NoteTag[]; selection: TextSelection }) => Promise<void>;
  onNoteUpdate?: (note: Note) => Promise<void>;
  onNoteDelete?: (noteId: string) => Promise<void>;
}
```

**API Responsibility:** PdfViewer calls callbacks with note data. Parent page.tsx makes API calls and updates notes state. Callbacks return Promises so PdfViewer can show loading states.

### New State

```typescript
const [editorPopup, setEditorPopup] = useState<{
  mode: 'create' | 'edit';
  note?: Note;
  position: { x: number; y: number };
  selection?: TextSelection;
} | null>(null);
```

### New Refs

```typescript
const pageElementRef = useRef<HTMLDivElement>(null);  // .react-pdf__Page element for coordinate conversion
const scrollContainerRef = useRef<HTMLDivElement>(null);  // Scroll container for scroll-to-selection (existing)
```

**Obtaining the Page element reference:**
The react-pdf `Page` component wraps its content in a div with class `react-pdf__Page`. Use a callback ref on the container div inside the `Document` component, or use the `inputRef` prop if available. The Page element is needed for accurate coordinate conversion regardless of PDF paper size.

```tsx
<Document file={url} ...>
  <Page
    pageNumber={page}
    inputRef={pageElementRef}  // react-pdf supports inputRef for the Page container
    ...
  />
</Document>
```

### Loading & Error States

**Loading indicator:** During save/delete operations, the Save/Delete button shows a spinner and becomes disabled.

**Error handling:**
- API errors display inline in the editor popup (red banner with error message)
- No optimistic updates - wait for API confirmation before updating UI
- User can retry or dismiss the error

**Delete confirmation:** Before deleting, show a confirmation row in the editor: "Delete this note? [Cancel] [Confirm]" with Confirm in red.

### Accessibility

**Keyboard navigation:**
- `Tab` cycles through: PDF content → AnnotationBubbles → SelectionToolbar (when visible)
- `Enter` on AnnotationBubble opens InlineNoteEditor
- `Escape` closes InlineNoteEditor without saving

**Focus management:**
- When InlineNoteEditor opens, focus moves to title input
- When InlineNoteEditor closes, focus returns to trigger element (bubble or toolbar)

**ARIA labels:**
- SelectionToolbar: `aria-label="Add note to selected text"`
- AnnotationBubble: `aria-label="Note: {title}"`
- Yellow highlights: No ARIA (visual only, semantic meaning in bubble)
- InlineNoteEditor: `role="dialog" aria-label="Edit note"`

**Screen reader announcements:**
- On note creation: "Note created"
- On note deletion: "Note deleted"
- On error: Error message announced
- Implementation: Use a hidden `div` with `aria-live="polite"` and `role="status"`; append message text to trigger announcement

### Highlight Rendering Logic

1. **Temporary selection highlights** (blue) - existing behavior, cleared when selection ends
2. **Persistent note highlights** (yellow) - from `notes` prop, filtered by current page

On page change:
- Clear temporary highlights
- Re-render persistent highlights from notes data for the new page

### Positioning Calculations

**SelectionToolbar:**
```typescript
const topmostRect = rects.reduce((min, r) => r.top < min.top ? r : min, rects[0]);
const toolbarY = topmostRect.top - 36;
const toolbarX = topmostRect.left + topmostRect.width / 2;
```

**AnnotationBubble:**
```typescript
const rightmostRect = rects.reduce((max, r) =>
  r.left + r.width > max.left + max.width ? r : max, rects[0]);
const bubbleX = rightmostRect.left + rightmostRect.width + 8;
const bubbleY = rightmostRect.top;
```

**InlineNoteEditor Viewport Adjustment:**
```typescript
const EDITOR_WIDTH = 320;
const EDITOR_HEIGHT = 280;

function calculateEditorPosition(triggerX: number, triggerY: number) {
  const viewport = { width: window.innerWidth, height: window.innerHeight };

  // Initial position: below and centered on trigger
  let x = triggerX - EDITOR_WIDTH / 2;
  let y = triggerY + 8;

  // Adjust if right edge exceeds viewport
  if (x + EDITOR_WIDTH > viewport.width - 16) {
    x = viewport.width - EDITOR_WIDTH - 16;
  }
  // Adjust if left edge exceeds viewport
  if (x < 16) {
    x = 16;
  }
  // Flip to above if bottom exceeds viewport
  if (y + EDITOR_HEIGHT > viewport.height - 16) {
    y = triggerY - EDITOR_HEIGHT - 8;
  }

  return { x, y };
}
```

**Multiple Bubbles Overlap:**
When multiple AnnotationBubbles would overlap at the same position, offset vertically:
```typescript
const bubbleY = baseY + (bubbleIndex * 24);  // 24px vertical offset per bubble
```

### Event Flow

```
User selects text
  → Temporary blue highlight appears
  → SelectionToolbar shows above selection
  → User clicks toolbar
    → InlineNoteEditor opens (create mode)
    → Title auto-filled with selected text
    → User edits, clicks Save
      → Note created via API
      → Blue highlight → Yellow highlight
      → AnnotationBubble appears
      → Editor closes

User clicks AnnotationBubble or yellow highlight
  → InlineNoteEditor opens (edit mode)
  → Pre-filled with existing note data
  → User edits, clicks Save/Delete
    → Note updated/deleted via API
    → Highlight/bubble updated/removed
    → Editor closes
```

## Notes Panel Integration

### NotesList Card Display

**Sentence-level notes:**
- Yellow snippet badge: `"...{text.slice(0, 30)}..."`
- Page badge: `p.{page}`
- Click → calls `onNoteClick` callback with note data

**Page-level notes:**
- Only page badge (existing behavior)
- Click → calls `onPageChange` to jump to page (existing behavior)

### Scroll-to-Selection Behavior

When clicking a sentence note:

1. If note is on current page: scroll to highlight position immediately
2. If note is on different page: navigate to that page first, wait for render, then scroll

```typescript
// Use a promise-based approach with react-pdf's render callback
const pageRenderPromiseRef = useRef<Promise<void> | null>(null);

// In Page component's onRenderSuccess callback
const handlePageRenderSuccess = () => {
  // Resolve any pending scroll promise
  if (pageRenderPromiseRef.current) {
    pageRenderPromiseRef.current = null;
  }
};

async function scrollToSelection(note: Note) {
  if (!note.selection || !scrollContainerRef.current) return;

  // Navigate to page if needed
  if (note.selection.page !== currentPage) {
    // Create a promise that resolves when page renders
    pageRenderPromiseRef.current = new Promise(resolve => {
      // Will be resolved in onRenderSuccess callback
      const checkRender = () => {
        if (pageElementRef.current) {
          requestAnimationFrame(resolve);
        } else {
          setTimeout(checkRender, 50);
        }
      };
      checkRender();
    });

    goToPage(note.selection.page);
    await pageRenderPromiseRef.current;
  }

  const topPercent = note.selection.rects[0]?.top || 0;
  const container = scrollContainerRef.current;
  const scrollY = (topPercent / 100) * container.scrollHeight;

  container.scrollTo({ top: scrollY - 50, behavior: 'smooth' });
}
```

### Visual Distinction

```tsx
// Sentence note card
<div className="snippet-badge">
  <span className="yellow-snippet">"...hybrid approach..."</span>
  <span className="page-badge">p.3</span>
</div>

// Page note card (existing)
<span className="page-badge">p.5</span>
```

## Component Architecture

```
page.tsx
├── PdfViewer (modified)
│   ├── SelectionToolbar (new)
│   ├── HighlightContainer (modified)
│   │   ├── Temporary highlights (blue)
│   │   └── Persistent highlights (yellow)
│   ├── AnnotationBubble[] (new)
│   └── InlineNoteEditor (new)
├── NotesPanel (modified)
│   ├── NotesList (modified)
│   │   └── NoteCard[] (modified - snippet badge)
│   └── NoteEditor (existing)
```

## Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| Selection across multiple lines | Multiple rects stored and rendered |
| Selection spans page boundary | Not possible - single page rendering; selection truncated to current page by browser |
| User zooms after creating note | Coordinates stored as percentages, scale-independent |
| Note deleted | Highlight and bubble removed |
| Page change | Persistent highlights re-rendered from notes data |
| Selection cleared | Toolbar hides, blue highlight disappears |
| Editor outside viewport | Auto-adjust position using viewport calculation |
| Duplicate note on same text | Allowed - bubbles offset vertically; consider badge count in future |
| Rapid page navigation | Editor popup closes on page change |
| Multiple bubbles overlap | Vertical offset of 24px per bubble |
| Touch device selection | SelectionToolbar appears after `touchend`; min touch target 44x44px; long-press initiates selection on some devices |
| Performance with many highlights | Current scope handles <10 per page; virtualization deferred to future if needed |
| PDF re-parsed or re-uploaded | Selection coordinates may become stale; `selection.text` provides visual reference for users |

## Touch Device Support

**Selection detection:**
- Listen for `selectionchange` event (fires after touch-based text selection completes)
- SelectionToolbar appears when selection is non-empty
- Hide toolbar on `touchstart` outside text layer (before potential new selection)

**Touch targets:**
- SelectionToolbar button: min 44x44px
- AnnotationBubble: min height 44px, full width clickable
- InlineNoteEditor buttons: min 44x44px touch target

## Implementation Scope

### New Files

| File | Purpose |
|------|---------|
| `src/components/selection-toolbar.tsx` | Floating button above selection |
| `src/components/annotation-bubble.tsx` | Persistent bubble for saved notes |
| `src/components/inline-note-editor.tsx` | Popup editor for create/edit |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `HighlightRect`, `TextSelection` interfaces; extend `Note` type with optional `selection` field |
| `src/components/pdf-viewer.tsx` | Add props, state, refs; render highlights/bubbles/editor; add page element ref for coordinate conversion |
| `src/components/notes-list.tsx` | Add snippet badge, handle note click |
| `src/components/notes-panel.tsx` | Add `onNoteClick` prop |
| `src/app/paper/[id]/page.tsx` | Pass notes to PdfViewer, handle callbacks |
| `src/app/api/paper/[id]/notes/route.ts` | Extract and validate `selection` field in POST/PUT handlers; apply validation rules |

### API Route Modifications

The notes API route must be updated to handle the `selection` field:

```typescript
// In POST handler
const { title, content, tags, page, selection } = await request.json();

// Validate selection if provided
if (selection) {
  if (!selection.text || selection.text.length > 1000) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'selection.text must be 1-1000 characters' }}, { status: 400 });
  }
  if (!selection.rects || selection.rects.length === 0) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'selection.rects must be non-empty' }}, { status: 400 });
  }
  if (!selection.page || selection.page < 1) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'selection.page must be >= 1' }}, { status: 400 });
  }
}

// Include selection in note object
const note = {
  id: crypto.randomUUID(),
  title,
  content,
  tags,
  page: selection?.page ?? page,
  selection,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### No Changes Needed

- `src/lib/storage.ts` - JSON storage handles new fields transparently
- `src/components/note-editor.tsx` - Full editor unchanged, only used for existing note editing from panel

## Dependencies

No new dependencies required - all rendering uses existing React/PDF.js patterns.