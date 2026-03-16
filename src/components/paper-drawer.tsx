'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Folder, PaperListItem } from '@/types';
import { FolderTree } from './folder-tree';

interface PaperDrawerProps {
  open: boolean;
  onClose: () => void;
  currentPaperId: string;
}

export function PaperDrawer({ open, onClose, currentPaperId }: PaperDrawerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingRootFolder, setIsCreatingRootFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [foldersRes, papersRes] = await Promise.all([
        fetch('/api/folders'),
        fetch('/api/papers'),
      ]);
      const foldersData = await foldersRes.json();
      const papersData = await papersRes.json();
      setFolders(foldersData.folders || []);
      setPapers(papersData.papers || []);
    } catch {
      // Silently fail, show whatever data we have
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchData();
      setSearchQuery('');
    }
  }, [open, fetchData]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
    if (res.ok) {
      const data = await res.json();
      setFolders((prev) => [...prev, data.folder]);
    }
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      setFolders((prev) => prev.map((f) => (f.id === folderId ? data.folder : f)));
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    if (res.ok) await fetchData();
  };

  const handleMovePaper = async (paperId: string, folderId: string | null) => {
    const res = await fetch(`/api/paper/${paperId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    });
    if (res.ok) {
      setPapers((prev) => prev.map((p) => (p.id === paperId ? { ...p, folderId } : p)));
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    const res = await fetch(`/api/paper/${paperId}`, { method: 'DELETE' });
    if (res.ok) {
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
    }
  };

  const handleCreateRootFolder = async () => {
    const trimmed = newFolderName.trim();
    if (trimmed) {
      await handleCreateFolder(trimmed, null);
      setNewFolderName('');
    }
    setIsCreatingRootFolder(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 top-[52px] z-30 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Paper navigation"
        className={`fixed top-[52px] left-0 bottom-0 w-80 z-30 bg-white shadow-xl transform transition-transform duration-200 flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Search + Add folder */}
        <div className="p-3 border-b border-slate-200 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-md px-3 py-1.5">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-slate-700 outline-none flex-1 placeholder-slate-400"
            />
          </div>
          <button
            onClick={() => setIsCreatingRootFolder(true)}
            className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors text-lg font-semibold flex-shrink-0"
            title="New folder"
          >
            +
          </button>
        </div>

        {/* New root folder input */}
        {isCreatingRootFolder && (
          <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
            <span>📁</span>
            <input
              autoFocus
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={handleCreateRootFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateRootFolder();
                if (e.key === 'Escape') setIsCreatingRootFolder(false);
              }}
              className="text-sm border border-indigo-400 rounded px-2 py-1 outline-none flex-1"
              maxLength={100}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <FolderTree
              folders={folders}
              papers={papers}
              currentPaperId={currentPaperId}
              searchQuery={searchQuery}
              onClose={onClose}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onMovePaper={handleMovePaper}
              onDeletePaper={handleDeletePaper}
            />
          )}
        </div>
      </div>
    </>
  );
}
