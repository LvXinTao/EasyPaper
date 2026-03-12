'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PdfViewer } from '@/components/pdf-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { usePaper } from '@/hooks/use-paper';
import { useSSE } from '@/hooks/use-sse';
import type { PaperAnalysis } from '@/types';

export default function PaperDetailPage() {
  const params = useParams();
  const paperId = params.id as string;
  const { data, loading, error, refetch } = usePaper(paperId);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const { start: startAnalysis } = useSSE('/api/analyze', {
    onMessage: (event) => {
      if ('section' in event) {
        setAnalysis((prev) => {
          if (!prev) {
            return {
              summary: { content: '', references: [] },
              contributions: { items: [], references: [] },
              methodology: { content: '', references: [] },
              conclusions: { content: '', references: [] },
              generatedAt: new Date().toISOString(),
            };
          }
          return prev;
        });
      }
    },
    onDone: () => {
      setIsAnalyzing(false);
      refetch();
    },
    onError: (err) => {
      setIsAnalyzing(false);
      setAnalysisError(err.message);
      refetch();
    },
  });

  const handleAnalyze = useCallback(() => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    startAnalysis({ paperId });
  }, [paperId, startAnalysis]);

  const handleReferenceClick = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="text-gray-400">Loading paper...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="text-red-500">{error || 'Paper not found'}</div>
      </div>
    );
  }

  const displayAnalysis = data.analysis || analysis;
  const needsAnalysis = (data.metadata.status === 'pending' || data.metadata.status === 'error') && !isAnalyzing;

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Left: PDF Viewer (55%) */}
      <div className="w-[55%] border-r">
        <PdfViewer
          url={`/api/paper/${paperId}/pdf`}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Right: Analysis Panel (45%) */}
      <div className="w-[45%] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <h1 className="text-lg font-semibold text-gray-800 truncate">
            {data.metadata.title}
          </h1>
          {needsAnalysis && (
            <button
              onClick={handleAnalyze}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              Analyze
            </button>
          )}
        </div>

        {/* Analysis error banner */}
        {analysisError && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
            <strong>Analysis failed:</strong> {analysisError}
          </div>
        )}

        {/* Analysis */}
        <div className="flex-1 overflow-hidden">
          <AnalysisPanel
            paperId={paperId}
            analysis={displayAnalysis}
            initialChatMessages={data.chatHistory?.messages || []}
            isAnalyzing={isAnalyzing}
            onReferenceClick={handleReferenceClick}
          />
        </div>
      </div>
    </div>
  );
}
