# Homepage Layout & Theme Fixes

**Date:** 2026-03-17
**Scope:** 3 targeted fixes to the main page UI

## Problem

1. **Sidebar layout broken** — The 200px fixed sidebar with 20px/level indentation causes paper names in the folder tree to be truncated to invisibility (e.g., "L...", "F..."). The three-column proportions (200px | 300px | flex) give ~70% of the page to the preview panel, which is excessive.

2. **Preview panel renders plain text** — The `PreviewPanel` component displays analysis content as plain text and manual bullet points instead of using the existing `MarkdownContent` component.

3. **Default theme too dark, light theme contrast weak** — The default CSS theme is `dark-minimal`. The `light-minimal` theme has insufficient contrast — `--text-secondary` (#6b6b7a) and `--text-tertiary` (#9b9baa) are too light, making labels and metadata hard to read.

## Design

### Fix 1: Percentage-based responsive columns + sidebar readability

**Column proportions** (`src/app/page.tsx`):
- Sidebar (Column 1): `width: '15%'` with `minWidth: '180px'`
- Paper list (Column 2): `width: '25%'` with `minWidth: '280px'`
- Preview (Column 3): `flex: 1` (remaining ~60%, unchanged)

**Minimum supported viewport:** 1024px. At narrower widths, horizontal scrolling is acceptable (academic tool, not mobile-first).

**Folder tree readability** (`src/components/folder-tree.tsx`):

All three indentation formulas change:
- `PaperRow` paddingLeft: `${12 + depth * 20}px` → `${10 + depth * 14}px`
- `FolderRow` paddingLeft: `${8 + depth * 20}px` → `${6 + depth * 14}px`
- Expanded children marginLeft: `${20 + depth * 20}px` → `${14 + depth * 14}px`

Text wrapping:
- Paper names (PaperRow in folder-tree.tsx): replace `truncate` class with `line-clamp-2` to allow up to 2 lines. This increases row height slightly for long titles — an acceptable trade-off for readability.
- Folder names (FolderRow): keep `truncate` (folder names are typically short).

### Fix 2: Markdown rendering in preview panel

**File:** `src/components/preview-panel.tsx`

- Import `MarkdownContent` from `@/components/markdown-content`
- Replace the plain text summary rendering with `<MarkdownContent content={analysis.summary?.content || 'No summary available'} />`
- Replace the manual bullet-point contributions rendering (`• {item}` divs) with `<MarkdownContent content={analysis.contributions.items.map(item => '- ' + item).join('\n')} />`
- The `MarkdownContent` component already uses CSS variables (`var(--text-primary)`, `var(--accent)`, etc.) in its custom renderers, so it integrates with the existing container without extra styling.
- Remove the inline `fontSize`, `color`, and `lineHeight` styles from the wrapping `<div>` for each section since `MarkdownContent`'s `prose` class handles typography. Keep only the `background`, `border`, and `padding` styles on the container.

### Fix 3: Light default theme + improved contrast

**File:** `src/app/globals.css`

**Switch default:** Move `light-minimal` color values into `:root` (the default). Move current dark-minimal values into `[data-theme="dark-minimal"]` only (no longer in `:root`).

**Theme persistence is safe:** The inline script in `layout.tsx` only sets `data-theme` if localStorage has a saved theme. For new users with no localStorage, `:root` applies — so changing `:root` to light-minimal colors makes light the default out of the box.

**Improved light-minimal contrast values:**

| Variable | Before | After |
|----------|--------|-------|
| `--text-primary` | `#1a1a1e` | `#111113` |
| `--text-secondary` | `#6b6b7a` | `#555566` |
| `--text-tertiary` | `#9b9baa` | `#888899` |
| `--border` | `rgba(0,0,0,0.06)` | `rgba(0,0,0,0.08)` |
| `--glass-border` | `rgba(0,0,0,0.06)` | `rgba(0,0,0,0.08)` |

All other values remain unchanged.

## Files Changed

1. `src/app/page.tsx` — column width/minWidth styles for all three columns
2. `src/components/folder-tree.tsx` — three indentation formulas + paper name `line-clamp-2`
3. `src/components/preview-panel.tsx` — import MarkdownContent, replace plain text rendering
4. `src/app/globals.css` — swap `:root` to light-minimal, improve contrast values

## Testing

- Visual: verify sidebar paper names are readable at 1280px, 1440px, 1920px widths
- Visual: verify preview panel renders markdown (headers, lists, bold, etc.)
- Visual: verify light theme default loads with improved contrast for new users (clear localStorage)
- Visual: verify theme picker still switches between all 4 themes correctly
- Existing Jest tests should continue to pass (no logic changes)
