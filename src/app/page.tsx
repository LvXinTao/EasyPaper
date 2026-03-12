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
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-slate-800 mb-3 tracking-tight">
          Welcome to EasyPaper
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Upload a PDF paper and let AI help you understand it &mdash; get summaries, key contributions, and ask questions.
        </p>
      </div>

      <UploadZone />

      {papers.length > 0 && (
        <div className="mt-14">
          <h2 className="text-xl font-bold text-slate-700 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
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

      {!loading && papers.length === 0 && (
        <div className="mt-14 text-center text-slate-400">
          <p>No papers yet. Upload your first PDF above to get started.</p>
        </div>
      )}

      {loading && (
        <div className="mt-10 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
          <div className="text-slate-400 text-sm">Loading papers...</div>
        </div>
      )}
    </div>
  );
}
