'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const THUMBNAIL_MAX_WIDTH = 80;
const THUMBNAIL_MAX_HEIGHT = 120;
const THUMBNAIL_CACHE_SIZE = 50;

interface PdfViewerProps {
  url: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function PdfViewer({ url, currentPage = 1, onPageChange }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(currentPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const textLayerInstanceRef = useRef<{ cancel: () => void } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const animationGenRef = useRef(0);
  const skipAnimationRef = useRef(false);
  const [isDraggingBar, setIsDraggingBar] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [hoveredPage, setHoveredPage] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const thumbnailCacheRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const thumbnailCacheOrder = useRef<number[]>([]);
  const thumbnailCanvasRef = useRef<HTMLDivElement>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRenderRef = useRef<{ cancel: boolean } | null>(null);
  const lastRenderedPageRef = useRef<number>(0);
  const pendingHoverPageRef = useRef<number>(0);

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

  // Render current page (canvas + text layer) with fade transition
  useEffect(() => {
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;

    let cancelled = false;
    const gen = ++animationGenRef.current;

    // Cancel previous text layer render
    if (textLayerInstanceRef.current) {
      textLayerInstanceRef.current.cancel();
      textLayerInstanceRef.current = null;
    }

    async function renderPage() {
      // Fade out (skip if animation disabled, e.g. during drag)
      if (!skipAnimationRef.current) {
        setCanvasOpacity(0);
        await new Promise((r) => setTimeout(r, 150));
        if (cancelled || gen !== animationGenRef.current) return;
      }

      const pdfPage = await pdf!.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (cancelled || gen !== animationGenRef.current) return;

      await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;

      if (cancelled || gen !== animationGenRef.current) return;

      // Render text layer
      const textLayerDiv = textLayerRef.current!;
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;

      const textContent = await pdfPage.getTextContent();
      if (cancelled || gen !== animationGenRef.current) return;

      const { TextLayer } = await import('pdfjs-dist');
      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });

      textLayerInstanceRef.current = textLayer;
      await textLayer.render();

      if (cancelled || gen !== animationGenRef.current) return;

      // Fade in
      setCanvasOpacity(1);
    }

    renderPage();
    return () => { cancelled = true; };
  }, [pdf, page, scale]);

  const goToPage = useCallback((p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
      onPageChange?.(p);
    }
  }, [totalPages, onPageChange]);

  const handlePageInputSubmit = useCallback(() => {
    const parsed = parseInt(editValue, 10);
    if (!isNaN(parsed)) {
      goToPage(Math.max(1, Math.min(parsed, totalPages)));
    }
    setIsEditing(false);
  }, [editValue, totalPages, goToPage]);

  const handlePageInputCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const calcPageFromMouseX = useCallback((clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar || totalPages === 0) return 1;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.max(1, Math.min(totalPages, Math.ceil(ratio * totalPages)));
  }, [totalPages]);

  const handleProgressBarClick = useCallback((e: React.MouseEvent) => {
    goToPage(calcPageFromMouseX(e.clientX));
  }, [calcPageFromMouseX, goToPage]);

  const handleBarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBar(true);
    skipAnimationRef.current = true;
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (!isDraggingBar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const pageNum = calcPageFromMouseX(e.clientX);
      goToPage(pageNum);

      // Update hover state so thumbnail follows during drag
      const bar = progressBarRef.current;
      if (bar) {
        const rect = bar.getBoundingClientRect();
        setHoverX(e.clientX - rect.left);
        setHoveredPage(pageNum);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDraggingBar(false);
      skipAnimationRef.current = false;
      document.body.style.userSelect = '';
      setHoveredPage(null);
      goToPage(calcPageFromMouseX(e.clientX));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      skipAnimationRef.current = false;
      document.body.style.userSelect = '';
    };
  }, [isDraggingBar, calcPageFromMouseX, goToPage]);

  const renderThumbnail = useCallback(async (pageNum: number) => {
    if (!pdf) return null;

    const cached = thumbnailCacheRef.current.get(pageNum);
    if (cached) {
      const order = thumbnailCacheOrder.current;
      const idx = order.indexOf(pageNum);
      if (idx !== -1) order.splice(idx, 1);
      order.push(pageNum);
      return cached;
    }

    if (pendingRenderRef.current) {
      pendingRenderRef.current.cancel = true;
    }
    const renderToken = { cancel: false };
    pendingRenderRef.current = renderToken;

    try {
      const pdfPage = await pdf.getPage(pageNum);
      if (renderToken.cancel) return null;

      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const aspect = baseViewport.width / baseViewport.height;

      let thumbWidth: number;
      let thumbHeight: number;
      if (aspect >= THUMBNAIL_MAX_WIDTH / THUMBNAIL_MAX_HEIGHT) {
        thumbWidth = THUMBNAIL_MAX_WIDTH;
        thumbHeight = THUMBNAIL_MAX_WIDTH / aspect;
      } else {
        thumbHeight = THUMBNAIL_MAX_HEIGHT;
        thumbWidth = THUMBNAIL_MAX_HEIGHT * aspect;
      }

      const thumbScale = thumbWidth / baseViewport.width;
      const viewport = pdfPage.getViewport({ scale: thumbScale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      if (renderToken.cancel) return null;

      await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;

      if (renderToken.cancel) return null;

      const order = thumbnailCacheOrder.current;
      if (order.length >= THUMBNAIL_CACHE_SIZE) {
        const evict = order.shift()!;
        thumbnailCacheRef.current.delete(evict);
      }
      thumbnailCacheRef.current.set(pageNum, canvas);
      order.push(pageNum);

      return canvas;
    } catch {
      return null;
    }
  }, [pdf]);

  const applyThumbnail = useCallback((pageNum: number) => {
    renderThumbnail(pageNum).then((canvas) => {
      if (canvas && thumbnailCanvasRef.current && pendingHoverPageRef.current === pageNum) {
        lastRenderedPageRef.current = pageNum;
        thumbnailCanvasRef.current.innerHTML = '';
        thumbnailCanvasRef.current.appendChild(canvas);
      }
    });
  }, [renderThumbnail]);

  const handleProgressBarHover = useCallback((e: React.MouseEvent) => {
    const pageNum = calcPageFromMouseX(e.clientX);
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    setHoverX(e.clientX - rect.left);
    setHoveredPage(pageNum);
    pendingHoverPageRef.current = pageNum;

    if (pageNum !== lastRenderedPageRef.current && thumbnailCanvasRef.current) {
      thumbnailCanvasRef.current.innerHTML = '';
    }

    if (throttleTimerRef.current) return;

    lastRenderedPageRef.current = pageNum;
    applyThumbnail(pageNum);

    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
      if (pendingHoverPageRef.current !== lastRenderedPageRef.current) {
        applyThumbnail(pendingHoverPageRef.current);
      }
    }, 100);
  }, [calcPageFromMouseX, applyThumbnail]);

  const handleProgressBarLeave = useCallback(() => {
    setHoveredPage(null);
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if an input/textarea is focused (covers page-number input from Task 2)
      // Also skip if progress bar slider is focused (Task 4) — it has its own key handler
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
          target.getAttribute('role') === 'slider') {
        return;
      }

      if (!viewerRef.current?.contains(target) &&
          document.activeElement !== document.body) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          goToPage(page - 1);
          break;
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          goToPage(page + 1);
          break;
        case 'Home':
          e.preventDefault();
          goToPage(1);
          break;
        case 'End':
          e.preventDefault();
          goToPage(totalPages);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [page, totalPages, goToPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-100">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-3" />
        <span className="text-sm">Loading PDF...</span>
      </div>
    );
  }

  return (
    <div ref={viewerRef} className="flex flex-col h-full" tabIndex={-1}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/pdf_viewer.css" />

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
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePageInputSubmit();
                  if (e.key === 'Escape') handlePageInputCancel();
                }}
                onBlur={handlePageInputSubmit}
                className="w-10 bg-slate-600 text-slate-100 text-xs text-center rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400"
                aria-label="Go to page"
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <span
                onClick={() => { setEditValue(String(page)); setIsEditing(true); }}
                className="cursor-pointer hover:text-indigo-300 hover:underline underline-offset-2"
              >
                {page}
              </span>
            )}
            {' / '}{totalPages}
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
      <div className="flex-1 overflow-auto bg-slate-200 p-4">
        <div className="text-center">
          <div
            className="relative inline-block shadow-xl rounded overflow-hidden"
            style={{
              opacity: canvasOpacity,
              transition: 'opacity 150ms ease-out',
            }}
          >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            <div ref={textLayerRef} className="textLayer" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-slate-100 border-t border-slate-300 px-4 py-2">
        <div
          ref={progressBarRef}
          className="relative h-1.5 bg-slate-200 rounded-full cursor-pointer"
          onClick={handleProgressBarClick}
          onMouseMove={handleProgressBarHover}
          onMouseLeave={handleProgressBarLeave}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goToPage(page - 1); }
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goToPage(page + 1); }
            if (e.key === 'Home') { e.preventDefault(); goToPage(1); }
            if (e.key === 'End') { e.preventDefault(); goToPage(totalPages); }
          }}
          role="slider"
          aria-valuemin={1}
          aria-valuemax={totalPages}
          aria-valuenow={page}
          aria-label="Page navigation"
          tabIndex={0}
        >
          {/* Thumbnail preview popover */}
          {hoveredPage !== null && (
            <div
              className="absolute bottom-6 pointer-events-none z-10"
              style={{
                left: hoverX,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="bg-white rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.2)] p-1.5 text-center">
                <div
                  ref={thumbnailCanvasRef}
                  className="rounded overflow-hidden bg-slate-100 flex items-center justify-center"
                  style={{ minWidth: 60, minHeight: 80 }}
                >
                  <span className="text-[10px] text-slate-400">Page {hoveredPage}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-semibold mt-1">
                  Page {hoveredPage}
                </div>
              </div>
              {/* Arrow */}
              <div className="flex justify-center -mt-px">
                <div className="w-2.5 h-2.5 bg-white rotate-45 shadow-[2px_2px_4px_rgba(0,0,0,0.1)]" />
              </div>
            </div>
          )}
          {/* Filled track */}
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: totalPages > 1 ? `${((page - 1) / (totalPages - 1)) * 100}%` : '100%',
              background: 'linear-gradient(90deg, #6366f1, #818cf8)',
            }}
          />
          {/* Drag indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full shadow cursor-grab active:cursor-grabbing"
            style={{
              left: totalPages > 1 ? `${((page - 1) / (totalPages - 1)) * 100}%` : '100%',
              transform: 'translate(-50%, -50%)',
            }}
            onMouseDown={handleBarDragStart}
          />
        </div>
      </div>
    </div>
  );
}
