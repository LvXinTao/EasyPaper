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
  onPaperDoubleClick: (paperId: string) => void;
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
  onToggleStar: (paperId: string) => void;
  // Filter props
  statusFilter: 'all' | 'analyzed' | 'pending' | 'error';
  starredOnly: boolean;
  sortMode: 'recent' | 'name' | 'starred';
  stats: { total: number; analyzed: number; pending: number; error: number; starred: number };
  onStatusFilterChange: (filter: 'all' | 'analyzed' | 'pending' | 'error') => void;
  onStarredOnlyChange: (value: boolean) => void;
  onSortModeChange: (mode: 'recent' | 'name' | 'starred') => void;
}

export function PaperTree({
  papers,
  folders,
  selectedPaperId,
  selectedPaperIds,
  searchQuery,
  onSearchQueryChange,
  onPaperClick,
  onPaperDoubleClick,
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
  onToggleStar,
  statusFilter,
  starredOnly,
  sortMode,
  stats,
  onStatusFilterChange,
  onStarredOnlyChange,
  onSortModeChange,
}: PaperTreeProps) {
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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

  const statusFilters = [
    { key: 'all' as const, label: 'All', count: stats.total },
    { key: 'analyzed' as const, label: 'Analyzed', count: stats.analyzed },
    { key: 'pending' as const, label: 'Pending', count: stats.pending },
    { key: 'error' as const, label: 'Error', count: stats.error },
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '12px', overflow: 'hidden' }}>
      {/* Search */}
      <div style={{ marginBottom: '8px' }}>
        <input
          type="text"
          placeholder="Search papers..."
          value={searchQuery}
          onChange={e => onSearchQueryChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '12px',
            background: 'var(--glass)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            borderRadius: '6px'
          }}
        />
      </div>

      {/* Filter Toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          fontSize: '11px',
          background: 'transparent',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '8px',
        }}
      >
        <span>Filters & Stats</span>
        <span style={{ fontSize: '10px' }}>{showFilters ? '▼' : '▶'}</span>
      </button>

      {/* Expandable Filters */}
      {showFilters && (
        <div style={{ marginBottom: '8px', padding: '10px', background: 'var(--glass)', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
          {/* Status Filters */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {statusFilters.map(f => (
                <button key={f.key} onClick={() => onStatusFilterChange(f.key)} style={{
                  padding: '4px 8px', fontSize: '10px', borderRadius: '10px',
                  border: statusFilter === f.key ? 'none' : '1px solid var(--glass-border)',
                  background: statusFilter === f.key ? 'var(--accent)' : 'transparent',
                  color: statusFilter === f.key ? 'var(--bg)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          {/* Starred Filter & Sort */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: starredOnly ? 'var(--amber)' : 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={starredOnly} onChange={e => onStarredOnlyChange(e.target.checked)} style={{ accentColor: 'var(--amber)', width: '14px', height: '14px' }} />
              ★ Starred ({stats.starred})
            </label>
            <select value={sortMode} onChange={e => onSortModeChange(e.target.value as 'recent' | 'name' | 'starred')} style={{
              flex: 1, padding: '4px 6px', fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer',
            }}>
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="starred">Starred</option>
            </select>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
            <div><div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{stats.total}</div><div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Total</div></div>
            <div><div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green)' }}>{stats.analyzed}</div><div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Analyzed</div></div>
            <div><div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--amber)' }}>{stats.pending}</div><div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Pending</div></div>
            <div><div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--rose)' }}>{stats.error}</div><div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Error</div></div>
          </div>
        </div>
      )}

      <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', fontWeight: 600, padding: '8px 6px 4px' }}>LIBRARY</div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {rootFolders.map(folder => (
          <PaperTreeFolder key={folder.id} folder={folder} depth={0} papers={filteredPapers} allFolders={folders} selectedPaperIds={selectedPaperIds} selectedPaperId={selectedPaperId} onPaperClick={onPaperClick} onPaperDoubleClick={onPaperDoubleClick} onPaperCheckboxToggle={onCheckboxToggle} onPaperContextMenu={onContextMenuOpen} onDropPaper={(paperId, folderId) => onMovePaper(paperId, folderId)} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onCreateChildFolder={(name, parentId) => onCreateFolder(name, parentId)} onToggleStar={onToggleStar} />
        ))}

        {isCreatingRoot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px' }}>
            <span style={{ fontSize: '13px' }}>📁</span>
            <input autoFocus placeholder="Folder name" value={newRootName} onChange={e => setNewRootName(e.target.value)} onBlur={handleCreateRoot} onKeyDown={e => { if (e.key === 'Enter') handleCreateRoot(); if (e.key === 'Escape') setIsCreatingRoot(false); }} style={{ flex: 1, fontSize: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '4px 6px' }} />
          </div>
        )}

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
      </div>

      <button onClick={() => setIsCreatingRoot(true)} style={{ marginTop: '8px', padding: '8px 12px', fontSize: '12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>+ New Folder</button>

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