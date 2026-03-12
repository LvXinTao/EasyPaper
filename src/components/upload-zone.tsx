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
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
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
          <div className="text-lg text-gray-600">{progress}</div>
          <div className="mt-4 w-48 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
          </div>
        </div>
      ) : (
        <div>
          <div className="text-4xl mb-4">&#128196;</div>
          <div className="text-lg text-gray-600 mb-2">
            Drag & drop your PDF here
          </div>
          <div className="text-sm text-gray-400">or click to select a file</div>
        </div>
      )}

      {error && (
        <div className="mt-4 text-red-500 text-sm">{error}</div>
      )}
    </div>
  );
}
