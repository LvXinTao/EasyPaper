'use client';

import { useState, useEffect, useCallback } from 'react';
import { UploadZone } from '@/components/upload-zone';
import { PaperCard } from '@/components/paper-card';
import type { PaperListItem } from '@/types';

export default function HomePage() {
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch('/api/papers');
      const data = await res.json();
      setPapers(data.papers || []);
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this paper?')) return;

    await fetch(`/api/paper/${id}`, { method: 'DELETE' });
    setPapers((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          EasyPaper
        </h1>
        <p className="text-gray-500">
          Upload a PDF paper and let AI help you understand it.
        </p>
      </div>

      <UploadZone />

      {papers.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Your Papers
          </h2>
          <div className="grid gap-4">
            {papers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-8 text-center text-gray-400">Loading papers...</div>
      )}
    </div>
  );
}
