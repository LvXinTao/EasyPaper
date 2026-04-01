'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Folder } from '@/types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (paperId: string) => void;
  initialFiles?: File[] | null;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const filterPdfFiles = (files: FileList | File[]): File[] => {
  return Array.from(files).filter(
    f => (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
  );
};

// Helper to recursively read entries from a dropped folder
const collectPdfFilesFromEntries = async (items: DataTransferItemList): Promise<File[]> => {
  const files: File[] = [];

  const readEntry = (entry: FileSystemEntry): Promise<void> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file) => {
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            files.push(file);
          }
          resolve();
        }, () => resolve());
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        reader.readEntries(async (entries) => {
          for (const e of entries) {
            await readEntry(e);
          }
          resolve();
        }, () => resolve());
      } else {
        resolve();
      }
    });
  };

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  for (const entry of entries) {
    await readEntry(entry);
  }
  return files;
};

export function UploadModal({ isOpen, onClose, onUploadComplete, initialFiles }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number } | null>(null);

  // Fetch folders when modal opens
  useEffect(() => {
    if (isOpen) {
      fetch('/api/folders').then(res => res.json()).then(data => setFolders(data.folders || [])).catch(() => {});
    }
  }, [isOpen]);

  // Pre-populate files when opened with initialFiles (e.g. drag onto paper list)
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0 && isOpen) {
      setSelectedFiles(filterPdfFiles(initialFiles));
    }
  }, [initialFiles, isOpen]);

  const handleClose = useCallback(() => {
    setSelectedFiles([]);
    setUploadProgress(null);
    setUploadResults(null);
    setError(null);
    setTargetFolderId(null);
    onClose();
  }, [onClose]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedFiles(prev => [...prev, ...filterPdfFiles(files)]);
    }
    e.target.value = '';
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedFiles(prev => [...prev, ...filterPdfFiles(files)]);
    }
    e.target.value = '';
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Try webkitGetAsEntry first for folder support
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const hasEntries = e.dataTransfer.items[0].webkitGetAsEntry;
      if (hasEntries) {
        const files = await collectPdfFilesFromEntries(e.dataTransfer.items);
        if (files.length > 0) {
          setSelectedFiles(prev => [...prev, ...files]);
          return;
        }
      }
    }

    // Fallback: direct file list
    const files = filterPdfFiles(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  }, []);

  const startBatchUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError(null);
    const total = selectedFiles.length;
    let success = 0;
    let failed = 0;
    const uploadedIds: string[] = [];

    setUploadProgress({ current: 0, total });
    for (let i = 0; i < total; i++) {
      const file = selectedFiles[i];

      // Client-side size check
      if (file.size > MAX_FILE_SIZE) {
        failed++;
        setUploadProgress({ current: i + 1, total });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!response.ok) {
          failed++;
          setUploadProgress({ current: i + 1, total });
          continue;
        }
        const { id } = await response.json();
        uploadedIds.push(id);

        // Assign to folder if selected
        if (targetFolderId) {
          await fetch(`/api/paper/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: targetFolderId }),
          });
        }
        success++;
      } catch {
        failed++;
      }
      setUploadProgress({ current: i + 1, total });
    }

    setUploadProgress(null);
    setUploadResults({ success, failed });
    setUploading(false);

    if (success > 0) {
      const lastId = uploadedIds[uploadedIds.length - 1];
      setTimeout(() => {
        handleClose();
        if (onUploadComplete && lastId) {
          onUploadComplete(lastId);
        }
      }, 2000);
    }
  }, [selectedFiles, targetFolderId, handleClose, onUploadComplete]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', animation: 'fadeIn 150ms ease-out' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl"
        style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', animation: 'fadeIn 150ms ease-out, scaleIn 150ms ease-out' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Upload Papers</h3>
            <button onClick={handleClose} className="cursor-pointer" style={{ color: 'var(--text-tertiary)', fontSize: '18px' }}>×</button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
            Upload PDFs to add them to your library
          </p>

          {/* Drop zone / file selection */}
          {!uploading && !uploadResults && (
            <div
              className="rounded-xl text-center transition-all cursor-pointer"
              style={{
                border: isDragging ? '2px dashed var(--accent)' : '2px dashed var(--border-strong)',
                background: isDragging ? 'var(--accent-subtle)' : 'transparent',
                padding: '32px',
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple onChange={handleFileSelect} className="hidden" />
              <input ref={folderInputRef} type="file" {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>} onChange={handleFolderSelect} className="hidden" />

              {selectedFiles.length === 0 ? (
                <div>
                  <div className="mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ width: '44px', height: '44px', background: 'var(--accent-subtle)' }}>
                    <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Drag & drop PDFs here</div>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                      className="cursor-pointer rounded-lg"
                      style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
                    >
                      Choose Files
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                      className="cursor-pointer rounded-lg"
                      style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
                    >
                      Choose Folder
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)' }}>
                    {selectedFiles.length} PDF {selectedFiles.length === 1 ? 'file' : 'files'} selected
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                      className="cursor-pointer rounded-lg"
                      style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
                    >
                      Add More
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFiles([]); }}
                      className="cursor-pointer rounded-lg"
                      style={{ padding: '5px 12px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', textDecoration: 'underline' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Uploading progress */}
          {uploading && uploadProgress && (
            <div className="rounded-xl text-center" style={{ border: '2px solid var(--border-strong)', padding: '32px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)' }}>
                Uploading {uploadProgress.current}/{uploadProgress.total}...
              </div>
              <div className="mt-3 mx-auto h-1.5 rounded-full overflow-hidden" style={{ width: '200px', background: 'var(--surface)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ background: 'var(--accent)', width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Results */}
          {uploadResults && (
            <div className="rounded-xl text-center" style={{ border: '2px solid var(--border-strong)', padding: '32px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: uploadResults.failed > 0 && uploadResults.success === 0 ? 'var(--rose)' : 'var(--accent)' }}>
                {uploadResults.failed === 0
                  ? `${uploadResults.success} ${uploadResults.success === 1 ? 'file' : 'files'} uploaded successfully`
                  : `${uploadResults.success} succeeded, ${uploadResults.failed} failed`
                }
              </div>
            </div>
          )}

          {/* Folder selector - shown when files are selected and not uploading */}
          {selectedFiles.length > 0 && !uploading && !uploadResults && folders.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Add to folder:</label>
              <select
                value={targetFolderId || ''}
                onChange={(e) => setTargetFolderId(e.target.value || null)}
                className="flex-1 rounded-lg"
                style={{
                  height: '28px', padding: '0 8px', fontSize: '11px',
                  background: 'var(--glass)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)', outline: 'none',
                }}
              >
                <option value="">None</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg" style={{ fontSize: '12px', color: 'var(--rose)', background: 'var(--rose-subtle)', padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={handleClose}
              className="cursor-pointer rounded-lg transition-colors"
              style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              {uploadResults ? 'Close' : 'Cancel'}
            </button>
            {selectedFiles.length > 0 && !uploading && !uploadResults && (
              <button
                onClick={startBatchUpload}
                className="cursor-pointer rounded-lg transition-colors"
                style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', fontWeight: 500 }}
              >
                Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
