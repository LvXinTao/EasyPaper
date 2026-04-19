'use client';

import { useState } from 'react';
import type { Folder } from '@/types';
import { PaperTreeFolder } from './paper-tree-folder';

interface PaperTreeProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

export function PaperTree({
  folders,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: PaperTreeProps) {
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

  const rootFolders = folders.filter(f => !f.parentId);

  const handleCreateRoot = () => {
    const trimmed = newRootName.trim();
    if (trimmed) { onCreateFolder(trimmed, null); setNewRootName(''); }
    setIsCreatingRoot(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '12px', overflow: 'hidden' }}>
      <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', fontWeight: 600, padding: '8px 6px 4px' }}>LIBRARY</div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {rootFolders.map(folder => (
          <PaperTreeFolder
            key={folder.id}
            folder={folder}
            depth={0}
            allFolders={folders}
            isSelected={selectedFolderId === folder.id}
            onFolderSelect={onFolderSelect}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onCreateChildFolder={(name, parentId) => onCreateFolder(name, parentId)}
          />
        ))}

        {isCreatingRoot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px' }}>
            <span style={{ fontSize: '13px' }}>📁</span>
            <input autoFocus placeholder="Folder name" value={newRootName} onChange={e => setNewRootName(e.target.value)} onBlur={handleCreateRoot} onKeyDown={e => { if (e.key === 'Enter') handleCreateRoot(); if (e.key === 'Escape') setIsCreatingRoot(false); }} style={{ flex: 1, fontSize: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '4px 6px' }} />
          </div>
        )}
      </div>

      <button onClick={() => setIsCreatingRoot(true)} style={{ marginTop: '8px', padding: '8px 12px', fontSize: '12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>+ New Folder</button>
    </div>
  );
}
