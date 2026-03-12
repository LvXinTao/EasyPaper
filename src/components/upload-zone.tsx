'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function UploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const uploadFile = useCallback(
    async (file: File) => {
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

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Upload failed');
        }

        const { id } = await response.json();
        setProgress('Upload complete! Redirecting...');
        router.push(`/paper/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setUploading(false);
        setProgress('');
      }
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-14 text-center transition-all cursor-pointer group ${
        isDragging
          ? 'border-indigo-400 bg-indigo-50 scale-[1.01] shadow-lg'
          : 'border-slate-300 hover:border-indigo-300 hover:bg-white hover:shadow-md'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploading ? (
        <div>
          <div className="text-lg font-medium text-indigo-600">{progress}</div>
          <div className="mt-4 w-48 mx-auto h-1.5 bg-indigo-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full animate-pulse w-full" />
          </div>
        </div>
      ) : (
        <div>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div className="text-lg font-medium text-slate-700 mb-1">
            Drag & drop your PDF here
          </div>
          <div className="text-sm text-slate-400">or click to select a file</div>
        </div>
      )}

      {error && (
        <div className="mt-4 text-rose-500 text-sm font-medium">{error}</div>
      )}
    </div>
  );
}
