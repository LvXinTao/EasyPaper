'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { PdfViewer } from '@/components/pdf-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { usePaper } from '@/hooks/use-paper';
import { useSSE } from '@/hooks/use-sse';
import type { PaperAnalysis } from '@/types';
import { AnnotationsPanel } from '@/components/annotations-panel';
import type { Annotation, HighlightColor } from '@/types';

export default function PaperDetailPage() {
  const params = useParams();
  const paperId = params.id as string;
  const { data, loading, error, refetch } = usePaper(paperId);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightText, setHighlightText] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activePanel, setActivePanel] = useState<'analysis' | 'annotations'>('analysis');

  useEffect(() => {
    if (!paperId) return;
    fetch(`/api/papers/${paperId}/annotations`)
      .then((res) => res.json())
      .then((data) => setAnnotations(data.annotations || []))
      .catch(() => setAnnotations([]));
  }, [paperId]);

  const { start: startAnalysis } = useSSE('/api/analyze', {
    onMessage: (event) => {
      if ('step' in event) {
        setAnalysisStep(event.step as string);
        setAnalysisMessage((event.message as string) || null);
      }
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
    setAnalysisStep(null);
    setAnalysisMessage(null);
    startAnalysis({ paperId });
  }, [paperId, startAnalysis]);

  const handleReferenceClick = useCallback((ref: { page: number; text: string }) => {
    setCurrentPage(ref.page);
    setHighlightText(ref.text);
  }, []);

  const handleAnnotationCreate = useCallback(async (data: {
    page: number; text: string; color: HighlightColor; comment: string;
    spanRange: { startIdx: number; endIdx: number };
  }) => {
    if (!paperId) return;
    const res = await fetch(`/api/papers/${paperId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { annotation } = await res.json();
      setAnnotations((prev) => [...prev, annotation]);
    }
  }, [paperId]);

  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    if (!paperId) return;
    const res = await fetch(`/api/papers/${paperId}/annotations/${annotationId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    }
  }, [paperId]);

  const handleAnnotationClick = useCallback((annotation: Annotation) => {
    setCurrentPage(annotation.page);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-52px)] bg-slate-50">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-3" />
        <div className="text-slate-400 text-sm">Loading paper...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-52px)] bg-slate-50">
        <div className="text-center">
          <div className="text-rose-500 font-medium">{error || 'Paper not found'}</div>
          <a href="/" className="text-sm text-indigo-500 hover:underline mt-2 inline-block">Back to home</a>
        </div>
      </div>
    );
  }

  const displayAnalysis = data.analysis || analysis;
  const needsAnalysis = (data.metadata.status === 'pending' || data.metadata.status === 'error') && !isAnalyzing;

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Left: PDF Viewer (55%) */}
      <div className="w-[55%] border-r border-slate-200">
        <PdfViewer
          url={`/api/paper/${paperId}/pdf`}
          currentPage={currentPage}
          highlightText={highlightText}
          onPageChange={(p) => { setCurrentPage(p); setHighlightText(null); }}
          onHighlightClear={() => setHighlightText(null)}
          annotations={annotations}
          onAnnotationCreate={handleAnnotationCreate}
        />
      </div>

      {/* Right: Analysis/Annotations Panel (45%) */}
      <div className="w-[45%] flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <h1 className="text-base font-semibold text-slate-800 truncate mr-3">
            {data.metadata.title}
          </h1>
          {needsAnalysis && (
            <button
              onClick={handleAnalyze}
              className="flex-shrink-0 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
            >
              Analyze
            </button>
          )}
        </div>

        {/* Top-level panel selector */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActivePanel('analysis')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
              activePanel === 'analysis'
                ? 'text-indigo-600 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActivePanel('annotations')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
              activePanel === 'annotations'
                ? 'text-indigo-600 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Annotations ({annotations.length})
          </button>
        </div>

        {/* Analysis error banner */}
        {analysisError && (
          <div className="px-4 py-3 bg-rose-50 border-b border-rose-200 text-rose-700 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <strong>Analysis failed:</strong> {analysisError}
            </div>
          </div>
        )}

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          {activePanel === 'analysis' ? (
            <AnalysisPanel
              paperId={paperId}
              analysis={displayAnalysis}
              initialChatMessages={data.chatHistory?.messages || []}
              isAnalyzing={isAnalyzing}
              analysisStep={analysisStep}
              analysisMessage={analysisMessage}
              onReferenceClick={handleReferenceClick}
            />
          ) : (
            <AnnotationsPanel
              annotations={annotations}
              onAnnotationClick={handleAnnotationClick}
              onAnnotationDelete={handleAnnotationDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
