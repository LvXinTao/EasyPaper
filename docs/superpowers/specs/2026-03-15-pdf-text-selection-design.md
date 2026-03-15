# PDF Text Selection Custom Highlighting

## Overview

Replace the browser's native text selection highlight in the PDF viewer with custom-rendered highlight rectangles that precisely match selected text, eliminating visual overflow into empty areas common in multi-column PDF layouts.

## Motivation

PDF.js renders a transparent text layer over the canvas. The `<span>` elements in this layer have widths derived from PDF internal text metrics, which frequently extend beyond the visible text — especially in two-column academic papers. When users select text, the browser's native highlight covers the full span width, producing blue highlight bars in blank areas where no text exists. This looks broken and confuses users.

## Design

### Approach: Native Selection + Custom Highlight Rendering

Keep the browser's native selection mechanism (preserving `user-select`, clipboard copy, and context menu) but hide the native blue highlight with CSS, then render precise custom highlight rectangles based on `Range.getClientRects()`.

`Range.getClientRects()` returns rectangles per inline box (line fragment) of the selected text, not the full containing span width. In PDF.js text layer, each span is absolutely positioned with a CSS-transformed width from PDF metrics, but the text node's inline box inside the span only extends as far as the actual glyphs. This means `getClientRects()` produces tighter rects than `::selection` highlighting, which covers the entire span element.

**Verification note:** Before full implementation, the first task should verify this behavior in the browser devtools by selecting text in a multi-column PDF and comparing `Range.getClientRects()` output against the parent span's `getBoundingClientRect()`. If `getClientRects()` produces the same oversized rects as the span, a fallback approach using canvas-based text measurement would be needed. However, based on how inline box layout works in CSS, `getClientRects()` should return glyph-tight rects.

### 1. Hide Native Selection Highlight

Override the `.textLayer ::selection` rule in `pdf_viewer.css`:

```css
.textLayer ::selection {
  background: transparent;
}
.textLayer ::-moz-selection {
  background: transparent;
}
```

Note: `.textLayer br::selection` and `.textLayer br::-moz-selection` already have `background: transparent` in the existing CSS and need no changes.

### 2. Listen to Selection Changes

Add a `selectionchange` event listener on `document` inside the pdf-viewer component.

On each event:
1. Get `window.getSelection()`
2. Check if the selection's anchor or focus node is within the text layer div
3. If not in text layer, clear any existing custom highlights
4. If in text layer, extract highlight rectangles

Note: Most browsers support only a single range per selection (Firefox is the exception with multiple ranges). The implementation iterates `selection.rangeCount` to handle both cases.

### 3. Extract Precise Highlight Rectangles

For each `Range` in the selection:
1. Call `range.getClientRects()` to get a `DOMRectList`
2. Get the canvas+textLayer wrapper's bounding rect via `getBoundingClientRect()`
3. Convert each client rect to wrapper-relative coordinates: `rect.left - wrapper.left`, `rect.top - wrapper.top`
4. Store the list of `{ left, top, width, height }` objects in component state

Both `getClientRects()` and `getBoundingClientRect()` return viewport-relative coordinates, so subtraction produces correct wrapper-relative positions regardless of scroll state.

### 4. Render Custom Highlight Divs

Insert a highlight container `<div>` as a child of the canvas+textLayer wrapper div (the `<div className="relative inline-block shadow-xl rounded overflow-hidden">` at line 460 of pdf-viewer.tsx). Place it in the DOM between the `<canvas>` and the text layer div. Since PDF.js text layer spans have `z-index: 1`, the highlight container uses `position: absolute` with no explicit z-index (defaults to 0), which places it above the canvas but below the text spans — allowing text selection to pass through.

For each rectangle in state, render an absolutely-positioned `<div>` with:
- `background: rgba(0, 0, 255, 0.25)` — semi-transparent blue matching native selection color
- `border-radius: 2px` — subtle rounding
- `pointer-events: none` — so highlights don't interfere with text selection
- Exact `left`, `top`, `width`, `height` from the calculated rectangles

### 5. Copy Support

No implementation needed. Browser native `Ctrl+C` / `Cmd+C` and right-click copy continue to work because the text layer's `user-select` is not disabled — only the visual `::selection` background is made transparent.

### 6. Accessibility

This change is accessibility-neutral. Screen readers rely on the DOM selection state (not the visual highlight), which remains untouched. The custom highlight divs are purely visual and have no semantic role.

## Changes to Existing Files

### `public/pdf_viewer.css`

Modify the existing `.textLayer ::selection` and `.textLayer ::-moz-selection` rules to set `background: transparent`.

### `src/components/pdf-viewer.tsx`

**New state:**
- `highlightRects: Array<{ left: number; top: number; width: number; height: number }>` — rectangles to render

**New refs:**
- `wrapperRef: RefObject<HTMLDivElement>` — reference to the `<div className="relative inline-block shadow-xl rounded overflow-hidden">` wrapper that contains both the canvas and text layer, used for coordinate conversion
- `rafIdRef: RefObject<number>` — stores the `requestAnimationFrame` ID for cleanup

**New effect: `selectionchange` listener**
- Adds `document.addEventListener('selectionchange', handler)`
- Handler uses `requestAnimationFrame` to throttle updates (store rAF ID in `rafIdRef`)
- Handler checks if selection intersects the text layer, computes rects, updates state
- Cleanup: calls `cancelAnimationFrame(rafIdRef.current)` and removes event listener on unmount

**Render changes:**
- Add `ref={wrapperRef}` to the canvas+textLayer wrapper div
- Add a highlight container div (absolutely positioned, `pointer-events: none`) inside the wrapper, between the canvas and text layer div in DOM order
- Map `highlightRects` to absolutely-positioned div elements

**Page/scale change cleanup:**
- Clear `highlightRects` when `page` or `scale` changes (selection becomes invalid)

## New Files

None. The viewer renders a single page at a time, so cross-page selection is not possible and no cross-page logic is needed.

## Edge Cases

- **Page change during active selection**: Clear highlights. The selection will naturally collapse when the text layer re-renders.
- **Scale change during active selection**: Clear highlights. Same rationale.
- **Selection starts outside text layer**: Ignore — only render highlights when selection involves text layer nodes.
- **Selection spans across text layer boundary** (e.g., user drags into toolbar): Only render rects that fall within the text layer container bounds.
- **Empty selection** (click without drag): `getClientRects()` returns empty list. Highlights clear naturally.
- **Performance**: `selectionchange` fires frequently during drag. Use `requestAnimationFrame` to batch updates to one per frame. Cancel pending rAF on cleanup.
- **Right-to-left text**: `getClientRects()` handles this natively — rects are always left-to-right in screen coordinates regardless of text direction.
- **Browser zoom**: `getClientRects()` returns viewport-relative coordinates that account for browser zoom, so highlights remain aligned with text.
