'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Folder } from '@/types';

interface PaperTreeFolderProps {
  folder: Folder;
  depth: number;
  allFolders: Folder[];
  isSelected?: boolean;
  onFolderSelect?: (folderId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateChildFolder: (name: string, parentId: string) => void;
}

export function PaperTreeFolder({
  folder,
  depth,
  allFolders,
  isSelected,
  onFolderSelect,
  onRenameFolder,
  onDeleteFolder,
  onCreateChildFolder,
}: PaperTreeFolderProps) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenu(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu]);

  const childFolders = useMemo(() => allFolders.filter(f => f.parentId === folder.id), [allFolders, folder.id]);

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
          display: 'flex', alignItems: 'center', padding: '6px 10px',
          paddingLeft: `${10 + depth * 16}px`,
          background: isSelected ? 'var(--accent-subtle)' : 'transparent',
          outline: isSelected ? '1px solid var(--accent)' : undefined,
          outlineOffset: '-2px', borderRadius: '8px', cursor: 'pointer',
          gap: '6px', position: 'relative', marginBottom: '2px',
        }}
        onClick={() => {
          setExpanded(!expanded);
          if (onFolderSelect) {
            onFolderSelect(isSelected ? null : folder.id);
          }
        }}
      >
        <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} style={{ width: '14px', fontSize: '10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{expanded ? '▼' : '▶'}</button>
        <span style={{ fontSize: '14px' }}>📁</span>
        {isRenaming ? (
          <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={handleRename} onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setRenameValue(folder.name); setIsRenaming(false); } }} style={{ flex: 1, fontSize: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '3px 6px' }} onClick={e => e.stopPropagation()} />
        ) : (
          <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{folder.name}</span>
        )}
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
            <PaperTreeFolder key={child.id} folder={child} depth={depth + 1} allFolders={allFolders} isSelected={isSelected} onFolderSelect={onFolderSelect} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onCreateChildFolder={onCreateChildFolder} />
          ))}
        </div>
      )}
    </div>
  );
}
