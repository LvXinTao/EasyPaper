# Sentence-Level Notes Design

## Overview

Extend the existing page-level notes feature to support sentence-level notes tied to specific text selections in the PDF. Users can select text, add notes via a floating button, and the notes are displayed with persistent highlights and annotation bubbles in the PDF viewer.

## Data Model

### Extended Types

```typescript
export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TextSelection {
  text: string;              // The selected text content
  rects: HighlightRect[];    // Rectangle positions for rendering (page-relative)
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

### Key Decisions

- `page` remains optional for backward compatibility with existing notes
- `selection` is optional - if present, it's a sentence-level note; if absent, it's a page-level note
- `selection.rects` stores coordinates relative to the PDF page wrapper (same format as existing `highlightRects`)
- A note with `selection` implicitly has `page = selection.page`

### Storage

No change to storage structure - notes still stored in `data/papers/{paperId}/notes.json` with the optional new `selection` field.

## API

No new routes needed. Existing `/api/paper/[id]/notes` handles all operations.

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

- **Container:** Separate div below temporary selection highlights
- **Color:** Warm yellow `rgba(250, 204, 21, 0.35)` (distinct from blue temporary highlights)
- **Persistence:** Re-rendered on page load/change from notes data
- **Interaction:** Click on highlight → opens InlineNoteEditor

## PDF Viewer Integration

### New Props

```typescript
interface PdfViewerProps {
  // ... existing props
  notes?: Note[];
  onNoteCreate?: (data: { title: string; content: string; tags: NoteTag[]; selection: TextSelection }) => void;
  onNoteUpdate?: (note: Note) => void;
  onNoteDelete?: (noteId: string) => void;
}
```

### New State

```typescript
const [editorPopup, setEditorPopup] = useState<{
  mode: 'create' | 'edit';
  note?: Note;
  position: { x: number; y: number };
} | null>(null);
```

### New Refs

```typescript
const wrapperRef = useRef<HTMLDivElement>(null);  // For coordinate conversion
```

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
- Click → highlights text in PDF + jumps to page

**Page-level notes:**
- Only page badge (existing behavior)
- Click → jumps to page (existing behavior)

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
| Selection spans page boundary | Not possible - single page rendering |
| User zooms after creating note | Rects in page-relative coords, scale-independent |
| Note deleted | Highlight and bubble removed |
| Page change | Persistent highlights re-rendered from notes data |
| Selection cleared | Toolbar hides, blue highlight disappears |
| Editor outside viewport | Auto-adjust position to stay within bounds |
| Duplicate note on same text | Allowed - each note is independent |
| Rapid page navigation | Editor popup closes on page change |

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
| `src/types/index.ts` | Add `HighlightRect`, `TextSelection`, extend `Note` |
| `src/components/pdf-viewer.tsx` | Add props, state, refs; render highlights/bubbles/editor |
| `src/components/notes-list.tsx` | Add snippet badge, handle note click |
| `src/components/notes-panel.tsx` | Add `onNoteClick` prop |
| `src/app/paper/[id]/page.tsx` | Pass notes to PdfViewer, handle callbacks |

### No Changes Needed

- `src/lib/storage.ts` - JSON storage handles new fields transparently
- `src/app/api/paper/[id]/notes/route.ts` - Handles new fields in request body
- `src/components/note-editor.tsx` - Full editor unchanged, only used for existing note editing from panel

## Dependencies

No new dependencies required - all rendering uses existing React/PDF.js patterns.