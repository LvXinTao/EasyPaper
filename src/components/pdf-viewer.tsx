'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import type { Bookmark, Note, NoteTag, TextSelection } from '@/types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { SelectionToolbar } from './selection-toolbar';
import { AnnotationBubble } from './annotation-bubble';
import { InlineNoteEditor } from './inline-note-editor';

// Configure pdf.js worker - use static file from public folder
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const THUMBNAIL_MAX_WIDTH = 80;
const THUMBNAIL_MAX_HEIGHT = 120;
const THUMBNAIL_CACHE_SIZE = 50;

export interface PdfViewerRef {
  scrollToNote: (note: Note) => void;
  scrollToQuote: (quote: TextSelection) => void;
}

interface PdfViewerProps {
  url: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  bookmarks?: Bookmark[];
  onAddBookmark?: (page: number, label?: string) => void;
  onRemoveBookmark?: (bookmarkId: string) => void;
  onBookmarksChange?: () => void;
  // Sentence-level notes props
  notes?: Note[];
  onNoteCreate?: (data: { title: string; content: string; tags: NoteTag[]; selection: TextSelection }) => Promise<void>;
  onNoteUpdate?: (note: Note) => Promise<void>;
  onNoteDelete?: (noteId: string) => Promise<void>;
}

export const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>(({
  url,
  currentPage = 1,
  onPageChange,
  bookmarks = [],
  onAddBookmark,
  onRemoveBookmark,
  onBookmarksChange,
  notes = [],
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
}, ref) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(currentPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevCurrentPageRef = useRef(currentPage);

  // Sentence-level notes state
  const pageElementRef = useRef<HTMLDivElement>(null);
  const [currentSelection, setCurrentSelection] = useState<TextSelection | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [editorPopup, setEditorPopup] = useState<{
    mode: 'create' | 'edit';
    note?: Note;
    position: { x: number; y: number };
    selection?: TextSelection;
  } | null>(null);
  const pageRenderPromiseRef = useRef<Promise<void> | null>(null);

  // Keep pageRef in sync for keyboard handlers
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Sync page with currentPage prop
  // This is a valid controlled/uncontrolled component pattern where we sync
  // external prop changes to internal state
  useEffect(() => {
    if (currentPage !== prevCurrentPageRef.current && currentPage > 0 && currentPage <= totalPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(currentPage);
      prevCurrentPageRef.current = currentPage;
    }
  }, [currentPage, totalPages]);

  const goToPage = useCallback((p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
      onPageChange?.(p);
    }
  }, [totalPages, onPageChange]);

  // Expose scrollToNote method via ref
  useImperativeHandle(ref, () => ({
    scrollToNote: async (note: Note) => {
      if (!note.selection || !scrollContainerRef.current) return;

      // Navigate to page if needed
      if (note.selection.page !== page) {
        // Create promise with timeout to prevent hanging indefinitely
        pageRenderPromiseRef.current = new Promise<void>((resolve) => {
          let cancelled = false;
          const timeoutId = setTimeout(() => {
            cancelled = true;
            resolve(); // Resolve anyway after timeout to proceed with scroll
          }, 5000); // 5 second max wait

          const checkRender = () => {
            if (cancelled) return;
            if (pageElementRef.current) {
              clearTimeout(timeoutId);
              requestAnimationFrame(() => resolve());
            } else {
              setTimeout(checkRender, 50);
            }
          };
          checkRender();
        });

        goToPage(note.selection.page);
        await pageRenderPromiseRef.current;
      }

      const topPercent = note.selection.rects[0]?.top || 0;
      const container = scrollContainerRef.current;
      const scrollY = (topPercent / 100) * container.scrollHeight;
      container.scrollTo({ top: scrollY - 50, behavior: 'smooth' });
    },
    scrollToQuote: async (quote: TextSelection) => {
      if (!scrollContainerRef.current) return;

      // Navigate to page if needed
      if (quote.page !== page) {
        pageRenderPromiseRef.current = new Promise<void>((resolve) => {
          let cancelled = false;
          const timeoutId = setTimeout(() => {
            cancelled = true;
            resolve();
          }, 5000);

          const checkRender = () => {
            if (cancelled) return;
            if (pageElementRef.current) {
              clearTimeout(timeoutId);
              requestAnimationFrame(() => resolve());
            } else {
              setTimeout(checkRender, 50);
            }
          };
          checkRender();
        });

        goToPage(quote.page);
        await pageRenderPromiseRef.current;
      }

      const topPercent = quote.rects[0]?.top || 0;
      const container = scrollContainerRef.current;
      const scrollY = (topPercent / 100) * container.scrollHeight;
      container.scrollTo({ top: scrollY - 50, behavior: 'smooth' });
    },
  }));

  // Selection capture for sentence-level notes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setCurrentSelection(null);
        setSelectionPosition(null);
        return;
      }

      // Check if selection is within the text layer
      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;

      const textLayer = anchorNode.parentElement?.closest('.textLayer');
      if (!textLayer) {
        setCurrentSelection(null);
        setSelectionPosition(null);
        return;
      }

      // Get the page container (parent of textLayer which contains canvas)
      const pageContainer = textLayer.parentElement;
      if (!pageContainer) {
        setCurrentSelection(null);
        setSelectionPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();
      if (!text) {
        setCurrentSelection(null);
        setSelectionPosition(null);
        return;
      }

      const pageRect = pageContainer.getBoundingClientRect();
      // Filter out rects with zero width or height (can happen with multi-line selections)
      const clientRects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);

      if (clientRects.length === 0) {
        setCurrentSelection(null);
        setSelectionPosition(null);
        return;
      }

      const rects = clientRects.map(rect => ({
        left: ((rect.left - pageRect.left) / pageRect.width) * 100,
        top: ((rect.top - pageRect.top) / pageRect.height) * 100,
        width: (rect.width / pageRect.width) * 100,
        height: (rect.height / pageRect.height) * 100,
      }));

      // Calculate toolbar position at bottom-right of selection
      // Find the bottommost rect (highest top + height value)
      const bottommostRect = rects.reduce((max, r) => {
        const maxBottom = max.top + max.height;
        const rBottom = r.top + r.height;
        return rBottom > maxBottom ? r : max;
      }, rects[0]);

      // Position at the right edge of the bottommost rect
      const toolbarX = pageRect.left + (bottommostRect.left + bottommostRect.width) / 100 * pageRect.width;
      const toolbarY = pageRect.top + bottommostRect.top / 100 * pageRect.height + bottommostRect.height / 100 * pageRect.height;

      setCurrentSelection({ text, rects, page });
      setSelectionPosition({ x: toolbarX, y: toolbarY });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [page]);

  // Clear selection on page change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentSelection(null);
     
    setSelectionPosition(null);
     
    setEditorPopup(null);
  }, [page]);

  // Close editor on click outside
  useEffect(() => {
    if (!editorPopup) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-note-editor]') && !target.closest('[data-selection-toolbar]')) {
        setEditorPopup(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [editorPopup]);

  // Handle note creation
  const handleNoteCreate = useCallback(async (data: { title: string; content: string; tags: NoteTag[]; selection?: TextSelection }) => {
    if (!onNoteCreate || !data.selection) return;
    await onNoteCreate({ title: data.title, content: data.content, tags: data.tags, selection: data.selection });
    window.getSelection()?.removeAllRanges();
    setCurrentSelection(null);
    setSelectionPosition(null);
  }, [onNoteCreate]);

  // Handle note update
  const handleNoteUpdate = useCallback(async (data: { title: string; content: string; tags: NoteTag[]; selection?: TextSelection }) => {
    if (!onNoteUpdate || !editorPopup?.note) return;
    const updatedNote: Note = {
      ...editorPopup.note,
      title: data.title,
      content: data.content,
      tags: data.tags,
      selection: data.selection,
      page: data.selection?.page ?? editorPopup.note.page,
      updatedAt: new Date().toISOString(),
    };
    await onNoteUpdate(updatedNote);
  }, [onNoteUpdate, editorPopup]);

  // Handle note delete
  const handleNoteDelete = useCallback(async () => {
    if (!onNoteDelete || !editorPopup?.note) return;
    await onNoteDelete(editorPopup.note.id);
  }, [onNoteDelete, editorPopup]);

  // Handle annotation bubble click
  const handleAnnotationClick = useCallback((note: Note) => {
    if (!note.selection) return;
    const rightmostRect = note.selection.rects.reduce((max, r) =>
      r.left + r.width > max.left + max.width ? r : max, note.selection!.rects[0]);

    if (!pageElementRef.current) return;
    const pageRect = pageElementRef.current.getBoundingClientRect();
    const bubbleX = pageRect.left + (rightmostRect.left + rightmostRect.width) / 100 * pageRect.width;
    const bubbleY = pageRect.top + rightmostRect.top / 100 * pageRect.height;

    setEditorPopup({
      mode: 'edit',
      note,
      position: { x: bubbleX, y: bubbleY },
      selection: note.selection,
    });
    setCurrentSelection(null);
    setSelectionPosition(null);
  }, []);

  // State for bubble positions (calculated via useEffect)
  const [bubblePositions, setBubblePositions] = useState<{ note: Note; x: number; y: number }[]>([]);

  // Get notes with selection on current page
  const notesWithSelectionOnPage = notes.filter(n => n.selection && n.selection.page === page);

  // Update bubble positions when page/scale/notes change
  useEffect(() => {
    const updateBubblePositions = () => {
      // Find the page container (react-pdf renders .react-pdf__Page inside our container)
      const pageContainer = pageElementRef.current?.querySelector('.react-pdf__Page') ||
                            pageElementRef.current?.querySelector('.textLayer')?.parentElement;

      if (!pageContainer) {
        setBubblePositions([]);
        return;
      }

      const pageRect = pageContainer.getBoundingClientRect();
      const positions: { note: Note; x: number; y: number }[] = [];

      notesWithSelectionOnPage.forEach((note, index) => {
        if (!note.selection) return;
        const rightmostRect = note.selection.rects.reduce((max, r) =>
          r.left + r.width > max.left + max.width ? r : max, note.selection.rects[0]);
        const x = pageRect.left + (rightmostRect.left + rightmostRect.width) / 100 * pageRect.width;
        const y = pageRect.top + rightmostRect.top / 100 * pageRect.height + (index * 24);
        positions.push({ note, x, y });
      });

      setBubblePositions(positions);
    };

    // Run after render with a small delay to ensure DOM is ready
    const timer = setTimeout(updateBubblePositions, 100);

    // Update on resize
    const resizeObserver = new ResizeObserver(updateBubblePositions);
    if (pageElementRef.current) {
      resizeObserver.observe(pageElementRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [notesWithSelectionOnPage, page, scale]);

  // Render persistent yellow highlights
  const renderPersistentHighlights = () => {
    return notesWithSelectionOnPage.map(note => {
      if (!note.selection) return null;
      return note.selection.rects.map((rect, i) => {
        const style = {
          left: `${rect.left}%`,
          top: `${rect.top}%`,
          width: `${rect.width}%`,
          height: `${rect.height}%`,
          position: 'absolute' as const,
          background: 'rgba(250, 204, 21, 0.35)',
          pointerEvents: 'none' as const,
          zIndex: 0,
        };
        return (
          <div
            key={`${note.id}-${i}`}
            style={style}
            data-highlight-id={note.id}
          />
        );
      });
    });
  };

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
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (!isDraggingBar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const pageNum = calcPageFromMouseX(e.clientX);
      goToPage(pageNum);
      const bar = progressBarRef.current;
      if (bar) {
        const rect = bar.getBoundingClientRect();
        setHoverX(e.clientX - rect.left);
        setHoveredPage(pageNum);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDraggingBar(false);
      document.body.style.userSelect = '';
      setHoveredPage(null);
      goToPage(calcPageFromMouseX(e.clientX));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDraggingBar, calcPageFromMouseX, goToPage]);

  const renderThumbnail = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return null;

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
      const pdfPage = await pdfDoc.getPage(pageNum);
      if (renderToken.cancel) return null;

      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const aspect = baseViewport.width / baseViewport.height;

      let thumbWidth: number;
      if (aspect >= THUMBNAIL_MAX_WIDTH / THUMBNAIL_MAX_HEIGHT) {
        thumbWidth = THUMBNAIL_MAX_WIDTH;
      } else {
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
  }, [pdfDoc]);

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

  // Bookmark handlers
  const currentPageBookmark = bookmarks.find((b) => b.page === page);

  const handleBookmarkClick = useCallback(() => {
    if (currentPageBookmark) {
      onBookmarksChange?.();
    } else {
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
  void handleContextMenuClose;

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
    const cache = thumbnailCacheRef.current;
    return () => {
      cache.clear();
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

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoad = useCallback((pdf: PDFDocumentProxy) => {
    setPdfDoc(pdf);
  }, []);

  return (
    <div ref={viewerRef} className="flex flex-col h-full" tabIndex={-1}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-deep)' }}>
          <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <span className="text-sm">Loading PDF...</span>
        </div>
      )}

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

      {/* Canvas + TextLayer via react-pdf */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4" style={{ background: 'var(--bg-deep)' }}
        onContextMenu={handleContextMenu}
      >
        <div className="text-center">
          <div className="inline-block shadow-xl rounded overflow-hidden relative" ref={pageElementRef}>
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoad={onDocumentLoad}
              loading={null}
            >
              <Page
                pageNumber={page}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
            {/* Persistent yellow highlights layer */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
              {renderPersistentHighlights()}
            </div>
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
              <div className="flex justify-center -mt-px">
                <div className="w-2.5 h-2.5 rotate-45 shadow-[2px_2px_4px_rgba(0,0,0,0.1)]" style={{ background: 'var(--surface)' }} />
              </div>
            </div>
          )}
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: totalPages > 1 ? `${((page - 1) / (totalPages - 1)) * 100}%` : '100%',
              background: 'var(--accent)',
            }}
          />
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

      {/* Selection Toolbar */}
      {currentSelection && selectionPosition && !editorPopup && (
        <div data-selection-toolbar>
          <SelectionToolbar
            position={selectionPosition}
            onNoteCreate={() => {
              setEditorPopup({
                mode: 'create',
                position: selectionPosition,
                selection: currentSelection,
              });
            }}
            onAskAI={() => {
              // TODO: Implement in Task 6 - Ask AI about selected text
              console.log('Ask AI about:', currentSelection);
            }}
          />
        </div>
      )}

      {/* Annotation Bubbles */}
      {bubblePositions.map(({ note, x, y }) => (
        <AnnotationBubble
          key={note.id}
          note={note}
          position={{ x, y }}
          onClick={() => handleAnnotationClick(note)}
        />
      ))}

      {/* Inline Note Editor */}
      {editorPopup && (
        <div data-note-editor>
          <InlineNoteEditor
            mode={editorPopup.mode}
            note={editorPopup.note}
            selection={editorPopup.selection}
            triggerPosition={editorPopup.position}
            onSave={editorPopup.mode === 'create' ? handleNoteCreate : handleNoteUpdate}
            onDelete={editorPopup.mode === 'edit' ? handleNoteDelete : undefined}
            onClose={() => setEditorPopup(null)}
          />
        </div>
      )}
    </div>
  );
});

PdfViewer.displayName = 'PdfViewer';