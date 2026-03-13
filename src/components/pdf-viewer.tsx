'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { applyParagraphHighlight } from '@/lib/pdf-highlight';
import { applyUserHighlights, getSelectionInfo } from '@/lib/pdf-annotations';
import { HighlightToolbar } from '@/components/highlight-toolbar';
import { CommentPopover } from '@/components/comment-popover';
import type { Annotation, HighlightColor } from '@/types';

interface PdfViewerProps {
  url: string;
  currentPage?: number;
  highlightText?: string | null;
  onPageChange?: (page: number) => void;
  onHighlightClear?: () => void;
  annotations?: Annotation[];
  onAnnotationCreate?: (annotation: { page: number; text: string; color: HighlightColor; comment: string; spanRange: { startIdx: number; endIdx: number } }) => void;
}

export function PdfViewer({ url, currentPage = 1, highlightText, onPageChange, onHighlightClear, annotations, onAnnotationCreate }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(currentPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const textLayerInstanceRef = useRef<{ cancel: () => void } | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<{ text: string; startIdx: number; endIdx: number } | null>(null);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');

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

      // Apply highlight unconditionally after TextLayer render completes.
      // No `cancelled` guard here — if a newer render has already cleared
      // textLayerDiv.innerHTML, applyHighlight finds no spans (safe no-op).
      if (highlightText) {
        const parentContainer = containerRef.current;
        if (parentContainer) {
          applyParagraphHighlight(parentContainer as HTMLDivElement, highlightText);
        }
      }

      // Apply user annotations
      const pageAnnotations = (annotations || []).filter((a) => a.page === page);
      if (pageAnnotations.length > 0) {
        applyUserHighlights(textLayerDiv, pageAnnotations);
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [pdf, page, scale, highlightText, annotations]);

  // Handle click on PDF canvas area to clear highlight
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'CANVAS') {
      // Clear paragraph highlight overlay
      const overlay = containerRef.current?.querySelector('.highlight-overlay');
      if (overlay) overlay.innerHTML = '';
      onHighlightClear?.();
    }
  }, [onHighlightClear]);

  const handleTextLayerMouseUp = useCallback(() => {
    if (!textLayerRef.current) return;
    setTimeout(() => {
      const info = getSelectionInfo(textLayerRef.current!);
      if (!info) {
        setToolbarPos(null);
        return;
      }
      setSelectionInfo({ text: info.text, startIdx: info.startIdx, endIdx: info.endIdx });
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      const top = info.rect.bottom - containerRect.top + 8;
      let left = (info.rect.left + info.rect.right) / 2 - containerRect.left;
      left = Math.max(80, Math.min(left, containerRect.width - 80));
      setToolbarPos({ top, left });
    }, 10);
  }, []);

  const handleColorSelect = useCallback((color: HighlightColor) => {
    if (!selectionInfo) return;
    onAnnotationCreate?.({
      page,
      text: selectionInfo.text,
      color,
      comment: '',
      spanRange: { startIdx: selectionInfo.startIdx, endIdx: selectionInfo.endIdx },
    });
    setToolbarPos(null);
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionInfo, page, onAnnotationCreate]);

  const handleCommentClick = useCallback(() => {
    if (!toolbarPos) return;
    setPopoverPos(toolbarPos);
    setToolbarPos(null);
  }, [toolbarPos]);

  const handleCommentSave = useCallback((comment: string) => {
    if (!selectionInfo) return;
    onAnnotationCreate?.({
      page,
      text: selectionInfo.text,
      color: selectedColor,
      comment,
      spanRange: { startIdx: selectionInfo.startIdx, endIdx: selectionInfo.endIdx },
    });
    setPopoverPos(null);
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionInfo, selectedColor, page, onAnnotationCreate]);

  const handleHighlightClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const annotationId = target.dataset?.annotationId;
    if (!annotationId) return;
    const annotation = annotations?.find((a) => a.id === annotationId);
    if (!annotation) return;
    e.stopPropagation();
    const containerRect = containerRef.current?.getBoundingClientRect();
    const spanRect = target.getBoundingClientRect();
    if (!containerRect) return;
    const top = spanRect.bottom - containerRect.top + 8;
    let left = (spanRect.left + spanRect.right) / 2 - containerRect.left;
    left = Math.max(80, Math.min(left, containerRect.width - 80));
    setSelectionInfo({
      text: annotation.text,
      startIdx: annotation.spanRange.startIdx,
      endIdx: annotation.spanRange.endIdx,
    });
    setSelectedColor(annotation.color);
    setToolbarPos({ top, left });
  }, [annotations]);

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
        .paragraph-highlight-box {
          border: 2.5px solid rgba(234, 179, 8, 0.9);
          border-radius: 4px;
          background: rgba(250, 204, 21, 0.15);
          box-shadow: 0 0 8px rgba(250, 204, 21, 0.3);
          pointer-events: none;
          transition: opacity 0.3s ease-in-out;
        }
        .user-highlight { border-radius: 2px; padding: 0 1px; cursor: pointer; }
        .user-highlight-yellow { background: rgba(250, 204, 21, 0.4); border-bottom: 2px solid rgba(234, 179, 8, 0.6); }
        .user-highlight-green { background: rgba(74, 222, 128, 0.4); border-bottom: 2px solid rgba(34, 197, 94, 0.6); }
        .user-highlight-blue { background: rgba(96, 165, 250, 0.4); border-bottom: 2px solid rgba(59, 130, 246, 0.6); }
        .user-highlight-pink { background: rgba(244, 114, 182, 0.4); border-bottom: 2px solid rgba(236, 72, 153, 0.6); }
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
            <div className="highlight-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />
            <div ref={textLayerRef} className="textLayer" style={{ zIndex: 2 }} onMouseUp={handleTextLayerMouseUp} onClick={handleHighlightClick} />
            {toolbarPos && (
              <HighlightToolbar
                position={toolbarPos}
                onColorSelect={handleColorSelect}
                onCommentClick={handleCommentClick}
                onClose={() => { setToolbarPos(null); setSelectionInfo(null); }}
              />
            )}
            {popoverPos && selectionInfo && (
              <CommentPopover
                position={popoverPos}
                selectedText={selectionInfo.text}
                onSave={handleCommentSave}
                onCancel={() => { setPopoverPos(null); setSelectionInfo(null); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
