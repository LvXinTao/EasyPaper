# AI Chat Header & Section Boundary Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve visual distinction between Analysis and Chat sections by adding an icon+text chat header and wrapping both sections in a shared card container with a gradient divider.

**Architecture:** Two visual-only changes to the paper detail page's right panel. The chat header gets a robot icon in a gradient badge. The Analysis and Chat sections are wrapped in a shared card container, with the existing ResizableDivider's inner bar restyled to a gradient. One new prop (`barStyle`) added to ResizableDivider.

**Tech Stack:** React, inline styles (matching existing codebase patterns)

---

## Chunk 1: Implementation

### Task 1: Add `barStyle` prop to ResizableDivider

**Files:**
- Modify: `src/components/resizable-divider.tsx`

- [ ] **Step 1: Add optional `barStyle` prop to interface and component**

In `src/components/resizable-divider.tsx`, add `barStyle?: React.CSSProperties` to `ResizableDividerProps` and merge it into the inner bar's style:

```tsx
interface ResizableDividerProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  barStyle?: React.CSSProperties;
}

export function ResizableDivider({ direction, onResize, onResizeEnd, barStyle }: ResizableDividerProps) {
```

Update the inner `<div>` (the 3px bar at line 83-90) to merge the optional style:

```tsx
<div
  className="rounded-full transition-colors"
  style={{
    width: isHorizontal ? '3px' : '32px',
    height: isHorizontal ? '32px' : '3px',
    background: 'var(--border)',
    ...barStyle,
  }}
/>
```

- [ ] **Step 2: Verify dev server runs without errors**

Run: `npm run dev` — check no TypeScript errors in terminal.

- [ ] **Step 3: Commit**

```bash
git add src/components/resizable-divider.tsx
git commit -m "feat: add barStyle prop to ResizableDivider"
```

---

### Task 2: Redesign AI Chat header with robot icon + gradient badge

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:397-408`

- [ ] **Step 1: Replace the chat header**

Replace lines 397-408 (the chat header `<div>`) with:

```tsx
<div className="flex items-center justify-between px-4" style={{ height: '36px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
  <div className="flex items-center gap-2">
    <div
      className="flex items-center justify-center"
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
      </svg>
    </div>
    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>AI Chat</span>
  </div>
  {modelName && (
    <span
      className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-tertiary)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
      {modelName}
    </span>
  )}
</div>
```

- [ ] **Step 2: Visual check in browser**

Open http://localhost:3000, navigate to any paper. Verify:
- Purple gradient square with white robot icon appears left of "AI Chat" text
- Model badge remains on the right, unchanged
- Header height and alignment looks correct

- [ ] **Step 3: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: add robot icon with gradient badge to AI Chat header"
```

---

### Task 3: Add shared card wrapper and gradient divider

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:325-423`

- [ ] **Step 1: Wrap Analysis + Divider + Chat in a card container**

Inside the right panel `<div>` (line 325), wrap the three children (Analysis zone, ResizableDivider, Chat zone) in a new `<div>`:

```tsx
{/* Right: Split Panel */}
<div ref={rightPanelRef} className="flex-1 flex flex-col" style={{ minWidth: '280px', overflow: 'hidden' }}>
  {/* Shared card container for Analysis + Chat */}
  <div className="flex-1 flex flex-col overflow-hidden" style={{
    borderRadius: '12px',
    border: '1px solid var(--glass-border)',
    margin: '4px',
  }}>
    {/* Top Zone: Analysis/Notes tabs */}
    ...existing analysis zone (remove any standalone border-radius if present)...

    {/* Vertical resizable divider — gradient bar */}
    <ResizableDivider
      direction="vertical"
      onResize={(delta) => {
        const maxTop = (rightPanelRef.current?.clientHeight ?? rightPanelHeight) - 120;
        const newHeight = Math.max(150, Math.min(effectiveTopHeight + delta, maxTop));
        handleTopHeightChange(newHeight);
      }}
      barStyle={{
        background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)',
        opacity: 0.6,
        width: '100%',
        borderRadius: 0,
      }}
    />

    {/* Bottom Zone: AI Chat */}
    ...existing chat zone...
  </div>
</div>
```

Key changes:
- New wrapper `<div>` with `borderRadius: 12px`, `border`, `margin: 4px` (small margin so card doesn't touch the edges)
- Pass `barStyle` to the vertical `ResizableDivider` to render a full-width gradient bar
- The horizontal ResizableDivider (between PDF and right panel) is NOT affected

- [ ] **Step 2: Visual check in browser**

Open http://localhost:3000, navigate to any paper. Verify:
- Analysis and Chat sections are wrapped in a rounded card with a visible border
- A purple gradient line separates Analysis from Chat
- The divider is still draggable (resize still works)
- Content doesn't clip unexpectedly
- Scrolling within Analysis and Chat sections still works

- [ ] **Step 3: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: add shared card container and gradient divider between Analysis and Chat"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Full visual check**

Open http://localhost:3000, navigate to a paper. Verify both changes together:
1. AI Chat header shows robot icon in purple gradient badge + "AI Chat" text
2. Analysis and Chat are in a shared rounded card
3. Purple gradient divider between them, still draggable
4. Resize behavior preserved (both horizontal and vertical)
5. All tab switching works (Analysis/Notes)
6. Chat input and messages work normally
