# Homepage Layout & Theme Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three UI issues on the main page: sidebar readability, markdown preview rendering, and default theme/contrast.

**Architecture:** Pure UI changes across 4 files. No logic, API, or data model changes. CSS variable swap for theme, component import for markdown, style adjustments for layout.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, CSS custom properties, react-markdown (via existing MarkdownContent component)

**Spec:** `docs/superpowers/specs/2026-03-17-homepage-layout-fixes-design.md`

---

## Chunk 1: All Fixes

### Task 1: Switch default theme to light-minimal with improved contrast

**Files:**
- Modify: `src/app/globals.css:1-60`

- [ ] **Step 1: Replace `:root` theme block with light-minimal values (improved contrast)**

In `src/app/globals.css`, replace the `:root, [data-theme="dark-minimal"]` block (lines 6-31) with light-minimal values. Then replace the `[data-theme="light-minimal"]` block (lines 36-60) with the dark-minimal values.

After the edit, the structure should be:

```css
:root,
[data-theme="light-minimal"] {
  --bg: #fafafa;
  --bg-deep: #f0f0f2;
  --surface: rgba(0, 0, 0, 0.02);
  --surface-hover: rgba(0, 0, 0, 0.04);
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.1);
  --text-primary: #111113;
  --text-secondary: #555566;
  --text-tertiary: #888899;
  --accent: #6b6b82;
  --accent-subtle: rgba(107, 107, 130, 0.1);
  --glass: rgba(0, 0, 0, 0.04);
  --glass-border: rgba(0, 0, 0, 0.08);
  --green: #16a34a;
  --green-subtle: rgba(22, 163, 74, 0.08);
  --amber: #d97706;
  --amber-subtle: rgba(217, 119, 6, 0.08);
  --blue: #2563eb;
  --blue-subtle: rgba(37, 99, 235, 0.08);
  --rose: #dc2626;
  --rose-subtle: rgba(220, 38, 38, 0.08);
  --scrollbar-thumb: rgba(0, 0, 0, 0.1);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.2);
}

[data-theme="dark-minimal"] {
  --bg: #161618;
  --bg-deep: #121214;
  --surface: rgba(255, 255, 255, 0.03);
  --surface-hover: rgba(255, 255, 255, 0.055);
  --border: rgba(255, 255, 255, 0.06);
  --border-strong: rgba(255, 255, 255, 0.1);
  --text-primary: #e8e8ec;
  --text-secondary: #8b8b9e;
  --text-tertiary: #55556a;
  --accent: #9d9db5;
  --accent-subtle: rgba(157, 157, 181, 0.1);
  --glass: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
  --green: #6ee7a0;
  --green-subtle: rgba(110, 231, 160, 0.08);
  --amber: #fbbf24;
  --amber-subtle: rgba(251, 191, 36, 0.08);
  --blue: #7daeff;
  --blue-subtle: rgba(125, 174, 255, 0.08);
  --rose: #f87171;
  --rose-subtle: rgba(248, 113, 113, 0.08);
  --scrollbar-thumb: rgba(255, 255, 255, 0.08);
  --scrollbar-thumb-hover: rgba(255, 255, 255, 0.15);
}
```

Note: `deep-blue` and `warm-dark` theme blocks remain unchanged.

- [ ] **Step 2: Run tests to verify nothing breaks**

Run: `npm test`
Expected: All 83 tests pass (no logic changes, CSS only)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "fix: switch default theme to light-minimal with improved contrast"
```

---

### Task 2: Fix three-column layout proportions

**Files:**
- Modify: `src/app/page.tsx:100-227`

- [ ] **Step 1: Change Column 1 (sidebar) from fixed 200px to 15% with min-width**

In `src/app/page.tsx`, find the sidebar `<div>` (line 102-105). Change the style from:
```tsx
style={{ width: '200px', padding: '14px 10px', borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.012)' }}
```
to:
```tsx
style={{ width: '15%', minWidth: '180px', padding: '14px 10px', borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.012)' }}
```

- [ ] **Step 2: Change Column 2 (paper list) from fixed 300px to 25% with min-width**

In `src/app/page.tsx`, find the paper list `<div>` (line 142-143). Change the style from:
```tsx
style={{ width: '300px', borderRight: '1px solid var(--border)' }}
```
to:
```tsx
style={{ width: '25%', minWidth: '280px', borderRight: '1px solid var(--border)' }}
```

Column 3 (preview) is already `flex-1` via className — no change needed.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: use percentage-based column widths for responsive layout"
```

---

### Task 3: Fix folder tree indentation and paper name readability

**Files:**
- Modify: `src/components/folder-tree.tsx:56,280,321,376`

- [ ] **Step 1: Reduce PaperRow indentation and enable line-clamp-2**

In `src/components/folder-tree.tsx`, in the `PaperRow` component (line 56), change:
```tsx
paddingLeft: `${12 + depth * 20}px`,
```
to:
```tsx
paddingLeft: `${10 + depth * 14}px`,
```

On line 64, change the paper name `<div>` className from:
```tsx
className="truncate"
```
to:
```tsx
className="line-clamp-2"
```

- [ ] **Step 2: Reduce FolderRow indentation**

In the `FolderRow` component (line 280), change:
```tsx
paddingLeft: `${8 + depth * 20}px`,
```
to:
```tsx
paddingLeft: `${6 + depth * 14}px`,
```

- [ ] **Step 3: Reduce expanded children margin-left**

In the expanded children container (line 376-377), change:
```tsx
marginLeft: `${20 + depth * 20}px`,
```
to:
```tsx
marginLeft: `${14 + depth * 14}px`,
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/folder-tree.tsx
git commit -m "fix: reduce folder tree indentation and enable paper name wrapping"
```

---

### Task 4: Add markdown rendering to preview panel

**Files:**
- Modify: `src/components/preview-panel.tsx:1-134`

- [ ] **Step 1: Add MarkdownContent import**

In `src/components/preview-panel.tsx`, add after the existing imports (line 3):
```tsx
import { MarkdownContent } from '@/components/markdown-content';
```

- [ ] **Step 2: Replace plain text summary with MarkdownContent**

Find the summary rendering section (lines 114-119). Replace:
```tsx
<div className="rounded-lg" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.65, background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
  {analysis.summary?.content || 'No summary available'}
</div>
```
with:
```tsx
<div className="rounded-lg" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
  <MarkdownContent content={analysis.summary?.content || 'No summary available'} />
</div>
```

- [ ] **Step 3: Replace bullet-point contributions with MarkdownContent**

Find the contributions rendering section (lines 122-129). Replace:
```tsx
<div className="rounded-lg" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.65, background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
  {analysis.contributions.items.map((item, i) => (
    <div key={i}>• {item}</div>
  ))}
</div>
```
with:
```tsx
<div className="rounded-lg" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
  <MarkdownContent content={analysis.contributions.items.map((item: string) => '- ' + item).join('\n')} />
</div>
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/components/preview-panel.tsx
git commit -m "fix: render preview panel analysis content as markdown"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All 83 tests pass

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Visual smoke test**

Run: `npm run dev`

Verify in browser at `http://localhost:3000`:
1. Default theme is light (no localStorage set → light background)
2. Sidebar paper names are readable, wrap to 2 lines for long titles
3. Column proportions look balanced (~15% | ~25% | ~60%)
4. Preview panel renders markdown (bold, lists, code, blockquotes)
5. Theme picker switches between all 4 themes correctly
