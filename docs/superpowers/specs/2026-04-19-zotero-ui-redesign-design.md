# Zotero-Style UI Redesign — Design Spec

## Overview

Redesign EasyPaper's homepage and paper detail page to follow a Zotero-like layout pattern, while preserving the existing glass-morphism visual style. The change improves information density, paper browsing efficiency, and workflow familiarity for users accustomed to reference managers.

---

## 1. Homepage Redesign

### 1.1 Layout Structure

**Three-column resizable layout:**

| Column | Content | Width |
|--------|---------|-------|
| Left | Folder tree + search + filters | 240px (min) – 500px (max), default 240px |
| Center | Paper table (tabular view) | Flexible (fills remaining) |
| Right | Simple preview card | 280px (min) – 400px (max), default 280px |

### 1.2 Left Column — Folder Tree

**Component:** `paper-tree.tsx` (modified)

**Structure (top to bottom):**
1. Search input — filters papers across all folders
2. "My Library" header — uppercase label, same style as current "LIBRARY"
3. Folder tree with nested indentation:
   - Root: "All Papers" (shows total count)
   - User-created folders with paper counts
   - Sub-folders with deeper indentation
4. "+ New Folder" button at bottom

**Component:** `paper-tree-folder.tsx` (modified)

**Critical change:** Remove the paper list rendering inside expanded folders (currently lines 147-149: `folderPapers.map(paper => <PaperTreeItem ...>)`). The folder tree shows folder names and paper counts only — no paper items under folders. `PaperTreeItem` and its props are removed from the `PaperTreeFolder` interface.

**Preserved from current implementation:**
- Folder CRUD (create, rename, delete)
- Nested folder hierarchy with expand/collapse
- Drag-and-drop paper-to-folder (droppable target)
- Folder selection highlights active item
- Paper count display (total including sub-folders)

**Changes:**
- Header label: "LIBRARY" → "My Library"
- Search box moved to top of sidebar (currently inside `PaperTree` component — no structural change needed)

### 1.3 Center Column — Paper Table

**New component:** `paper-table.tsx` (extracted from `paper-tree.tsx`)

The current tree-based paper list (in `paper-tree-item.tsx`) is replaced with a tabular view.

**Table columns:**

| Column | Width | Sortable | Data Source |
|--------|-------|----------|-------------|
| Checkbox | 36px | No | Multi-select state |
| Title | Flexible | Yes | `paper.title` |
| Author | 200px | Yes | First author from metadata, truncated with "et al." |
| Year | 60px | Yes | `paper.year` from metadata |
| Status | 90px | Yes | `paper.status` (badge: ✓ Analyzed / ⏳ Pending / ✗ Error) |
| Star | 36px | Yes | `paper.starred` |
| Short Title | Flexible | Yes | User-defined short title field (new field on `PaperMetadata`) |

**Table features:**
- Sticky header for scrolling
- Row hover highlight
- Selected row highlight (same style as current tree selection)
- Double-click to open paper detail page
- Right-click context menu (unchanged — delete, move, star, clear)
- Column header click to sort
- Keyboard: Ctrl+A select all, Escape clear selection

**Toolbar above table:**
- Filter chips: All (N), Analyzed (N), Pending (N), Error (N), ★ Starred (N)
- Sort dropdown: Recent, Date, Name, Starred

### 1.4 Right Column — Simple Preview Card

**Component:** `preview-panel.tsx` (simplified)

**Structure (top to bottom):**
1. Star button + paper title + "Added [date]"
2. 2×2 stats grid: Sections, Notes, Chats, Pages
3. Metadata fields:
   - Authors
   - Year
   - Journal
   - Short Title (user-defined)
4. Action buttons: Open (primary), Analyze

**Removed from current implementation:**
- Analysis summary section
- Key Contributions section
- MetadataCard component (full metadata edit card)

The preview card becomes a lightweight info panel. Full metadata viewing and editing moves to the detail page.

### 1.5 Resizable Panels

**Component:** `resizable-panels.tsx` (extended)

Current two-column resizer is extended to support three columns:
- Left↔Center divider: default 240px, range [200, 500]
- Center↔Right divider: default 280px, range [240, 400]
- Width ratios persisted to localStorage (unchanged pattern)

---

## 2. Paper Detail Page Redesign

### 2.1 Layout Structure

**Two-column resizable layout:**

| Column | Content | Width |
|--------|---------|-------|
| Left | PDF viewer + toolbar | Flexible (default 55%) |
| Right | Tabbed panel (Info / Notes / Chat) | 400px (min) – 600px (max), default 400px |

### 2.2 Top Bar

**Modified `paper/[id]/page.tsx` top bar.**

**Structure (left to right):**
1. Back button (← to homepage)
2. Paper title (editable)
3. Status badge
4. Re-analyze button
5. **New:** Prompts button
6. **New:** Settings button

The Prompts and Settings buttons open the same modals as the homepage navbar. This makes the detail page self-contained — users don't need to navigate back to access these features.

### 2.3 PDF Viewer (Left Column)

**Component:** `pdf-viewer.tsx` (unchanged)

No structural changes to the PDF viewer. Toolbar and page navigation remain the same.

### 2.4 Tabbed Panel (Right Column)

**New component:** `paper-tabs.tsx`

A three-tab panel replaces the current Analysis/Notes/Bookmarks tab system and the chat section below.

**Tab bar:** Info | Notes (N) | Chat (N)

#### Tab 1: Info

Shows paper metadata and AI analysis results in a structured, scrollable format:

- **Title** — editable paper title
- **Metadata section:**
  - Authors (full list)
  - Year
  - Journal/Venue
  - DOI (clickable link)
  - Pages
  - Short Title (user-defined)
- **Tags** — clickable tag chips (existing tag system)
- **Summary** — AI-generated summary (from analysis.json)
- **Key Contributions** — bullet list from analysis.json

This consolidates the current `MetadataCard` and `AnalysisPanel` content into a single coherent view.

**Metadata editing:** The Info tab is read-only. Metadata editing (re-parse, manual field updates) is removed — users can edit the title and shortTitle inline (double-click to edit). Full PDF metadata re-extraction is triggered by the "Re-analyze" button in the top bar, which already re-parses the PDF.

#### Tab 2: Notes

Shows sentence-level notes list.

**Preserved from current `notes-panel.tsx`:**
- Note list with title, content preview, page number, and tags
- Click note to scroll PDF to highlighted text
- Edit/delete note
- Create new note

**Changes:**
- Layout adapted to fit within the tab panel
- Notes list scrolls within the tab content area (not the whole page)

#### Tab 3: Chat

Shows the existing chat interface within a tab.

**Layout within Chat tab:**
- Session list sidebar on the left (narrow, ~120px) — shows session titles, created dates, message counts
- Chat area on the right (fills remaining width) — messages scrollable area + input bar at bottom
- This is essentially the current layout from `paper/[id]/page.tsx` but contained within the tab panel

**Preserved from current implementation:**
- Chat messages display with SSE streaming
- Session management (new, delete, switch sessions)
- Pending quote (Ask AI from PDF selection — quote banner appears above input)
- Session titles auto-generated from first message

**Changes:**
- All chat UI elements constrained to the tab panel width (max ~600px total for right panel)
- Session sidebar remains a vertical list (same `ChatSessionBar` component, just repositioned)

### 2.5 Resizable Divider

**Component:** `resizable-divider.tsx` (unchanged)

The horizontal divider between PDF and right panel is preserved with the same drag behavior and localStorage persistence.

---

## 3. Data Model Changes

### 3.1 New Field: `shortTitle` on `PaperMetadata`

Add `shortTitle?: string` to the `PaperMetadata` type in `src/types/index.ts`.

**API changes:**
- `PATCH /api/paper/[id]` — accepts `shortTitle` field
- `GET /api/paper/[id]` — returns `shortTitle` in metadata
- `GET /api/papers` — returns `shortTitle` in each paper's metadata

**Storage:** Saved in each paper's `metadata.json` file.

**UI:**
- Homepage table: "Short Title" column, inline editable (double-click or right-click menu)
- Preview panel: displayed as a metadata field
- Detail page Info tab: displayed as a metadata field, editable

### 3.2 Extend `PaperListItem` for Table Columns

The paper table needs author, year, and shortTitle data. Currently `PaperListItem` (returned by `/api/papers` via `storage.listPapers()`) only contains: id, title, createdAt, status, folderId, sortIndex, starred, pdfDate.

Add these fields to `PaperListItem` in `src/types/index.ts`:
- `shortTitle?: string`
- `authors?: string[]` (from `pdfMetadata.authors`)
- `year?: string` (extracted from `pdfMetadata.date` — parse the year from the ISO date string)

Update `storage.listPapers()` in `src/lib/storage.ts` to include these fields when building the `PaperListItem` objects (line 245). The full `PaperMetadata` is already loaded via `getMetadata()` in that loop, so adding these fields is a matter of including them in the push call.

**Year extraction:** `pdfMetadata.date` is an ISO string (e.g., "2017-12-06T00:00:00Z"). Extract the year with `new Date(date).getFullYear().toString()`. If no date, leave empty.

**Author display:** In the table, show `authors[0]` if single author, or `authors[0] + " et al."` if multiple. Truncate if needed.

---

## 4. Component Changes Summary

| File | Change | Type |
|------|--------|------|
| `src/components/paper-table.tsx` | **New** — Tabular paper list with columns, sorting, selection | New |
| `src/components/paper-tree.tsx` | Remove paper list rendering; keep folder tree only | Modify |
| `src/components/paper-tabs.tsx` | **New** — Tabbed panel (Info/Notes/Chat) for detail page | New |
| `src/components/preview-panel.tsx` | Simplify: remove analysis sections, add Short Title field | Modify |
| `src/components/navbar.tsx` | Unchanged (homepage only) | — |
| `src/app/page.tsx` | Swap right panel from `PaperTree` (with papers) to `PaperTable`; update layout to 3-column | Modify |
| `src/app/paper/[id]/page.tsx` | Add Prompts/Settings buttons to top bar; replace right panel with `PaperTabs`; remove bottom chat zone | Modify |
| `src/components/resizable-panels.tsx` | Add third-column support | Modify |
| `src/types/index.ts` | Add `shortTitle?: string` to `PaperMetadata` | Modify |
| `src/app/api/paper/[id]/route.ts` | Accept `shortTitle` in PATCH | Modify |

### 4.1 Components to Remove

| File | Reason |
|------|--------|
| `src/components/paper-row.tsx` | Already orphaned (not used anywhere in current codebase) | Remove |
| `src/components/paper-tree-item.tsx` | Replaced by table row rendering |
| `src/components/paper-tree-folder.tsx` | Remove paper item rendering; keep folder tree logic | Modify |
| `src/components/chat-session-bar.tsx` | Merged into `paper-tabs.tsx` Chat tab |
| `src/components/analysis-panel.tsx` | Content merged into Info tab of `paper-tabs.tsx` |
| `src/components/notes-panel.tsx` | Content merged into Notes tab of `paper-tabs.tsx` |
| `src/components/bookmarks-panel.tsx` | Bookmarks list view removed; bookmark add/remove stays via PDF toolbar button (unchanged) |
| `src/components/batch-action-toolbar.tsx` | Kept — still used for multi-select on homepage |
| `src/components/paper/metadata-card.tsx` | Content merged into Info tab; component removed |

---

## 5. Visual Style

**No change to the existing visual design language.** The glass-morphism theme, CSS variables, color scheme, rounded corners, and spacing all remain unchanged. Only the layout structure and component organization change.

---

## 6. Implementation Order

1. **Data model** — Add `shortTitle` field to `PaperMetadata` type and API
2. **Paper table component** — Build `paper-table.tsx` with columns, sorting, selection
3. **Homepage layout** — Integrate 3-column layout with `PaperTable` and simplified `PreviewPanel`
4. **Paper tabs component** — Build `paper-tabs.tsx` with Info/Notes/Chat tabs
5. **Detail page layout** — Update detail page with Prompts/Settings buttons and `PaperTabs`
6. **Cleanup** — Remove obsolete components, verify all features work
