# Bookmark Feature Design

## Overview

Add two bookmark capabilities to EasyPaper:

1. **Paper-level starring** — mark papers as important for quick filtering
2. **PDF page-level bookmarks** — mark specific pages within a paper for quick navigation

## Data Model

### Paper Starring

Add `starred?: boolean` to both `PaperMetadata` and `PaperListItem` in `src/types/index.ts`. Defaults to `false`/`undefined`. The `listPapers()` method in `storage.ts` must propagate the `starred` field when constructing `PaperListItem`. Toggled via the existing `PATCH /api/paper/[id]` endpoint (handler must be updated to accept `starred` in addition to the currently supported `title`, `folderId`, `sortIndex`).

### Page Bookmarks

New file per paper: `data/papers/{paperId}/bookmarks.json`

```typescript
interface Bookmark {
  id: string        // crypto.randomUUID() generated (consistent with notes)
  page: number      // 1-based page number
  label?: string    // optional short note
  createdAt: string // ISO timestamp
}
```

The `Bookmark` type is defined in `src/types/index.ts` alongside the existing `Note` type. Storage file contains a `Bookmark[]` array, sorted by page number. Constraint: one bookmark per page (enforced at the API layer).

## Storage Layer

Add to `src/lib/storage.ts`:

- `getBookmarks(paperId: string): Promise<Bookmark[]>` — read `bookmarks.json`, return `[]` if file doesn't exist
- `saveBookmarks(paperId: string, bookmarks: Bookmark[]): Promise<void>` — write `bookmarks.json`

Follows the same pattern as existing `getNotes` / `saveNotes`.

## API Routes

### Starring

No new routes. Use existing endpoint:

```
PATCH /api/paper/[id]  body: { starred: true | false }
```

### Page Bookmarks

New route file: `src/app/api/paper/[id]/bookmarks/route.ts`

| Method | Params | Description |
|--------|--------|-------------|
| GET | — | Return bookmarks sorted by page number |
| POST | body: `{ page, label? }` | Create bookmark, return created bookmark |
| PUT | body: `{ id, label }` | Update bookmark label |
| DELETE | query: `?bookmarkId=xxx` | Delete bookmark by id |

Mirrors the pattern of `src/app/api/paper/[id]/notes/route.ts` (which uses query params for DELETE).

## UI Design

### Home Page — Paper Starring

Three touch points for the star feature:

**1. Paper list item (`paper-row.tsx`):**
- Star icon to the left of the paper title
- Not starred: hollow gray star (☆)
- Starred: solid gold star (★) with subtle warm background highlight on the row
- Click to toggle star state via `PATCH /api/paper/[id]`

**2. Filter bar (home page):**
- New "★ Starred" filter button alongside existing All / Analyzed / Pending / Error buttons
- When active, only starred papers are shown
- Can combine with folder selection (show starred papers in selected folder)

**3. Preview panel (`preview-panel.tsx`):**
- Star icon to the left of the paper title in the preview panel
- Provides an additional starring entry point when a paper is selected

### Paper Detail Page — PDF Page Bookmarks

Four interaction areas:

**1. PDF viewer toolbar — bookmark button:**
- Placed in the right section of the toolbar, alongside the existing keyboard shortcuts button
- Toolbar layout: `[◀ page ▶] | [− zoom +] | [🔖 ⌨]`
- No bookmark on current page: gray outline icon
- Current page has bookmark: gold highlighted icon
- Click behavior (no bookmark): open a small popover to enter an optional label, confirm to add
- Click behavior (has bookmark): navigate to the bookmark entry in the Bookmarks tab

**2. Progress bar — bookmark markers** (the existing draggable page progress bar at the bottom of the PDF viewer)**:**
- Gold vertical markers on the progress bar at positions corresponding to bookmarked pages
- Provides a global view of bookmark distribution across the entire document
- Hover on a marker shows the bookmark label in a tooltip

**3. Right-click context menu:**
- New menu item on PDF page right-click: "Add Bookmark Here"
- If current page already has a bookmark: show "Edit Bookmark" and "Remove Bookmark" instead
- Selecting "Add Bookmark Here" opens the label input popover

**4. Right panel — Bookmarks tab:**
- New tab alongside existing "Analysis" and "Notes" tabs
- Tab bar becomes: `Analysis | Notes | Bookmarks`
- Bookmark list sorted by page number ascending
- Each item shows:
  - Page number badge (e.g., "P3") on the left
  - Label text (or italic "No label" if empty)
  - Relative timestamp
  - Delete button (×) on the right
- Click a bookmark item → PDF viewer jumps to that page, item highlights in gold
- Double-click the label text → inline edit mode to update the label (Enter to save, Escape to cancel)
- Bottom of the list: "+ Add Bookmark for Current Page" button as a quick-add shortcut

### Add Bookmark Popover

A small popover that appears when adding a bookmark (from toolbar button, right-click menu, or tab bottom button):

- Text input field for optional label (placeholder: "Add a note...")
- "Add" confirm button and "Cancel" button
- Pressing Enter confirms, Escape cancels
- Label can be left empty — bookmark is created with just the page number

## Error Handling

- Adding a bookmark for a page that already has one: show the existing bookmark in the Bookmarks tab instead of creating a duplicate (one bookmark per page)
- Deleting a bookmark updates the toolbar icon and progress bar marker immediately
- Network errors on save: show a brief toast notification, keep local state unchanged

## Scope Exclusions

- No bookmark import/export
- No bookmark sharing
- No bookmark search
- No bookmark colors or categories (beyond the optional label)
- No keyboard shortcut for adding bookmarks (can be added later)
