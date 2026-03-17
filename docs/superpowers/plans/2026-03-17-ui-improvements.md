# UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance themes to 2 light + 2 dark, refine homepage layout with compact paper list and double-click navigation, fix markdown font consistency.

**Architecture:** Three independent changes to the existing EasyPaper Next.js app. All changes are UI-only — no backend or data model changes. Theme change touches CSS + picker component. Layout change adds a compact paper list to Column 1 sidebar and double-click navigation to Column 2. Markdown fix normalizes font sizes in the shared `MarkdownContent` component.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-17-ui-improvements-design.md`

---

## Chunk 1: Theme System — Replace Deep Blue with Warm Light

### Task 1: Update ThemePreset type

**Files:**
- Modify: `src/types/index.ts:98`

- [ ] **Step 1: Update ThemePreset type union**

Replace `'deep-blue'` with `'warm-light'`:

```typescript
export type ThemePreset = 'dark-minimal' | 'light-minimal' | 'warm-light' | 'warm-dark';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (other files referencing `deep-blue` will fail — that's expected, we'll fix them next)

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor: update ThemePreset type — replace deep-blue with warm-light"
```

---

### Task 2: Replace deep-blue CSS with warm-light

**Files:**
- Modify: `src/app/globals.css:62-89`

- [ ] **Step 1: Replace the Deep Blue CSS block (lines 62-89) with Warm Light**

Replace the entire `[data-theme="deep-blue"]` block with:

```css
/* ============================================
   Theme: Warm Light
   ============================================ */
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

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "refactor: replace deep-blue theme with warm-light theme"
```

---

### Task 3: Update theme picker component

**Files:**
- Modify: `src/components/theme-picker.tsx:6-14`

- [ ] **Step 1: Update presets array (line 6-11)**

Replace the presets array:

```typescript
const presets: { id: ThemePreset; name: string; preview: string }[] = [
  { id: 'light-minimal', name: 'Light Minimal', preview: '#fafafa' },
  { id: 'warm-light', name: 'Warm Light', preview: '#faf8f5' },
  { id: 'dark-minimal', name: 'Dark Minimal', preview: '#161618' },
  { id: 'warm-dark', name: 'Warm Dark', preview: '#1a1816' },
];
```

Note: reordered to show light themes first, then dark themes.

- [ ] **Step 2: Update default state (line 14)**

Change from `'dark-minimal'` to `'light-minimal'`:

```typescript
const [current, setCurrent] = useState<ThemePreset>('light-minimal');
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add src/components/theme-picker.tsx
git commit -m "feat: update theme picker — warm-light replaces deep-blue, light themes first"
```

---

### Task 4: Add localStorage migration for deep-blue

**Files:**
- Modify: `src/app/layout.tsx:10-25`

- [ ] **Step 1: Add migration to the theme script**

Replace the `themeScript` string (lines 10-25) with:

```typescript
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('easypaper-theme');
    if (theme === 'deep-blue') {
      theme = 'light-minimal';
      localStorage.setItem('easypaper-theme', theme);
    }
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    var accent = localStorage.getItem('easypaper-accent');
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
      var r = parseInt(accent.slice(1, 3), 16);
      var g = parseInt(accent.slice(3, 5), 16);
      var b = parseInt(accent.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent-subtle', 'rgba(' + r + ',' + g + ',' + b + ',0.1)');
    }
  } catch(e) {}
})();
`;
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix: migrate deep-blue theme users to light-minimal on page load"
```

---

### Task 5: Fix dark theme paper name visibility

**Files:**
- Modify: `src/components/editable-title.tsx:68,76`

- [ ] **Step 1: Fix editing state styles (line 68)**

Replace line 68:
```
className="text-base font-semibold text-slate-800 bg-white border-2 border-indigo-500 rounded-md px-2 py-1 outline-none w-full ring-2 ring-indigo-100 disabled:opacity-50"
```

With:
```
className="text-base font-semibold rounded-md px-2 py-1 outline-none w-full disabled:opacity-50"
style={{ color: 'var(--text-primary)', background: 'var(--surface)', border: '2px solid var(--accent)', boxShadow: '0 0 0 2px var(--accent-subtle)' }}
```

Note: Move color-related classes to inline styles using CSS variables so they adapt to all themes. Remove `ring-2` and use `boxShadow` instead since Tailwind ring utilities don't accept CSS variables via inline style. Keep layout classes in className.

- [ ] **Step 2: Fix display state styles (line 76)**

Replace line 76:
```
className="text-base font-semibold text-slate-800 truncate cursor-pointer hover:border-b hover:border-dashed hover:border-slate-400 transition-colors"
```

With:
```
className="text-base font-semibold truncate cursor-pointer transition-colors"
style={{ color: 'var(--text-primary)' }}
```

Note: Remove `hover:border-b hover:border-dashed hover:border-slate-400` since these use hardcoded colors. The cursor-pointer and title="Click to rename" are sufficient hover cues.

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Navigate to `/paper/[id]` in dark-minimal and warm-dark themes. Paper title should be clearly visible in both display and editing states.

- [ ] **Step 4: Commit**

```bash
git add src/components/editable-title.tsx
git commit -m "fix: use CSS variables for paper title — readable in all themes"
```

---

## Chunk 2: Homepage Layout Refinement

### Task 6: Add onDoubleClick and data-paper-id to PaperRow

**Files:**
- Modify: `src/components/paper-row.tsx`

- [ ] **Step 1: Update PaperRowProps interface and component**

Replace the entire `paper-row.tsx` with:

```typescript
'use client';

import type { PaperListItem } from '@/types';

interface PaperRowProps {
  paper: PaperListItem;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  analyzed: { label: '✓ Analyzed', className: 'analyzed' },
  pending: { label: 'Pending', className: 'pending' },
  parsing: { label: 'Parsing...', className: 'parsing' },
  analyzing: { label: 'Analyzing...', className: 'analyzing' },
  error: { label: 'Error', className: 'error' },
};

export function PaperRow({ paper, isActive, onClick, onDoubleClick }: PaperRowProps) {
  const status = statusConfig[paper.status] || statusConfig.pending;

  return (
    <div
      data-paper-id={paper.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="cursor-pointer rounded-lg transition-colors"
      style={{
        padding: '10px',
        marginBottom: '2px',
        background: isActive ? 'var(--accent-subtle)' : 'transparent',
        border: isActive ? '1px solid rgba(157,157,181,0.08)' : '1px solid transparent',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {paper.title}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
        {new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <span
          className="rounded"
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            background: status.className === 'analyzed' ? 'var(--green-subtle)' :
                        status.className === 'error' ? 'var(--rose-subtle)' :
                        status.className === 'parsing' || status.className === 'analyzing' ? 'var(--blue-subtle)' :
                        'var(--amber-subtle)',
            color: status.className === 'analyzed' ? 'var(--green)' :
                   status.className === 'error' ? 'var(--rose)' :
                   status.className === 'parsing' || status.className === 'analyzing' ? 'var(--blue)' :
                   'var(--amber)',
          }}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}
```

Changes from original:
- Added `onDoubleClick?: () => void` to props
- Added `data-paper-id={paper.id}` to root div
- Added `onDoubleClick={onDoubleClick}` to root div

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/paper-row.tsx
git commit -m "feat: add onDoubleClick prop and data-paper-id to PaperRow"
```

---

### Task 7: Add compact paper list to Column 1 and wire up interactions

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add useRouter import**

Add a new line after line 2 (after the react import):

```typescript
import { useRouter } from 'next/navigation';
```

- [ ] **Step 2: Add router inside component**

Add after line 19 (after `const [droppedFile, setDroppedFile] = useState<File | null>(null);`):

```typescript
const router = useRouter();
```

- [ ] **Step 3: Add Column 1 compact paper list click handler**

Add after the `handleCol2Drop` function (after line 97):

```typescript
const handleCompactPaperClick = (paperId: string) => {
  // Clear folder filter and search so Column 2 shows all papers
  setSelectedFolderId(null);
  setFilterStatus('all');
  setSearchQuery('');
  // Select the paper
  setSelectedPaperId(paperId);
  // Scroll Column 2 to show the selected paper
  setTimeout(() => {
    document.querySelector(`[data-paper-id="${paperId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
};
```

- [ ] **Step 4: Add compact paper list section to Column 1**

After the `FolderTree` closing tag (after line 137, just before the closing `</div>` of Column 1), add the compact paper list. Note: the Column 1 parent div has `overflow-y-auto` — the new paper list section uses `flex-1 overflow-y-auto` inside it. Since Column 1 is `flex flex-col`, `flex-1` will make the paper list take remaining vertical space and scroll independently while Library/Folders stay pinned at the top.

```tsx
{papers.length > 0 && (
  <>
    <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', padding: '12px 10px 5px', fontWeight: 600 }}>
      Papers
    </div>
    <div className="flex-1 overflow-y-auto" style={{ padding: '0 4px' }}>
      {papers.map(paper => (
        <div
          key={paper.id}
          onClick={() => handleCompactPaperClick(paper.id)}
          className="cursor-pointer rounded transition-colors"
          style={{
            padding: '4px 6px',
            marginBottom: '1px',
            fontSize: '11px',
            color: paper.id === selectedPaperId ? 'var(--text-primary)' : 'var(--text-secondary)',
            background: paper.id === selectedPaperId ? 'var(--accent-subtle)' : 'transparent',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={paper.title}
        >
          {paper.title}
        </div>
      ))}
    </div>
  </>
)}
```

- [ ] **Step 5: Wire up double-click on Column 2 PaperRow**

Update the `PaperRow` usage in the filtered list (around line 216-221). Change from:

```tsx
<PaperRow
  key={paper.id}
  paper={paper}
  isActive={paper.id === selectedPaperId}
  onClick={() => setSelectedPaperId(paper.id)}
/>
```

To:

```tsx
<PaperRow
  key={paper.id}
  paper={paper}
  isActive={paper.id === selectedPaperId}
  onClick={() => setSelectedPaperId(paper.id)}
  onDoubleClick={() => router.push(`/paper/${paper.id}`)}
/>
```

- [ ] **Step 6: Verify build compiles and test visually**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npm run dev`
Test:
- Column 1 shows "Papers" section below Folders with compact paper names
- Click paper in Column 1 → selects it, Column 2 scrolls to it, Column 3 shows preview
- Column 1 click clears any folder filter/search
- Column 2 single-click selects paper
- Column 2 double-click navigates to `/paper/[id]`
- Empty library: "Papers" section hidden in Column 1

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add compact paper list to sidebar, double-click to open paper"
```

---

## Chunk 3: Markdown Font Consistency Fix

### Task 8: Normalize markdown font sizes

**Files:**
- Modify: `src/components/markdown-content.tsx`

- [ ] **Step 1: Update the MarkdownContent component**

Replace the entire file with:

```typescript
'use client';

import ReactMarkdown from 'react-markdown';

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`prose max-w-none ${className || ''}`} style={{ fontSize: '13px', lineHeight: 1.7 }}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h3 className="text-base font-bold mt-3 mb-1" style={{ color: 'var(--text-primary)' }}>{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-base font-bold mt-3 mb-1" style={{ color: 'var(--text-primary)' }}>{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--text-primary)' }}>{children}</h4>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0" style={{ fontSize: '13px' }}>{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li style={{ fontSize: '13px' }}>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} style={{ color: 'var(--accent)' }} className="underline underline-offset-2">{children}</a>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.startsWith('language-');
            if (isBlock) {
              return (
                <pre
                  className="rounded-lg p-3 my-2 overflow-x-auto text-xs"
                  style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)' }}
                >
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code
                className="px-1 py-0.5 rounded text-xs"
                style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)' }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote
              className="border-l-2 pl-3 my-2 italic"
              style={{ borderColor: 'var(--accent)', color: 'var(--text-secondary)', fontSize: '13px' }}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

Changes from original:
- Wrapper: `prose prose-sm` → `prose` (removed `prose-sm`) + explicit `fontSize: '13px'` and `lineHeight: 1.7`
- `p`: added `style={{ fontSize: '13px' }}`
- `li`: changed from `className="text-sm"` to `style={{ fontSize: '13px' }}`
- `h3` render: kept `text-sm` (14px) — unchanged per spec
- `blockquote`: added `fontSize: '13px'` to style

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Navigate to a paper with analysis. Check Summary, Contributions, Methodology tabs — all body text should be uniform 13px.

- [ ] **Step 3: Commit**

```bash
git add src/components/markdown-content.tsx
git commit -m "fix: normalize markdown font sizes to consistent 13px base"
```

---

## Final Verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Visual testing checklist**

1. Theme picker: 4 themes shown (Light Minimal, Warm Light, Dark Minimal, Warm Dark)
2. Warm Light theme: cream/paper background, readable text
3. Dark themes: paper title in `/paper/[id]` header is clearly visible
4. Homepage Column 1: Library + Folders + Papers sections
5. Column 1 paper click: selects, scrolls Column 2, shows preview
6. Column 2 double-click: navigates to reading page
7. Markdown: Summary and Contributions have same font size
