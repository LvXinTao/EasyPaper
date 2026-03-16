'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (paperId: string) => void;
  initialFile?: File | null;
}

export function UploadModal({ isOpen, onClose, onUploadComplete, initialFile }: UploadModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  // Auto-upload if opened with an initial file (from drag onto paper list)
  useEffect(() => {
    if (initialFile && isOpen) {
      uploadFile(initialFile);
    }
  }, [initialFile, isOpen]);

  const uploadFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }
    setUploading(true);
    setError(null);
    setProgress('Uploading...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }
      const { id } = await response.json();
      setProgress('Upload complete!');
      onClose();
      if (onUploadComplete) {
        onUploadComplete(id);
      } else {
        router.push(`/paper/${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress('');
    }
  }, [router, onClose, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', animation: 'fadeIn 150ms ease-out' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl"
        style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', animation: 'fadeIn 150ms ease-out, scaleIn 150ms ease-out' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Upload Paper</h3>
            <button onClick={onClose} className="cursor-pointer" style={{ color: 'var(--text-tertiary)', fontSize: '18px' }}>×</button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>Upload a PDF to add it to your library</p>

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
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} className="hidden" />
            {uploading ? (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)' }}>{progress}</div>
                <div className="mt-3 mx-auto h-1 rounded-full overflow-hidden" style={{ width: '120px', background: 'var(--surface)' }}>
                  <div className="h-full rounded-full animate-pulse" style={{ background: 'var(--accent)', width: '100%' }} />
                </div>
              </div>
            ) : (
              <div>
                <div className="mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ width: '44px', height: '44px', background: 'var(--accent-subtle)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Drag & drop your PDF here</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>or click to browse · PDF only</div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-lg" style={{ fontSize: '12px', color: 'var(--rose)', background: 'var(--rose-subtle)', padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg transition-colors"
              style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
