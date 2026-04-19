# Note Indicator (Dot) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PDF note annotation bubbles with compact colored dot indicators.

**Architecture:** Create a new `NoteIndicator` component that renders a small colored dot (based on tag) with hover tooltip and click-to-edit. Modify `pdf-viewer.tsx` to use it instead of `AnnotationBubble`. Delete `annotation-bubble.tsx`.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, react-pdf 10

---

## Chunk 1: NoteIndicator Component

### Task 1: Write NoteIndicator component

**Files:**
- Create: `src/components/note-indicator.tsx`
- Test: `__tests__/components/note-indicator.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/note-indicator.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteIndicator } from '@/components/note-indicator';
import type { Note } from '@/types';

const mockNote: Note = {
  id: 'note-1',
  title: 'Important feature semantics',
  content: 'In the vanilla attention layer, features are projected through the same projection matrices that are shared across all features.',
  tags: ['important'],
  selection: {
    text: 'In the vanilla attention layer...',
    rects: [{ left: 10, top: 20, width: 80, height: 5 }],
    page: 2,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('NoteIndicator', () => {
  it('renders a colored dot with correct tag color', () => {
    render(<NoteIndicator note={mockNote} position={{ x: 100, y: 200 }} onClick={() => {}} />);
    const dot = screen.getByRole('button', { name: /Important feature semantics/i });
    expect(dot).toBeInTheDocument();
    // Dot should have red color for 'important' tag
    expect(dot).toHaveStyle({ background: 'rgb(239, 68, 68)' });
  });

  it('shows tooltip on hover with note preview', async () => {
    render(<NoteIndicator note={mockNote} position={{ x: 100, y: 200 }} onClick={() => {}} />);
    const dot = screen.getByRole('button');
    fireEvent.mouseEnter(dot);
    const tooltip = await screen.findByText(/Important feature semantics/);
    expect(tooltip).toBeInTheDocument();
    expect(screen.getByText(/重要/)).toBeInTheDocument();
  });

  it('calls onClick when dot is clicked', () => {
    const handleClick = jest.fn();
    render(<NoteIndicator note={mockNote} position={{ x: 100, y: 200 }} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('uses default gray color when note has no tags', () => {
    const noTagNote = { ...mockNote, tags: [] as const };
    render(<NoteIndicator note={noTagNote} position={{ x: 100, y: 200 }} onClick={() => {}} />);
    const dot = screen.getByRole('button');
    expect(dot).toHaveStyle({ background: 'rgb(156, 163, 175)' });
  });
});
```

Run: `npx jest __tests__/components/note-indicator.test.tsx -v`
Expected: FAIL with module not found

- [ ] **Step 2: Write the NoteIndicator component**

```tsx
'use client';

import { useState } from 'react';
import type { Note, NoteTag } from '@/types';

const TAG_COLORS: Record<NoteTag, string> = {
  important: 'rgb(239, 68, 68)',
  question: 'rgb(245, 158, 11)',
  todo: 'rgb(59, 130, 246)',
  idea: 'rgb(16, 185, 129)',
  summary: 'rgb(139, 92, 246)',
};

const TAG_LABELS: Record<NoteTag, string> = {
  important: '重要',
  question: '疑问',
  todo: '待办',
  idea: '灵感',
  summary: '总结',
};

const DEFAULT_COLOR = 'rgb(156, 163, 175)';

interface NoteIndicatorProps {
  note: Note;
  position: { x: number; y: number };
  onClick: () => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
}

export function NoteIndicator({ note, position, onClick }: NoteIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const dotColor = note.tags.length > 0 ? TAG_COLORS[note.tags[0]] : DEFAULT_COLOR;
  const firstTag = note.tags[0];
  const tagLabel = firstTag ? TAG_LABELS[firstTag] : null;
  const tagColor = firstTag ? TAG_COLORS[firstTag] : null;

  const displayTitle = note.title.length > 40 ? note.title.slice(0, 40) + '...' : note.title;
  const displayContent = stripMarkdown(note.content).length > 80
    ? stripMarkdown(note.content).slice(0, 80) + '...'
    : stripMarkdown(note.content);

  // Tooltip placement: left by default, right if dot is near left edge
  const isNearLeftEdge = position.x < 200;

  return (
    <div
      className="fixed z-40 pointer-events-auto"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={onClick}
          className="rounded-full transition-transform duration-150"
          style={{
            width: '8px',
            height: '8px',
            background: dotColor,
            border: 'none',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
          tabIndex={0}
          role="button"
          aria-label={`Note: ${note.title}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
        />

        {/* Tooltip */}
        {showTooltip && (
          <div
            className="absolute px-3 py-2 rounded-lg text-xs max-w-[200px] z-50"
            style={{
              background: 'rgba(26, 26, 26, 0.95)',
              color: 'white',
              top: isNearLeftEdge ? '50%' : '50%',
              transform: 'translateY(-50%)',
              left: isNearLeftEdge ? '16px' : 'auto',
              right: isNearLeftEdge ? 'auto' : '-8px',
              transformOrigin: isNearLeftEdge ? 'left center' : 'right center',
              marginLeft: isNearLeftEdge ? '12px' : '0',
              marginRight: isNearLeftEdge ? '0' : '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            {tagLabel && tagColor && (
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: `${tagColor}33`, color: tagColor }}
              >
                {tagLabel}
              </span>
            )}
            <div className="font-medium mt-1" style={{ color: 'white' }}>
              {displayTitle}
            </div>
            {displayContent && (
              <div className="mt-1 opacity-80 italic" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {displayContent}
              </div>
            )}
            {/* Tooltip arrow */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                left: isNearLeftEdge ? '-5px' : 'auto',
                right: isNearLeftEdge ? 'auto' : '-5px',
                borderLeft: isNearLeftEdge ? '5px solid rgba(26, 26, 26, 0.95)' : 'none',
                borderRight: isNearLeftEdge ? 'none' : '5px solid rgba(26, 26, 26, 0.95)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx jest __tests__/components/note-indicator.test.tsx -v`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/components/note-indicator.tsx __tests__/components/note-indicator.test.tsx
git commit -m "feat: add NoteIndicator dot component for PDF annotations"
```

---

## Chunk 2: Integrate into PDF Viewer

### Task 2: Replace AnnotationBubble with NoteIndicator in pdf-viewer

**Files:**
- Modify: `src/components/pdf-viewer.tsx`
- Delete: `src/components/annotation-bubble.tsx`

- [ ] **Step 1: Update imports in pdf-viewer.tsx**

Change the import:
```tsx
// Remove this:
import { AnnotationBubble } from './annotation-bubble';
// Add this:
import { NoteIndicator } from './note-indicator';
```

- [ ] **Step 2: Rename handler function**

Find `handleAnnotationClick` (around line 304) and rename to `handleNoteIndicatorClick`. Update the useCallback name.

- [ ] **Step 3: Replace JSX rendering**

Find the AnnotationBubble rendering block (around line 1087-1093):
```tsx
// Remove this:
{bubblePositions.map(({ note, x, y }) => (
  <AnnotationBubble
    key={note.id}
    note={note}
    position={{ x, y }}
    onClick={() => handleAnnotationClick(note)}
  />
))}

// Replace with this:
{bubblePositions.map(({ note, x, y }) => (
  <NoteIndicator
    key={note.id}
    note={note}
    position={{ x, y }}
    onClick={() => handleNoteIndicatorClick(note)}
  />
))}
```

- [ ] **Step 4: Delete annotation-bubble.tsx**

```bash
rm src/components/annotation-bubble.tsx
```

- [ ] **Step 5: Run build to verify no compilation errors**

Run: `npm run build`
Expected: Build succeeds (no type errors from deleted file)

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/pdf-viewer.tsx src/components/annotation-bubble.tsx
git commit -m "refactor: replace annotation bubble with note indicator dots"
```

---

## Chunk 3: Verify in Browser

### Task 3: Manual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Open a paper with sentence-level notes**

Navigate to a paper that has existing notes (from the screenshot).

- [ ] **Step 3: Verify visual appearance**

Check that:
- Colored dots appear at the right edge of highlighted sentences
- Dot colors match the note's first tag
- Multiple notes on the same sentence show multiple dots side by side
- Dots have `scale(1.2)` hover effect

- [ ] **Step 4: Verify hover tooltip**

Check that:
- Hovering a dot shows the tooltip with tag label, title, and content preview
- Tooltip appears on the left side of the dot (or right if near page edge)
- Tooltip disappears when mouse leaves the dot

- [ ] **Step 5: Verify click behavior**

Check that:
- Clicking a dot opens the InlineNoteEditor in edit mode
- The editor shows the correct note content and tags

- [ ] **Step 6: Verify no tag case**

Create or find a note with no tags and verify it shows a gray dot.

- [ ] **Step 7: Verify resize and page-turn repositioning**

Resize the browser window and verify dots reposition correctly (ResizeObserver). Turn to a different page and back — dots should reappear on the correct sentences.

- [ ] **Step 8: Final build check**

Run: `npm run build`
Expected: Build succeeds with no errors.
