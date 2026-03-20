# Bookmark Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paper-level starring and PDF page-level bookmarks to EasyPaper.

**Architecture:** Extend existing types and storage layer with `starred` field on papers and new `bookmarks.json` per paper. Add bookmarks API routes mirroring the notes pattern. Update home page with star icons and filter, update PDF viewer with bookmark button, progress bar markers, and a Bookmarks tab.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Add `starred` to types, add `Bookmark` type |
| `src/lib/storage.ts` | Modify | Add `getBookmarks`/`saveBookmarks`, update `listPapers` |
| `src/app/api/paper/[id]/route.ts` | Modify | Handle `starred` in PATCH |
| `src/app/api/paper/[id]/bookmarks/route.ts` | Create | Bookmarks CRUD API |
| `src/components/paper-row.tsx` | Modify | Add star icon |
| `src/app/page.tsx` | Modify | Add Starred filter button |
| `src/components/preview-panel.tsx` | Modify | Add star icon to header |
| `src/components/pdf-viewer.tsx` | Modify | Add bookmark button, progress bar markers, context menu |
| `src/components/bookmarks-panel.tsx` | Create | Bookmarks tab component |
| `src/components/add-bookmark-popover.tsx` | Create | Popover for adding/editing bookmarks |
| `src/app/paper/[id]/page.tsx` | Modify | Add Bookmarks tab, wire up bookmark state |

---

## Chunk 1: Data Model & Storage Layer

### Task 1: Add Bookmark Type and Starred Field

**Files:**
- Modify: `src/types/index.ts:91-98` (PaperListItem)
- Modify: `src/types/index.ts:3-17` (PaperMetadata)

- [ ] **Step 1: Add `starred` to PaperMetadata**

Edit `src/types/index.ts` at line 11 (after `sortIndex`):

```typescript
export interface PaperMetadata {
  id: string;
  title: string;
  filename: string;
  pages: number;
  createdAt: string;
  status: PaperStatus;
  folderId?: string | null;
  sortIndex?: number;
  starred?: boolean;  // Add this line
  analysisProgress?: {
    step: 'parsing' | 'analyzing' | 'saving';
    message: string;
    updatedAt: string;
  };
}
```

- [ ] **Step 2: Add `starred` to PaperListItem**

Edit `src/types/index.ts` at line 97 (after `sortIndex`):

```typescript
export interface PaperListItem {
  id: string;
  title: string;
  createdAt: string;
  status: PaperStatus;
  folderId?: string | null;
  sortIndex?: number;
  starred?: boolean;  // Add this line
}
```

- [ ] **Step 3: Add `Bookmark` type**

Add after the `Note` interface (after line 123):

```typescript
export interface Bookmark {
  id: string;
  page: number;
  label?: string;
  createdAt: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add starred field and Bookmark type"
```

---

### Task 2: Add Bookmark Storage Methods

**Files:**
- Modify: `src/lib/storage.ts:175-185` (after saveNotes)
- Modify: `src/lib/storage.ts:186-199` (listPapers)

- [ ] **Step 1: Add `getBookmarks` and `saveBookmarks` methods**

Add after `saveNotes` method (after line 185):

```typescript
  async getBookmarks(paperId: string): Promise<Bookmark[]> {
    try {
      const filePath = path.join(paperDir(paperId), 'bookmarks.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return []; }
  },
  async saveBookmarks(paperId: string, bookmarks: Bookmark[]): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'bookmarks.json');
    await fs.writeFile(filePath, JSON.stringify(bookmarks, null, 2));
  },
```

- [ ] **Step 2: Add Bookmark import at top of file**

Edit line 4 to include Bookmark:

```typescript
import type { PaperMetadata, PaperAnalysis, ChatHistory, ChatSession, ChatSessionMeta, PaperListItem, Note, Folder, PromptSettings, Bookmark } from '@/types';
```

- [ ] **Step 3: Update `listPapers` to propagate `starred`**

Edit line 194 to include starred:

```typescript
papers.push({ id: metadata.id, title: metadata.title, createdAt: metadata.createdAt, status: metadata.status, folderId: metadata.folderId ?? null, sortIndex: metadata.sortIndex, starred: metadata.starred });
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add bookmark storage methods and propagate starred in listPapers"
```

---

## Chunk 2: API Routes

### Task 3: Update PATCH Endpoint for Starred

**Files:**
- Modify: `src/app/api/paper/[id]/route.ts:49-84`

- [ ] **Step 1: Add `starred` handling in PATCH handler**

Insert after the `sortIndex` handling block (after line 76), before the empty check:

```typescript
  if (body.starred !== undefined) {
    if (typeof body.starred !== 'boolean') {
      return createErrorResponse('VALIDATION_ERROR', 'starred must be a boolean');
    }
    updates.starred = body.starred;
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/paper/[id]/route.ts
git commit -m "feat: handle starred field in paper PATCH endpoint"
```

---

### Task 4: Create Bookmarks API Route

**Files:**
- Create: `src/app/api/paper/[id]/bookmarks/route.ts`

- [ ] **Step 1: Create the bookmarks route file**

```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import type { Bookmark } from '@/types';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const bookmarks = await storage.getBookmarks(id);
  // Sort by page number
  bookmarks.sort((a, b) => a.page - b.page);
  return NextResponse.json(bookmarks);
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const body = await request.json();

  // Validate page
  if (typeof body.page !== 'number' || body.page < 1) {
    return createErrorResponse('VALIDATION_ERROR', 'page must be a positive number');
  }

  const bookmarks = await storage.getBookmarks(id);

  // Check if bookmark already exists for this page (one per page)
  const existingIndex = bookmarks.findIndex(b => b.page === body.page);
  if (existingIndex !== -1) {
    // Return existing bookmark instead of creating duplicate
    return NextResponse.json(bookmarks[existingIndex]);
  }

  const now = new Date().toISOString();
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    page: body.page,
    ...(body.label ? { label: body.label } : {}),
    createdAt: now,
  };

  bookmarks.push(bookmark);
  bookmarks.sort((a, b) => a.page - b.page);
  await storage.saveBookmarks(id, bookmarks);
  return NextResponse.json(bookmark, { status: 201 });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const body = await request.json();
  if (!body.id) {
    return createErrorResponse('VALIDATION_ERROR', 'bookmark id is required');
  }

  const bookmarks = await storage.getBookmarks(id);
  const index = bookmarks.findIndex(b => b.id === body.id);
  if (index === -1) {
    return createErrorResponse('BOOKMARK_NOT_FOUND', 'Bookmark not found');
  }

  // Only update label
  if (body.label !== undefined) {
    if (body.label) {
      bookmarks[index].label = body.label;
    } else {
      delete bookmarks[index].label;
    }
  }

  await storage.saveBookmarks(id, bookmarks);
  return NextResponse.json(bookmarks[index]);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const url = new URL(request.url);
  const bookmarkId = url.searchParams.get('bookmarkId');
  if (!bookmarkId) {
    return createErrorResponse('VALIDATION_ERROR', 'bookmarkId query param is required');
  }

  const bookmarks = await storage.getBookmarks(id);
  const index = bookmarks.findIndex(b => b.id === bookmarkId);
  if (index === -1) {
    return createErrorResponse('BOOKMARK_NOT_FOUND', 'Bookmark not found');
  }

  const updated = bookmarks.filter(b => b.id !== bookmarkId);
  await storage.saveBookmarks(id, updated);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/paper/[id]/bookmarks/route.ts
git commit -m "feat: add bookmarks CRUD API route"
```

---

## Chunk 3: Home Page - Paper Starring

### Task 5: Add Star Icon to PaperRow

**Files:**
- Modify: `src/components/paper-row.tsx`

- [ ] **Step 1: Add `onToggleStar` prop and star icon**

Replace the entire file with:

```typescript
'use client';

import type { PaperListItem } from '@/types';
import { formatRelativeTime } from '@/lib/format';

interface PaperRowProps {
  paper: PaperListItem;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onToggleStar?: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  analyzed: { label: '✓ Analyzed', className: 'analyzed' },
  pending: { label: 'Pending', className: 'pending' },
  parsing: { label: 'Parsing...', className: 'parsing' },
  analyzing: { label: 'Analyzing...', className: 'analyzing' },
  error: { label: 'Error', className: 'error' },
};

export function PaperRow({ paper, isActive, onClick, onDoubleClick, onToggleStar }: PaperRowProps) {
  const status = statusConfig[paper.status] || statusConfig.pending;
  const isStarred = paper.starred === true;

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar?.();
  };

  return (
    <div
      data-paper-id={paper.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="cursor-pointer rounded-lg transition-colors"
      style={{
        padding: '10px',
        marginBottom: '2px',
        background: isActive ? 'var(--accent-subtle)' : isStarred ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
        border: isActive ? '1px solid rgba(157,157,181,0.08)' : '1px solid transparent',
      }}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={handleStarClick}
          className="flex-shrink-0 mt-0.5 cursor-pointer"
          style={{ fontSize: '15px', color: isStarred ? 'var(--amber)' : 'var(--text-tertiary)', opacity: isStarred ? 1 : 0.4 }}
          title={isStarred ? 'Remove from starred' : 'Add to starred'}
        >
          {isStarred ? '★' : '☆'}
        </button>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
            {paper.title}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
            {formatRelativeTime(paper.createdAt)}
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
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/paper-row.tsx
git commit -m "feat: add star icon to PaperRow"
```

---

### Task 6: Add Starred Filter and Toggle Handler to Home Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add `filterStarred` state**

Add after `filterStatus` state (around line 17):

```typescript
  const [filterStarred, setFilterStarred] = useState(false);
```

- [ ] **Step 2: Add `handleToggleStar` handler**

Add after `handleRename` function (around line 87):

```typescript
  const handleToggleStar = async (paperId: string) => {
    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;
    const newStarred = !paper.starred;
    // Optimistic update
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, starred: newStarred } : p));
    await fetch(`/api/paper/${paperId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: newStarred }),
    });
  };
```

- [ ] **Step 3: Update filter logic**

Modify the `filtered` variable (around line 90) to include starred filter:

```typescript
  const filtered = papers.filter(p => {
    if (selectedFolderId && p.folderId !== selectedFolderId) return false;
    if (filterStatus === 'analyzed' && p.status !== 'analyzed') return false;
    if (filterStatus === 'pending' && !['pending', 'parsing', 'analyzing'].includes(p.status)) return false;
    if (filterStatus === 'error' && p.status !== 'error') return false;
    if (filterStarred && !p.starred) return false;
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
```

- [ ] **Step 4: Add Starred filter button**

Add after the filter buttons loop (after line 260), inside the same div:

```typescript
          <button
            onClick={() => setFilterStarred(!filterStarred)}
            className="cursor-pointer rounded-full"
            style={{
              padding: '3px 9px', fontSize: '10px',
              background: filterStarred ? 'var(--amber-subtle)' : 'var(--glass)',
              color: filterStarred ? 'var(--amber)' : 'var(--text-tertiary)',
              border: filterStarred ? '1px solid var(--amber)' : '1px solid var(--glass-border)',
            }}
          >
            ★ Starred
          </button>
```

- [ ] **Step 5: Pass `onToggleStar` to PaperRow**

Update the PaperRow component usage (around line 293):

```typescript
          {filtered.map(paper => (
            <PaperRow
              key={paper.id}
              paper={paper}
              isActive={paper.id === selectedPaperId}
              onClick={() => setSelectedPaperId(paper.id)}
              onDoubleClick={() => router.push(`/paper/${paper.id}`)}
              onToggleStar={() => handleToggleStar(paper.id)}
            />
          ))}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add starred filter and toggle handler to home page"
```

---

### Task 7: Add Star Icon to PreviewPanel

**Files:**
- Modify: `src/components/preview-panel.tsx`

- [ ] **Step 1: Add `onToggleStar` prop**

Update the interface (lines 8-15):

```typescript
interface PreviewPanelProps {
  paper: PaperListItem | null;
  onDelete?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onMovePaper?: (paperId: string, folderId: string | null) => void;
  onRename?: (id: string, title: string) => Promise<void>;
  onToggleStar?: (id: string) => void;
  folders?: { id: string; name: string }[];
}
```

- [ ] **Step 2: Add star icon to header**

Replace the header section (lines 76-117) with:

```typescript
    <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto" style={{ padding: '20px' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={() => onToggleStar?.(paper.id)}
            className="flex-shrink-0 cursor-pointer mt-1"
            style={{ fontSize: '20px', color: paper.starred ? 'var(--amber)' : 'var(--text-tertiary)' }}
            title={paper.starred ? 'Remove from starred' : 'Add to starred'}
          >
            {paper.starred ? '★' : '☆'}
          </button>
          <div className="min-w-0">
            {isRenaming ? (
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={async () => {
                  const trimmed = renameValue.trim();
                  if (trimmed && trimmed !== paper.title && onRename) {
                    await onRename(paper.id, trimmed);
                  }
                  setIsRenaming(false);
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = renameValue.trim();
                    if (trimmed && trimmed !== paper.title && onRename) {
                      await onRename(paper.id, trimmed);
                    }
                    setIsRenaming(false);
                  } else if (e.key === 'Escape') {
                    setIsRenaming(false);
                  }
                }}
                maxLength={200}
                className="w-full rounded-md px-2 py-1 outline-none"
                style={{
                  fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)',
                  background: 'var(--surface)', border: '2px solid var(--accent)',
                  boxShadow: '0 0 0 2px var(--accent-subtle)',
                }}
              />
            ) : (
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, letterSpacing: '-0.2px' }}>{paper.title}</div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Added {new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Update prop destructuring**

Update line 17:

```typescript
export function PreviewPanel({ paper, onDelete, onAnalyze, onMovePaper, onRename, onToggleStar, folders }: PreviewPanelProps) {
```

- [ ] **Step 4: Pass `onToggleStar` from home page**

Update PreviewPanel usage in `src/app/page.tsx` (around line 307):

```typescript
        <PreviewPanel
          paper={selectedPaper}
          onDelete={handleDelete}
          onMovePaper={handleMovePaper}
          onRename={handleRename}
          onToggleStar={handleToggleStar}
          folders={folders}
        />
```

- [ ] **Step 5: Commit**

```bash
git add src/components/preview-panel.tsx src/app/page.tsx
git commit -m "feat: add star icon to PreviewPanel"
```

---

## Chunk 4: Paper Detail Page - PDF Page Bookmarks

### Task 8: Create BookmarksPanel Component

**Files:**
- Create: `src/components/bookmarks-panel.tsx`

- [ ] **Step 1: Create the BookmarksPanel component**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Bookmark } from '@/types';
import { formatRelativeTime } from '@/lib/format';

interface BookmarksPanelProps {
  paperId: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onBookmarksChange?: () => void;
}

export function BookmarksPanel({ paperId, currentPage, onPageChange, onBookmarksChange }: BookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks`);
      if (res.ok) {
        const data: Bookmark[] = await res.json();
        setBookmarks(data);
      }
    } catch { /* ignore */ }
  }, [paperId]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const handleDelete = async (bookmarkId: string) => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks?bookmarkId=${bookmarkId}`, { method: 'DELETE' });
      if (res.ok) {
        setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
        onBookmarksChange?.();
      }
    } catch { /* ignore */ }
  };

  const handleEdit = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setEditValue(bookmark.label || '');
  };

  const handleSaveEdit = async (bookmarkId: string) => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookmarkId, label: editValue || null }),
      });
      if (res.ok) {
        setBookmarks(prev => prev.map(b => b.id === bookmarkId ? { ...b, label: editValue || undefined } : b));
        setEditingId(null);
        setEditValue('');
        onBookmarksChange?.();
      }
    } catch { /* ignore */ }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleJumpToPage = (page: number) => {
    onPageChange(page);
  };

  const handleAddForCurrentPage = async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: currentPage }),
      });
      if (res.ok) {
        const newBookmark: Bookmark = await res.json();
        setBookmarks(prev => {
          const exists = prev.some(b => b.page === newBookmark.page);
          if (exists) return prev;
          const updated = [...prev, newBookmark].sort((a, b) => a.page - b.page);
          return updated;
        });
        onBookmarksChange?.();
      }
    } catch { /* ignore */ }
  };

  const currentPageHasBookmark = bookmarks.some(b => b.page === currentPage);

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-tertiary)', padding: '24px' }}>
        <div style={{ fontSize: '28px' }}>🔖</div>
        <div style={{ fontSize: '12px', textAlign: 'center' }}>No bookmarks yet</div>
        <button
          onClick={handleAddForCurrentPage}
          className="cursor-pointer rounded-lg text-xs font-medium"
          style={{ padding: '6px 12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
        >
          + Bookmark current page
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px' }}>
        {bookmarks.map(bookmark => (
          <div
            key={bookmark.id}
            onClick={() => handleJumpToPage(bookmark.page)}
            className="cursor-pointer rounded-lg transition-colors"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 8px',
              marginBottom: '6px',
              background: bookmark.page === currentPage ? 'rgba(251, 191, 36, 0.12)' : 'var(--glass)',
              border: bookmark.page === currentPage ? '1px solid var(--amber)' : '1px solid var(--glass-border)',
            }}
          >
            <div
              className="flex-shrink-0"
              style={{
                minWidth: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: bookmark.page === currentPage ? 'var(--amber-subtle)' : 'var(--surface-hover)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: bookmark.page === currentPage ? 'var(--amber)' : 'var(--text-secondary)',
              }}
            >
              P{bookmark.page}
            </div>
            <div className="flex-1 min-w-0">
              {editingId === bookmark.id ? (
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => handleSaveEdit(bookmark.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveEdit(bookmark.id);
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  className="w-full rounded px-2 py-1 outline-none"
                  style={{ fontSize: '13px', background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }}
                  placeholder="Add a note..."
                />
              ) : (
                <div
                  style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}
                  onDoubleClick={(e) => { e.stopPropagation(); handleEdit(bookmark); }}
                >
                  {bookmark.label || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No label</span>}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Page {bookmark.page} · {formatRelativeTime(bookmark.createdAt)}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(bookmark.id); }}
              className="flex-shrink-0 cursor-pointer opacity-40 hover:opacity-100"
              style={{ fontSize: '16px', color: 'var(--text-tertiary)', padding: '2px' }}
              title="Delete bookmark"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {!currentPageHasBookmark && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleAddForCurrentPage}
            className="w-full cursor-pointer rounded-lg text-xs"
            style={{ padding: '8px', border: '1px dashed var(--glass-border)', background: 'transparent', color: 'var(--text-tertiary)' }}
          >
            + Add Bookmark for Current Page
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bookmarks-panel.tsx
git commit -m "feat: create BookmarksPanel component"
```

---

### Task 9: Add Bookmark Button to PdfViewer Toolbar

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

- [ ] **Step 1: Add bookmark-related props**

Update the interface (lines 10-14):

```typescript
interface PdfViewerProps {
  url: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  bookmarks?: Bookmark[];
  onAddBookmark?: (page: number, label?: string) => void;
  onBookmarksChange?: () => void;
}
```

- [ ] **Step 2: Add Bookmark import at top**

Add after line 1:

```typescript
import type { Bookmark } from '@/types';
```

- [ ] **Step 3: Add bookmark state and handlers inside component**

Add after the `highlightRects` state (around line 47):

```typescript
  const [showBookmarkPopover, setShowBookmarkPopover] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
```

- [ ] **Step 4: Add bookmark handlers**

Add after the `handlePageInputCancel` callback (around line 164):

```typescript
  const currentPageHasBookmark = (bookmarks || []).some(b => b.page === page);

  const handleBookmarkClick = () => {
    if (currentPageHasBookmark) {
      // If page has bookmark, trigger scroll to bookmarks panel (parent handles this)
      onBookmarksChange?.();
    } else {
      setShowBookmarkPopover(true);
      setBookmarkLabel('');
    }
  };

  const handleAddBookmarkConfirm = () => {
    onAddBookmark?.(page, bookmarkLabel || undefined);
    setShowBookmarkPopover(false);
    setBookmarkLabel('');
  };

  const handleAddBookmarkCancel = () => {
    setShowBookmarkPopover(false);
    setBookmarkLabel('');
  };
```

- [ ] **Step 5: Add bookmark button to toolbar**

Add after the zoom buttons div, before the shortcuts button (around line 630):

```typescript
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={handleBookmarkClick}
            className="px-2 py-1 text-xs rounded-md transition-colors"
            style={{
              color: currentPageHasBookmark ? 'var(--amber)' : 'var(--text-tertiary)',
              background: currentPageHasBookmark ? 'var(--amber-subtle)' : 'var(--surface-hover)',
              border: currentPageHasBookmark ? '1px solid var(--amber)' : '1px solid transparent',
            }}
            title={currentPageHasBookmark ? 'Bookmarked' : 'Add bookmark'}
          >
            🔖
          </button>
          {showBookmarkPopover && (
            <div
              className="absolute right-0 top-full mt-1 rounded-lg z-20"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '12px', minWidth: '200px' }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Add Bookmark (Page {page})
              </div>
              <input
                autoFocus
                type="text"
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddBookmarkConfirm();
                  if (e.key === 'Escape') handleAddBookmarkCancel();
                }}
                placeholder="Add a note..."
                className="w-full rounded-md px-2 py-1.5 outline-none"
                style={{ fontSize: '12px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleAddBookmarkCancel}
                  className="flex-1 rounded-md cursor-pointer"
                  style={{ padding: '6px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBookmarkConfirm}
                  className="flex-1 rounded-md cursor-pointer"
                  style={{ padding: '6px', fontSize: '11px', background: 'var(--text-primary)', border: 'none', color: 'var(--bg)' }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

- [ ] **Step 6: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add bookmark button and popover to PdfViewer toolbar"
```

---

### Task 10: Add Bookmark Markers to Progress Bar

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

- [ ] **Step 1: Add bookmark markers to progress bar**

Find the progress bar container (around line 704, the div with `ref={progressBarRef}`). Add bookmark markers inside, after the drag indicator div (around line 769):

```typescript
          {/* Bookmark markers on progress bar */}
          {(bookmarks || []).map(bookmark => {
            const position = totalPages > 1 ? ((bookmark.page - 1) / (totalPages - 1)) * 100 : 0;
            return (
              <div
                key={bookmark.id}
                className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
                style={{
                  left: `${position}%`,
                  width: '3px',
                  height: '12px',
                  background: 'var(--amber)',
                  borderRadius: '2px',
                  zIndex: 5,
                }}
                title={`P${bookmark.page}${bookmark.label ? `: ${bookmark.label}` : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goToPage(bookmark.page);
                }}
              />
            );
          })}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add bookmark markers to PDF progress bar"
```

---

### Task 10.5: Add Right-Click Context Menu for Bookmarks

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

- [ ] **Step 1: Add context menu state**

Add after the `bookmarkLabel` state (around line 47):

```typescript
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; page: number } | null>(null);
```

- [ ] **Step 2: Add context menu handlers**

Add after the `handleAddBookmarkCancel` function (around line 164):

```typescript
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, page });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleContextMenuAddBookmark = () => {
    if (contextMenu) {
      setShowBookmarkPopover(true);
      setBookmarkLabel('');
    }
    setContextMenu(null);
  };

  const handleContextMenuEditBookmark = () => {
    // Find the bookmark for current page and trigger edit in BookmarksPanel
    onBookmarksChange?.();
    setContextMenu(null);
  };

  const handleContextMenuRemoveBookmark = async () => {
    const existingBookmark = (bookmarks || []).find(b => b.page === page);
    if (existingBookmark && existingBookmark.id) {
      // Call parent to delete - we need a new prop for this
      // For now, trigger the bookmarks panel to show
      onBookmarksChange?.();
    }
    setContextMenu(null);
  };

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);
```

- [ ] **Step 3: Add `onRemoveBookmark` prop**

Update the interface (lines 10-14):

```typescript
interface PdfViewerProps {
  url: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  bookmarks?: Bookmark[];
  onAddBookmark?: (page: number, label?: string) => void;
  onRemoveBookmark?: (bookmarkId: string) => void;
  onBookmarksChange?: () => void;
}
```

- [ ] **Step 4: Add `onContextMenu` to canvas wrapper**

Find the canvas wrapper div (around line 667, the one with `ref={scrollContainerRef}`). Add `onContextMenu`:

```typescript
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4" style={{ background: 'var(--bg-deep)' }}
        onContextMenu={handleContextMenu}
      >
```

- [ ] **Step 5: Add context menu component**

Add before the closing `</div>` of the main container (around line 770, after the progress bar section):

```typescript
      {/* Context Menu for Bookmarks */}
      {contextMenu && (
        <div
          className="fixed rounded-lg z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: '160px',
            padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {currentPageHasBookmark ? (
            <>
              <button
                onClick={handleContextMenuEditBookmark}
                className="w-full text-left cursor-pointer"
                style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}
              >
                Edit Bookmark
              </button>
              <button
                onClick={handleContextMenuRemoveBookmark}
                className="w-full text-left cursor-pointer"
                style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--rose)' }}
              >
                Remove Bookmark
              </button>
            </>
          ) : (
            <button
              onClick={handleContextMenuAddBookmark}
              className="w-full text-left cursor-pointer"
              style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}
            >
              Add Bookmark Here
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 6: Update `handleContextMenuRemoveBookmark` to use the new prop**

Replace the handler from Step 2:

```typescript
  const handleContextMenuRemoveBookmark = () => {
    const existingBookmark = (bookmarks || []).find(b => b.page === page);
    if (existingBookmark) {
      onRemoveBookmark?.(existingBookmark.id);
    }
    setContextMenu(null);
  };
```

- [ ] **Step 7: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add right-click context menu for bookmarks in PDF viewer"
```

---

### Task 11: Integrate Bookmarks Tab into Paper Detail Page

**Files:**
- Modify: `src/app/paper/[id]/page.tsx`

- [ ] **Step 1: Add BookmarksPanel import**

Add to imports (around line 7):

```typescript
import { BookmarksPanel } from '@/components/bookmarks-panel';
```

- [ ] **Step 2: Add Bookmark type import**

Add `Bookmark` to the type import (line 15):

```typescript
import type { PaperAnalysis, ChatMessage, ChatSessionMeta, Bookmark } from '@/types';
```

- [ ] **Step 3: Add bookmark state**

Add after `noteCount` state (around line 38):

```typescript
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
```

- [ ] **Step 4: Update `activeTab` type**

Change line 31:

```typescript
  const [activeTab, setActiveTab] = useState<'analysis' | 'notes' | 'bookmarks'>('analysis');
```

- [ ] **Step 5: Add fetchBookmarks function**

Add after the note count fetch effect (around line 94):

```typescript
  // Fetch bookmarks
  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks`);
      if (res.ok) {
        const data: Bookmark[] = await res.json();
        setBookmarks(data);
      }
    } catch { /* ignore */ }
  }, [paperId]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);
```

- [ ] **Step 6: Add handleAddBookmark function**

Add after `fetchBookmarks`:

```typescript
  const handleAddBookmark = useCallback(async (page: number, label?: string) => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, label }),
      });
      if (res.ok) {
        fetchBookmarks();
      }
    } catch { /* ignore */ }
  }, [paperId, fetchBookmarks]);
```

- [ ] **Step 7: Add Bookmarks tab to tab bar**

Add after the Notes button (around line 547):

```typescript
              <button
                onClick={() => setActiveTab('bookmarks')}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={{
                  background: activeTab === 'bookmarks' ? 'var(--accent-subtle)' : 'transparent',
                  color: activeTab === 'bookmarks' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: activeTab === 'bookmarks' ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                Bookmarks
                {bookmarks.length > 0 && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--glass)', color: 'var(--text-tertiary)' }}>
                    {bookmarks.length}
                  </span>
                )}
              </button>
```

- [ ] **Step 8: Add BookmarksPanel to tab content**

Add in the tab content section (after NotesPanel, around line 568):

```typescript
              {activeTab === 'bookmarks' && (
                <BookmarksPanel
                  paperId={paperId}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onBookmarksChange={fetchBookmarks}
                />
              )}
```

- [ ] **Step 9: Add `handleRemoveBookmark` function**

Add after `handleAddBookmark`:

```typescript
  const handleRemoveBookmark = useCallback(async (bookmarkId: string) => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks?bookmarkId=${bookmarkId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchBookmarks();
      }
    } catch { /* ignore */ }
  }, [paperId, fetchBookmarks]);
```

- [ ] **Step 10: Pass bookmark props to PdfViewer**

Update the PdfViewer component (around line 488):

```typescript
          <PdfViewer
            url={`/api/paper/${paperId}/pdf`}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            bookmarks={bookmarks}
            onAddBookmark={handleAddBookmark}
            onRemoveBookmark={handleRemoveBookmark}
            onBookmarksChange={() => setActiveTab('bookmarks')}
          />
```

- [ ] **Step 11: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: integrate Bookmarks tab into paper detail page"
```

---

### Task 12: Final Integration Test

- [ ] **Step 1: Run the development server**

```bash
npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. Home page:
   - [ ] Star icon visible on paper rows
   - [ ] Click star toggles starred state
   - [ ] Starred papers get warm background
   - [ ] "★ Starred" filter button works
   - [ ] Preview panel shows star icon

2. Paper detail page:
   - [ ] Bookmarks tab visible
   - [ ] Bookmark button in PDF toolbar works
   - [ ] Click bookmark button opens popover
   - [ ] Add bookmark with/without label works
   - [ ] Bookmark markers appear on progress bar
   - [ ] Click marker jumps to page
   - [ ] Bookmarks panel shows bookmarks
   - [ ] Click bookmark jumps to page
   - [ ] Double-click label enters edit mode
   - [ ] Delete bookmark works
   - [ ] Right-click on PDF shows context menu
   - [ ] "Add Bookmark Here" option appears when page has no bookmark
   - [ ] "Edit Bookmark" and "Remove Bookmark" options appear when page has bookmark
   - [ ] Remove Bookmark from context menu deletes the bookmark

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add .
git commit -m "fix: resolve bookmark feature issues"
```

---

## Summary

This plan implements:
- Paper-level starring with UI on home page (PaperRow, filter, PreviewPanel)
- PDF page-level bookmarks with toolbar button, progress bar markers, and Bookmarks tab
- API routes for bookmarks CRUD
- Storage methods for bookmarks

Total estimated tasks: 13
Total estimated commits: 12