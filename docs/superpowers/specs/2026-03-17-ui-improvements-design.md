# EasyPaper UI Improvements Spec

**Date:** 2026-03-17
**Scope:** Theme rebalancing, homepage layout refinement, markdown font consistency

---

## 1. Theme System: Replace Deep Blue with Warm Light

### Goal

Rebalance from 1 light + 3 dark to 2 light + 2 dark. Fix paper name visibility in dark themes.

### Changes

Remove `[data-theme="deep-blue"]` CSS block. Add `[data-theme="warm-light"]`:

```css
[data-theme="warm-light"] {
  --bg: #faf8f5;
  --bg-deep: #f3f0eb;
  --surface: rgba(120, 100, 70, 0.03);
  --surface-hover: rgba(120, 100, 70, 0.06);
  --border: rgba(120, 100, 70, 0.1);
  --border-strong: rgba(120, 100, 70, 0.15);
  --text-primary: #2d2a26;
  --text-secondary: #6b6356;
  --text-tertiary: #9e9586;
  --accent: #8a7e6e;
  --accent-subtle: rgba(138, 126, 110, 0.1);
  --glass: rgba(120, 100, 70, 0.04);
  --glass-border: rgba(120, 100, 70, 0.08);
  --green: #16a34a;
  --green-subtle: rgba(22, 163, 74, 0.08);
  --amber: #d97706;
  --amber-subtle: rgba(217, 119, 6, 0.08);
  --blue: #2563eb;
  --blue-subtle: rgba(37, 99, 235, 0.08);
  --rose: #dc2626;
  --rose-subtle: rgba(220, 38, 38, 0.08);
  --scrollbar-thumb: rgba(120, 100, 70, 0.1);
  --scrollbar-thumb-hover: rgba(120, 100, 70, 0.2);
}
```

### Dark Theme Paper Name Fix

The paper title in the header bar uses hardcoded Tailwind classes (`text-slate-800`) in `src/components/editable-title.tsx` — nearly invisible on dark backgrounds. Fix both display state (line ~77: `text-slate-800`) and editing state (line ~68: `text-slate-800 bg-white border-indigo-500 ring-indigo-100`) to use CSS variables (`var(--text-primary)`, `var(--surface)`, `var(--accent)`).

### localStorage Migration

Users who have `deep-blue` saved in `localStorage` (key `easypaper-theme`) will get a broken page since the CSS block no longer exists. Add a migration in the `layout.tsx` theme script: if stored theme is `deep-blue`, remap to `light-minimal` and update localStorage.

### Files to Modify

- `src/app/globals.css` — replace `deep-blue` block with `warm-light`
- `src/components/theme-picker.tsx` — update `deep-blue` → `warm-light` in preset list, label, preview swatch; update initial state default to `light-minimal`
- `src/types/index.ts` — update `ThemePreset` type: change `'deep-blue'` to `'warm-light'`
- `src/app/layout.tsx` — add `deep-blue` → `light-minimal` migration in theme script
- `src/components/editable-title.tsx` — replace hardcoded `text-slate-800`/`bg-white` with CSS variable-based styles

---

## 2. Homepage Three-Column Layout Refinement

### Current State

| Column | Width | Content |
|--------|-------|---------|
| 1 | 15% (min 180px) | Library nav + Folders tree |
| 2 | 25% (min 280px) | Paper list (title + date + status, click to select) |
| 3 | flex | Preview panel |

### Target State

| Column | Width | Content |
|--------|-------|---------|
| 1 | 15-18% (min 180px) | Library nav + Folders tree + **compact paper name list** |
| 2 | 25-30% (min 280px) | **Detailed paper list** (title + status + timestamps, single-click select, **double-click navigate**) |
| 3 | flex | Preview panel (unchanged) |

### Column 1: Add Compact Paper List

Below the existing Library/Folders navigation, add a scrollable list of paper names:

- Section header: "Papers" (uppercase label, same style as "Library" / "Folders")
- Each item: paper title only, single line with `text-overflow: ellipsis`
- Font: 11px, padding: 4px 6px
- Active item: `var(--accent-subtle)` background
- No timestamps, no status badges
- Click behavior: select paper → highlight in Column 2 (scroll into view) → show preview in Column 3
- No navigation to `/paper/[id]` on click
- Shows ALL papers regardless of folder/search filter. Clicking a paper in Column 1 clears current folder filter and search so Column 2 shows the selected paper.
- Empty state: hide "Papers" section entirely when `papers.length === 0`

### Column 2: Interaction Changes

Current behavior: single-click selects paper and shows preview (no navigation exists today). Changes:

- **Keep**: title, status badge, relative timestamps ("13 hours ago"), single-click selection
- **Add**: `onDoubleClick` handler to navigate to `/paper/[id]`
- Scroll sync: when Column 1 paper is clicked, Column 2 scrolls to corresponding row using `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`
- Scroll sync mechanism: add `data-paper-id={paper.id}` attribute to each `PaperRow` root div, then use `document.querySelector('[data-paper-id="..."]')?.scrollIntoView(...)` from Column 1 click handler

### Implementation

- `src/app/page.tsx` — add compact paper list section to Column 1, implement scroll sync with `data-paper-id` query, wire up double-click on Column 2 rows
- `src/components/paper-row.tsx` — add `onDoubleClick` prop and `data-paper-id` attribute

---

## 3. Markdown Font Consistency Fix

### Problem

`markdown-content.tsx` uses `prose prose-sm` Tailwind classes. Different markdown elements inherit different sizes:
- `p` tags: no explicit size, inherits from `prose-sm` (~14px)
- `li` tags: explicitly set to `text-sm` (14px but rendered differently)
- Headings: explicitly set (`text-base` for h1/h2, `text-sm` for h3)

This causes visual inconsistency between Summary (paragraphs) and Key Contributions (lists).

### Solution

Remove `prose-sm` from the wrapper (keep only `prose max-w-none`) to avoid specificity conflicts. Set explicit `text-[13px]` on all body-text components in the custom overrides:

- `p` — add `text-[13px]`
- `li` — change `text-sm` → `text-[13px]`
- `blockquote` — add `text-[13px]`
- Keep heading hierarchy: h1/h2 `text-base`, h3 `text-sm`

### Files to Modify

- `src/components/markdown-content.tsx` — update component style overrides

---

## Testing Checklist

- [ ] All 4 themes render correctly (light-minimal, warm-light, dark-minimal, warm-dark)
- [ ] Users with `deep-blue` in localStorage are migrated to `light-minimal`
- [ ] Paper name readable in dark-minimal and warm-dark on `/paper/[id]` page (both display and edit states)
- [ ] Theme picker shows correct labels and preview swatches
- [ ] Column 1 shows compact paper names below Folders
- [ ] Column 1 click selects paper, scrolls Column 2, shows preview
- [ ] Column 1 click does NOT navigate to reading page
- [ ] Column 2 single-click selects paper
- [ ] Column 2 double-click navigates to `/paper/[id]`
- [ ] Column 2 shows timestamps ("13 hours ago")
- [ ] Scroll sync works between Column 1 and Column 2
- [ ] Markdown font sizes consistent across all analysis sections
