'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Folder } from '@/types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (paperId: string) => void;
  initialFiles?: File[] | null;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const CONCURRENT_UPLOADS = 3; // Number of parallel uploads

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

interface FailedFile {
  name: string;
  reason: string;
}

export function UploadModal({ isOpen, onClose, onUploadComplete, initialFiles }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use ref to avoid stale closure in setTimeout
  const onUploadCompleteRef = useRef(onUploadComplete);
  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
  }, [onUploadComplete]);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; failedFiles: FailedFile[] } | null>(null);

  // Filter initial files at render time
  const filteredInitialFiles = useMemo(() => {
    if (initialFiles && initialFiles.length > 0 && isOpen) {
      return filterPdfFiles(initialFiles);
    }
    return null;
  }, [initialFiles, isOpen]);

  // Fetch folders when modal opens
  useEffect(() => {
    if (isOpen) {
      fetch('/api/folders').then(res => res.json()).then(data => setFolders(data.folders || [])).catch(() => {});
    }
  }, [isOpen]);

  // Merge filtered initial files with selected files
  useEffect(() => {
    if (filteredInitialFiles && filteredInitialFiles.length > 0) {
      setSelectedFiles(prev => {
        // Avoid duplicates by checking file name and size
        const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
        const newFiles = filteredInitialFiles.filter(f => !existingKeys.has(`${f.name}-${f.size}`));
        return [...prev, ...newFiles];
      });
    }
  }, [filteredInitialFiles]);

  const handleClose = useCallback(() => {
    // Cancel any ongoing upload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
      const firstEntry = e.dataTransfer.items[0].webkitGetAsEntry?.();
      if (firstEntry) {
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
    setUploadResults(null);

    const total = selectedFiles.length;
    const uploadedIds: string[] = [];
    const failedFiles: FailedFile[] = [];
    let completed = 0;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setUploadProgress({ current: 0, total });

    // Upload with controlled concurrency
    const uploadFile = async (file: File): Promise<{ id?: string; error?: string }> => {
      // Check if cancelled
      if (signal.aborted) {
        return { error: 'Cancelled' };
      }

      // Client-side size check
      if (file.size > MAX_FILE_SIZE) {
        return { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 50MB limit)` };
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          signal
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return { error: errorData.error?.message || `HTTP ${response.status}` };
        }

        const { id } = await response.json();

        // Assign to folder if selected
        if (targetFolderId && id) {
          await fetch(`/api/paper/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: targetFolderId }),
            signal
          }).catch(() => {}); // Ignore folder assignment errors
        }

        return { id };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { error: 'Cancelled' };
        }
        return { error: err instanceof Error ? err.message : 'Upload failed' };
      }
    };

    // Process files with concurrency control
    const queue = [...selectedFiles];

    const processNext = async () => {
      while (queue.length > 0 && !signal.aborted) {
        const file = queue.shift();
        if (!file) break;

        const result = await uploadFile(file);
        completed++;
        setUploadProgress({ current: completed, total });

        if (result.id) {
          uploadedIds.push(result.id);
        } else if (result.error) {
          failedFiles.push({ name: file.name, reason: result.error });
          console.warn(`[Upload] Failed: ${file.name} - ${result.error}`);
        }
      }
    };

    // Start concurrent uploads
    const workers = Array(Math.min(CONCURRENT_UPLOADS, total))
      .fill(null)
      .map(() => processNext());

    await Promise.all(workers);

    setUploadProgress(null);
    setUploadResults({
      success: uploadedIds.length,
      failed: failedFiles.length,
      failedFiles
    });
    setUploading(false);
    abortControllerRef.current = null;

    if (uploadedIds.length > 0) {
      const lastId = uploadedIds[uploadedIds.length - 1];
      // Dispatch custom event for any listeners (e.g., page.tsx)
      window.dispatchEvent(new CustomEvent('paperUploaded', { detail: { paperId: lastId } }));
      setTimeout(() => {
        if (onUploadCompleteRef.current && lastId) {
          onUploadCompleteRef.current(lastId);
        }
        handleClose();
      }, 2000);
    }
  }, [selectedFiles, targetFolderId, handleClose]);

  const handleCancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    handleClose();
  }, [handleClose]);

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
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple onChange={handleFileSelect} className="hidden" />
              <input ref={folderInputRef} type="file" {...{ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>} onChange={handleFolderSelect} className="hidden" />

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
              {uploadResults.failedFiles.length > 0 && (
                <div className="mt-2 text-left" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>Failed files:</div>
                  {uploadResults.failedFiles.slice(0, 5).map((f, i) => (
                    <div key={i} style={{ color: 'var(--rose-subtle)' }}>• {f.name}: {f.reason}</div>
                  ))}
                  {uploadResults.failedFiles.length > 5 && (
                    <div style={{ color: 'var(--text-tertiary)' }}>...and {uploadResults.failedFiles.length - 5} more</div>
                  )}
                </div>
              )}
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
              onClick={uploading ? handleCancelUpload : handleClose}
              className="cursor-pointer rounded-lg transition-colors"
              style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              {uploading ? 'Cancel' : (uploadResults ? 'Close' : 'Cancel')}
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