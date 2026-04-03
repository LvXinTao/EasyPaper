# Fix Drag-and-Drop in Tauri App

**Date:** 2026-04-03
**Status:** Draft
**Scope:** Replace HTML5 drag API with @dnd-kit for cross-platform compatibility

## Problem

The drag-and-drop functionality for moving papers to folders and reordering papers works correctly in the web browser, but fails in the Tauri desktop app on macOS. This is due to incomplete support for HTML5 native drag events (`dragstart`, `dragover`, `drop`) in WKWebView, which Tauri uses as its webview backend.

## Solution

Replace HTML5 drag-and-drop API with `@dnd-kit`, a modern React drag-and-drop library that uses pointer events instead of native HTML5 drag events. This ensures consistent behavior across web and Tauri platforms.

## Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- `@dnd-kit/core` (~15KB) - Core drag-and-drop primitives
- `@dnd-kit/sortable` (~10KB) - Sortable list functionality
- `@dnd-kit/utilities` (~5KB) - CSS transform helpers

Total bundle impact: ~30KB gzipped

## Scope of Changes

| Component | Current Functionality | After |
|-----------|----------------------|-------|
| `paper-tree.tsx` | HTML5 drag events (move only) | `DndContext` wrapper (move only) |
| `paper-tree-folder.tsx` | `onDragOver`, `onDrop` handlers | `useDroppable` hook |
| `paper-tree.tsx` + `paper-tree-folder.tsx` | `<div draggable>` wrapper around `PaperTreeItem` | Move draggable logic into `PaperTreeItem` |
| `paper-tree-item.tsx` | Pure display component (no drag logic) | `useDraggable` hook (move-only, no sortable) |
| `folder-tree.tsx` | HTML5 drag events (move + reorder) | `DndContext` + hooks (move + reorder) |

**Note:** `paper-tree.tsx` only supports moving papers to folders. `folder-tree.tsx` supports both moving and reordering. This spec fixes both components without adding new functionality.

## Detailed Design

### 1. `paper-tree.tsx` - DndContext Wrapper

Wrap the entire tree with `DndContext` to manage all drag-and-drop interactions:

```tsx
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';

<DndContext
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  {/* Existing tree structure */}
</DndContext>
```

The `onDragEnd` handler for `paper-tree.tsx` (move-only, no reorder):

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
```

### 2. `paper-tree-folder.tsx` - Droppable Region

Convert folder rows to droppable targets:

```tsx
import { useDroppable } from '@dnd-kit/core';

const { setNodeRef, isOver } = useDroppable({
  id: folder.id,
  data: {
    type: 'folder',
    folderId: folder.id,
  },
});

// Render
<div ref={setNodeRef} style={{
  background: isOver ? 'var(--accent-subtle)' : 'transparent',
  outline: isOver ? '2px solid var(--accent)' : undefined,
  // ...existing styles
}}>
  {/* Folder content */}
</div>
```

Remove existing:
- `isDragOver` state
- `onDragOver`, `onDragLeave`, `onDrop` handlers

### 3. `paper-tree-item.tsx` - Draggable Item (Move Only)

**Current state:** The draggable wrapper is applied in parent components (`paper-tree.tsx` line 195 and `paper-tree-folder.tsx` line 144) around `PaperTreeItem`. The item component itself has no drag logic.

**After:** Move draggable logic into `PaperTreeItem` using `useDraggable` hook (not sortable - move only):

```tsx
import { useDraggable } from '@dnd-kit/core';

const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
  id: paper.id,
  data: {
    type: 'paper',
    paperId: paper.id,
    folderId: paper.folderId,
  },
});

const style = {
  opacity: isDragging ? 0.4 : 1,
  // ...existing styles
};

// Render
<div ref={setNodeRef} style={style} {...attributes} {...listeners}>
  {/* Paper content - unchanged */}
</div>
```

**Important:** Remove the outer `<div draggable onDragStart={...}>` wrapper from:
- `paper-tree.tsx` (line 195-207)
- `paper-tree-folder.tsx` (line 144-146)

Note: The drag handle should cover the entire paper row (except checkbox/star buttons which need `stopPropagation`).

### 4. `folder-tree.tsx` - Full Implementation (Move + Reorder)

This component supports both moving papers to folders and reordering within folders.

**Apply the pattern:**

1. Add `DndContext` wrapper with `onDragEnd` handler
2. Convert `FolderRow` to use `useDroppable`
3. Convert `PaperRow` to use `useSortable` (sortable for reorder support)

The `onDragEnd` handler:

```tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
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
    // Use @dnd-kit's rect information to determine position
    // over.rect provides { top, left, width, height } of the drop target
    const overRect = over.rect;
    const midY = overRect.top + overRect.height / 2;

    // active.rect.current.translated gives the dragged element's current position
    const activeRect = active.rect.current.translated;
    if (!activeRect) return;

    const position: 'before' | 'after' = activeRect.top < midY ? 'before' : 'after';

    handleReorder(active.id as string, over.id as string, position);
  }
};
```

**Visual Drop Indicators for Reorder:**

The existing `PaperRow` renders position-based indicators (blue line above/below target). With `useSortable`, replicate this using drag overlay or computed position:

Option A - Use `SortableContext` with `verticalListSortingStrategy` (automatic indicators):

```tsx
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

<SortableContext items={folderPapers.map(p => p.id)} strategy={verticalListSortingStrategy}>
  {folderPapers.map(paper => <SortablePaperRow key={paper.id} paper={paper} />)}
</SortableContext>
```

Option B - Custom position detection (manual indicators):

Track the active drag item and compute indicator position relative to each sortable item:

```tsx
// In the sortable item component
const { isOver } = useSortable({ id: paper.id, data: { type: 'paper', folderId } });

// Use @dnd-kit's DragOverlay for visual feedback during drag
// The parent DndContext renders a single DragOverlay that follows the cursor:
<DndContext onDragEnd={handleDragEnd}>
  {/* Tree content */}
  <DragOverlay>
    {activeItem && <PaperRowOverlay paper={activeItem} />}
  </DragOverlay>
</DndContext>
```

The `DragOverlay` approach is recommended - it renders a copy of the dragged item that follows the cursor, while the original item stays in place with reduced opacity. Position indicators can be computed in the parent by comparing `active.rect.current.translated` with each sortable item's rect.

**Reorder Logic (reference existing implementation at lines 263-275):**

```tsx
const handleReorder = (draggedPaperId: string, targetPaperId: string, position: 'before' | 'after') => {
  if (!onReorderPapers) return;
  const currentOrder = [...folderPapers];
  const draggedIndex = currentOrder.findIndex(p => p.id === draggedPaperId);
  if (draggedIndex === -1) return;
  const [dragged] = currentOrder.splice(draggedIndex, 1);
  const targetIndex = currentOrder.findIndex(p => p.id === targetPaperId);
  if (targetIndex === -1) return;
  const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
  currentOrder.splice(insertIndex, 0, dragged);
  const orders = currentOrder.map((p, i) => ({ id: p.id, sortIndex: i }));
  onReorderPapers(orders);
};
```

**Note:** When using `useSortable`, apply the `transform` CSS property for smooth drag animations:

```tsx
const { transform, transition } = useSortable({ id: paper.id });

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
};
```

This component has its own drag-and-drop context separate from `paper-tree.tsx`.

## Data Flow

### paper-tree.tsx (Move Only)

```
User initiates drag on paper
        ↓
useDraggable provides drag state
        ↓
User drags over folder
        ↓
useDroppable detects hover (visual feedback)
        ↓
User releases (drop)
        ↓
DndContext.onDragEnd fires
        ↓
Handler checks: over.data.current?.type === 'folder'
        ↓
onMovePaper(paperId, folderId)
        ↓
API call + state update
        ↓
UI reflects new folder
```

### folder-tree.tsx (Move + Reorder)

```
User initiates drag on paper
        ↓
useSortable provides drag state
        ↓
User drags over folder OR another paper
        ↓
useDroppable/useSortable detects hover
        ↓
Visual feedback:
  ├─ folder: background highlight
  └─ paper: position indicator (before/after line)
        ↓
User releases (drop)
        ↓
DndContext.onDragEnd fires
        ↓
Handler determines action:
  ├─ folder target → onMovePaper(paperId, folderId)
  └─ paper target (same folder) → handleReorder(paperId, targetId, position)
        ↓
API call + state update
        ↓
UI reflects new position/folder
```

## Edge Cases

### Dragging to collapsed folder

Folders can receive drops regardless of expanded/collapsed state. The visual feedback (`isOver`) should still apply.

### Dragging across folders (reorder)

Reordering only applies when dragging within the same folder (matching `folderId`). Cross-folder drops should trigger move action instead.

### Multiple drag contexts

`paper-tree.tsx` and `folder-tree.tsx` each have their own `DndContext`. They do not interact with each other. This is intentional - they serve different UI contexts.

## Testing Checklist

### paper-tree.tsx (Move Only)
- [ ] Drag paper to folder in web browser - moves correctly
- [ ] Drag paper to folder in Tauri app - moves correctly
- [ ] Drag to collapsed folder - still works
- [ ] Visual feedback (folder highlight) shows on hover
- [ ] Checkbox/star clicks do not trigger drag
- [ ] No console errors or warnings

### folder-tree.tsx (Move + Reorder)
- [ ] Drag paper to folder in web browser - moves correctly
- [ ] Drag paper to folder in Tauri app - moves correctly
- [ ] Reorder paper within folder in web browser - updates sortIndex
- [ ] Reorder paper within folder in Tauri app - updates sortIndex
- [ ] Position indicator (blue line) shows before/after target
- [ ] Drag across folders triggers move (not reorder)
- [ ] No console errors or warnings

### Notes
- Existing unit tests (`__tests__/components/paper-tree-item.test.tsx`) may need updates for the new hook-based implementation
- Consider adding E2E tests (Playwright) for future regression prevention of drag-and-drop in Tauri

## Risks

1. **Bundle size increase** - ~30KB added. Acceptable for improved UX.
2. **Touch device support** - @dnd-kit supports touch via pointer events; needs testing on potential mobile future.
3. **Accessibility** - @dnd-kit provides keyboard support; existing keyboard shortcuts should remain functional.

## Migration Steps

1. Install dependencies
2. Refactor `paper-tree.tsx` (add DndContext)
3. Refactor `paper-tree-folder.tsx` (useDroppable)
4. Refactor `paper-tree-item.tsx` (useDraggable - move only, not sortable)
5. Remove outer draggable wrappers from `paper-tree.tsx` and `paper-tree-folder.tsx`
6. Refactor `folder-tree.tsx` (DndContext + useDroppable + useSortable)
7. Remove all HTML5 drag event handlers
8. Test on web browser
9. Test on Tauri app
10. Update tests if needed