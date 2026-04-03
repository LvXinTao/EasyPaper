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

| Component | Current | After |
|-----------|---------|-------|
| `paper-tree.tsx` | HTML5 drag events | `DndContext` wrapper |
| `paper-tree-folder.tsx` | `onDragOver`, `onDrop` handlers | `useDroppable` hook |
| `paper-tree-item.tsx` | `draggable` attribute wrapper | `useSortable` hook |
| `folder-tree.tsx` | HTML5 drag events | `DndContext` + hooks |

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

The `onDragEnd` handler determines the action based on the drop target:

```tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over) return;

  const activeData = active.data.current;
  const overData = over.data.current;

  // Move paper to folder
  if (overData?.type === 'folder') {
    onMovePaper(active.id as string, over.id as string);
  }

  // Reorder papers within same folder
  if (overData?.type === 'paper' && activeData?.folderId === overData?.folderId) {
    const position = determinePosition(event); // 'before' or 'after'
    handleReorder(active.id as string, over.id as string, position);
  }
};
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

### 3. `paper-tree-item.tsx` - Sortable Item

Convert paper items to draggable/sortable elements:

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  opacity: isDragging ? 0.4 : 1,
  // ...existing styles
};

// Render
<div ref={setNodeRef} style={style} {...attributes} {...listeners}>
  {/* Paper content - unchanged */}
</div>
```

Note: The drag handle should cover the entire paper row (except checkbox/star buttons which need `stopPropagation`).

### 4. `folder-tree.tsx` - Parallel Implementation

Apply the same pattern to `folder-tree.tsx`:

1. Add `DndContext` wrapper with `onDragEnd` handler
2. Convert `FolderRow` to use `useDroppable`
3. Convert `PaperRow` to use `useSortable`

This component has its own drag-and-drop context separate from `paper-tree.tsx`.

## Data Flow

```
User initiates drag on paper
        ↓
useSortable provides drag state
        ↓
User drags over folder or another paper
        ↓
useDroppable detects hover (visual feedback)
        ↓
User releases (drop)
        ↓
DndContext.onDragEnd fires
        ↓
Handler determines action type:
  ├─ folder target → onMovePaper(paperId, folderId)
  └─ paper target → handleReorder(paperId, targetId, position)
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

- [ ] Drag paper to folder in web browser - moves correctly
- [ ] Drag paper to folder in Tauri app - moves correctly
- [ ] Reorder paper within folder in web browser - updates sortIndex
- [ ] Reorder paper within folder in Tauri app - updates sortIndex
- [ ] Drag to collapsed folder - still works
- [ ] Visual feedback (highlight) shows on hover
- [ ] Checkbox/star clicks do not trigger drag
- [ ] No console errors or warnings

## Risks

1. **Bundle size increase** - ~30KB added. Acceptable for improved UX.
2. **Touch device support** - @dnd-kit supports touch via pointer events; needs testing on potential mobile future.
3. **Accessibility** - @dnd-kit provides keyboard support; existing keyboard shortcuts should remain functional.

## Migration Steps

1. Install dependencies
2. Refactor `paper-tree.tsx` (add DndContext)
3. Refactor `paper-tree-folder.tsx` (useDroppable)
4. Refactor `paper-tree-item.tsx` (useSortable)
5. Refactor `folder-tree.tsx` (same pattern)
6. Remove all HTML5 drag event handlers
7. Test on web browser
8. Test on Tauri app
9. Update tests if needed