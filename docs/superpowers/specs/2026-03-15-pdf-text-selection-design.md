# PDF Text Selection Custom Highlighting

## Overview

Replace the browser's native text selection highlight in the PDF viewer with custom-rendered highlight rectangles that precisely match selected text, eliminating visual overflow into empty areas common in multi-column PDF layouts.

## Motivation

PDF.js renders a transparent text layer over the canvas. The `<span>` elements in this layer have widths derived from PDF internal text metrics, which frequently extend beyond the visible text — especially in two-column academic papers. When users select text, the browser's native highlight covers the full span width, producing blue highlight bars in blank areas where no text exists. This looks broken and confuses users.

## Design

### Approach: Native Selection + Custom Highlight Rendering

Keep the browser's native selection mechanism (preserving `user-select`, clipboard copy, and context menu) but hide the native blue highlight with CSS, then render precise custom highlight rectangles based on `Range.getClientRects()`.

`Range.getClientRects()` returns rectangles that cover only the actual glyph area of selected text, not the full span width. This is the key insight: it produces tight-fitting rects that do not overflow into blank areas.

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

### 2. Listen to Selection Changes

Add a `selectionchange` event listener on `document` inside the pdf-viewer component.

On each event:
1. Get `window.getSelection()`
2. Check if the selection's anchor or focus node is within the text layer div
3. If not in text layer, clear any existing custom highlights
4. If in text layer, extract highlight rectangles

### 3. Extract Precise Highlight Rectangles

For each `Range` in the selection:
1. Call `range.getClientRects()` to get a `DOMRectList`
2. Get the text layer container's bounding rect via `getBoundingClientRect()`
3. Convert each client rect to container-relative coordinates: `rect.left - container.left`, `rect.top - container.top`
4. Store the list of `{ left, top, width, height }` objects in component state

### 4. Render Custom Highlight Divs

Insert a highlight container `<div>` as a child of the canvas+textLayer wrapper, positioned between the canvas and the text layer (z-index between canvas and text spans).

For each rectangle in state, render an absolutely-positioned `<div>` with:
- `background: rgba(0, 0, 255, 0.25)` — semi-transparent blue matching native selection color
- `border-radius: 2px` — subtle rounding
- `pointer-events: none` — so highlights don't interfere with text selection
- Exact `left`, `top`, `width`, `height` from the calculated rectangles

### 5. Copy Support

No implementation needed. Browser native `Ctrl+C` / `Cmd+C` and right-click copy continue to work because the text layer's `user-select` is not disabled — only the visual `::selection` background is made transparent.

## Changes to Existing Files

### `public/pdf_viewer.css`

Modify the existing `.textLayer ::selection` and `.textLayer ::-moz-selection` rules to set `background: transparent`.

### `src/components/pdf-viewer.tsx`

**New state:**
- `highlightRects: Array<{ left: number; top: number; width: number; height: number }>` — rectangles to render

**New ref:**
- `wrapperRef: RefObject<HTMLDivElement>` — reference to the canvas+textLayer wrapper div for coordinate conversion

**New effect: `selectionchange` listener**
- Adds `document.addEventListener('selectionchange', handler)`
- Handler uses `requestAnimationFrame` to throttle updates
- Handler checks if selection intersects the text layer, computes rects, updates state
- Cleans up on unmount

**Render changes:**
- Add a highlight container div (absolutely positioned, `pointer-events: none`, z-index between canvas and text layer) inside the existing canvas wrapper
- Map `highlightRects` to absolutely-positioned div elements

**Page/scale change cleanup:**
- Clear `highlightRects` when `page` or `scale` changes (selection becomes invalid)

## New Files

None.

## Edge Cases

- **Page change during active selection**: Clear highlights. The selection will naturally collapse when the text layer re-renders.
- **Scale change during active selection**: Clear highlights. Same rationale.
- **Selection starts outside text layer**: Ignore — only render highlights when selection involves text layer nodes.
- **Selection spans across text layer boundary** (e.g., user drags into toolbar): Only render rects that fall within the text layer container bounds.
- **Empty selection** (click without drag): `getClientRects()` returns empty list. Highlights clear naturally.
- **Performance**: `selectionchange` fires frequently during drag. Use `requestAnimationFrame` to batch updates to one per frame.
- **Right-to-left text**: `getClientRects()` handles this natively — rects are always left-to-right in screen coordinates regardless of text direction.
