'use client';

import { useState, useMemo } from 'react';
import type { Folder, PaperListItem } from '@/types';
import { PaperTreeItem } from './paper-tree-item';
import { PaperTreeFolder } from './paper-tree-folder';
import { BatchActionToolbar } from './batch-action-toolbar';

interface PaperTreeProps {
  papers: PaperListItem[];
  folders: Folder[];
  selectedPaperId: string | null;
  selectedPaperIds: Set<string>;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onPaperClick: (paperId: string) => void;
  onCheckboxToggle: (paperId: string) => void;
  onBatchDelete: (paperIds: string[]) => void;
  onBatchMove: (paperIds: string[], folderId: string | null) => void;
  onBatchStar: (paperIds: string[], starred: boolean) => void;
  onMovePaper: (paperId: string, folderId: string | null) => void;
  onClearSelection: () => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onContextMenuOpen: (e: React.MouseEvent, paperId: string) => void;
}

export function PaperTree({
  papers,
  folders,
  selectedPaperId,
  selectedPaperIds,
  searchQuery,
  onSearchQueryChange,
  onPaperClick,
  onCheckboxToggle,
  onBatchDelete,
  onBatchMove,
  onBatchStar,
  onMovePaper,
  onClearSelection,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onContextMenuOpen,
}: PaperTreeProps) {
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

  const filteredPapers = useMemo(() => papers.filter(p => {
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [papers, searchQuery]);

  const rootFolders = useMemo(() => folders.filter(f => !f.parentId), [folders]);
  const rootPapers = useMemo(() => filteredPapers.filter(p => !p.folderId), [filteredPapers]);

  const handleCreateRoot = () => {
    const trimmed = newRootName.trim();
    if (trimmed) { onCreateFolder(trimmed, null); setNewRootName(''); }
    setIsCreatingRoot(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '10px', overflow: 'hidden' }}>
      <div style={{ marginBottom: '8px' }}>
        <input type="text" placeholder="搜索论文..." value={searchQuery} onChange={e => onSearchQueryChange(e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '6px' }} />
      </div>

      <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', fontWeight: 600, padding: '8px 6px 4px' }}>LIBRARY</div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {rootFolders.map(folder => (
          <PaperTreeFolder key={folder.id} folder={folder} depth={0} papers={filteredPapers} allFolders={folders} selectedPaperIds={selectedPaperIds} selectedPaperId={selectedPaperId} onPaperClick={onPaperClick} onPaperCheckboxToggle={onCheckboxToggle} onPaperContextMenu={onContextMenuOpen} onDropPaper={(paperId, folderId) => onMovePaper(paperId, folderId)} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onCreateChildFolder={(name, parentId) => onCreateFolder(name, parentId)} />
        ))}

        {isCreatingRoot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px' }}>
            <span style={{ fontSize: '11px' }}>📁</span>
            <input autoFocus placeholder="文件夹名称" value={newRootName} onChange={e => setNewRootName(e.target.value)} onBlur={handleCreateRoot} onKeyDown={e => { if (e.key === 'Enter') handleCreateRoot(); if (e.key === 'Escape') setIsCreatingRoot(false); }} style={{ flex: 1, fontSize: '11px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '2px 4px' }} />
          </div>
        )}

        {rootPapers.map(paper => (
          <div key={paper.id} draggable onDragStart={e => e.dataTransfer.setData('application/x-paper-id', paper.id)}>
            <PaperTreeItem paper={paper} isSelected={paper.id === selectedPaperId} isChecked={selectedPaperIds.has(paper.id)} depth={0} onClick={() => onPaperClick(paper.id)} onCheckboxToggle={() => onCheckboxToggle(paper.id)} onContextMenu={e => onContextMenuOpen(e, paper.id)} />
          </div>
        ))}
      </div>

      <button onClick={() => setIsCreatingRoot(true)} style={{ marginTop: '8px', padding: '6px 10px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>+ 新建文件夹</button>

      <BatchActionToolbar
        selectedCount={selectedPaperIds.size}
        onDelete={() => onBatchDelete(Array.from(selectedPaperIds))}
        onMove={() => onBatchMove(Array.from(selectedPaperIds), null)}
        onStar={() => onBatchStar(Array.from(selectedPaperIds), true)}
        onClear={onClearSelection}
      />
    </div>
  );
}