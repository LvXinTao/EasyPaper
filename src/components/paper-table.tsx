'use client';

import { useMemo, useState } from 'react';
import type { PaperListItem, Folder } from '@/types';

interface PaperTableProps {
  papers: PaperListItem[];
  folders: Folder[];
  selectedPaperId: string | null;
  selectedPaperIds: Set<string>;
  selectedFolderId: string | null;
  searchQuery: string;
  statusFilter: 'all' | 'analyzed' | 'pending' | 'error';
  starredOnly: boolean;
  sortMode: 'recent' | 'name' | 'starred' | 'date';
  stats: { total: number; analyzed: number; pending: number; error: number; starred: number };
  onPaperClick: (paperId: string) => void;
  onPaperDoubleClick: (paperId: string) => void;
  onCheckboxToggle: (paperId: string) => void;
  onToggleStar: (paperId: string) => void;
  onContextMenuOpen: (e: React.MouseEvent, paperId: string) => void;
  onSortModeChange: (mode: 'recent' | 'name' | 'starred' | 'date') => void;
  onStatusFilterChange: (filter: 'all' | 'analyzed' | 'pending' | 'error') => void;
  onStarredOnlyChange: (value: boolean) => void;
  onClearSelection: () => void;
  onShortTitleChange?: (paperId: string, shortTitle: string) => Promise<void>;
  onClearFolderFilter?: () => void;
}

export function PaperTable({
  papers, folders, selectedPaperId, selectedPaperIds, selectedFolderId, searchQuery,
  statusFilter, starredOnly, sortMode, stats,
  onPaperClick, onPaperDoubleClick, onCheckboxToggle, onToggleStar,
  onContextMenuOpen, onSortModeChange, onStatusFilterChange,
  onStarredOnlyChange, onClearSelection, onShortTitleChange, onClearFolderFilter,
}: PaperTableProps) {
  const [editingShortTitle, setEditingShortTitle] = useState<{ id: string; value: string } | null>(null);
  const [shortTitleSaving, setShortTitleSaving] = useState<string | null>(null);

  const handleShortTitleSave = async (paperId: string, value: string) => {
    if (!onShortTitleChange) return;
    setShortTitleSaving(paperId);
    try {
      await onShortTitleChange(paperId, value);
    } finally {
      setShortTitleSaving(null);
      setEditingShortTitle(null);
    }
  };
  const visiblePapers = useMemo(() => {
    const filtered = papers.filter(p => {
      if (selectedFolderId && p.folderId !== selectedFolderId) return false;
      if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter === 'analyzed' && p.status !== 'analyzed') return false;
      if (statusFilter === 'pending' && !['pending', 'parsing', 'analyzing', 'queued'].includes(p.status)) return false;
      if (statusFilter === 'error' && p.status !== 'error') return false;
      if (starredOnly && !p.starred) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (sortMode === 'name') return a.title.localeCompare(b.title);
      if (sortMode === 'date') {
        const dateA = a.pdfDate || a.createdAt;
        const dateB = b.pdfDate || b.createdAt;
        return dateB.localeCompare(dateA);
      }
      if (sortMode === 'starred') {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
      }
      if (a.sortIndex != null && b.sortIndex != null) return a.sortIndex - b.sortIndex;
      if (a.sortIndex != null) return -1;
      if (b.sortIndex != null) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [papers, searchQuery, statusFilter, starredOnly, sortMode]);

  const formatAuthor = (authors: string[] | undefined) => {
    if (!authors || authors.length === 0) return '—';
    if (authors.length === 1) return authors[0];
    return authors[0] + ' et al.';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const statusConfig: Record<string, { label: string; badgeClass: string }> = {
    analyzed: { label: '✓ Analyzed', badgeClass: 'analyzed' },
    pending: { label: '⏳ Pending', badgeClass: 'pending' },
    queued: { label: '⏳ Queued', badgeClass: 'pending' },
    parsing: { label: '⏳ Parsing', badgeClass: 'pending' },
    analyzing: { label: '⏳ Analyzing', badgeClass: 'pending' },
    error: { label: '✗ Error', badgeClass: 'error' },
  };

  const handleSelectAll = () => {
    const visibleIds = visiblePapers.map(p => p.id);
    const allSelected = visibleIds.every(id => selectedPaperIds.has(id));
    if (allSelected) {
      onClearSelection();
    } else {
      // Select all visible papers — parent handles via Ctrl+A, but this provides checkbox UX
      for (const id of visibleIds) {
        if (!selectedPaperIds.has(id)) onCheckboxToggle(id);
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {selectedFolderId && (
          <span className="px-2 py-1 text-xs rounded-full" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600 }}>
            📁 Folder
            <button onClick={() => onClearFolderFilter?.()} style={{ marginLeft: '6px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700 }} title="Clear folder filter">×</button>
          </span>
        )}
        {(['all', 'analyzed', 'pending', 'error'] as const).map(key => (
          <button
            key={key}
            onClick={() => onStatusFilterChange(key)}
            className="px-2.5 py-1 text-xs rounded-full cursor-pointer transition-colors"
            style={{
              background: statusFilter === key ? 'var(--accent)' : 'transparent',
              color: statusFilter === key ? 'var(--bg)' : 'var(--text-secondary)',
              border: statusFilter === key ? 'none' : '1px solid var(--glass-border)',
            }}
          >
            {key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)} ({stats[key as keyof Omit<typeof stats, 'total'>]})
          </button>
        ))}
        <button
          onClick={() => onStarredOnlyChange(!starredOnly)}
          className="px-2.5 py-1 text-xs rounded-full cursor-pointer transition-colors"
          style={{
            background: starredOnly ? 'var(--amber)' : 'transparent',
            color: starredOnly ? 'var(--bg)' : 'var(--text-secondary)',
            border: starredOnly ? 'none' : '1px solid var(--glass-border)',
          }}
        >
          ★ Starred ({stats.starred})
        </button>
        <div className="flex-1" />
        <select
          value={sortMode}
          onChange={e => onSortModeChange(e.target.value as typeof sortMode)}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{ background: 'var(--surface)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
        >
          <option value="recent">Sort: Recent</option>
          <option value="date">Sort: Date</option>
          <option value="name">Sort: Name</option>
          <option value="starred">Sort: Starred</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
            <tr>
              <th className="text-center" style={{ width: '36px', padding: '8px 6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <input
                  type="checkbox"
                  checked={selectedPaperIds.size > 0 && visiblePapers.length > 0 && visiblePapers.every(p => selectedPaperIds.has(p.id))}
                  onChange={handleSelectAll}
                  style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                />
              </th>
              <th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Title</th>
              <th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', width: '180px' }}>Author</th>
              <th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', width: '100px' }}>Date</th>
              <th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', width: '100px' }}>Status</th>
              <th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', width: '36px' }}>★</th>
              <th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', width: '120px' }}>Short Title</th>
            </tr>
          </thead>
          <tbody>
            {visiblePapers.map(paper => {
              const status = statusConfig[paper.status] || statusConfig.pending;
              const isSelected = paper.id === selectedPaperId;
              const isChecked = selectedPaperIds.has(paper.id);
              return (
                <tr
                  key={paper.id}
                  className={`cursor-pointer transition-colors ${isSelected ? 'selected' : ''}`}
                  onClick={() => onPaperClick(paper.id)}
                  onDoubleClick={() => onPaperDoubleClick(paper.id)}
                  onContextMenu={e => onContextMenuOpen(e, paper.id)}
                  style={{
                    background: isChecked ? 'var(--accent-subtle)' : isSelected ? 'var(--accent-subtle)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { if (!isChecked && !isSelected) (e.currentTarget.style.background = 'var(--glass)'); }}
                  onMouseLeave={e => { if (!isChecked && !isSelected) (e.currentTarget.style.background = 'transparent'); }}
                >
                  <td className="text-center" style={{ padding: '6px 8px' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => { e.stopPropagation(); onCheckboxToggle(paper.id); }}
                      onClick={e => e.stopPropagation()}
                      style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                    />
                  </td>
                  <td className="title-cell" style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {paper.title}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatAuthor(paper.authors)}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-tertiary)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {paper.pdfDate ? formatDate(paper.pdfDate) : '—'}
                  </td>
                  <td className="text-center" style={{ padding: '6px 10px' }}>
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        fontSize: '10px', fontWeight: 600,
                        background: status.badgeClass === 'analyzed' ? 'var(--green-subtle)' : status.badgeClass === 'error' ? 'var(--rose-subtle)' : 'var(--amber-subtle)',
                        color: status.badgeClass === 'analyzed' ? 'var(--green)' : status.badgeClass === 'error' ? 'var(--rose)' : 'var(--amber)',
                      }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="text-center" style={{ padding: '6px 10px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); onToggleStar(paper.id); }}
                      className="cursor-pointer"
                      style={{ background: 'none', border: 'none', fontSize: '14px', color: paper.starred ? 'var(--amber)' : 'var(--text-tertiary)', opacity: paper.starred ? 1 : 0.4 }}
                    >
                      {paper.starred ? '★' : '☆'}
                    </button>
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px', maxWidth: '120px' }}>
                    {editingShortTitle?.id === paper.id ? (
                      <input
                        autoFocus
                        value={editingShortTitle.value}
                        onChange={e => setEditingShortTitle({ id: paper.id, value: e.target.value })}
                        onBlur={() => handleShortTitleSave(paper.id, editingShortTitle.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleShortTitleSave(paper.id, editingShortTitle.value);
                          if (e.key === 'Escape') setEditingShortTitle(null);
                        }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        style={{
                          width: '100%',
                          fontSize: '12px',
                          border: '1px solid var(--accent)',
                          background: 'var(--surface)',
                          color: shortTitleSaving === paper.id ? 'var(--text-tertiary)' : 'var(--text-primary)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                        }}
                        placeholder="Enter short title"
                      />
                    ) : (
                      <span
                        onClick={e => { e.stopPropagation(); setEditingShortTitle({ id: paper.id, value: paper.shortTitle || '' }); }}
                        style={{ cursor: 'text', color: paper.shortTitle ? 'var(--text-primary)' : 'var(--text-tertiary)', opacity: 0.7 }}
                        title="Click to edit"
                      >
                        {paper.shortTitle || '—'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visiblePapers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12" style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                  {papers.length === 0 ? 'No papers yet. Upload a PDF to get started.' : 'No papers match current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
