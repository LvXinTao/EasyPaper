'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Folder, PaperListItem } from '@/types';

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
  onReorder,
}: {
  paper: PaperListItem;
  depth: number;
  onReorder?: (draggedPaperId: string, targetPaperId: string, position: 'before' | 'after') => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<'before' | 'after' | null>(null);

  return (
    <div
      style={{ position: 'relative' }}
    >
      {dropIndicator === 'before' && (
        <div style={{ position: 'absolute', top: 0, left: `${10 + depth * 14}px`, right: '12px', height: '2px', background: 'var(--accent)', borderRadius: '1px', zIndex: 5 }} />
      )}
      <div
        className="truncate"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-paper-id', paper.id);
          e.dataTransfer.setData('application/x-paper-reorder', 'true');
          e.dataTransfer.effectAllowed = 'move';
          setIsDragging(true);
        }}
        onDragEnd={() => setIsDragging(false)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-paper-reorder')) {
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            setDropIndicator(e.clientY < midY ? 'before' : 'after');
          }
        }}
        onDragLeave={() => setDropIndicator(null)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const draggedId = e.dataTransfer.getData('application/x-paper-id');
          if (draggedId && draggedId !== paper.id && onReorder && dropIndicator) {
            onReorder(draggedId, paper.id, dropIndicator);
          }
          setDropIndicator(null);
        }}
        style={{
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
          transition: 'background 0.15s, opacity 0.15s',
        }}
        title={paper.title}
      >
        <span style={{ color: 'var(--text-tertiary)', marginRight: '4px' }}>•</span>{paper.title}
      </div>
      {dropIndicator === 'after' && (
        <div style={{ position: 'absolute', bottom: 0, left: `${10 + depth * 14}px`, right: '12px', height: '2px', background: 'var(--accent)', borderRadius: '1px', zIndex: 5 }} />
      )}
    </div>
  );
}

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
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = () => setShowMenu(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showMenu]);

  const childFolders = folders.filter((f) => f.parentId === folder.id).sort((a, b) => a.name.localeCompare(b.name));
  const folderPapers = papers
    .filter((p) => p.folderId === folder.id)
    .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.sortIndex != null && b.sortIndex != null) return a.sortIndex - b.sortIndex;
      if (a.sortIndex != null) return -1;
      if (b.sortIndex != null) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

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

  return (
    <div>
      <div
        className="flex items-center gap-1.5 cursor-pointer group transition-colors"
        style={{
          paddingLeft: `${6 + depth * 14}px`,
          paddingTop: '6px',
          paddingBottom: '6px',
          paddingRight: '12px',
          background: isDragOver ? 'var(--accent-subtle)' : isSelected ? 'var(--accent-subtle)' : 'transparent',
          outline: isDragOver ? '2px solid var(--accent)' : undefined,
          outlineOffset: '-2px',
          borderRadius: isDragOver ? '6px' : undefined,
          position: 'relative',
          zIndex: showMenu ? 10 : undefined,
        }}
        onClick={() => {
          setExpanded(!expanded);
          onSelectFolder?.(folder.id);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-paper-id')) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragEnter={(e) => {
          if (e.dataTransfer.types.includes('application/x-paper-id')) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const paperId = e.dataTransfer.getData('application/x-paper-id');
          if (paperId) {
            onMovePaper(paperId, folder.id);
          }
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
          {folderPapers.map((paper) => (
            <PaperRow
              key={paper.id}
              paper={paper}
              depth={depth + 1}
              onReorder={handleReorder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree(props: FolderTreeProps) {
  const { folders, papers, currentPaperId, searchQuery, onClose, onCreateFolder, onRenameFolder, onDeleteFolder, onMovePaper, onDeletePaper, onReorderPapers, onSelectFolder, selectedFolderId } = props;

  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

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

  const handleRootReorder = (draggedPaperId: string, targetPaperId: string, position: 'before' | 'after') => {
    if (!onReorderPapers) return;
    const currentOrder = [...rootPapers];
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

  return (
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
      {rootPapers.map((paper) => (
        <PaperRow
          key={paper.id}
          paper={paper}
          depth={0}
          onReorder={handleRootReorder}
        />
      ))}
    </div>
  );
}
