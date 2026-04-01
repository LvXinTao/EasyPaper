'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PaperTree } from '@/components/paper-tree';
import { FilterPanel } from '@/components/filter-panel';
import { ContextMenu } from '@/components/context-menu';
import { ConfirmModal } from '@/components/confirm-modal';
import { FolderPickerModal } from '@/components/folder-picker-modal';
import { Toast } from '@/components/toast';
import { PreviewPanel } from '@/components/preview-panel';
import { UploadModal } from '@/components/upload-modal';
import { useToast } from '@/hooks/use-toast';
import type { PaperListItem, Folder } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);

  // New state for modals and filters
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; paperId: string | null }>({
    isOpen: false, x: 0, y: 0, paperId: null
  });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });
  const [folderPickerModal, setFolderPickerModal] = useState<{ isOpen: boolean; paperIds: string[] }>({
    isOpen: false, paperIds: []
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'analyzed' | 'pending' | 'error'>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'recent' | 'name' | 'starred'>('recent');

  const { toasts, showToast, dismissToast } = useToast();

  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch('/api/papers');
      const data = await res.json();
      setPapers(data.papers || []);
    } catch {
      showToast('Failed to load papers', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch {
      showToast('Failed to load folders', 'error');
    }
  }, [showToast]);

  // Initial load on mount
  useEffect(() => { fetchPapers(); fetchFolders(); }, [fetchPapers, fetchFolders]);

  // Listen for paper upload events from navbar's UploadModal
  useEffect(() => {
    const handlePaperUploaded = (e: CustomEvent<{ paperId: string }>) => {
      fetchPapers().then(() => setSelectedPaperId(e.detail.paperId));
    };
    window.addEventListener('paperUploaded', handlePaperUploaded as EventListener);
    return () => window.removeEventListener('paperUploaded', handlePaperUploaded as EventListener);
  }, [fetchPapers]);

  // Refresh papers when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPapers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchPapers]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear selection
      if (e.key === 'Escape' && selectedPaperIds.size > 0) {
        setSelectedPaperIds(new Set());
        setContextMenu(c => ({ ...c, isOpen: false }));
      }
      // Ctrl+A to select all visible papers
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && visiblePapers.length > 0) {
        e.preventDefault();
        setSelectedPaperIds(new Set(visiblePapers.map(p => p.id)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPaperIds, visiblePapers]);

  // Compute stats
  const stats = useMemo(() => ({
    total: papers.length,
    analyzed: papers.filter(p => p.status === 'analyzed').length,
    pending: papers.filter(p => ['pending', 'parsing', 'analyzing', 'queued'].includes(p.status)).length,
    error: papers.filter(p => p.status === 'error').length,
    starred: papers.filter(p => p.starred).length,
  }), [papers]);

  // Compute visible papers with filtering and sorting
  const visiblePapers = useMemo(() => {
    let filtered = papers.filter(p => {
      // Search filter
      if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      // Status filter
      if (statusFilter === 'analyzed' && p.status !== 'analyzed') return false;
      if (statusFilter === 'pending' && !['pending', 'parsing', 'analyzing', 'queued'].includes(p.status)) return false;
      if (statusFilter === 'error' && p.status !== 'error') return false;
      // Starred filter
      if (starredOnly && !p.starred) return false;
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortMode === 'name') return a.title.localeCompare(b.title);
      if (sortMode === 'starred') {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
      }
      // Recent (default)
      if (a.sortIndex != null && b.sortIndex != null) return a.sortIndex - b.sortIndex;
      if (a.sortIndex != null) return -1;
      if (b.sortIndex != null) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [papers, searchQuery, statusFilter, starredOnly, sortMode]);

  // Single paper handlers
  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除论文',
      message: '确定要删除这篇论文吗？此操作不可撤销。',
      onConfirm: async () => {
        await fetch(`/api/paper/${id}`, { method: 'DELETE' });
        setPapers(prev => prev.filter(p => p.id !== id));
        if (selectedPaperId === id) setSelectedPaperId(null);
        setSelectedPaperIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        showToast('论文已删除', 'success');
      }
    });
  };

  const handleToggleStar = async (paperId: string) => {
    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;
    const newStarred = !paper.starred;
    // Optimistic update
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, starred: newStarred } : p));
    await fetch(`/api/paper/${paperId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: newStarred }),
    });
    showToast(newStarred ? '已添加星标' : '已移除星标', 'info');
  };

  const handleMovePaper = async (paperId: string, folderId: string | null) => {
    await fetch(`/api/paper/${paperId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId }) });
    await fetchPapers();
    showToast('论文已移动', 'success');
  };

  const handleRename = async (id: string, title: string) => {
    await fetch(`/api/paper/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    await fetchPapers();
    showToast('论文已重命名', 'success');
  };

  // Folder handlers
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) });
    await fetchFolders();
    showToast('文件夹已创建', 'success');
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    await fetch(`/api/folders/${folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    await fetchFolders();
    showToast('文件夹已重命名', 'success');
  };

  const handleDeleteFolder = async (folderId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除文件夹',
      message: '确定要删除此文件夹吗？文件夹内的论文将移至根目录。',
      onConfirm: async () => {
        await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
        await fetchFolders();
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        showToast('文件夹已删除', 'success');
      }
    });
  };

  // Batch operation handlers
  const handleBatchDelete = (paperIds: string[]) => {
    setConfirmModal({
      isOpen: true,
      title: '批量删除',
      message: `确定要删除 ${paperIds.length} 篇论文吗？此操作不可撤销。`,
      onConfirm: async () => {
        for (const id of paperIds) {
          await fetch(`/api/paper/${id}`, { method: 'DELETE' });
        }
        setPapers(prev => prev.filter(p => !paperIds.includes(p.id)));
        setSelectedPaperIds(new Set());
        if (paperIds.includes(selectedPaperId || '')) setSelectedPaperId(null);
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        showToast(`已删除 ${paperIds.length} 篇论文`, 'success');
      }
    });
  };

  const handleBatchMove = (paperIds: string[], folderId: string | null) => {
    if (paperIds.length === 0) return;
    setFolderPickerModal({ isOpen: true, paperIds });
  };

  const handleBatchMoveConfirm = async (folderId: string | null) => {
    const paperIds = folderPickerModal.paperIds;
    for (const id of paperIds) {
      await fetch(`/api/paper/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId }) });
    }
    await fetchPapers();
    setSelectedPaperIds(new Set());
    setFolderPickerModal({ isOpen: false, paperIds: [] });
    showToast(`已移动 ${paperIds.length} 篇论文`, 'success');
  };

  const handleBatchStar = async (paperIds: string[], starred: boolean) => {
    for (const id of paperIds) {
      await fetch(`/api/paper/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred }),
      });
    }
    setPapers(prev => prev.map(p => paperIds.includes(p.id) ? { ...p, starred } : p));
    setSelectedPaperIds(new Set());
    showToast(starred ? `已添加 ${paperIds.length} 个星标` : `已移除 ${paperIds.length} 个星标`, 'success');
  };

  const handleCheckboxToggle = (paperId: string) => {
    setSelectedPaperIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paperId)) {
        newSet.delete(paperId);
      } else {
        newSet.add(paperId);
      }
      return newSet;
    });
  };

  const handleContextMenuOpen = (e: React.MouseEvent, paperId: string) => {
    e.preventDefault();
    // If right-clicking on a paper not in selection, add it to selection
    if (!selectedPaperIds.has(paperId)) {
      setSelectedPaperIds(new Set([paperId]));
    }
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, paperId });
  };

  const handlePaperClick = (paperId: string) => {
    setSelectedPaperId(paperId);
  };

  const handleUploadComplete = (paperId: string) => {
    setDroppedFiles(null);
    fetchPapers().then(() => setSelectedPaperId(paperId));
  };

  // Drag-and-drop on Column 2 to trigger upload
  const handleCol2Drop = (e: React.DragEvent) => {
    e.preventDefault();
    const pdfFiles = Array.from(e.dataTransfer.files).filter(
      f => f.type === 'application/pdf' || f.name.endsWith('.pdf')
    );
    if (pdfFiles.length > 0) {
      setDroppedFiles(pdfFiles);
      setUploadOpen(true);
    }
  };

  const selectedPaper = papers.find(p => p.id === selectedPaperId) || null;

  return (
    <div className="flex" style={{ height: 'calc(100vh - 44px)' }}>
      {/* Column 1: Paper Tree */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: '20%', minWidth: '220px', borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.012)' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCol2Drop}
      >
        <PaperTree
          papers={visiblePapers}
          folders={folders}
          selectedPaperId={selectedPaperId}
          selectedPaperIds={selectedPaperIds}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onPaperClick={handlePaperClick}
          onCheckboxToggle={handleCheckboxToggle}
          onBatchDelete={handleBatchDelete}
          onBatchMove={handleBatchMove}
          onBatchStar={handleBatchStar}
          onMovePaper={handleMovePaper}
          onClearSelection={() => setSelectedPaperIds(new Set())}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onContextMenuOpen={handleContextMenuOpen}
        />
      </div>

      {/* Column 2: Filter Panel */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: '20%', minWidth: '200px', borderRight: '1px solid var(--border)' }}
      >
        <FilterPanel
          statusFilter={statusFilter}
          starredOnly={starredOnly}
          sortMode={sortMode}
          stats={stats}
          onStatusFilterChange={setStatusFilter}
          onStarredOnlyChange={setStarredOnly}
          onSortModeChange={setSortMode}
        />
      </div>

      {/* Column 3: Preview Panel */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.006)' }}>
        <PreviewPanel
          paper={selectedPaper}
          multiSelectCount={selectedPaperIds.size}
          onDelete={handleDelete}
          onMovePaper={handleMovePaper}
          onRename={handleRename}
          onToggleStar={handleToggleStar}
          folders={folders}
        />
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => { setUploadOpen(false); setDroppedFiles(null); }}
        onUploadComplete={handleUploadComplete}
        initialFiles={droppedFiles}
      />

      {/* Context Menu */}
      {contextMenu.isOpen && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedCount={selectedPaperIds.size}
          onClose={() => setContextMenu({ isOpen: false, x: 0, y: 0, paperId: null })}
          onDelete={() => handleBatchDelete(Array.from(selectedPaperIds))}
          onMove={() => handleBatchMove(Array.from(selectedPaperIds), null)}
          onStar={() => handleBatchStar(Array.from(selectedPaperIds), true)}
          onUnstar={() => handleBatchStar(Array.from(selectedPaperIds), false)}
          onClear={() => setSelectedPaperIds(new Set())}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="确认"
        cancelLabel="取消"
        danger={true}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
      />

      {/* Folder Picker Modal */}
      <FolderPickerModal
        isOpen={folderPickerModal.isOpen}
        folders={folders}
        selectedFolderId={null}
        onSelect={handleBatchMoveConfirm}
        onCancel={() => setFolderPickerModal({ isOpen: false, paperIds: [] })}
      />

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}