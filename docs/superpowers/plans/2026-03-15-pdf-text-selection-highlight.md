# PDF Text Selection Custom Highlighting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native browser text selection highlight in the PDF viewer with custom-rendered highlight rectangles that precisely match selected text, eliminating visual overflow into empty areas.

**Architecture:** Keep browser native selection (preserving copy/paste) but hide its visual highlight via CSS. Listen to `selectionchange` events, extract precise rectangles via `Range.getClientRects()`, and render custom highlight divs positioned between the canvas and text layer.

**Tech Stack:** React 19, pdfjs-dist 5, TypeScript, CSS

**Spec:** `docs/superpowers/specs/2026-03-15-pdf-text-selection-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `public/pdf_viewer.css` | Modify lines 995-1003 | Hide native selection highlight |
| `src/components/pdf-viewer.tsx` | Modify | Add custom highlight state, selectionchange listener, highlight rendering |

No new files.

---

## Chunk 1: Implementation

### Task 0: Verify `getClientRects()` Produces Tighter Rects Than Spans

**Files:** None (manual browser verification only)

This task validates the core assumption before writing any code. The spec requires this verification first.

- [ ] **Step 1: Start dev server and open a multi-column PDF**

```bash
npm run dev
```

Open `http://localhost:3000`, upload a two-column academic paper, navigate to a page with two-column text.

- [ ] **Step 2: Verify in DevTools**

Select text in the left column that spans several lines. Open browser DevTools console and run:

```javascript
const sel = window.getSelection();
const range = sel.getRangeAt(0);
const clientRects = Array.from(range.getClientRects());
console.log('getClientRects widths:', clientRects.map(r => Math.round(r.width)));

// Compare with parent span widths
const spans = document.querySelectorAll('.textLayer span');
spans.forEach(s => {
  const sr = s.getBoundingClientRect();
  if (sr.width > 400) console.log('Wide span:', Math.round(sr.width), s.textContent?.substring(0, 30));
});
```

**Expected**: `getClientRects()` widths should be noticeably smaller than the oversized span widths (which extend across columns).

**If `getClientRects()` returns the same oversized widths**: STOP. The approach needs revision — a fallback using canvas-based text measurement would be required. Consult the spec's verification note.

- [ ] **Step 3: Confirm and proceed**

If verification passes, proceed to Task 1. No commit needed for this task.

---

### Task 1: Hide Native Selection Highlight in CSS

**Files:**
- Modify: `public/pdf_viewer.css:995-1003`

- [ ] **Step 1: Modify the `.textLayer ::-moz-selection` rule**

Open `public/pdf_viewer.css`. Find lines 995-998:

```css
.textLayer ::-moz-selection{
    background:rgba(0 0 255 / 0.25);
    background:color-mix(in srgb, AccentColor, transparent 75%);
  }
```

Replace with:

```css
.textLayer ::-moz-selection{
    background:transparent;
  }
```

- [ ] **Step 2: Modify the `.textLayer ::selection` rule**

Find lines 1000-1003:

```css
.textLayer ::selection{
    background:rgba(0 0 255 / 0.25);
    background:color-mix(in srgb, AccentColor, transparent 75%);
  }
```

Replace with:

```css
.textLayer ::selection{
    background:transparent;
  }
```

Note: `.textLayer br::selection` and `.textLayer br::-moz-selection` (lines 1005-1011) already have `background:transparent` — leave them unchanged.

- [ ] **Step 3: Commit**

```bash
git add public/pdf_viewer.css
git commit -m "feat: hide native text selection highlight in PDF text layer"
```

---

### Task 2: Add Custom Highlight State, Refs, and Selection Listener

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

This task adds the core logic: new state/refs, the `selectionchange` event listener that computes highlight rectangles, and cleanup on page/scale change.

- [ ] **Step 1: Add new state and refs**

In `src/components/pdf-viewer.tsx`, add the following after the existing ref/state declarations (after line 43 `pageRef.current = page;`):

```tsx
// Custom selection highlight
const [highlightRects, setHighlightRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);
const wrapperRef = useRef<HTMLDivElement>(null);
const rafIdRef = useRef<number>(0);
```

- [ ] **Step 2: Add `selectionchange` effect**

Add a new `useEffect` after the existing keyboard shortcuts effect (after line 370). This effect listens for selection changes, checks if the selection is within the text layer, extracts precise rectangles via `Range.getClientRects()`, and updates state.

```tsx
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
        const clientRects = range.getClientRects();
        for (let j = 0; j < clientRects.length; j++) {
          const r = clientRects[j];
          // Only include rects that have non-zero dimensions
          if (r.width > 0 && r.height > 0) {
            rects.push({
              left: r.left - wrapperRect.left,
              top: r.top - wrapperRect.top,
              width: r.width,
              height: r.height,
            });
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
```

- [ ] **Step 3: Clear highlights on page or scale change**

In the existing render-page effect (the `useEffect` that depends on `[pdf, page, scale]`), add a line to clear highlight rects right after the `if (!pdf || !canvasRef.current || !textLayerRef.current) return;` guard and before `let cancelled = false;`:

```tsx
// Clear custom selection highlights when page/scale changes
setHighlightRects([]);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors. (The state and refs are declared but not yet used in render — TypeScript may warn about unused vars depending on config, but should not error.)

- [ ] **Step 5: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add selectionchange listener and highlight rect computation"
```

---

### Task 3: Render Custom Highlight Divs and Wire Up Wrapper Ref

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

This task modifies the JSX render section to: (1) attach `wrapperRef` to the canvas+textLayer wrapper div, and (2) render the custom highlight rectangles between the canvas and text layer.

- [ ] **Step 1: Attach `wrapperRef` to the wrapper div**

Find the wrapper div at line 460-466:

```tsx
          <div
            className="relative inline-block shadow-xl rounded overflow-hidden"
            style={{
              opacity: canvasOpacity,
              transition: 'opacity 150ms ease-out',
            }}
          >
```

Add `ref={wrapperRef}` to it:

```tsx
          <div
            ref={wrapperRef}
            className="relative inline-block shadow-xl rounded overflow-hidden"
            style={{
              opacity: canvasOpacity,
              transition: 'opacity 150ms ease-out',
            }}
          >
```

- [ ] **Step 2: Add highlight container between canvas and text layer**

Find lines 467-468:

```tsx
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            <div ref={textLayerRef} className="textLayer" />
```

Insert the highlight container div between them:

```tsx
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
```

The highlight container has `position: absolute; inset: 0` (via `absolute inset-0`) and `pointer-events: none` so it covers the canvas area but doesn't intercept mouse events. It sits between the canvas and text layer in DOM order, so it renders above the canvas but below the text layer spans (which have `z-index: 1`).

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Verify build passes**

Run:
```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: render custom selection highlight divs in PDF viewer"
```

---

### Task 4: Manual Verification

This task verifies the feature works correctly in the browser.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test with a multi-column PDF**

1. Open `http://localhost:3000` in the browser
2. Upload or open a two-column academic paper PDF
3. Navigate to a page with two-column text layout

- [ ] **Step 3: Verify custom highlight precision**

1. Click and drag to select text in the left column
2. **Verify**: Blue highlight rectangles appear only over the selected text, NOT extending into the blank area between columns or the right column
3. **Verify**: The highlight color is semi-transparent blue (matching native selection look)

- [ ] **Step 4: Verify copy works**

1. Select some text in the PDF
2. Press `Cmd+C` (macOS) or `Ctrl+C`
3. Paste into a text editor
4. **Verify**: The copied text matches what was visually selected

- [ ] **Step 5: Verify page/scale change clears highlights**

1. Select some text so highlights are visible
2. Click the next-page button (or press ArrowRight)
3. **Verify**: Highlights disappear when the page changes
4. Go back, select text again, then click the zoom in/out button
5. **Verify**: Highlights disappear when the scale changes

- [ ] **Step 6: Verify edge cases**

1. Click on the PDF without dragging (no selection) — **Verify**: No highlight rectangles appear
2. Start selecting text from outside the PDF area and drag into it — **Verify**: No crash, highlights appear only for text layer content
3. Right-click on selected text — **Verify**: Browser context menu appears with "Copy" option
