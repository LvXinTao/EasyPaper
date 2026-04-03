'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Folder, PaperListItem } from '@/types';
import { DndContext, DragEndEvent, DragStartEvent, closestCenter, DragOverlay, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FolderTreeProps {
  folders: Folder[];
  papers: PaperListItem[];
  currentPaperId: string;
  searchQuery: string;
  onClose: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onMovePaper: (paperId: string, folderId: string | null) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
  onReorderPapers?: (orders: { id: string; sortIndex: number }[]) => Promise<void>;
  onSelectFolder?: (folderId: string | null) => void;
  selectedFolderId?: string | null;
}

function PaperRow({
  paper,
  depth,
}: {
  paper: PaperListItem;
  depth: number;
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
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? 'var(--accent-subtle)' : 'transparent',
    borderRadius: '4px',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} title={paper.title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Drag Handle */}
        <div
          {...listeners}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '1px',
            width: '16px',
            height: '16px',
            cursor: 'grab',
            flexShrink: 0,
            padding: '3px',
            borderRadius: '4px',
            // Make the hit area larger than visible area
            marginLeft: '-2px',
          }}
          title="Drag to move"
        >
          <div style={{ width: '4px', height: '2px', background: 'var(--text-tertiary)', borderRadius: '1px' }} />
          <div style={{ width: '4px', height: '2px', background: 'var(--text-tertiary)', borderRadius: '1px' }} />
          <div style={{ width: '4px', height: '2px', background: 'var(--text-tertiary)', borderRadius: '1px' }} />
        </div>
        {/* Title - clickable area for selection */}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {paper.title}
        </span>
      </div>
    </div>
  );
}

// MoveToPicker component - kept for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MoveToPicker({
  folders,
  currentFolderId,
  onSelect,
  onClose,
}: {
  folders: Folder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentFolderId);

  const rootFolders = folders.filter((f) => !f.parentId);

  function renderFolderOption(folder: Folder, depth: number): React.ReactNode {
    const children = folders.filter((f) => f.parentId === folder.id);
    return (
      <div key={folder.id}>
        <label
          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <input
            type="radio"
            name="moveTarget"
            checked={selected === folder.id}
            onChange={() => setSelected(folder.id)}
          />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>📁 {folder.name}</span>
        </label>
        {children.map((c) => renderFolderOption(c, depth + 1))}
      </div>
    );
  }

  return (
    <div
      className="absolute right-0 top-full z-50 rounded-lg shadow-lg w-56 py-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--glass-border)' }}
    >
      <div className="px-3 py-1 text-xs font-medium uppercase" style={{ color: 'var(--text-tertiary)' }}>Move to</div>
      <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer">
        <input
          type="radio"
          name="moveTarget"
          checked={selected === null}
          onChange={() => setSelected(null)}
        />
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>📁 Root (no folder)</span>
      </label>
      {rootFolders.map((f) => renderFolderOption(f, 0))}
      <div
        className="flex justify-end gap-2 px-3 pt-2 mt-1"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          onClick={onClose}
          className="text-xs"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSelect(selected)}
          className="text-xs px-2.5 py-1 rounded"
          style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none' }}
        >
          Move
        </button>
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  depth,
  papers,
  folders,
  currentPaperId,
  searchQuery,
  onClose,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMovePaper,
  onDeletePaper,
  onReorderPapers,
  onSelectFolder,
  selectedFolderId,
}: {
  folder: Folder;
  depth: number;
  papers: PaperListItem[];
  folders: Folder[];
  currentPaperId: string;
  searchQuery: string;
  onClose: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onMovePaper: (paperId: string, folderId: string | null) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
  onReorderPapers?: (orders: { id: string; sortIndex: number }[]) => Promise<void>;
  onSelectFolder?: (folderId: string | null) => void;
  selectedFolderId?: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');

  const { setNodeRef: setFolderRef, isOver: isFolderOver } = useDroppable({
    id: folder.id,
    data: {
      type: 'folder',
      folderId: folder.id,
    },
  });

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = () => setShowMenu(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showMenu]);

  const childFolders = useMemo(
    () => folders.filter((f) => f.parentId === folder.id).sort((a, b) => a.name.localeCompare(b.name)),
    [folders, folder.id]
  );
  const folderPapers = useMemo(
    () => papers
      .filter((p) => p.folderId === folder.id)
      .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (a.sortIndex != null && b.sortIndex != null) return a.sortIndex - b.sortIndex;
        if (a.sortIndex != null) return -1;
        if (b.sortIndex != null) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [papers, folder.id, searchQuery]
  );

  // Paper IDs for this folder's SortableContext
  const folderPaperIds = useMemo(() => folderPapers.map(p => p.id), [folderPapers]);

  // Count all papers in this folder and descendants
  const allDescendantIds = new Set<string>([folder.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId && allDescendantIds.has(f.parentId) && !allDescendantIds.has(f.id)) {
        allDescendantIds.add(f.id);
        changed = true;
      }
    }
  }
  const totalPapers = papers.filter((p) => p.folderId && allDescendantIds.has(p.folderId)).length;

  const isSelected = selectedFolderId === folder.id;

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      await onRenameFolder(folder.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleCreateChild = async () => {
    const trimmed = newChildName.trim();
    if (trimmed) {
      await onCreateFolder(trimmed, folder.id);
      setNewChildName('');
    }
    setIsCreatingChild(false);
  };

  return (
    <div>
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
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="text-[11px] w-4 flex-shrink-0"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="flex-shrink-0">📁</span>

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setRenameValue(folder.name); setIsRenaming(false); }
            }}
            className="text-sm font-medium rounded px-1 py-0.5 outline-none flex-1 min-w-0"
            style={{
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
            }}
            maxLength={100}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-sm font-medium truncate flex-1"
            style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}
          >
            {folder.name}
          </span>
        )}

        <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{totalPapers}</span>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ⋯
          </button>
          {showMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                width: '176px',
                borderRadius: '8px',
                padding: '4px 0',
                background: 'var(--bg)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 50,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setShowMenu(false); setIsCreatingChild(true); setExpanded(true); }}
                className="w-full text-left px-3 py-1.5 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                📁 New sub-folder
              </button>
              <button
                onClick={() => { setShowMenu(false); setIsRenaming(true); setRenameValue(folder.name); }}
                className="w-full text-left px-3 py-1.5 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                ✏️ Rename
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  if (confirm(`Delete folder "${folder.name}" and all sub-folders? Papers will be moved to the parent.`)) {
                    onDeleteFolder(folder.id);
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                🗑️ Delete folder
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginLeft: `${14 + depth * 14}px`,
            borderLeft: depth > 0 ? '1px solid var(--border)' : undefined,
          }}
        >
          {isCreatingChild && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span>📁</span>
              <input
                autoFocus
                placeholder="Folder name"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onBlur={handleCreateChild}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateChild();
                  if (e.key === 'Escape') setIsCreatingChild(false);
                }}
                className="text-sm rounded px-1 py-0.5 outline-none flex-1"
                style={{
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                }}
                maxLength={100}
              />
            </div>
          )}
          {childFolders.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              papers={papers}
              folders={folders}
              currentPaperId={currentPaperId}
              searchQuery={searchQuery}
              onClose={onClose}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMovePaper={onMovePaper}
              onDeletePaper={onDeletePaper}
              onReorderPapers={onReorderPapers}
              onSelectFolder={onSelectFolder}
              selectedFolderId={selectedFolderId}
            />
          ))}
          {/* Each folder has its own SortableContext for papers */}
          <SortableContext items={folderPaperIds} strategy={verticalListSortingStrategy}>
            {folderPapers.map((paper) => (
              <PaperRow
                key={paper.id}
                paper={paper}
                depth={depth + 1}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

export function FolderTree(props: FolderTreeProps) {
  const { folders, papers, currentPaperId, searchQuery, onClose, onCreateFolder, onRenameFolder, onDeleteFolder, onMovePaper, onDeletePaper, onReorderPapers, onSelectFolder, selectedFolderId } = props;

  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure pointer sensor with constraints for better Tauri compatibility
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before starting drag
      },
    })
  );

  const handleCreateRoot = async () => {
    const trimmed = newRootName.trim();
    if (trimmed) {
      await onCreateFolder(trimmed, null);
      setNewRootName('');
    }
    setIsCreatingRoot(false);
  };

  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parentId).sort((a, b) => a.name.localeCompare(b.name)),
    [folders]
  );

  const rootPapers = useMemo(
    () => papers
      .filter((p) => !p.folderId)
      .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (a.sortIndex != null && b.sortIndex != null) return a.sortIndex - b.sortIndex;
        if (a.sortIndex != null) return -1;
        if (b.sortIndex != null) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [papers, searchQuery]
  );

  // Get papers for a specific folder (used in handleReorder)
  const getPapersInFolder = (folderId: string | null): PaperListItem[] => {
    return papers
      .filter(p => p.folderId === folderId)
      .sort((a, b) => {
        if (a.sortIndex != null && b.sortIndex != null) return a.sortIndex - b.sortIndex;
        if (a.sortIndex != null) return -1;
        if (b.sortIndex != null) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  };

  const handleReorder = (draggedPaperId: string, targetPaperId: string, folderId: string | null, position: 'before' | 'after') => {
    if (!onReorderPapers) return;
    const folderPapers = getPapersInFolder(folderId);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

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
      handleReorder(active.id as string, over.id as string, activeData?.folderId ?? null, position);
    }
  };

  const activePaper = activeId ? papers.find(p => p.id === activeId) : null;

  // Get paper IDs for root papers SortableContext
  const rootPaperIds = useMemo(() => rootPapers.map(p => p.id), [rootPapers]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div>
        <div
            className="flex items-center justify-between"
            style={{ padding: '6px 12px 4px 10px' }}
          >
            <span className="text-xs font-medium uppercase" style={{ color: 'var(--text-tertiary)' }}>Folders</span>
            <button
              onClick={() => { setIsCreatingRoot(true); setNewRootName(''); }}
              className="text-sm leading-none"
              style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
              title="New folder"
            >
              +
            </button>
          </div>
          {isCreatingRoot && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span>📁</span>
              <input
                autoFocus
                placeholder="Folder name"
                value={newRootName}
                onChange={(e) => setNewRootName(e.target.value)}
                onBlur={handleCreateRoot}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateRoot();
                  if (e.key === 'Escape') setIsCreatingRoot(false);
                }}
                className="text-sm rounded px-1 py-0.5 outline-none flex-1"
                style={{
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                }}
                maxLength={100}
              />
            </div>
          )}
          {rootFolders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              depth={0}
              papers={papers}
              folders={folders}
              currentPaperId={currentPaperId}
              searchQuery={searchQuery}
              onClose={onClose}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMovePaper={onMovePaper}
              onDeletePaper={onDeletePaper}
              onReorderPapers={onReorderPapers}
              onSelectFolder={onSelectFolder}
              selectedFolderId={selectedFolderId}
            />
          ))}
          {/* Root papers have their own SortableContext */}
          <SortableContext items={rootPaperIds} strategy={verticalListSortingStrategy}>
            {rootPapers.map((paper) => (
              <PaperRow
                key={paper.id}
                paper={paper}
                depth={0}
              />
            ))}
          </SortableContext>
        </div>
      <DragOverlay>
        {activePaper && (
          <div
            style={{
              paddingLeft: '10px',
              paddingTop: '6px',
              paddingBottom: '6px',
              paddingRight: '12px',
              fontSize: '11px',
              color: 'var(--text-primary)',
              background: 'var(--surface)',
              borderRadius: '4px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              cursor: 'grabbing',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <div style={{ width: '4px', height: '2px', background: 'var(--text-tertiary)', borderRadius: '1px' }} />
                <div style={{ width: '4px', height: '2px', background: 'var(--text-tertiary)', borderRadius: '1px' }} />
                <div style={{ width: '4px', height: '2px', background: 'var(--text-tertiary)', borderRadius: '1px' }} />
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activePaper.title}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
