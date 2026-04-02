'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Folder, PaperListItem } from '@/types';
import { PaperTreeItem } from './paper-tree-item';

interface PaperTreeFolderProps {
  folder: Folder;
  depth: number;
  papers: PaperListItem[];
  allFolders: Folder[];
  selectedPaperIds: Set<string>;
  selectedPaperId: string | null;
  onPaperClick: (paperId: string) => void;
  onPaperDoubleClick: (paperId: string) => void;
  onPaperCheckboxToggle: (paperId: string) => void;
  onPaperContextMenu: (e: React.MouseEvent, paperId: string) => void;
  onDropPaper: (paperId: string, folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateChildFolder: (name: string, parentId: string) => void;
  onToggleStar: (paperId: string) => void;
}

export function PaperTreeFolder({
  folder,
  depth,
  papers,
  allFolders,
  selectedPaperIds,
  selectedPaperId,
  onPaperClick,
  onPaperDoubleClick,
  onPaperCheckboxToggle,
  onPaperContextMenu,
  onDropPaper,
  onRenameFolder,
  onDeleteFolder,
  onCreateChildFolder,
  onToggleStar,
}: PaperTreeFolderProps) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu]);

  const childFolders = useMemo(() => allFolders.filter(f => f.parentId === folder.id), [allFolders, folder.id]);
  const folderPapers = useMemo(() => papers.filter(p => p.folderId === folder.id), [papers, folder.id]);
  const totalPapers = useMemo(() => papers.filter(p => {
    const checkFolder = (fid: string | null): boolean => {
      if (fid === folder.id) return true;
      const parent = allFolders.find(f => f.id === fid);
      return parent ? checkFolder(parent.parentId) : false;
    };
    return checkFolder(p.folderId ?? null);
  }).length, [papers, folder.id, allFolders]);

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) onRenameFolder(folder.id, trimmed);
    setIsRenaming(false);
  };

  const handleCreateChild = () => {
    const trimmed = newChildName.trim();
    if (trimmed) { onCreateChildFolder(trimmed, folder.id); setNewChildName(''); }
    setIsCreatingChild(false);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          paddingLeft: `${10 + depth * 16}px`,
          background: isDragOver ? 'var(--accent-subtle)' : 'transparent',
          outline: isDragOver ? '2px solid var(--accent)' : undefined,
          outlineOffset: '-2px',
          borderRadius: '8px',
          cursor: 'pointer',
          gap: '6px',
          position: 'relative',
          marginBottom: '2px',
        }}
        onClick={() => setExpanded(!expanded)}
        onDragOver={e => { if (e.dataTransfer.types.includes('application/x-paper-id')) { e.preventDefault(); setIsDragOver(true); } }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); const paperId = e.dataTransfer.getData('application/x-paper-id'); if (paperId) onDropPaper(paperId, folder.id); }}
      >
        <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} style={{ width: '14px', fontSize: '10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{expanded ? '▼' : '▶'}</button>
        <span style={{ fontSize: '14px' }}>📁</span>
        {isRenaming ? (
          <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={handleRename} onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setRenameValue(folder.name); setIsRenaming(false); } }} style={{ flex: 1, fontSize: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '3px 6px' }} onClick={e => e.stopPropagation()} />
        ) : (
          <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{folder.name}</span>
        )}
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{totalPapers}</span>
        <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }} style={{ fontSize: '14px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>⋯</button>
        {showMenu && (
          <div ref={menuRef} style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', width: '160px', borderRadius: '8px', padding: '4px 0', background: 'var(--bg)', border: '1px solid var(--glass-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowMenu(false); setIsCreatingChild(true); setExpanded(true); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>📁 New Subfolder</button>
            <button onClick={() => { setShowMenu(false); setIsRenaming(true); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>✏️ Rename</button>
            <button onClick={() => { setShowMenu(false); onDeleteFolder(folder.id); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️ Delete</button>
          </div>
        )}
      </div>

      {expanded && (
        <div style={{ marginLeft: `${12 + depth * 16}px`, borderLeft: depth > 0 ? '1px solid var(--border)' : undefined }}>
          {isCreatingChild && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px' }}>
              <span style={{ fontSize: '14px' }}>📁</span>
              <input autoFocus placeholder="Folder name" value={newChildName} onChange={e => setNewChildName(e.target.value)} onBlur={handleCreateChild} onKeyDown={e => { if (e.key === 'Enter') handleCreateChild(); if (e.key === 'Escape') setIsCreatingChild(false); }} style={{ flex: 1, fontSize: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '4px 6px' }} />
            </div>
          )}
          {childFolders.map(child => (
            <PaperTreeFolder key={child.id} folder={child} depth={depth + 1} papers={papers} allFolders={allFolders} selectedPaperIds={selectedPaperIds} selectedPaperId={selectedPaperId} onPaperClick={onPaperClick} onPaperDoubleClick={onPaperDoubleClick} onPaperCheckboxToggle={onPaperCheckboxToggle} onPaperContextMenu={onPaperContextMenu} onDropPaper={onDropPaper} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onCreateChildFolder={onCreateChildFolder} onToggleStar={onToggleStar} />
          ))}
          {folderPapers.map(paper => (
            <div key={paper.id} draggable onDragStart={e => e.dataTransfer.setData('application/x-paper-id', paper.id)}>
              <PaperTreeItem paper={paper} isSelected={paper.id === selectedPaperId} isChecked={selectedPaperIds.has(paper.id)} depth={depth + 1} onClick={() => onPaperClick(paper.id)} onDoubleClick={() => onPaperDoubleClick(paper.id)} onCheckboxToggle={() => onPaperCheckboxToggle(paper.id)} onContextMenu={e => onPaperContextMenu(e, paper.id)} onToggleStar={() => onToggleStar(paper.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}