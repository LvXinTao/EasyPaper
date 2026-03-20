'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Bookmark } from '@/types';

const THUMBNAIL_MAX_WIDTH = 80;
const THUMBNAIL_MAX_HEIGHT = 120;
const THUMBNAIL_CACHE_SIZE = 50;

interface PdfViewerProps {
  url: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  bookmarks?: Bookmark[];
  onAddBookmark?: (page: number, label?: string) => void;
  onRemoveBookmark?: (bookmarkId: string) => void;
  onBookmarksChange?: () => void;
}

export function PdfViewer({
  url,
  currentPage = 1,
  onPageChange,
  bookmarks = [],
  onAddBookmark,
  onRemoveBookmark,
  onBookmarksChange,
}: PdfViewerProps) {
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showBookmarkPopover, setShowBookmarkPopover] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; page: number } | null>(null);
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
  const pageRef = useRef(page);
  pageRef.current = page;

  // Custom selection highlight
  const [highlightRects, setHighlightRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    // Clear custom selection highlights when page/scale changes
    setHighlightRects([]);

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

      await pdfPage.render({ canvasContext: context, viewport }).promise;

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

      await pdfPage.render({ canvasContext: ctx, viewport }).promise;

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
        // Imperative DOM: this container is managed outside React for canvas element insertion
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

  // Bookmark handlers
  const currentPageBookmark = bookmarks.find((b) => b.page === page);

  const handleBookmarkClick = useCallback(() => {
    if (currentPageBookmark) {
      // If bookmark exists, highlight/navigate to it - callback will be handled by parent
      onBookmarksChange?.();
    } else {
      // Open popover to add bookmark
      setBookmarkLabel('');
      setShowBookmarkPopover(true);
    }
  }, [currentPageBookmark, onBookmarksChange]);

  const handleAddBookmark = useCallback(() => {
    onAddBookmark?.(page, bookmarkLabel || undefined);
    setShowBookmarkPopover(false);
    setBookmarkLabel('');
  }, [page, bookmarkLabel, onAddBookmark]);

  const handleCancelBookmark = useCallback(() => {
    setShowBookmarkPopover(false);
    setBookmarkLabel('');
  }, []);

  // Handle keyboard in bookmark popover
  const handleBookmarkKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddBookmark();
    } else if (e.key === 'Escape') {
      handleCancelBookmark();
    }
  }, [handleAddBookmark, handleCancelBookmark]);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, page });
  }, [page]);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuAddBookmark = useCallback(() => {
    if (contextMenu) {
      setShowBookmarkPopover(true);
      setBookmarkLabel('');
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleContextMenuEditBookmark = useCallback(() => {
    onBookmarksChange?.();
    setContextMenu(null);
  }, [onBookmarksChange]);

  const handleContextMenuRemoveBookmark = useCallback(() => {
    if (currentPageBookmark && currentPageBookmark.id) {
      onRemoveBookmark?.(currentPageBookmark.id);
    }
    setContextMenu(null);
  }, [currentPageBookmark, onRemoveBookmark]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      thumbnailCacheRef.current.clear();
      thumbnailCacheOrder.current = [];
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
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
          e.preventDefault();
          goToPage(pageRef.current - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToPage(pageRef.current + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          scrollContainerRef.current?.scrollBy({ top: -100, behavior: 'smooth' });
          break;
        case 'ArrowDown':
          e.preventDefault();
          scrollContainerRef.current?.scrollBy({ top: 100, behavior: 'smooth' });
          break;
        case 'PageUp':
          e.preventDefault();
          goToPage(pageRef.current - 1);
          break;
        case 'PageDown':
          e.preventDefault();
          goToPage(pageRef.current + 1);
          break;
        case 'Home':
          e.preventDefault();
          goToPage(1);
          break;
        case 'End':
          e.preventDefault();
          goToPage(totalPages);
          break;
        case '+':
        case '=':
          e.preventDefault();
          setScale((s) => Math.min(3, s + 0.2));
          break;
        case '-':
        case '_':
          e.preventDefault();
          setScale((s) => Math.max(0.5, s - 0.2));
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [totalPages, goToPage]);

  // Custom selection highlight: listen to selectionchange
  useEffect(() => {
    const handleSelectionChange = () => {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          setHighlightRects([]);
          return;
        }

        const textLayerEl = textLayerRef.current;
        const wrapperEl = wrapperRef.current;
        if (!textLayerEl || !wrapperEl) {
          setHighlightRects([]);
          return;
        }

        // Check if selection is within text layer
        const anchorInTextLayer = selection.anchorNode && textLayerEl.contains(selection.anchorNode);
        const focusInTextLayer = selection.focusNode && textLayerEl.contains(selection.focusNode);
        if (!anchorInTextLayer && !focusInTextLayer) {
          setHighlightRects([]);
          return;
        }

        const wrapperRect = wrapperEl.getBoundingClientRect();
        const rects: Array<{ left: number; top: number; width: number; height: number }> = [];

        for (let i = 0; i < selection.rangeCount; i++) {
          const range = selection.getRangeAt(i);

          // Walk text nodes in the selection to extract highlight rects.
          // Uses canvas pixel scanning to find actual text boundaries,
          // bypassing font mismatch between text layer and PDF canvas.
          const walker = document.createTreeWalker(
            textLayerEl,
            NodeFilter.SHOW_TEXT,
            { acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
          );

          while (walker.nextNode()) {
            const textNode = walker.currentNode;
            const spanEl = textNode.parentElement as HTMLElement | null;
            if (!spanEl || spanEl === textLayerEl) continue;

            const fullText = textNode.textContent || '';
            const startOff = textNode === range.startContainer ? range.startOffset : 0;
            let endOff = textNode === range.endContainer ? range.endOffset : fullText.length;

            // Trim trailing whitespace
            while (endOff > startOff && /\s/.test(fullText[endOff - 1])) {
              endOff--;
            }
            if (endOff <= startOff) continue;

            const nodeRange = document.createRange();
            nodeRange.setStart(textNode, startOff);
            nodeRange.setEnd(textNode, endOff);

            const nodeRects = nodeRange.getClientRects();
            const canvas = canvasRef.current;
            const canvasCtx = canvas?.getContext('2d');

            for (let j = 0; j < nodeRects.length; j++) {
              const r = nodeRects[j];
              if (r.width <= 0 || r.height <= 0) continue;

              const left = r.left - wrapperRect.left;
              let width = r.width;

              // Scan canvas pixels to find the actual right edge of visible text.
              // The text layer uses browser-substituted fonts while the canvas uses
              // PDF-embedded fonts, causing per-character width mismatches. Pixel
              // scanning gives us the ground truth of where text actually ends.
              if (canvasCtx && canvas) {
                const scanWidth = Math.min(60, Math.ceil(r.width * 0.15));
                const scanHeight = Math.max(3, Math.min(7, Math.floor(r.height * 0.4)));
                const startX = Math.max(0, Math.floor(left + width - scanWidth));
                const startY = Math.max(0, Math.floor(r.top - wrapperRect.top + (r.height - scanHeight) / 2));

                try {
                  const imageData = canvasCtx.getImageData(startX, startY, scanWidth, scanHeight);
                  const pixels = imageData.data;

                  // Find rightmost non-background column
                  let rightmostCol = -1;
                  for (let col = scanWidth - 1; col >= 0; col--) {
                    let found = false;
                    for (let row = 0; row < scanHeight; row++) {
                      const idx = (row * scanWidth + col) * 4;
                      if (pixels[idx] < 220 || pixels[idx + 1] < 220 || pixels[idx + 2] < 220) {
                        found = true;
                        break;
                      }
                    }
                    if (found) {
                      rightmostCol = col;
                      break;
                    }
                  }

                  if (rightmostCol >= 0) {
                    // +2px padding for anti-aliased edges
                    const adjustedRight = startX + rightmostCol + 2;
                    width = Math.max(r.width * 0.8, adjustedRight - left);
                  }
                } catch {
                  // Fallback to getClientRects width (e.g. cross-origin canvas)
                }
              }

              rects.push({ left, top: r.top - wrapperRect.top, width, height: r.height });
            }
          }
        }

        setHighlightRects(rects);
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-deep)' }}>
        <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <span className="text-sm">Loading PDF...</span>
      </div>
    );
  }

  return (
    <div ref={viewerRef} className="flex flex-col h-full" tabIndex={-1}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/pdf_viewer.css" />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-2.5 py-1 text-xs rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            style={{ color: 'var(--text-tertiary)', background: 'var(--surface-hover)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs tabular-nums px-2" style={{ color: 'var(--text-secondary)' }}>
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
                className="w-10 text-xs text-center rounded px-1 py-0.5 outline-none"
                style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
                aria-label="Go to page"
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <span
                onClick={() => { setEditValue(String(page)); setIsEditing(true); }}
                className="cursor-pointer hover:underline underline-offset-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                {page}
              </span>
            )}
            {' / '}{totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-2.5 py-1 text-xs rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            style={{ color: 'var(--text-tertiary)', background: 'var(--surface-hover)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="px-2.5 py-1 text-xs rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)', background: 'var(--surface-hover)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs tabular-nums px-1 min-w-[3rem] text-center" style={{ color: 'var(--text-tertiary)' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="px-2.5 py-1 text-xs rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)', background: 'var(--surface-hover)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Bookmark button */}
          <button
            onClick={handleBookmarkClick}
            className="px-2 py-1 text-xs rounded-md transition-colors"
            style={{
              color: currentPageBookmark ? 'var(--amber)' : 'var(--text-tertiary)',
              background: currentPageBookmark ? 'var(--amber-subtle)' : 'var(--surface-hover)',
              border: currentPageBookmark ? '1px solid var(--amber)' : '1px solid transparent',
            }}
            title={currentPageBookmark ? 'Bookmarked' : 'Add bookmark'}
          >
            <svg className="w-3.5 h-3.5" fill={currentPageBookmark ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          {/* Bookmark popover */}
          {showBookmarkPopover && (
            <div
              className="absolute right-0 top-full mt-1 rounded-lg z-20"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '12px', minWidth: '220px' }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Add Bookmark for Page {page}
              </div>
              <input
                type="text"
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                onKeyDown={handleBookmarkKeyDown}
                placeholder="Label (optional)"
                className="w-full text-xs rounded px-2 py-1.5 outline-none mb-2"
                style={{ background: 'var(--surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelBookmark}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--text-tertiary)', background: 'var(--surface-hover)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBookmark}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--bg)', background: 'var(--accent)' }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="px-2 py-1 text-xs rounded-md transition-colors"
            style={{ color: showShortcuts ? 'var(--text-primary)' : 'var(--text-tertiary)', background: showShortcuts ? 'var(--surface-hover)' : 'transparent' }}
            onMouseEnter={(e) => { if (!showShortcuts) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { if (!showShortcuts) e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            title="Keyboard shortcuts"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
            </svg>
          </button>
          {showShortcuts && (
            <div
              className="absolute right-0 top-full mt-1 rounded-lg z-20"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '10px 14px', minWidth: '200px' }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Keyboard Shortcuts</div>
              {[
                ['Arrow Left / Right', 'Prev / Next page'],
                ['PageUp / PageDown', 'Prev / Next page'],
                ['Arrow Up / Down', 'Scroll content'],
                ['+ / -', 'Zoom in / out'],
                ['Home / End', 'First / Last page'],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between gap-4" style={{ fontSize: '10px', padding: '3px 0' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{key}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Canvas + TextLayer */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4" style={{ background: 'var(--bg-deep)' }}
        onContextMenu={handleContextMenu}
      >
        <div className="text-center">
          <div
            ref={wrapperRef}
            className="relative inline-block shadow-xl rounded overflow-hidden"
            style={{
              opacity: canvasOpacity,
              transition: 'opacity 150ms ease-out',
            }}
          >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            {/* Custom selection highlight overlay */}
            {highlightRects.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {highlightRects.map((rect, i) => (
                  <div
                    key={i}
                    className="absolute rounded-sm"
                    style={{
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                      background: 'rgba(0, 0, 255, 0.25)',
                    }}
                  />
                ))}
              </div>
            )}
            <div ref={textLayerRef} className="textLayer" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div
          ref={progressBarRef}
          className="relative h-1.5 rounded-full cursor-pointer"
          style={{ background: 'var(--surface-hover)' }}
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
              <div className="rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.2)] p-1.5 text-center" style={{ background: 'var(--surface)' }}>
                <div
                  ref={thumbnailCanvasRef}
                  className="rounded overflow-hidden flex items-center justify-center"
                  style={{ minWidth: 60, minHeight: 80, background: 'var(--bg-deep)' }}
                >
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Page {hoveredPage}</span>
                </div>
                <div className="text-[10px] font-semibold mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Page {hoveredPage}
                </div>
              </div>
              {/* Arrow */}
              <div className="flex justify-center -mt-px">
                <div className="w-2.5 h-2.5 rotate-45 shadow-[2px_2px_4px_rgba(0,0,0,0.1)]" style={{ background: 'var(--surface)' }} />
              </div>
            </div>
          )}
          {/* Filled track */}
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: totalPages > 1 ? `${((page - 1) / (totalPages - 1)) * 100}%` : '100%',
              background: 'var(--accent)',
            }}
          />
          {/* Drag indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 rounded-full shadow cursor-grab active:cursor-grabbing"
            style={{
              left: totalPages > 1 ? `${((page - 1) / (totalPages - 1)) * 100}%` : '100%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--accent)',
              borderColor: 'var(--surface)',
            }}
            onMouseDown={handleBarDragStart}
          />
          {/* Bookmark markers on progress bar */}
          {bookmarks.map((bookmark) => {
            const position = totalPages > 1 ? ((bookmark.page - 1) / (totalPages - 1)) * 100 : 0;
            return (
              <div
                key={bookmark.id}
                className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
                style={{
                  left: `${position}%`,
                  width: '3px',
                  height: '12px',
                  background: 'var(--amber)',
                  borderRadius: '2px',
                  zIndex: 5,
                }}
                title={`P${bookmark.page}${bookmark.label ? `: ${bookmark.label}` : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goToPage(bookmark.page);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Context Menu for Bookmarks */}
      {contextMenu && (
        <div
          className="fixed rounded-lg z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: '160px',
            padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {currentPageBookmark ? (
            <>
              <button
                onClick={handleContextMenuEditBookmark}
                className="w-full text-left cursor-pointer"
                style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Edit Bookmark
              </button>
              <button
                onClick={handleContextMenuRemoveBookmark}
                className="w-full text-left cursor-pointer"
                style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--rose)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Remove Bookmark
              </button>
            </>
          ) : (
            <button
              onClick={handleContextMenuAddBookmark}
              className="w-full text-left cursor-pointer"
              style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Add Bookmark
            </button>
          )}
        </div>
      )}
    </div>
  );
}
