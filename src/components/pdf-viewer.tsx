'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PdfViewerProps {
  url: string;
  currentPage?: number;
  highlightText?: string | null;
  onPageChange?: (page: number) => void;
  onHighlightClear?: () => void;
}

export function PdfViewer({ url, currentPage = 1, highlightText, onPageChange, onHighlightClear }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(currentPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const textLayerInstanceRef = useRef<{ cancel: () => void } | null>(null);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const loadingTask = pdfjsLib.getDocument(url);
      const pdfDoc = await loadingTask.promise;
      if (!cancelled) {
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [url]);

  // Navigate to page when prop changes
  useEffect(() => {
    if (currentPage > 0 && currentPage <= totalPages) {
      setPage(currentPage);
    }
  }, [currentPage, totalPages]);

  // Render current page (canvas + text layer)
  useEffect(() => {
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;

    let cancelled = false;

    // Cancel previous text layer render
    if (textLayerInstanceRef.current) {
      textLayerInstanceRef.current.cancel();
      textLayerInstanceRef.current = null;
    }

    async function renderPage() {
      const pdfPage = await pdf!.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (cancelled) return;

      await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;

      if (cancelled) return;

      // Render text layer
      const textLayerDiv = textLayerRef.current!;
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;

      const textContent = await pdfPage.getTextContent();
      if (cancelled) return;

      const { TextLayer } = await import('pdfjs-dist');
      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });

      textLayerInstanceRef.current = textLayer;
      await textLayer.render();

      if (cancelled) return;

      // Apply highlight if needed
      if (highlightText) {
        applyHighlight(textLayerDiv, highlightText);
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [pdf, page, scale, highlightText]);

  // Apply highlight when highlightText changes (but page/scale don't)
  const applyHighlight = useCallback((container: HTMLDivElement, text: string) => {
    // Clear existing highlights
    container.querySelectorAll('.highlight-active').forEach((el) => {
      el.classList.remove('highlight-active');
    });

    if (!text) return;

    const normalizedSearch = text.trim().toLowerCase();
    if (!normalizedSearch) return;

    const spans = container.querySelectorAll('span');
    let found = false;

    // Try exact substring match first
    spans.forEach((span) => {
      const spanText = span.textContent?.toLowerCase() || '';
      if (spanText.includes(normalizedSearch) || normalizedSearch.includes(spanText)) {
        if (spanText.trim().length > 0 && (
          spanText.includes(normalizedSearch) ||
          (normalizedSearch.includes(spanText) && spanText.length > 3)
        )) {
          span.classList.add('highlight-active');
          found = true;
        }
      }
    });

    // Scroll the first highlighted element into view
    if (found) {
      const firstHighlight = container.querySelector('.highlight-active');
      firstHighlight?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Handle click on PDF canvas area to clear highlight
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Only clear if clicking the background, not text layer spans
    if ((e.target as HTMLElement).tagName === 'CANVAS') {
      onHighlightClear?.();
    }
  }, [onHighlightClear]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
      onPageChange?.(p);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-100">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-3" />
        <span className="text-sm">Loading PDF...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* TextLayer: official pdfjs CSS + highlight override */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/pdf_viewer.css" />
      <style>{`
        .textLayer .highlight-active {
          background-color: rgba(250, 204, 21, 0.85) !important;
          border-radius: 2px;
          box-shadow: 0 0 4px 1px rgba(250, 204, 21, 0.6);
          transition: background-color 0.3s ease;
        }
        .textLayer .highlight-active::after {
          content: '';
          position: absolute;
          inset: -2px;
          border: 2px solid rgba(234, 179, 8, 0.8);
          border-radius: 3px;
          pointer-events: none;
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-2.5 py-1 text-xs text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs text-slate-300 tabular-nums px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-2.5 py-1 text-xs text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="px-2.5 py-1 text-xs text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-slate-300 tabular-nums px-1 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="px-2.5 py-1 text-xs text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas + TextLayer */}
      <div className="flex-1 overflow-auto bg-slate-200 p-4" onClick={handleCanvasClick}>
        <div className="text-center">
          <div ref={containerRef} className="relative inline-block shadow-xl rounded overflow-hidden">
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            <div ref={textLayerRef} className="textLayer" />
          </div>
        </div>
      </div>
    </div>
  );
}
