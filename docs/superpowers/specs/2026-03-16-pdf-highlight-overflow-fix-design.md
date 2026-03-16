# Fix PDF Highlight Right-Side Overflow

**Date:** 2026-03-16
**Status:** Approved

## Problem

When selecting text in the PDF viewer, the custom highlight rectangles overflow to the right of each line by more than one character width. This occurs consistently across all lines.

## Root Cause

In `src/components/pdf-viewer.tsx` (lines 449-454), the highlight rect calculation divides `getClientRects()` width and adjusts left offset by `scaleX`. However, `getClientRects()` already returns screen-space coordinates that include the CSS `scaleX` transform. The division is incorrect:

- When `scaleX < 1` (text compressed): dividing makes width **larger**, amplifying overflow
- When `scaleX > 1` (text stretched): dividing makes width smaller, potentially under-sizing

## Fix

Remove the scaleX adjustment entirely. Use `getClientRects()` screen-space values directly for highlight positioning. Also remove the now-unnecessary span/scaleX lookup loop.

**File:** `src/components/pdf-viewer.tsx`

### Remove (lines 425-435): span/scaleX lookup

```typescript
// DELETE: No longer needed
let span: HTMLElement | null = textNode.parentElement;
let scaleX = 1;
while (span && span !== textLayerEl) {
  const sx = span.style.getPropertyValue('--scale-x');
  if (sx) {
    scaleX = parseFloat(sx) || 1;
    break;
  }
  span = span.parentElement;
}
```

### Simplify (lines 446-454): rect calculation

```typescript
// BEFORE:
let left = r.left - wrapperRect.left;
let width = r.width;
if (span && span !== textLayerEl && scaleX > 0 && scaleX !== 1) {
  const spanRect = span.getBoundingClientRect();
  left = (spanRect.left - wrapperRect.left) + (r.left - spanRect.left) / scaleX;
  width = r.width / scaleX;
}

// AFTER:
const left = r.left - wrapperRect.left;
const width = r.width;
```

## Verification

1. Select text in single-column and dual-column PDFs — highlights should not overflow right
2. Test at different zoom levels (80%, 100%, 120%, 150%)
3. Verify copy/paste still works
4. Check that dual-column PDFs don't show cross-column highlight bleed
