# Paper Notes Feature Design

## Overview

Add an independent notes feature to EasyPaper, allowing users to create, edit, and manage personal notes for each paper. Notes are organized as a list of individual entries, each with a title, Markdown body, fixed tags, and an optional page reference.

The notes panel lives in the right-side panel as a new top-level tab alongside the existing Analysis tab.

## Data Model

### Types

```typescript
type NoteTag = 'important' | 'question' | 'todo' | 'idea' | 'summary'

interface Note {
  id: string           // nanoid generated
  title: string        // Note title
  content: string      // Markdown body
  tags: NoteTag[]      // Fixed tag set, multi-select
  page?: number        // Optional associated PDF page number
  createdAt: string    // ISO8601
  updatedAt: string    // ISO8601
}
```

### Tag Definitions

| Tag | Label | Color |
|-----|-------|-------|
| `important` | 重要 | Red (`#ef4444` / `#f87171`) |
| `question` | 疑问 | Yellow (`#f59e0b` / `#fbbf24`) |
| `todo` | 待办 | Blue (`#3b82f6` / `#60a5fa`) |
| `idea` | 灵感 | Green (`#10b981` / `#34d399`) |
| `summary` | 总结 | Purple (`#8b5cf6` / `#a78bfa`) |

Each tag uses a semi-transparent background (`{color}33`) with the lighter shade for text.

## Storage

Follows the existing file-based storage pattern.

### File Location

```
data/papers/{paperId}/
├── ...existing files...
└── notes.json         # Note[] array
```

### Storage Functions (src/lib/storage.ts)

- `getNotes(paperId: string): Promise<Note[]>` — Read notes list, returns `[]` if file doesn't exist
- `saveNotes(paperId: string, notes: Note[]): Promise<void>` — Write entire notes array

## API

### Route: `/api/paper/[id]/notes`

| Method | Purpose | Request Body | Response |
|--------|---------|--------------|----------|
| `GET` | List all notes | — | `Note[]` |
| `POST` | Create new note | `Omit<Note, 'id' \| 'createdAt' \| 'updatedAt'>` | `Note` (created) |
| `PUT` | Update note | `Note` (full object with id) | `Note` (updated) |
| `DELETE` | Delete note | — (query param `noteId`) | `{ success: true }` |

## UI Design

### Panel Tab Structure

The right-side panel header gains a top-level tab bar:

```
┌─────────────┬─────────────┐
│  Analysis   │   Notes     │  ← top-level tab switch
└─────────────┴─────────────┘
```

When "Analysis" is selected, the existing analysis content (with its section sub-tabs) displays. When "Notes" is selected, the notes panel displays.

### Notes List View

- **Toolbar**: Note count label (left) + "+ New Note" button (right)
- **Note cards**: Sorted by `updatedAt` descending
  - Title (left-aligned, bold)
  - Associated page number (right-aligned, e.g. "p.5")
  - Content preview (2-line clamp of Markdown-stripped text)
  - Tag pills (colored, compact)
- **Page click**: Clicking the page number on a card jumps the PDF viewer to that page without entering edit mode

### Note Editor View

Entered by clicking a note card (edit) or "+ New Note" (create).

- **Top bar**: "← Back to list" (left) + Delete button + Save button (right)
- **Title**: Full-width text input
- **Page + Tags row**:
  - Page number input (numeric, left side)
  - Tag pills in a row — click to toggle selected/unselected
  - Selected tags show checkmark (✓) and filled background
- **Content area**: Edit / Preview sub-tab toggle
  - **Edit tab**: Monospace textarea for raw Markdown input
  - **Preview tab**: Rendered Markdown using `react-markdown` (already in project dependencies)

### Default Page Behavior

When creating a new note, the page field auto-fills with the current PDF page number from the viewer. Users can modify or clear it.

## Component Architecture

```
page.tsx (Paper Detail)
├── PdfViewer              (existing, provides currentPage)
├── Panel Tabs             (new: "Analysis | Notes" top-level switch)
│   ├── AnalysisPanel      (existing)
│   └── NotesPanel         (new)
│       ├── NotesList      (new: card list + new button)
│       └── NoteEditor     (new: title/tags/page/markdown editor)
├── ChatButton             (existing)
└── ChatDialog             (existing)
```

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `NotesPanel` | `src/components/notes-panel.tsx` | Container managing list/edit view state and notes data |
| `NotesList` | `src/components/notes-list.tsx` | Renders note cards with tag pills and page links |
| `NoteEditor` | `src/components/note-editor.tsx` | Edit form with title, tags, page, Markdown editor/preview |

### Data Flow

1. `page.tsx` holds `currentPage` state (from PdfViewer) and passes it to `NotesPanel`
2. `NotesPanel` manages internal state: `notes: Note[]`, `view: 'list' | 'edit'`, `editingNote: Note | null`
3. On "New Note": creates empty note with `page = currentPage`, switches to edit view
4. On card click: loads note into editor, switches to edit view
5. On page number click (in list): calls `onPageChange` callback from `page.tsx` to jump PDF
6. On Save: API call → update local state → switch to list view
7. On Delete: confirmation dialog → API call → remove from local state → switch to list view

### Data Loading

Notes are loaded when the Notes tab is first activated (lazy loading), not on page mount. This avoids unnecessary API calls when users only view the analysis.

## Interaction Flows

### Create Note
1. User switches to Notes tab
2. Clicks "+ New Note"
3. Editor opens with empty title/content, current PDF page pre-filled, no tags selected
4. User fills in content, toggles tags, adjusts page if needed
5. Clicks Save → POST to API → returns to list

### Edit Note
1. User clicks on a note card
2. Editor opens with existing data populated
3. User modifies content
4. Clicks Save → PUT to API → returns to list

### Delete Note
1. User opens a note in editor
2. Clicks Delete → confirmation dialog appears
3. Confirms → DELETE to API → returns to list

### Jump to Page
1. In list view, user clicks the page number on a note card
2. PDF viewer jumps to that page
3. User stays on Notes tab (no view change)

## Dependencies

No new dependencies required:
- `react-markdown` — already used for chat message rendering
- `nanoid` — already available in Next.js environment (use `crypto.randomUUID()` as alternative)

## Error Handling

- API errors display a toast/banner notification (consistent with existing error patterns)
- Storage read failures return empty array (consistent with existing `getChatHistory` pattern)
- Unsaved changes: no explicit warning on navigation away (YAGNI — can be added later if needed)
