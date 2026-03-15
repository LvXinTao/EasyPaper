# PDF Page Navigation UX Improvements

## Overview

Enhance the PDF viewer's page navigation experience while keeping the single-page rendering mode. Add four improvements: a progress bar with hover thumbnail preview, keyboard shortcuts, page number jump input, and page transition animations.

## Motivation

The current PDF viewer only supports navigation via `<`/`>` toolbar buttons. There are no keyboard shortcuts, no way to jump to a specific page, no visual progress indicator, and page changes are instant with no transition — all of which make the reading experience feel rigid and basic.

## Design

### 1. Progress Bar with Hover Thumbnail

A thin progress bar at the bottom of the PDF viewing area, showing the reader's position in the document.

**Visual spec:**
- Height: 6px (idle), within a container with 8px vertical padding
- Background: `slate-200` track, `indigo-500` → `indigo-400` linear gradient fill
- Border-radius: 3px
- Current position indicator: 14px circle, `indigo-500` fill, 2px white border, subtle shadow
- Container background: `slate-100` with `slate-300` top border
- The indicator is draggable for scrubbing through pages

**Hover thumbnail preview:**
- Appears when mouse hovers over the progress bar
- Positioned above the hover point, centered horizontally
- White card with 8px border-radius, `0 8px 24px rgba(0,0,0,0.2)` shadow
- Thumbnail width: fixed at 80px, height proportional to page aspect ratio. Max height: 120px (for landscape pages, scale down width to maintain ratio within this constraint)
- Page number label below the thumbnail
- Small downward-pointing arrow/triangle connecting to the progress bar
- Disappears when mouse leaves the progress bar

**Click/drag behavior:**
- Clicking anywhere on the progress bar jumps to that page
- Dragging the circle indicator scrubs through pages
- During drag, the thumbnail preview follows the cursor position
- Page calculation: `Math.ceil((mouseX / barWidth) * totalPages)`, clamped to `[1, totalPages]`

**Thumbnail rendering:**
- Use `pdfjs` `PDFPageProxy.render()` at a small scale (e.g., 0.3) to generate thumbnails
- Cache rendered thumbnails to avoid re-rendering on every hover
- Render thumbnails lazily (on first hover near that page position)
- Throttle thumbnail render requests to at most one every 100ms. If the hovered page changes before a render completes, cancel the in-progress render and start the new one.
- Cache up to 50 thumbnails (LRU eviction). For most documents this covers all pages; for large documents it keeps memory bounded.

### 2. Keyboard Shortcuts

Global keyboard event listener on the PDF viewer container.

| Key | Action |
|-----|--------|
| `ArrowLeft` | Previous page |
| `ArrowRight` | Next page |
| `PageUp` | Previous page |
| `PageDown` | Next page |
| `Home` | First page |
| `End` | Last page |

**Constraints:**
- Only active when the PDF viewer area has focus (or no input element is focused)
- Disabled when the page number input is active (to allow typing)
- When the progress bar slider is focused, arrow keys are handled by the slider's own handler. The global keyboard shortcut handler should check `event.target` and yield to the slider when it has focus, to avoid double-firing.
- Respects page bounds (no-op at first/last page)

### 3. Page Number Jump

Transform the static page indicator (`5 / 12`) in the toolbar into an interactive element.

**Display mode (default):**
- Shows `{page} / {totalPages}` as currently
- The page number portion has a subtle hover style (underline or background highlight) to hint it's clickable
- Cursor: pointer on the page number

**Edit mode (on click):**
- The page number becomes a text input
- Input width: ~40px, styled to match toolbar aesthetic (dark background, light text)
- Auto-selects the current page number text
- Auto-focuses the input

**Actions:**
- `Enter`: Parse input, clamp to `[1, totalPages]`, navigate, exit edit mode
- `Escape`: Cancel edit, restore display mode
- `blur`: Submit the entered value (same as Enter). This avoids accidental cancellation when user clicks elsewhere after typing.
- Non-numeric input: Ignore or show brief visual feedback

### 4. Page Transition Animation

Smooth visual transition when switching pages.

**Animation spec:**
- Type: Fade-out-then-in (single canvas — not a true crossfade since there is only one canvas element)
- Duration: 150ms out + 150ms in = 300ms total
- Easing: ease-out
- On page change: canvas opacity transitions from 1 → 0 (150ms), new page renders while invisible, then opacity transitions from 0 → 1 (150ms)

**Rapid navigation handling:**
- If a new page change is triggered while animating, cancel the current animation and jump directly to the new page
- This prevents animation queue buildup when holding arrow keys or scrubbing the progress bar
- During progress bar drag, disable transition animation entirely. Apply animation only on drag end (mouseup) for the final page.

**Implementation approach:**
- Use a CSS transition on the canvas container's opacity
- Before rendering new page: set opacity to 0
- After render completes: set opacity to 1
- Track an animation generation counter to detect stale transitions

## Changes to Existing Files

### `src/components/pdf-viewer.tsx`

This is the only file that needs modification. All four features are internal to the PDF viewer component.

**New state:**
- `isEditing: boolean` — page number input edit mode
- `editValue: string` — input value during editing
- `thumbnailCache: Map<number, HTMLCanvasElement>` — cached thumbnail canvases (via useRef)
- `hoveredPage: number | null` — page shown in hover preview
- `hoverX: number` — mouse X position on progress bar for positioning the preview
- `isTransitioning: boolean` — animation state flag
- `isDragging: boolean` — progress bar drag state

**New internal functions:**
- `renderThumbnail(pageNum: number): Promise<HTMLCanvasElement>` — renders a page at small scale, caches result
- `handleProgressBarHover(e: MouseEvent)` — calculates hover page, triggers thumbnail render
- `handleProgressBarClick(e: MouseEvent)` — calculates target page, navigates
- `handleProgressBarDrag` — mousedown/mousemove/mouseup handlers for dragging the indicator
- `handleKeyDown(e: KeyboardEvent)` — keyboard shortcut handler
- `handlePageInputSubmit()` — validates and navigates to entered page number
- `handlePageInputCancel()` — restores display mode without navigating

**Render changes:**
- Toolbar: Replace static page number span with clickable/editable element
- Canvas container: Add opacity transition style
- New element: Progress bar section below the canvas scroll area
- New element: Thumbnail preview popover (conditionally rendered on hover)

## New Files

None. All changes are within `pdf-viewer.tsx`.

## Edge Cases

- **1-page PDFs**: Progress bar shows full fill, no drag/hover needed. Arrow keys and Home/End still work (no-op).
- **Rapid key repeat**: Animation cancellation prevents queue buildup. Page changes are immediate.
- **Progress bar drag beyond bounds**: Clamp to `[1, totalPages]`.
- **Thumbnail render failure**: Show a plain colored rectangle with page number text as fallback.
- **Window resize**: Progress bar is percentage-based, adapts naturally. Thumbnail cache can be kept (scale is fixed).
- **Page input with invalid value**: Non-numeric or out-of-range values are clamped silently. Empty input cancels.
- **Touch interaction**: Out of scope for this iteration. Progress bar is mouse-only.

## Keyboard Accessibility

- Progress bar container has `role="slider"`, `aria-valuemin=1`, `aria-valuemax={totalPages}`, `aria-valuenow={page}`, `aria-label="Page navigation"`
- Arrow keys on focused progress bar also change pages
- Page input is a standard `<input>` with appropriate `aria-label`
