'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PaperTree } from '@/components/paper-tree';
import { ResizablePanels } from '@/components/resizable-panels';
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
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);

  // Modals and filters state
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
  const [sortMode, setSortMode] = useState<'recent' | 'name' | 'starred' | 'date'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('homepageSortMode');
        if (saved === 'recent' || saved === 'name' || saved === 'starred' || saved === 'date') {
          return saved;
        }
      } catch { /* ignore */ }
    }
    return 'recent';
  });

  const handleSortModeChange = useCallback((newMode: 'recent' | 'name' | 'starred' | 'date') => {
    setSortMode(newMode);
    try { localStorage.setItem('homepageSortMode', newMode); } catch { /* ignore */ }
  }, []);

  const { toasts, showToast, dismissToast } = useToast();

  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch('/api/papers');
      const data = await res.json();
      setPapers(data.papers || []);
    } catch {
      showToast('Failed to load papers', 'error');
    }
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

  // Initial data fetch
  useEffect(() => {
    (async () => {
      try {
        const [papersRes, foldersRes] = await Promise.all([
          fetch('/api/papers'),
          fetch('/api/folders')
        ]);
        const papersData = await papersRes.json();
        const foldersData = await foldersRes.json();
        setPapers(papersData.papers || []);
        setFolders(foldersData.folders || []);
      } catch {
        showToast('Failed to load data', 'error');
      }
    })();
  }, [showToast]);

  // Refresh handlers
  useEffect(() => {
    const handlePaperUploaded = (e: CustomEvent<{ paperId?: string }>) => {
      fetchPapers().then(() => {
        if (e.detail?.paperId) {
          setSelectedPaperId(e.detail.paperId);
        }
      });
    };
    window.addEventListener('paperUploaded', handlePaperUploaded as EventListener);
    return () => window.removeEventListener('paperUploaded', handlePaperUploaded as EventListener);
  }, [fetchPapers]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchPapers();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchPapers]);

  const stats = useMemo(() => ({
    total: papers.length,
    analyzed: papers.filter(p => p.status === 'analyzed').length,
    pending: papers.filter(p => ['pending', 'parsing', 'analyzing', 'queued'].includes(p.status)).length,
    error: papers.filter(p => p.status === 'error').length,
    starred: papers.filter(p => p.starred).length,
  }), [papers]);

  const visiblePapers = useMemo(() => {
    const filtered = papers.filter(p => {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPaperIds.size > 0) {
        setSelectedPaperIds(new Set());
        setContextMenu(c => ({ ...c, isOpen: false }));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && visiblePapers.length > 0) {
        e.preventDefault();
        setSelectedPaperIds(new Set(visiblePapers.map(p => p.id)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPaperIds, visiblePapers]);

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Paper',
      message: 'Are you sure you want to delete this paper? This action cannot be undone.',
      onConfirm: async () => {
        await fetch(`/api/paper/${id}`, { method: 'DELETE' });
        setPapers(prev => prev.filter(p => p.id !== id));
        if (selectedPaperId === id) setSelectedPaperId(null);
        setSelectedPaperIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        showToast('Paper deleted', 'success');
      }
    });
  };

  const handleToggleStar = async (paperId: string) => {
    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;
    const newStarred = !paper.starred;
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, starred: newStarred } : p));
    await fetch(`/api/paper/${paperId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ starred: newStarred }) });
    showToast(newStarred ? 'Star added' : 'Star removed', 'info');
  };

  const handleMovePaper = async (paperId: string, folderId: string | null) => {
    await fetch(`/api/paper/${paperId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId }) });
    await fetchPapers();
    showToast('Paper moved', 'success');
  };

  const handleRename = async (id: string, title: string) => {
    const trimmedTitle = title.trim().slice(0, 500);
    if (!trimmedTitle) {
      showToast('Paper title cannot be empty', 'error');
      return;
    }
    await fetch(`/api/paper/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: trimmedTitle }) });
    await fetchPapers();
    showToast('Paper renamed', 'success');
  };

  const handleAnalyze = async (paperId: string) => {
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to start analysis', 'error');
        return;
      }

      const contentType = res.headers.get('Content-Type') || '';

      if (contentType.includes('text/event-stream')) {
        // SSE stream — analysis started immediately. Close stream; homepage doesn't consume it.
        res.body?.cancel();
        setPapers(prev => prev.map(p => p.id === paperId ? { ...p, status: 'analyzing' as const } : p));
      } else {
        const data = await res.json();
        if (data.status === 'queued') {
          setPapers(prev => prev.map(p => p.id === paperId ? { ...p, status: 'queued' as const } : p));
        } else if (data.status === 'already_queued') {
          showToast('Analysis already queued', 'info');
        } else if (data.status === 'already_running') {
          showToast('Analysis already in progress', 'info');
        }
      }
    } catch {
      showToast('Failed to start analysis', 'error');
    }
  };

  const handleAnalysisComplete = useCallback(() => {
    fetchPapers();
  }, [fetchPapers]);

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    const trimmedName = name.trim().slice(0, 100);
    if (!trimmedName) {
      showToast('Folder name cannot be empty', 'error');
      return;
    }
    await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmedName, parentId }) });
    await fetchFolders();
    showToast('Folder created', 'success');
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    const trimmedName = name.trim().slice(0, 100);
    if (!trimmedName) {
      showToast('Folder name cannot be empty', 'error');
      return;
    }
    await fetch(`/api/folders/${folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmedName }) });
    await fetchFolders();
    showToast('Folder renamed', 'success');
  };

  const handleDeleteFolder = async (folderId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Folder',
      message: 'Are you sure you want to delete this folder? Papers inside will be moved to the root.',
      onConfirm: async () => {
        await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
        await fetchFolders();
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        showToast('Folder deleted', 'success');
      }
    });
  };

  const handleBatchDelete = (paperIds: string[]) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Papers',
      message: `Are you sure you want to delete ${paperIds.length} papers? This action cannot be undone.`,
      onConfirm: async () => {
        const results = await Promise.allSettled(
          paperIds.map(id => fetch(`/api/paper/${id}`, { method: 'DELETE' }))
        );
        const deletedIds = paperIds.filter((_, i) => results[i].status === 'fulfilled');
        setPapers(prev => prev.filter(p => !deletedIds.includes(p.id)));
        setSelectedPaperIds(new Set());
        if (paperIds.includes(selectedPaperId || '')) setSelectedPaperId(null);
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        const failedCount = paperIds.length - deletedIds.length;
        if (failedCount > 0) {
          showToast(`${deletedIds.length} papers deleted, ${failedCount} failed`, 'warning');
        } else {
          showToast(`${deletedIds.length} papers deleted`, 'success');
        }
      }
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBatchMove = (paperIds: string[], _folderId: string | null) => {
    if (paperIds.length === 0) return;
    setFolderPickerModal({ isOpen: true, paperIds });
  };

  const handleBatchMoveConfirm = async (folderId: string | null) => {
    const paperIds = folderPickerModal.paperIds;
    const results = await Promise.allSettled(
      paperIds.map(id => fetch(`/api/paper/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId })
      }))
    );
    const movedIds = paperIds.filter((_, i) => results[i].status === 'fulfilled');
    await fetchPapers();
    setSelectedPaperIds(new Set());
    setFolderPickerModal({ isOpen: false, paperIds: [] });
    const failedCount = paperIds.length - movedIds.length;
    if (failedCount > 0) {
      showToast(`${movedIds.length} papers moved, ${failedCount} failed`, 'warning');
    } else {
      showToast(`${movedIds.length} papers moved`, 'success');
    }
  };

  const handleBatchStar = async (paperIds: string[], starred: boolean) => {
    const results = await Promise.allSettled(
      paperIds.map(id => fetch(`/api/paper/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred })
      }))
    );
    const starredIds = paperIds.filter((_, i) => results[i].status === 'fulfilled');
    setPapers(prev => prev.map(p => starredIds.includes(p.id) ? { ...p, starred } : p));
    setSelectedPaperIds(new Set());
    const failedCount = paperIds.length - starredIds.length;
    if (failedCount > 0) {
      showToast(starred ? `Star added to ${starredIds.length} papers, ${failedCount} failed` : `Star removed from ${starredIds.length} papers, ${failedCount} failed`, 'warning');
    } else {
      showToast(starred ? `Star added to ${starredIds.length} papers` : `Star removed from ${starredIds.length} papers`, 'success');
    }
  };

  const handleCheckboxToggle = (paperId: string) => {
    setSelectedPaperIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paperId)) newSet.delete(paperId);
      else newSet.add(paperId);
      return newSet;
    });
  };

  const handleContextMenuOpen = (e: React.MouseEvent, paperId: string) => {
    e.preventDefault();
    if (!selectedPaperIds.has(paperId)) setSelectedPaperIds(new Set([paperId]));
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, paperId });
  };

  const handleUploadComplete = (paperId: string) => {
    setDroppedFiles(null);
    fetchPapers().then(() => setSelectedPaperId(paperId));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const pdfFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFiles.length > 0) { setDroppedFiles(pdfFiles); setUploadOpen(true); }
  };

  const selectedPaper = papers.find(p => p.id === selectedPaperId) || null;

  const handlePaperDoubleClick = useCallback((paperId: string) => {
    router.push(`/paper/${paperId}`);
  }, [router]);

  // Left Panel Component
  const leftPanel = (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100%', background: 'rgba(255,255,255,0.012)' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <PaperTree
        papers={visiblePapers}
        folders={folders}
        selectedPaperId={selectedPaperId}
        selectedPaperIds={selectedPaperIds}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onPaperClick={(id) => setSelectedPaperId(id)}
        onPaperDoubleClick={handlePaperDoubleClick}
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
        onToggleStar={handleToggleStar}
        statusFilter={statusFilter}
        starredOnly={starredOnly}
        sortMode={sortMode}
        stats={stats}
        onStatusFilterChange={setStatusFilter}
        onStarredOnlyChange={setStarredOnly}
        onSortModeChange={handleSortModeChange}
      />
    </div>
  );

  // Right Panel Component
  const rightPanel = (
    <div className="flex flex-col overflow-hidden" style={{ height: '100%', background: 'rgba(255,255,255,0.006)' }}>
      <PreviewPanel
        key={selectedPaper?.id ?? 'none'}
        paper={selectedPaper}
        multiSelectCount={selectedPaperIds.size}
        onDelete={handleDelete}
        onAnalyze={handleAnalyze}
        onAnalysisComplete={handleAnalysisComplete}
        onMovePaper={handleMovePaper}
        onRename={handleRename}
        onToggleStar={handleToggleStar}
        folders={folders}
      />
    </div>
  );

  return (
    <div style={{ height: 'calc(100vh - 44px)' }}>
      <ResizablePanels
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        defaultLeftWidth={300}
        minLeftWidth={240}
        maxLeftWidth={500}
      />

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => { setUploadOpen(false); setDroppedFiles(null); }}
        onUploadComplete={handleUploadComplete}
        initialFiles={droppedFiles}
      />

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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        danger={true}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
      />

      <FolderPickerModal
        isOpen={folderPickerModal.isOpen}
        folders={folders}
        selectedFolderId={null}
        onSelect={handleBatchMoveConfirm}
        onCancel={() => setFolderPickerModal({ isOpen: false, paperIds: [] })}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}