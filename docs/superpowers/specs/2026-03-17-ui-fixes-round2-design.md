# UI Fixes Round 2 — Design Spec

## Goal

Fix three remaining UI issues from the previous round: Column 1 folder tree papers too verbose, Column 2 missing relative timestamps, Column 3 pages always 0, and Column 3 more menu missing Rename/Move-to.

## Changes

### 1. Column 1 — Simplify folder tree paper items

**File:** `src/components/folder-tree.tsx` (inner `PaperRow` component, lines 23-121)

**Current behavior:** Papers in the folder tree show `📄` icon, multi-line title, relative timestamp ("14 hours ago"), and a `⋯` context menu with Move-to and Delete actions. Clicking navigates to `/paper/{id}`.

**New behavior:** Single-line text-only item:
- Remove `📄` icon, relative timestamp line, `⋯` menu button
- Remove `router.push` click-to-navigate behavior
- Remove `MoveToPicker` rendering and `showMenu`/`showMovePicker` state
- Keep depth-based `paddingLeft` indentation for folder hierarchy
- Single line with `text-overflow: ellipsis`, `overflow: hidden`, `white-space: nowrap`
- Font size ~11px, color `var(--text-primary)` (no active/current state needed)
- The component no longer needs `onClose`, `onMovePaper`, `onDeletePaper`, `folders`, `useRouter`, or `formatRelativeTime` — remove those props/imports if unused elsewhere

### 2. Column 2 — Add relative timestamps

**File:** `src/components/paper-row.tsx` (line 40)

**Current:** `{new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

**New:** `{formatRelativeTime(paper.createdAt)}` — import from `@/lib/format.ts`

This shows "14 hours ago", "4 days ago", etc. instead of "Mar 13".

### 3. Column 3 — Fix Pages count (always shows 0)

**Root cause:** `pages: 0` is hardcoded at upload (`src/app/api/upload/route.ts:24`) and never updated. The Python `parse-pdf.py` script doesn't extract page count.

**Fix approach:** Use `pdfjs-dist` (already a project dependency for the PDF viewer) to count pages server-side during upload.

**File:** `src/app/api/upload/route.ts`

- After saving the PDF buffer to disk, load it with `pdfjs-dist` to get `numPages`
- Store the actual page count in `metadata.pages` instead of `0`
- This is a server-side Node.js context — use `pdfjs-dist/legacy/build/pdf.mjs` (the Node-compatible build)

### 4. Column 3 — Enhanced "⋯" menu (Rename + Move-to)

**File:** `src/components/preview-panel.tsx`

**Current menu items:** "Move to folder" (conditional on `onMovePaper && folders`), "Delete"

**New menu items (in order):**
1. **Rename** — triggers inline editing of the paper title in the preview header
2. **Move to folder** — always shown (parent must pass the props)
3. **Delete** — unchanged

**Rename implementation:**
- Add `isRenaming` state to PreviewPanel
- When "Rename" is clicked: close menu, set `isRenaming = true`
- When `isRenaming`, replace the title `<div>` with an `<input>` (similar to EditableTitle pattern)
- On Enter or blur: call `onRename(paper.id, newTitle)` callback, reset state
- On Escape: cancel, reset state
- Add `onRename?: (id: string, title: string) => Promise<void>` prop

**File:** `src/app/page.tsx`

- Pass `folders`, `onMovePaper={handleMovePaper}`, and `onRename={handleRename}` to `<PreviewPanel>`
- Add `handleRename` handler:
  ```typescript
  const handleRename = async (id: string, title: string) => {
    await fetch(`/api/paper/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    await fetchPapers();
  };
  ```

## Files to modify

| File | Change |
|------|--------|
| `src/components/folder-tree.tsx` | Simplify inner PaperRow to single-line text |
| `src/components/paper-row.tsx` | Use `formatRelativeTime` instead of `toLocaleDateString` |
| `src/app/api/upload/route.ts` | Extract page count with pdfjs-dist on upload |
| `src/components/preview-panel.tsx` | Add Rename to menu, inline rename UI, ensure Move-to works |
| `src/app/page.tsx` | Pass folders/onMovePaper/onRename to PreviewPanel, add handleRename |

## Out of scope

- Re-analyzing existing papers to backfill page counts (only new uploads get pages)
- Changing folder tree structure or folder management UI
- Any other Column 3 changes beyond the menu
