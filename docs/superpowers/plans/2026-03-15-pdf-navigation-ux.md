# PDF Navigation UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the PDF viewer's page navigation with keyboard shortcuts, page number jump, transition animations, and a progress bar with hover thumbnail preview.

**Architecture:** All changes are within `src/components/pdf-viewer.tsx`. The component grows from a simple viewer to an interactive reader with four new capabilities, each added incrementally. No new files or dependencies needed — uses existing `pdfjs-dist` APIs.

**Tech Stack:** React 19, TypeScript 5, pdfjs-dist 5, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-15-pdf-navigation-ux-design.md`

**Note:** Line references are based on the original file before any tasks are applied. After each task, line numbers shift accordingly.

---

## Chunk 1: Core Navigation Enhancements

### Task 1: Keyboard Shortcuts

**Files:**
- Modify: `src/components/pdf-viewer.tsx:12-181`

**Context:** The component currently has a `goToPage` callback (line 101-106) that handles page navigation with bounds checking. The viewer container is a `div` with `className="flex flex-col h-full"` (line 118). We need to add a `keydown` listener that calls `goToPage` for arrow keys, PageUp/PageDown, Home, and End.

- [ ] **Step 1: Add keyboard event handler**

Add a `useEffect` after the existing `goToPage` callback (after line 106) that listens for keyboard events on the document:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add keyboard shortcuts to PDF viewer"
```

---

### Task 2: Page Number Jump Input

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

**Context:** The toolbar currently shows a static `<span>` with `{page} / {totalPages}` (line 134-136). We need to replace this with a clickable page number that transforms into an input field for direct page navigation.

- [ ] **Step 1: Add editing state**

Add two new state variables after the existing state and ref declarations (after line 20):

```typescript
const [isEditing, setIsEditing] = useState(false);
const [editValue, setEditValue] = useState('');
```

- [ ] **Step 2: Add submit and cancel handlers**

Add after the `goToPage` callback:

```typescript
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
```

- [ ] **Step 3: Replace static page number span with interactive element**

Replace the existing page number span (lines 134-136):

```tsx
{/* Old: */}
<span className="text-xs text-slate-300 tabular-nums px-2">
  {page} / {totalPages}
</span>
```

With:

```tsx
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
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add page number jump input to PDF viewer toolbar"
```

---

### Task 3: Page Transition Animation

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

**Context:** The current render effect (lines 52-99) directly renders to canvas with no transition. We need to add a fade-out-then-in animation (150ms out + 150ms in). The canvas container is at line 173. We'll use an opacity state and CSS transition, with a generation counter to handle rapid navigation.

- [ ] **Step 1: Add animation state and refs**

Add after the existing state declarations:

```typescript
const [canvasOpacity, setCanvasOpacity] = useState(1);
const animationGenRef = useRef(0);
const skipAnimationRef = useRef(false);
```

- [ ] **Step 2: Modify the render effect to include fade animation**

Replace the existing render effect (lines 52-99) with a version that fades:

```typescript
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
```

- [ ] **Step 3: Add transition style to canvas container**

Replace the canvas container div (line 173):

```tsx
{/* Old: */}
<div className="relative inline-block shadow-xl rounded overflow-hidden">
```

With:

```tsx
<div
  className="relative inline-block shadow-xl rounded overflow-hidden"
  style={{
    opacity: canvasOpacity,
    transition: 'opacity 150ms ease-out',
  }}
>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add page transition fade animation to PDF viewer"
```

---

## Chunk 2: Progress Bar with Thumbnail Preview

### Task 4: Progress Bar (no thumbnails yet)

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

**Context:** The progress bar goes below the canvas scroll area (after line 178, before the closing `</div>` of the outer container). It needs its own state for drag handling. The `goToPage` function handles bounds checking. The `skipAnimationRef` from Task 3 is used to disable animation during drag.

- [ ] **Step 1: Add drag state**

Add after existing state:

```typescript
const [isDraggingBar, setIsDraggingBar] = useState(false);
const progressBarRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Add progress bar click handler**

```typescript
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
```

- [ ] **Step 3: Add drag handlers**

```typescript
const handleBarDragStart = useCallback((e: React.MouseEvent) => {
  e.preventDefault();
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
    // Final page with animation on drag end
    goToPage(calcPageFromMouseX(e.clientX));
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    // Safety reset in case mouseup was missed (e.g., mouse left window)
    skipAnimationRef.current = false;
    document.body.style.userSelect = '';
  };
}, [isDraggingBar, calcPageFromMouseX, goToPage]);
```

- [ ] **Step 4: Add progress bar JSX**

Insert after the canvas scroll area div (after the `</div>` that closes `className="flex-1 overflow-auto bg-slate-200 p-4"`), before the outer container's closing `</div>`:

```tsx
{/* Progress Bar */}
<div className="bg-slate-100 border-t border-slate-300 px-4 py-2">
  <div
    ref={progressBarRef}
    className="relative h-1.5 bg-slate-200 rounded-full cursor-pointer"
    onClick={handleProgressBarClick}
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
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add progress bar with drag navigation to PDF viewer"
```

---

### Task 5: Hover Thumbnail Preview

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

**Context:** This is the most complex addition. When hovering over the progress bar, render a small thumbnail of the page at that position using pdfjs `PDFPageProxy.render()` at scale 0.3. Thumbnails are cached in a Map (max 50, LRU eviction). Render requests are throttled to 100ms. The thumbnail appears in a popover card above the hover point.

- [ ] **Step 1: Add thumbnail state and refs**

```typescript
const [hoveredPage, setHoveredPage] = useState<number | null>(null);
const [hoverX, setHoverX] = useState(0);
const thumbnailCacheRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
const thumbnailCacheOrder = useRef<number[]>([]); // LRU order tracking
const thumbnailCanvasRef = useRef<HTMLDivElement>(null);
const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const pendingRenderRef = useRef<{ cancel: boolean } | null>(null);
const lastRenderedPageRef = useRef<number>(0);
const pendingHoverPageRef = useRef<number>(0);
```

- [ ] **Step 2: Add thumbnail render function**

```typescript
const THUMBNAIL_MAX_WIDTH = 80;
const THUMBNAIL_MAX_HEIGHT = 120;
const THUMBNAIL_CACHE_SIZE = 50;

const renderThumbnail = useCallback(async (pageNum: number) => {
  if (!pdf) return null;

  // Check cache
  const cached = thumbnailCacheRef.current.get(pageNum);
  if (cached) {
    // Move to end of LRU order
    const order = thumbnailCacheOrder.current;
    const idx = order.indexOf(pageNum);
    if (idx !== -1) order.splice(idx, 1);
    order.push(pageNum);
    return cached;
  }

  // Cancel any pending render
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
      // Default: constrain by width (80px) — covers most portrait and standard pages
      thumbWidth = THUMBNAIL_MAX_WIDTH;
      thumbHeight = THUMBNAIL_MAX_WIDTH / aspect;
    } else {
      // Extreme landscape: constrain by height (120px) to prevent oversized popover
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

    // LRU cache eviction
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
```

- [ ] **Step 3: Add hover handler with throttle**

```typescript
const applyThumbnail = useCallback((pageNum: number) => {
  renderThumbnail(pageNum).then((canvas) => {
    lastRenderedPageRef.current = pageNum;
    if (canvas && thumbnailCanvasRef.current) {
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

  // Clear stale thumbnail when page changes
  if (pageNum !== lastRenderedPageRef.current && thumbnailCanvasRef.current) {
    thumbnailCanvasRef.current.innerHTML = '';
  }

  // Throttled thumbnail render — ensures latest page always gets rendered
  if (throttleTimerRef.current) return;

  // Render immediately for the first call in this throttle window
  lastRenderedPageRef.current = pageNum;
  applyThumbnail(pageNum);

  throttleTimerRef.current = setTimeout(() => {
    throttleTimerRef.current = null;
    // After throttle expires, render latest page if it changed
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
```

- [ ] **Step 4: Add hover handlers to progress bar and render thumbnail popover**

Update the progress bar container div to add hover handlers:

```tsx
<div
  ref={progressBarRef}
  className="relative h-1.5 bg-slate-200 rounded-full cursor-pointer"
  onClick={handleProgressBarClick}
  onMouseMove={handleProgressBarHover}
  onMouseLeave={handleProgressBarLeave}
  role="slider"
  aria-valuemin={1}
  aria-valuemax={totalPages}
  aria-valuenow={page}
  aria-label="Page navigation"
  tabIndex={0}
>
```

Add the thumbnail popover inside the progress bar container div, before the filled track:

```tsx
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
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Verify build succeeds**

Run: `npm run build`
Expected: Build completes successfully

- [ ] **Step 7: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add hover thumbnail preview to PDF progress bar"
```

---

## Chunk 3: Verification

### Task 6: Final Verification

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build completes successfully

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All 35 existing tests pass (no regressions)
