'use client';

import { useState, useEffect, useCallback } from 'react';
import { FolderTree } from '@/components/folder-tree';
import { PaperRow } from '@/components/paper-row';
import { PreviewPanel } from '@/components/preview-panel';
import { UploadModal } from '@/components/upload-modal';
import type { PaperListItem, Folder } from '@/types';

export default function HomePage() {
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch('/api/papers');
      const data = await res.json();
      setPapers(data.papers || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchPapers(); fetchFolders(); }, [fetchPapers, fetchFolders]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this paper?')) return;
    await fetch(`/api/paper/${id}`, { method: 'DELETE' });
    setPapers(prev => prev.filter(p => p.id !== id));
    if (selectedPaperId === id) setSelectedPaperId(null);
  };

  const handleUploadComplete = (paperId: string) => {
    setDroppedFile(null);
    fetchPapers().then(() => setSelectedPaperId(paperId));
  };

  // Folder CRUD handlers
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) });
    await fetchFolders();
  };
  const handleRenameFolder = async (folderId: string, name: string) => {
    await fetch(`/api/folders/${folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    await fetchFolders();
  };
  const handleDeleteFolder = async (folderId: string) => {
    await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    await fetchFolders();
    if (selectedFolderId === folderId) setSelectedFolderId(null);
  };
  const handleMovePaper = async (paperId: string, folderId: string | null) => {
    await fetch(`/api/paper/${paperId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId }) });
    await fetchPapers();
  };

  // Filter papers
  const filtered = papers.filter(p => {
    if (selectedFolderId && p.folderId !== selectedFolderId) return false;
    if (filterStatus === 'analyzed' && p.status !== 'analyzed') return false;
    if (filterStatus === 'pending' && !['pending', 'parsing', 'analyzing'].includes(p.status)) return false;
    if (filterStatus === 'error' && p.status !== 'error') return false;
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectedPaper = papers.find(p => p.id === selectedPaperId) || null;
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'analyzed', label: 'Analyzed' },
    { key: 'pending', label: 'Pending' },
    { key: 'error', label: 'Error' },
  ];

  // Drag-and-drop on Column 2 to trigger upload
  const handleCol2Drop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      setDroppedFile(file);
      setUploadOpen(true);
    }
  };

  return (
    <div className="flex" style={{ height: 'calc(100vh - 44px)' }}>
      {/* Column 1: Folder Sidebar */}
      <div
        className="flex flex-col overflow-y-auto"
        style={{ width: '15%', minWidth: '180px', padding: '14px 10px', borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.012)' }}
      >
        <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', padding: '8px 10px 5px', fontWeight: 600 }}>
          Library
        </div>
        <div
          onClick={() => setSelectedFolderId(null)}
          className="cursor-pointer rounded-lg flex items-center gap-2 transition-colors"
          style={{
            padding: '6px 10px', fontSize: '12px',
            background: !selectedFolderId ? 'var(--accent-subtle)' : 'transparent',
            color: !selectedFolderId ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          All Papers
          <span className="ml-auto" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{papers.length}</span>
        </div>
        <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', padding: '12px 10px 5px', fontWeight: 600 }}>
          Folders
        </div>
        <FolderTree
          folders={folders}
          papers={papers}
          currentPaperId={''}
          searchQuery={''}
          onClose={() => {}}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMovePaper={handleMovePaper}
          onDeletePaper={handleDelete}
          onSelectFolder={setSelectedFolderId}
          selectedFolderId={selectedFolderId}
        />
      </div>

      {/* Column 2: Paper List */}
      <div
        className="flex flex-col"
        style={{ width: '25%', minWidth: '280px', borderRight: '1px solid var(--border)' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCol2Drop}
      >
        <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedFolderId ? 'Folder' : 'All Papers'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{filtered.length} papers</div>
        </div>
        <div style={{ margin: '8px 10px' }}>
          <input
            type="text"
            placeholder="Search papers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg"
            style={{
              height: '32px', padding: '0 10px', fontSize: '12px',
              background: 'var(--glass)', border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
        </div>
        <div className="flex gap-1" style={{ padding: '0 10px 8px' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className="cursor-pointer rounded-full"
              style={{
                padding: '3px 9px', fontSize: '10px',
                background: filterStatus === f.key ? 'var(--text-primary)' : 'var(--glass)',
                color: filterStatus === f.key ? 'var(--bg)' : 'var(--text-tertiary)',
                border: filterStatus === f.key ? 'none' : '1px solid var(--glass-border)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Paper list or empty state */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '4px 8px' }}>
          {loading && (
            <div className="text-center" style={{ padding: '32px 0', color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Loading papers...
            </div>
          )}
          {!loading && filtered.length === 0 && papers.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center gap-3" style={{ padding: '48px 16px', color: 'var(--text-tertiary)' }}>
              <div className="rounded-2xl flex items-center justify-center" style={{ width: '48px', height: '48px', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Upload your first paper</div>
              <div style={{ fontSize: '11px' }}>Drag a PDF here or click the button</div>
              <button
                onClick={() => setUploadOpen(true)}
                className="cursor-pointer rounded-lg"
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', marginTop: '4px' }}
              >
                + Upload
              </button>
            </div>
          )}
          {!loading && filtered.length === 0 && papers.length > 0 && (
            <div className="text-center" style={{ padding: '32px 0', color: 'var(--text-tertiary)', fontSize: '12px' }}>
              No papers match this filter
            </div>
          )}
          {filtered.map(paper => (
            <PaperRow
              key={paper.id}
              paper={paper}
              isActive={paper.id === selectedPaperId}
              onClick={() => setSelectedPaperId(paper.id)}
            />
          ))}
        </div>
      </div>

      {/* Column 3: Preview Panel */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.006)' }}>
        <PreviewPanel paper={selectedPaper} onDelete={handleDelete} />
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => { setUploadOpen(false); setDroppedFile(null); }}
        onUploadComplete={handleUploadComplete}
        initialFile={droppedFile}
      />
    </div>
  );
}
