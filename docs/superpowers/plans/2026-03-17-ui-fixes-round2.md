# UI Fixes Round 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four UI issues — simplify Column 1 folder tree papers, add relative timestamps to Column 2, fix Column 3 pages count, and add Rename/Move-to to Column 3 more menu.

**Architecture:** Four independent changes across 5 files. Column 1 and 2 are pure frontend component edits. Column 3 pages fix requires a server-side change to extract page count at upload using pdfjs-dist. Column 3 menu enhancement adds inline rename state and wires up missing props from the homepage.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, pdfjs-dist 5

---

## Chunk 1: Column 1 & Column 2 Fixes

### Task 1: Simplify folder tree PaperRow to single-line text

**Files:**
- Modify: `src/components/folder-tree.tsx:23-121`

The inner `PaperRow` component currently renders papers with an icon, multi-line title, relative timestamp, context menu, and click-to-navigate. Replace it with a minimal single-line text item.

- [ ] **Step 1: Replace the PaperRow component**

Replace the entire `PaperRow` function (lines 23-121) in `src/components/folder-tree.tsx` with this simplified version:

```tsx
function PaperRow({
  paper,
  depth,
}: {
  paper: PaperListItem;
  depth: number;
}) {
  return (
    <div
      className="truncate"
      style={{
        paddingLeft: `${10 + depth * 14}px`,
        paddingTop: '3px',
        paddingBottom: '3px',
        paddingRight: '12px',
        fontSize: '11px',
        color: 'var(--text-primary)',
      }}
      title={paper.title}
    >
      {paper.title}
    </div>
  );
}
```

- [ ] **Step 2: Remove unused imports**

At the top of `folder-tree.tsx`, the following imports are no longer needed by `PaperRow` (but check if `FolderRow` or `MoveToPicker` still use them before removing):

- `useRouter` from `next/navigation` — still used by... actually check: `FolderRow` does NOT use `useRouter`. `MoveToPicker` does NOT use it. Only the old `PaperRow` used it. **Remove the import.**
- `formatRelativeTime` from `@/lib/format` — only used by old `PaperRow`. **Remove the import.**

The line to remove: `import { useRouter } from 'next/navigation';`
The line to remove: `import { formatRelativeTime } from '@/lib/format';`

- [ ] **Step 3: Update PaperRow call sites**

The `PaperRow` component is rendered in two places within `folder-tree.tsx`:

1. Inside `FolderRow` (around line 422-433):
```tsx
{folderPapers.map((paper) => (
  <PaperRow
    key={paper.id}
    paper={paper}
    isCurrent={paper.id === currentPaperId}
    depth={depth + 1}
    onClose={onClose}
    onMovePaper={onMovePaper}
    onDeletePaper={onDeletePaper}
    folders={folders}
  />
))}
```
Change to:
```tsx
{folderPapers.map((paper) => (
  <PaperRow
    key={paper.id}
    paper={paper}
    depth={depth + 1}
  />
))}
```

2. Inside `FolderTree` (around line 477-488):
```tsx
{rootPapers.map((paper) => (
  <PaperRow
    key={paper.id}
    paper={paper}
    isCurrent={paper.id === currentPaperId}
    depth={0}
    onClose={onClose}
    onMovePaper={onMovePaper}
    onDeletePaper={onDeletePaper}
    folders={folders}
  />
))}
```
Change to:
```tsx
{rootPapers.map((paper) => (
  <PaperRow
    key={paper.id}
    paper={paper}
    depth={0}
  />
))}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/folder-tree.tsx
git commit -m "fix: simplify folder tree paper items to single-line text"
```

---

### Task 2: Add relative timestamps to Column 2 PaperRow

**Files:**
- Modify: `src/components/paper-row.tsx:1-63`

- [ ] **Step 1: Add import**

Add this import at the top of `src/components/paper-row.tsx` (after the existing type import on line 3):

```tsx
import { formatRelativeTime } from '@/lib/format';
```

- [ ] **Step 2: Replace date formatting**

In `src/components/paper-row.tsx`, replace line 40:

```tsx
{new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
```

with:

```tsx
{formatRelativeTime(paper.createdAt)}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/paper-row.tsx
git commit -m "fix: show relative timestamps in paper list"
```

---

## Chunk 2: Column 3 Fixes

### Task 3: Fix Pages count — extract page count at upload

**Files:**
- Modify: `src/app/api/upload/route.ts:1-30`

- [ ] **Step 1: Add pdfjs-dist import**

Add this import at the top of `src/app/api/upload/route.ts` (after the existing imports):

```tsx
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
```

Note: Using the `legacy` build which works in Node.js without a DOM. The `pdfjs-dist` package is already installed (v5.5.207).

- [ ] **Step 2: Extract page count after saving PDF**

In `src/app/api/upload/route.ts`, replace lines 18-25 (from `const paperId` through the `saveMetadata` call) with:

```tsx
    const paperId = uuidv4();
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.createPaperDir(paperId);
    await storage.savePdf(paperId, buffer);

    // Extract page count from PDF
    let pageCount = 0;
    try {
      const uint8 = new Uint8Array(buffer);
      const pdf = await getDocument({ data: uint8 }).promise;
      pageCount = pdf.numPages;
    } catch {
      // If page extraction fails, default to 0
    }

    await storage.saveMetadata(paperId, {
      id: paperId, title: file.name.replace(/\.pdf$/i, ''), filename: file.name,
      pages: pageCount, createdAt: new Date().toISOString(), status: 'pending',
    });
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors. If there's a type error on the `getDocument` import, try the alternative import path `pdfjs-dist/build/pdf.mjs` or use `const pdfjsLib = await import('pdfjs-dist')` pattern instead.

- [ ] **Step 4: Test manually**

Run: `npm run dev`
Upload a PDF and check:
1. The upload succeeds (no crash from pdfjs-dist import)
2. Check `data/papers/{new-id}/metadata.json` — the `pages` field should now be > 0
3. Select the paper on the homepage — Column 3 should show the correct page count

- [ ] **Step 5: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "fix: extract PDF page count at upload using pdfjs-dist"
```

---

### Task 4: Add Rename and ensure Move-to in Column 3 more menu

**Files:**
- Modify: `src/components/preview-panel.tsx:1-133`
- Modify: `src/app/page.tsx:268-271`

- [ ] **Step 1: Add onRename prop and rename state to PreviewPanel**

In `src/components/preview-panel.tsx`, update the `PreviewPanelProps` interface (lines 8-14) to add `onRename`:

```tsx
interface PreviewPanelProps {
  paper: PaperListItem | null;
  onDelete?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onMovePaper?: (paperId: string, folderId: string | null) => void;
  onRename?: (id: string, title: string) => Promise<void>;
  folders?: { id: string; name: string }[];
}
```

Update the destructuring on line 16:

```tsx
export function PreviewPanel({ paper, onDelete, onAnalyze, onMovePaper, onRename, folders }: PreviewPanelProps) {
```

Add rename state after the existing state declarations (after line 22):

```tsx
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
```

Add a `useEffect` to reset rename state when paper changes (add after the existing `useEffect` that fetches data, around line 45):

```tsx
  useEffect(() => {
    setIsRenaming(false);
  }, [paper]);
```

- [ ] **Step 2: Add inline rename UI to the header**

In `src/components/preview-panel.tsx`, replace the title `<div>` on line 65:

```tsx
<div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, letterSpacing: '-0.2px' }}>{paper.title}</div>
```

with:

```tsx
{isRenaming ? (
  <input
    autoFocus
    type="text"
    value={renameValue}
    onChange={(e) => setRenameValue(e.target.value)}
    onBlur={async () => {
      const trimmed = renameValue.trim();
      if (trimmed && trimmed !== paper.title && onRename) {
        await onRename(paper.id, trimmed);
      }
      setIsRenaming(false);
    }}
    onKeyDown={async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== paper.title && onRename) {
          await onRename(paper.id, trimmed);
        }
        setIsRenaming(false);
      } else if (e.key === 'Escape') {
        setIsRenaming(false);
      }
    }}
    maxLength={200}
    className="w-full rounded-md px-2 py-1 outline-none"
    style={{
      fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)',
      background: 'var(--surface)', border: '2px solid var(--accent)',
      boxShadow: '0 0 0 2px var(--accent-subtle)',
    }}
  />
) : (
  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, letterSpacing: '-0.2px' }}>{paper.title}</div>
)}
```

- [ ] **Step 3: Add Rename option to the menu**

In `src/components/preview-panel.tsx`, inside the `menuOpen` dropdown (line 78), add the Rename button as the **first** menu item (before the Move to folder section). Insert right after the opening `<div>` of the dropdown:

```tsx
{onRename && (
  <button
    onClick={() => {
      setMenuOpen(false);
      setRenameValue(paper.title);
      setIsRenaming(true);
    }}
    className="w-full text-left cursor-pointer block"
    style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}
  >
    Rename
  </button>
)}
```

- [ ] **Step 4: Wire up props in page.tsx**

In `src/app/page.tsx`, add the `handleRename` handler (add after `handleMovePaper` around line 71):

```tsx
  const handleRename = async (id: string, title: string) => {
    await fetch(`/api/paper/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    await fetchPapers();
  };
```

Then update the `<PreviewPanel>` usage (line 270) to pass all needed props:

```tsx
<PreviewPanel
  paper={selectedPaper}
  onDelete={handleDelete}
  onMovePaper={handleMovePaper}
  onRename={handleRename}
  folders={folders}
/>
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Test manually**

Run: `npm run dev`
1. Select a paper → click `⋯` → verify "Rename", "Move to folder", and "Delete" all appear
2. Click "Rename" → title becomes an editable input → type new name → press Enter → title updates
3. Click "Rename" → press Escape → cancels without saving
4. Click "Move to folder" → submenu shows all folders → click one → paper moves
5. Click "Delete" → paper is deleted

- [ ] **Step 7: Commit**

```bash
git add src/components/preview-panel.tsx src/app/page.tsx
git commit -m "feat: add Rename and Move-to in preview panel menu"
```

---

### Task 5: Full build verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: All routes compile successfully

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (or only pre-existing warnings)
