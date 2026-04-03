# Fix Drag-and-Drop in Tauri App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace HTML5 drag API with @dnd-kit to fix paper drag-to-folder and reorder functionality in Tauri app.

**Architecture:** Wrap tree components with `DndContext`, convert folders to `useDroppable` targets, convert papers to `useDraggable`/`useSortable` items. Maintain existing visual feedback and callback interfaces.

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/components/paper-tree.tsx` | DndContext wrapper for paper-tree, onDragEnd handler (move only) |
| `src/components/paper-tree-folder.tsx` | Droppable folder targets, remove HTML5 handlers |
| `src/components/paper-tree-item.tsx` | Draggable paper items (move only) |
| `src/components/folder-tree.tsx` | DndContext + SortableContext for reorder support |
| `__tests__/components/paper-tree-item.test.tsx` | Update tests for hook-based implementation |

---

## Chunk 1: Dependencies + paper-tree.tsx + paper-tree-folder.tsx

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install @dnd-kit packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: Packages added to package.json and package-lock.json

- [ ] **Step 2: Verify installation**

```bash
npm list @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: Shows installed versions

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @dnd-kit for cross-platform drag-and-drop"
```

---

### Task 2: Refactor paper-tree.tsx (Add DndContext)

**Files:**
- Modify: `src/components/paper-tree.tsx:1-234`

**Reference:** Spec section "1. paper-tree.tsx - DndContext Wrapper"

- [ ] **Step 1: Add DndContext imports**

Add at top of file after existing imports:

```tsx
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
```

- [ ] **Step 2: Add onDragEnd handler**

Add inside component function, before `handleCreateRoot`:

```tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over) return;

  const overData = over.data.current;

  // Move paper to folder (only action for paper-tree.tsx)
  if (overData?.type === 'folder') {
    onMovePaper(active.id as string, over.id as string);
  }
};
```

- [ ] **Step 3: Wrap tree content with DndContext**

Wrap the `<div style={{ flex: 1, overflow: 'auto' }}>` section (lines 182-221) with DndContext:

```tsx
<DndContext
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <div style={{ flex: 1, overflow: 'auto' }}>
    {/* existing content */}
  </div>
</DndContext>
```

- [ ] **Step 4: Remove outer draggable wrapper from rootPapers**

In the `rootPapers.map` block (lines 194-208), remove the outer `<div draggable onDragStart={...}>` wrapper. Keep only the `PaperTreeItem`:

Change from:
```tsx
{rootPapers.map(paper => (
  <div key={paper.id} draggable onDragStart={e => e.dataTransfer.setData('application/x-paper-id', paper.id)}>
    <PaperTreeItem
      paper={paper}
      isSelected={paper.id === selectedPaperId}
      isChecked={selectedPaperIds.has(paper.id)}
      depth={0}
      onClick={() => onPaperClick(paper.id)}
      onDoubleClick={() => onPaperDoubleClick(paper.id)}
      onCheckboxToggle={() => onCheckboxToggle(paper.id)}
      onContextMenu={e => onContextMenuOpen(e, paper.id)}
      onToggleStar={() => onToggleStar(paper.id)}
    />
  </div>
))}
```

To:
```tsx
{rootPapers.map(paper => (
  <PaperTreeItem
    key={paper.id}
    paper={paper}
    isSelected={paper.id === selectedPaperId}
    isChecked={selectedPaperIds.has(paper.id)}
    depth={0}
    onClick={() => onPaperClick(paper.id)}
    onDoubleClick={() => onPaperDoubleClick(paper.id)}
    onCheckboxToggle={() => onCheckboxToggle(paper.id)}
    onContextMenu={e => onContextMenuOpen(e, paper.id)}
    onToggleStar={() => onToggleStar(paper.id)}
  />
))}
```

- [ ] **Step 5: Verify component renders**

```bash
npm run build 2>&1 | head -20
```

Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/components/paper-tree.tsx
git commit -m "refactor: add DndContext to paper-tree for @dnd-kit migration"
```

---

### Task 3: Refactor paper-tree-folder.tsx (Add useDroppable)

**Files:**
- Modify: `src/components/paper-tree-folder.tsx:1-152`

**Reference:** Spec section "2. paper-tree-folder.tsx - Droppable Region"

- [ ] **Step 1: Add useDroppable import**

Add at top of file after existing imports:

```tsx
import { useDroppable } from '@dnd-kit/core';
```

- [ ] **Step 2: Add useDroppable hook**

Add inside component function, after state declarations (around line 48):

```tsx
const { setNodeRef, isOver } = useDroppable({
  id: folder.id,
  data: {
    type: 'folder',
    folderId: folder.id,
  },
});
```

- [ ] **Step 3: Remove isDragOver state**

Delete line 48:
```tsx
const [isDragOver, setIsDragOver] = useState(false);
```

The `isOver` from `useDroppable` replaces this.

- [ ] **Step 4: Update folder row div to use setNodeRef and isOver**

Replace the outer folder `<div>` (lines 94-113) to use `setNodeRef` and `isOver`:

```tsx
<div
  ref={setNodeRef}
  style={{
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    paddingLeft: `${10 + depth * 16}px`,
    background: isOver ? 'var(--accent-subtle)' : 'transparent',
    outline: isOver ? '2px solid var(--accent)' : undefined,
    outlineOffset: '-2px',
    borderRadius: '8px',
    cursor: 'pointer',
    gap: '6px',
    position: 'relative',
    marginBottom: '2px',
  }}
  onClick={() => setExpanded(!expanded)}
>
  {/* existing content */}
</div>
```

- [ ] **Step 5: Remove HTML5 drag event handlers**

Remove from the folder div:
- `onDragOver={e => { if (e.dataTransfer.types.includes('application/x-paper-id')) { e.preventDefault(); setIsDragOver(true); } }}`
- `onDragLeave={() => setIsDragOver(false)}`
- `onDrop={e => { e.preventDefault(); setIsDragOver(false); const paperId = e.dataTransfer.getData('application/x-paper-id'); if (paperId) onDropPaper(paperId, folder.id); }}`

These are no longer needed - DndContext handles drag events.

- [ ] **Step 6: Remove outer draggable wrapper from folderPapers**

In the `folderPapers.map` block (lines 143-146), remove the outer `<div draggable onDragStart={...}>` wrapper:

Change from:
```tsx
{folderPapers.map(paper => (
  <div key={paper.id} draggable onDragStart={e => e.dataTransfer.setData('application/x-paper-id', paper.id)}>
    <PaperTreeItem paper={paper} isSelected={paper.id === selectedPaperId} isChecked={selectedPaperIds.has(paper.id)} depth={depth + 1} onClick={() => onPaperClick(paper.id)} onDoubleClick={() => onPaperDoubleClick(paper.id)} onCheckboxToggle={() => onPaperCheckboxToggle(paper.id)} onContextMenu={e => onPaperContextMenu(e, paper.id)} onToggleStar={() => onToggleStar(paper.id)} />
  </div>
))}
```

To:
```tsx
{folderPapers.map(paper => (
  <PaperTreeItem key={paper.id} paper={paper} isSelected={paper.id === selectedPaperId} isChecked={selectedPaperIds.has(paper.id)} depth={depth + 1} onClick={() => onPaperClick(paper.id)} onDoubleClick={() => onPaperDoubleClick(paper.id)} onCheckboxToggle={() => onPaperCheckboxToggle(paper.id)} onContextMenu={e => onPaperContextMenu(e, paper.id)} onToggleStar={() => onToggleStar(paper.id)} />
))}
```

- [ ] **Step 7: Remove unused onDropPaper prop**

The `onDropPaper` prop (line 18) is no longer used - DndContext calls `onMovePaper` directly. Remove from interface and destructuring:

Remove from interface:
```tsx
onDropPaper: (paperId: string, folderId: string) => void;
```

Remove from destructuring in component function.

- [ ] **Step 8: Verify component renders**

```bash
npm run build 2>&1 | head -20
```

Expected: No TypeScript errors (may have unused prop warning in paper-tree.tsx)

- [ ] **Step 9: Commit**

```bash
git add src/components/paper-tree-folder.tsx
git commit -m "refactor: add useDroppable to paper-tree-folder for @dnd-kit migration"
```

---

### Task 4: Update paper-tree.tsx to remove onDropPaper prop usage

**Files:**
- Modify: `src/components/paper-tree.tsx`

- [ ] **Step 1: Remove onDropPaper prop from PaperTreeFolder usage**

In `paper-tree.tsx`, the `PaperTreeFolder` component (line 184) passes `onDropPaper`. Remove this prop since it's no longer needed:

Change from:
```tsx
<PaperTreeFolder key={folder.id} folder={folder} depth={0} papers={filteredPapers} allFolders={folders} selectedPaperIds={selectedPaperIds} selectedPaperId={selectedPaperId} onPaperClick={onPaperClick} onPaperDoubleClick={onPaperDoubleClick} onPaperCheckboxToggle={onCheckboxToggle} onPaperContextMenu={onContextMenuOpen} onDropPaper={(paperId, folderId) => onMovePaper(paperId, folderId)} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onCreateChildFolder={(name, parentId) => onCreateFolder(name, parentId)} onToggleStar={onToggleStar} />
```

To:
```tsx
<PaperTreeFolder key={folder.id} folder={folder} depth={0} papers={filteredPapers} allFolders={folders} selectedPaperIds={selectedPaperIds} selectedPaperId={selectedPaperId} onPaperClick={onPaperClick} onPaperDoubleClick={onPaperDoubleClick} onPaperCheckboxToggle={onCheckboxToggle} onPaperContextMenu={onContextMenuOpen} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onCreateChildFolder={(name, parentId) => onCreateFolder(name, parentId)} onToggleStar={onToggleStar} />
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -20
```

Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/paper-tree.tsx
git commit -m "refactor: remove unused onDropPaper prop from PaperTreeFolder"
```

---

## Chunk 2: paper-tree-item.tsx

### Task 5: Refactor paper-tree-item.tsx (Add useDraggable)

**Files:**
- Modify: `src/components/paper-tree-item.tsx:1-128`
- Modify: `__tests__/components/paper-tree-item.test.tsx:1-72`

**Reference:** Spec section "3. paper-tree-item.tsx - Draggable Item (Move Only)"

- [ ] **Step 1: Add useDraggable import**

Add at top of file:

```tsx
import { useDraggable } from '@dnd-kit/core';
```

- [ ] **Step 2: Add useDraggable hook inside component**

Add inside component function, after `const isStarred = ...`:

```tsx
const {
  attributes,
  listeners,
  setNodeRef,
  isDragging,
} = useDraggable({
  id: paper.id,
  data: {
    type: 'paper',
    paperId: paper.id,
    folderId: paper.folderId,
  },
});
```

- [ ] **Step 3: Update outer div to use useDraggable**

Update the outer div to use `ref={setNodeRef}`, add opacity for dragging state, and spread drag handlers:

```tsx
<div
  ref={setNodeRef}
  style={{
    padding: '10px 10px 10px ' + `${12 + depth * 16}px`,
    marginBottom: '2px',
    background: isChecked ? 'var(--accent-subtle)' : isSelected ? 'rgba(255,255,255,0.04)' : isStarred ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
    border: isChecked || isSelected ? '1px solid rgba(157,157,181,0.12)' : '1px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s ease, border 0.15s ease',
    opacity: isDragging ? 0.4 : 1,
  }}
  onClick={onClick}
  onDoubleClick={onDoubleClick}
  onContextMenu={onContextMenu}
  {...attributes}
  {...listeners}
>
```

**Note:** The `{...listeners}` spread uses pointer events (`onPointerDown`) which are separate from click events. This means `onClick`, `onDoubleClick`, and `onContextMenu` handlers will work alongside drag functionality without conflicts.

**Note:** The existing `stopPropagation()` on checkbox (line 66-67 in current code) and star button (`handleStarClick` at line 42-43) will prevent those elements from triggering drag. This is already correctly implemented.

- [ ] **Step 4: Update test file for useDraggable mock**

Update `__tests__/components/paper-tree-item.test.tsx` to mock @dnd-kit:

Add at top of file:
```tsx
// Mock @dnd-kit/core
jest.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    isDragging: false,
  }),
}));
```

- [ ] **Step 5: Run tests**

```bash
npm test __tests__/components/paper-tree-item.test.tsx
```

Expected: All tests pass

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | head -20
```

Expected: No TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/components/paper-tree-item.tsx __tests__/components/paper-tree-item.test.tsx
git commit -m "refactor: add useDraggable to paper-tree-item for @dnd-kit migration"
```

---

## Chunk 3: folder-tree.tsx

### Task 6: Refactor folder-tree.tsx (Add DndContext + SortableContext)

**Files:**
- Modify: `src/components/folder-tree.tsx:1-594`

**Reference:** Spec section "4. folder-tree.tsx - Full Implementation (Move + Reorder)"

- [ ] **Step 1: Add @dnd-kit imports**

Add at top of file:

```tsx
import { DndContext, DragEndEvent, closestCenter, DragOverlay } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

- [ ] **Step 2: Create useDroppable hook for FolderRow**

In `FolderRow` component (around line 203), add after state declarations:

```tsx
const { setNodeRef: setFolderRef, isOver: isFolderOver } = useDroppable({
  id: folder.id,
  data: {
    type: 'folder',
    folderId: folder.id,
  },
});
```

Note: Need to import `useDroppable` from '@dnd-kit/core'.

- [ ] **Step 3: Remove isDragOver state from FolderRow**

Delete line 210:
```tsx
const [isDragOver, setIsDragOver] = useState(false);
```

- [ ] **Step 4: Update FolderRow div to use useDroppable**

Update the outer folder `<div>` (around line 279) to use `setFolderRef` and `isFolderOver`:

Replace:
```tsx
<div
  className="flex items-center gap-1.5 cursor-pointer group transition-colors"
  style={{
    paddingLeft: `${6 + depth * 14}px`,
    paddingTop: '6px',
    paddingBottom: '6px',
    paddingRight: '12px',
    background: isDragOver ? 'var(--accent-subtle)' : isSelected ? 'var(--accent-subtle)' : 'transparent',
    outline: isDragOver ? '2px solid var(--accent)' : undefined,
    ...
  }}
  onDragOver={...}
  onDragEnter={...}
  onDragLeave={...}
  onDrop={...}
>
```

With:
```tsx
<div
  ref={setFolderRef}
  className="flex items-center gap-1.5 cursor-pointer group transition-colors"
  style={{
    paddingLeft: `${6 + depth * 14}px`,
    paddingTop: '6px',
    paddingBottom: '6px',
    paddingRight: '12px',
    background: isFolderOver ? 'var(--accent-subtle)' : isSelected ? 'var(--accent-subtle)' : 'transparent',
    outline: isFolderOver ? '2px solid var(--accent)' : undefined,
    outlineOffset: '-2px',
    borderRadius: isFolderOver ? '6px' : undefined,
    position: 'relative',
    zIndex: showMenu ? 10 : undefined,
  }}
  onClick={() => {
    setExpanded(!expanded);
    onSelectFolder?.(folder.id);
  }}
>
```

- [ ] **Step 5: Remove HTML5 drag handlers from FolderRow**

Remove from the folder div:
- `onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-paper-id')) { e.preventDefault(); setIsDragOver(true); } }}`
- `onDragEnter={(e) => { if (e.dataTransfer.types.includes('application/x-paper-id')) { e.preventDefault(); setIsDragOver(true); } }}`
- `onDragLeave={() => setIsDragOver(false)}`
- `onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const paperId = e.dataTransfer.getData('application/x-paper-id'); if (paperId) { onMovePaper(paperId, folder.id); } }}`

- [ ] **Step 6: Refactor PaperRow to use useSortable**

Replace the `PaperRow` component (lines 22-92) with useSortable-based implementation:

```tsx
function PaperRow({
  paper,
  depth,
  onReorder,
}: {
  paper: PaperListItem;
  depth: number;
  onReorder?: (draggedPaperId: string, targetPaperId: string, position: 'before' | 'after') => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: paper.id,
    data: {
      type: 'paper',
      paperId: paper.id,
      folderId: paper.folderId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${10 + depth * 14}px`,
    paddingTop: '3px',
    paddingBottom: '3px',
    paddingRight: '12px',
    fontSize: '11px',
    color: 'var(--text-primary)',
    cursor: 'grab',
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? 'var(--accent-subtle)' : 'transparent',
    borderRadius: '4px',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} title={paper.title}>
      <span style={{ color: 'var(--text-tertiary)', marginRight: '4px' }}>•</span>{paper.title}
    </div>
  );
}
```

- [ ] **Step 7: Add DndContext and SortableContext to FolderTree**

Wrap the tree content in `FolderTree` component (around line 477):

```tsx
export function FolderTree(props: FolderTreeProps) {
  const { folders, papers, currentPaperId, searchQuery, onClose, onCreateFolder, onRenameFolder, onDeleteFolder, onMovePaper, onDeletePaper, onReorderPapers, onSelectFolder, selectedFolderId } = props;

  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  // ... existing handlers ...

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Move paper to folder
    if (overData?.type === 'folder') {
      onMovePaper(active.id as string, over.id as string);
      return;
    }

    // Reorder papers within same folder
    if (overData?.type === 'paper' && activeData?.folderId === overData?.folderId) {
      const overRect = over.rect;
      const midY = overRect.top + overRect.height / 2;
      const activeRect = active.rect.current.translated;
      if (!activeRect) return;

      const position: 'before' | 'after' = activeRect.top < midY ? 'before' : 'after';
      handleReorder(active.id as string, over.id as string, position);
    }
  };

  const handleDragStart = (event: { active: { id: string } }) => {
    setActiveId(event.active.id);
  };

  // handleReorder function stays the same (lines 263-275)

  const activePaper = activeId ? papers.find(p => p.id === activeId) : null;

  // Get all paper IDs for SortableContext
  const allPaperIds = useMemo(() => papers.map(p => p.id), [papers]);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allPaperIds} strategy={verticalListSortingStrategy}>
        <div>
          {/* existing header and root folder/paper content */}
        </div>
      </SortableContext>
      <DragOverlay>
        {activePaper && (
          <div
            style={{
              paddingLeft: '10px',
              paddingTop: '3px',
              paddingBottom: '3px',
              paddingRight: '12px',
              fontSize: '11px',
              color: 'var(--text-primary)',
              background: 'var(--surface)',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <span style={{ color: 'var(--text-tertiary)', marginRight: '4px' }}>•</span>{activePaper.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 8: Remove HTML5 drag handlers from root PaperRow**

In the root `rootPapers.map` (around line 583), the PaperRow is called with `onReorder={handleRootReorder}`. This is fine - just ensure the PaperRow component now uses useSortable.

- [ ] **Step 9: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: No TypeScript errors

- [ ] **Step 10: Commit**

```bash
git add src/components/folder-tree.tsx
git commit -m "refactor: add DndContext and useSortable to folder-tree for @dnd-kit migration"
```

---

## Chunk 4: Testing and Verification

### Task 7: Run Full Test Suite

**Files:**
- None (verification only)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors

- [ ] **Step 3: Build production bundle**

```bash
npm run build
```

Expected: Build succeeds without errors

- [ ] **Step 4: Start dev server for manual testing**

```bash
npm run dev
```

Expected: Dev server starts on localhost:3000

---

### Task 8: Manual Testing in Web Browser - paper-tree.tsx

**Files:**
- None (manual testing)

- [ ] **Step 1: Test paper-tree.tsx drag to folder**

1. Open http://localhost:3000 in browser
2. Create a folder if none exists
3. Drag a paper from root to folder
4. Verify: Paper moves to folder, folder shows highlight during drag

- [ ] **Step 2: Test paper-tree.tsx drag to collapsed folder**

1. Collapse a folder with papers inside
2. Drag a paper from root to collapsed folder
3. Verify: Paper moves to folder, highlight shows during drag

- [ ] **Step 3: Test checkbox/star clicks don't trigger drag**

1. Click checkbox on a paper
2. Click star button on a paper
3. Verify: Checkbox toggles, star toggles, no drag starts

---

### Task 9: Manual Testing in Web Browser - folder-tree.tsx

**Files:**
- None (manual testing)

- [ ] **Step 1: Test folder-tree.tsx drag to folder**

1. Navigate to a page that uses folder-tree.tsx (paper detail page sidebar)
2. Drag a paper from one folder to another folder
3. Verify: Paper moves to target folder, folder shows highlight during drag

- [ ] **Step 2: Test folder-tree.tsx reorder within folder**

1. Open a folder with multiple papers
2. Drag a paper and drop it above/below another paper in the same folder
3. Verify: Paper reorders correctly, visual feedback shows during drag

- [ ] **Step 3: Test drag across folders triggers move (not reorder)**

1. Drag a paper from one folder to a paper in a different folder
2. Verify: Paper moves to the target folder (not reordered within original folder)

- [ ] **Step 4: Stop dev server**

```bash
# Stop with Ctrl+C
```

---

### Task 10: Manual Testing in Tauri App

**Files:**
- None (manual testing)

- [ ] **Step 1: Run Tauri app in dev mode**

```bash
npm run tauri:dev
```

Expected: Tauri app window opens and loads the app

- [ ] **Step 2: Test paper-tree.tsx drag to folder in Tauri**

1. In the left sidebar, drag a paper to a folder
2. Verify: Paper moves, folder highlights during drag

- [ ] **Step 3: Test folder-tree.tsx drag to folder in Tauri**

1. Navigate to paper detail page (double-click a paper)
2. In the folder sidebar, drag a paper from one folder to another
3. Verify: Paper moves, folder highlights during drag

- [ ] **Step 4: Test folder-tree.tsx reorder in Tauri**

1. In the folder sidebar, open a folder with multiple papers
2. Drag a paper to reorder within the folder
3. Verify: Paper reorders correctly, visual feedback shows

- [ ] **Step 5: Stop Tauri app**

Stop the running app (close window or Ctrl+C in terminal).

---

### Task 11: Final Commit and Summary

**Files:**
- None (summary)

- [ ] **Step 1: Review all changes**

```bash
git log --oneline -10
git diff HEAD~10
```

- [ ] **Step 2: Ensure clean working tree**

```bash
git status
```

Expected: Clean working tree (no uncommitted changes)

- [ ] **Step 3: Update spec status**

Edit `docs/superpowers/specs/2026-04-03-fix-dnd-tauri-design.md`:

Change `**Status:** Draft` to `**Status:** Implemented`

- [ ] **Step 4: Final commit**

```bash
git add docs/superpowers/specs/2026-04-03-fix-dnd-tauri-design.md
git commit -m "docs: mark spec as implemented after @dnd-kit migration"
```

---

## Summary

This plan transforms the drag-and-drop functionality from HTML5 native events to @dnd-kit's pointer-event-based system. The migration ensures:

1. Cross-platform compatibility (web + Tauri)
2. Preserved visual feedback (folder highlights, drag opacity)
3. No behavioral changes for end users
4. Updated tests for hook-based implementation