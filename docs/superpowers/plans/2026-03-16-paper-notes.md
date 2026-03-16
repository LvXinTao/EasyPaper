# Paper Notes Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent notes feature to each paper — users can create, edit, and delete notes with Markdown content, fixed tags, and optional page references, displayed in a new "Notes" tab in the right-side panel.

**Architecture:** File-based storage (notes.json per paper), REST API route for CRUD, three new React components (NotesPanel, NotesList, NoteEditor) added as a tab alongside the existing AnalysisPanel. Notes are lazy-loaded when the tab is first activated.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, react-markdown (existing), file-based JSON storage (existing pattern)

**Spec:** `docs/superpowers/specs/2026-03-16-paper-notes-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `NoteTag` and `Note` types |
| Modify | `src/lib/errors.ts` | Add `NOTE_NOT_FOUND` error code |
| Modify | `src/lib/storage.ts` | Add `getNotes()` and `saveNotes()` functions |
| Create | `src/app/api/paper/[id]/notes/route.ts` | GET/POST/PUT/DELETE API handlers |
| Create | `src/components/notes-panel.tsx` | Container: manages notes state, list/edit view switching |
| Create | `src/components/notes-list.tsx` | Note card list with tag pills and page links |
| Create | `src/components/note-editor.tsx` | Edit form: title, tags, page, Markdown editor/preview |
| Modify | `src/app/paper/[id]/page.tsx` | Add top-level "Analysis \| Notes" tab bar, wire NotesPanel |
| Create | `__tests__/lib/storage-notes.test.ts` | Storage layer tests for notes |
| Create | `__tests__/api/notes.test.ts` | API route tests for notes CRUD |

---

## Chunk 1: Data Layer (Types + Storage + Tests)

### Task 1: Add Note types and NOTE_NOT_FOUND error code

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/errors.ts`

- [ ] **Step 1: Add NoteTag and Note types to the types file**

Append the following types at the end of `src/types/index.ts` (after the `PaperData` interface):

```typescript
export type NoteTag = 'important' | 'question' | 'todo' | 'idea' | 'summary';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: NoteTag[];
  page?: number;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Add NOTE_NOT_FOUND to the ErrorCode type and STATUS_MAP in `src/lib/errors.ts`**

Add `'NOTE_NOT_FOUND'` to the `ErrorCode` union type, and add `NOTE_NOT_FOUND: 404` to the `STATUS_MAP` object.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/errors.ts
git commit -m "feat(notes): add NoteTag, Note types and NOTE_NOT_FOUND error code"
```

---

### Task 2: Add storage functions for notes

**Files:**
- Modify: `src/lib/storage.ts`
- Create: `__tests__/lib/storage-notes.test.ts`

- [ ] **Step 1: Write failing tests for getNotes and saveNotes**

Create `__tests__/lib/storage-notes.test.ts`:

```typescript
import { storage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Note } from '@/types';

describe('storage notes', () => {
  let testDir: string;
  let originalDataDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'easypaper-test-'));
    originalDataDir = process.env.DATA_DIR || '';
    process.env.DATA_DIR = testDir;
  });

  afterEach(async () => {
    process.env.DATA_DIR = originalDataDir;
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('getNotes', () => {
    it('returns empty array when no notes file exists', async () => {
      await storage.createPaperDir('test-no-notes');
      const notes = await storage.getNotes('test-no-notes');
      expect(notes).toEqual([]);
    });
  });

  describe('saveNotes / getNotes', () => {
    it('round-trips notes through JSON', async () => {
      const paperId = 'test-notes';
      await storage.createPaperDir(paperId);
      const notes: Note[] = [
        {
          id: 'note-1',
          title: 'Test Note',
          content: '# Hello\n\nWorld',
          tags: ['important', 'summary'],
          page: 3,
          createdAt: '2026-03-16T10:00:00Z',
          updatedAt: '2026-03-16T10:00:00Z',
        },
      ];
      await storage.saveNotes(paperId, notes);
      const loaded = await storage.getNotes(paperId);
      expect(loaded).toEqual(notes);
    });

    it('overwrites existing notes', async () => {
      const paperId = 'test-overwrite';
      await storage.createPaperDir(paperId);
      const first: Note[] = [{ id: '1', title: 'A', content: '', tags: [], createdAt: '', updatedAt: '' }];
      const second: Note[] = [{ id: '2', title: 'B', content: '', tags: ['idea'], createdAt: '', updatedAt: '' }];
      await storage.saveNotes(paperId, first);
      await storage.saveNotes(paperId, second);
      const loaded = await storage.getNotes(paperId);
      expect(loaded).toEqual(second);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/storage-notes.test.ts --verbose`
Expected: FAIL — `storage.getNotes is not a function`

- [ ] **Step 3: Implement getNotes and saveNotes in storage.ts**

Add the import for `Note` type at the top of `src/lib/storage.ts`:

```typescript
import type { PaperMetadata, PaperAnalysis, ChatHistory, PaperListItem, Note } from '@/types';
```

Add the following two methods inside the `storage` object (after the `getChatHistory` method):

```typescript
  async getNotes(paperId: string): Promise<Note[]> {
    try {
      const filePath = path.join(paperDir(paperId), 'notes.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return []; }
  },
  async saveNotes(paperId: string, notes: Note[]): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'notes.json');
    await fs.writeFile(filePath, JSON.stringify(notes, null, 2));
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/storage-notes.test.ts --verbose`
Expected: All 3 tests PASS

- [ ] **Step 5: Run full test suite to check no regressions**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts __tests__/lib/storage-notes.test.ts
git commit -m "feat(notes): add getNotes/saveNotes storage functions with tests"
```

---

### Task 3: Add notes API route

**Files:**
- Create: `src/app/api/paper/[id]/notes/route.ts`
- Create: `__tests__/api/notes.test.ts`

- [ ] **Step 1: Write failing tests for the notes API**

Create `__tests__/api/notes.test.ts`:

```typescript
import { GET, POST, PUT, DELETE } from '@/app/api/paper/[id]/notes/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getNotes: jest.fn(),
    saveNotes: jest.fn(),
  },
}));

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/paper/[id]/notes', () => {
  it('returns notes array', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const notes = [{ id: 'n1', title: 'Note 1', content: 'text', tags: [], createdAt: '', updatedAt: '' }];
    (storage.getNotes as jest.Mock).mockResolvedValue(notes);
    const request = new Request('http://localhost/api/paper/p1/notes');
    const response = await GET(request, makeContext('p1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual(notes);
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/paper/missing/notes');
    const response = await GET(request, makeContext('missing'));
    expect(response.status).toBe(404);
  });
});

describe('POST /api/paper/[id]/notes', () => {
  it('creates a new note with server-generated fields', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue([]);
    (storage.saveNotes as jest.Mock).mockResolvedValue(undefined);
    const request = new Request('http://localhost/api/paper/p1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Note', content: '# Hi', tags: ['important'], page: 5 }),
    });
    const response = await POST(request, makeContext('p1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.title).toBe('New Note');
    expect(data.content).toBe('# Hi');
    expect(data.tags).toEqual(['important']);
    expect(data.page).toBe(5);
    expect(data.id).toBeDefined();
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
    expect(storage.saveNotes).toHaveBeenCalledWith('p1', [data]);
  });
});

describe('PUT /api/paper/[id]/notes', () => {
  it('updates an existing note preserving createdAt', async () => {
    const existing = {
      id: 'n1', title: 'Old', content: 'old', tags: [] as string[],
      createdAt: '2026-03-16T10:00:00Z', updatedAt: '2026-03-16T10:00:00Z',
    };
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue([existing]);
    (storage.saveNotes as jest.Mock).mockResolvedValue(undefined);
    const request = new Request('http://localhost/api/paper/p1/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'n1', title: 'Updated', content: 'new', tags: ['idea'] }),
    });
    const response = await PUT(request, makeContext('p1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.title).toBe('Updated');
    expect(data.createdAt).toBe('2026-03-16T10:00:00Z');
    expect(data.updatedAt).not.toBe('2026-03-16T10:00:00Z');
  });

  it('returns 404 when note id not found', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/paper/p1/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'nonexistent', title: 'X', content: '', tags: [] }),
    });
    const response = await PUT(request, makeContext('p1'));
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/paper/[id]/notes', () => {
  it('deletes a note by id', async () => {
    const existing = [
      { id: 'n1', title: 'A', content: '', tags: [], createdAt: '', updatedAt: '' },
      { id: 'n2', title: 'B', content: '', tags: [], createdAt: '', updatedAt: '' },
    ];
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue(existing);
    (storage.saveNotes as jest.Mock).mockResolvedValue(undefined);
    const request = new Request('http://localhost/api/paper/p1/notes?noteId=n1', { method: 'DELETE' });
    const response = await DELETE(request, makeContext('p1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(storage.saveNotes).toHaveBeenCalledWith('p1', [existing[1]]);
  });

  it('returns 404 when noteId not found', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/paper/p1/notes?noteId=missing', { method: 'DELETE' });
    const response = await DELETE(request, makeContext('p1'));
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api/notes.test.ts --verbose`
Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement the notes API route**

Create `src/app/api/paper/[id]/notes/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import type { Note } from '@/types';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const notes = await storage.getNotes(id);
  return NextResponse.json(notes);
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const body = await request.json();
  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    title: body.title || '',
    content: body.content || '',
    tags: body.tags || [],
    ...(body.page != null && { page: body.page }),
    createdAt: now,
    updatedAt: now,
  };
  const notes = await storage.getNotes(id);
  notes.push(note);
  await storage.saveNotes(id, notes);
  return NextResponse.json(note);
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const body = await request.json();
  const notes = await storage.getNotes(id);
  const index = notes.findIndex((n) => n.id === body.id);
  if (index === -1) return createErrorResponse('NOTE_NOT_FOUND', 'Note not found');
  const existing = notes[index];
  const updated: Note = {
    ...existing,
    title: body.title ?? existing.title,
    content: body.content ?? existing.content,
    tags: body.tags ?? existing.tags,
    ...(body.page !== undefined ? { page: body.page ?? undefined } : {}),
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  notes[index] = updated;
  await storage.saveNotes(id, notes);
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const url = new URL(request.url);
  const noteId = url.searchParams.get('noteId');
  const notes = await storage.getNotes(id);
  const index = notes.findIndex((n) => n.id === noteId);
  if (index === -1) return createErrorResponse('NOTE_NOT_FOUND', 'Note not found');
  notes.splice(index, 1);
  await storage.saveNotes(id, notes);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/api/notes.test.ts --verbose`
Expected: All 7 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/paper/[id]/notes/route.ts __tests__/api/notes.test.ts
git commit -m "feat(notes): add notes CRUD API route with tests"
```

---

## Chunk 2: Frontend Components

### Task 4: Create NotesList component

**Files:**
- Create: `src/components/notes-list.tsx`

- [ ] **Step 1: Create the NotesList component**

Create `src/components/notes-list.tsx`:

```typescript
'use client';

import type { Note, NoteTag } from '@/types';

const TAG_CONFIG: Record<NoteTag, { label: string; bg: string; text: string }> = {
  important: { label: '重要', bg: 'bg-red-500/20', text: 'text-red-400' },
  question: { label: '疑问', bg: 'bg-amber-500/20', text: 'text-amber-400' },
  todo: { label: '待办', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  idea: { label: '灵感', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  summary: { label: '总结', bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

interface NotesListProps {
  notes: Note[];
  onSelect: (note: Note) => void;
  onNew: () => void;
  onPageClick: (page: number) => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n/g, ' ')
    .trim();
}

export function NotesList({ notes, onSelect, onNew, onPageClick }: NotesListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
        <span className="text-sm text-slate-400">{notes.length} notes</span>
        <button
          onClick={onNew}
          className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-md hover:bg-indigo-600 transition-colors"
        >
          + New Note
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <svg className="w-10 h-10 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="text-sm">No notes yet</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelect(note)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-800 truncate flex-1 mr-2">
                  {note.title || 'Untitled'}
                </h3>
                {note.page != null && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPageClick(note.page!); }}
                    className="text-xs text-slate-400 hover:text-indigo-500 flex-shrink-0 transition-colors"
                  >
                    p.{note.page}
                  </button>
                )}
              </div>
              {note.content && (
                <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                  {stripMarkdown(note.content)}
                </p>
              )}
              {note.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {note.tags.map((tag) => {
                    const config = TAG_CONFIG[tag];
                    return (
                      <span
                        key={tag}
                        className={`${config.bg} ${config.text} px-2 py-0.5 rounded-full text-[11px]`}
                      >
                        {config.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/notes-list.tsx
git commit -m "feat(notes): add NotesList component"
```

---

### Task 5: Create NoteEditor component

**Files:**
- Create: `src/components/note-editor.tsx`

- [ ] **Step 1: Create the NoteEditor component**

Create `src/components/note-editor.tsx`:

```typescript
'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Note, NoteTag } from '@/types';

const TAG_OPTIONS: { key: NoteTag; label: string; bg: string; activeBg: string; text: string }[] = [
  { key: 'important', label: '重要', bg: 'border-slate-300', activeBg: 'bg-red-500/20 border-red-500/40', text: 'text-red-400' },
  { key: 'question', label: '疑问', bg: 'border-slate-300', activeBg: 'bg-amber-500/20 border-amber-500/40', text: 'text-amber-400' },
  { key: 'todo', label: '待办', bg: 'border-slate-300', activeBg: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-400' },
  { key: 'idea', label: '灵感', bg: 'border-slate-300', activeBg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-400' },
  { key: 'summary', label: '总结', bg: 'border-slate-300', activeBg: 'bg-purple-500/20 border-purple-500/40', text: 'text-purple-400' },
];

interface NoteEditorProps {
  note?: Note;
  defaultPage: number;
  onSave: (data: { title: string; content: string; tags: NoteTag[]; page?: number }) => void;
  onDelete?: () => void;
  onBack: () => void;
}

export function NoteEditor({ note, defaultPage, onSave, onDelete, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState<NoteTag[]>(note?.tags || []);
  const [pageStr, setPageStr] = useState(String(note?.page ?? defaultPage));
  const [previewMode, setPreviewMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleTag = (tag: NoteTag) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleSave = () => {
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    onSave({ title, content, tags, page: page && !isNaN(page) ? page : undefined });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
        <button onClick={onBack} className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
          ← Back to list
        </button>
        <div className="flex gap-2">
          {note && onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2.5 py-1 text-xs text-rose-500 border border-rose-300 rounded-md hover:bg-rose-50 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
          <span className="text-xs text-rose-700">Delete this note?</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-0.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(false); onDelete?.(); }}
              className="px-2 py-0.5 text-xs text-white bg-rose-500 rounded hover:bg-rose-600"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />

        {/* Page + Tags row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Page:</span>
            <input
              type="number"
              value={pageStr}
              onChange={(e) => setPageStr(e.target.value)}
              min={1}
              className="w-14 px-2 py-1 border border-slate-300 rounded text-xs text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div className="flex gap-1 flex-wrap flex-1">
            {TAG_OPTIONS.map((opt) => {
              const active = tags.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleTag(opt.key)}
                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                    active ? `${opt.activeBg} ${opt.text}` : `${opt.bg} text-slate-400`
                  }`}
                >
                  {active ? '✓ ' : ''}{opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content editor with Edit/Preview toggle */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setPreviewMode(false)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
                !previewMode ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Edit
              {!previewMode && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
                previewMode ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Preview
              {previewMode && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
            </button>
          </div>

          {previewMode ? (
            <div className="flex-1 overflow-y-auto p-3 prose prose-sm max-w-none text-slate-700">
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <p className="text-slate-400 italic">Nothing to preview</p>
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your notes in Markdown..."
              className="flex-1 min-h-[200px] p-3 text-sm text-slate-700 font-mono leading-relaxed resize-none border-0 focus:outline-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/note-editor.tsx
git commit -m "feat(notes): add NoteEditor component with Markdown edit/preview"
```

---

### Task 6: Create NotesPanel component

**Files:**
- Create: `src/components/notes-panel.tsx`

- [ ] **Step 1: Create the NotesPanel component**

Create `src/components/notes-panel.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { NotesList } from './notes-list';
import { NoteEditor } from './note-editor';
import type { Note, NoteTag } from '@/types';

interface NotesPanelProps {
  paperId: string;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function NotesPanel({ paperId, currentPage, onPageChange }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data: Note[] = await res.json();
      setNotes(data.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoaded(true);
    }
  }, [paperId]);

  useEffect(() => {
    if (!loaded) fetchNotes();
  }, [loaded, fetchNotes]);

  const handleNew = () => {
    setEditingNote(null);
    setView('edit');
  };

  const handleSelect = (note: Note) => {
    setEditingNote(note);
    setView('edit');
  };

  const handleSave = async (data: { title: string; content: string; tags: NoteTag[]; page?: number }) => {
    try {
      if (editingNote) {
        const res = await fetch(`/api/paper/${paperId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingNote.id, ...data }),
        });
        if (!res.ok) throw new Error('Failed to update note');
        const updated: Note = await res.json();
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        );
      } else {
        const res = await fetch(`/api/paper/${paperId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create note');
        const created: Note = await res.json();
        setNotes((prev) => [created, ...prev]);
      }
      setView('list');
      setEditingNote(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const handleDelete = async () => {
    if (!editingNote) return;
    try {
      const res = await fetch(`/api/paper/${paperId}/notes?noteId=${editingNote.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete note');
      setNotes((prev) => prev.filter((n) => n.id !== editingNote.id));
      setView('list');
      setEditingNote(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}
      {view === 'list' ? (
        <NotesList
          notes={notes}
          onSelect={handleSelect}
          onNew={handleNew}
          onPageClick={onPageChange}
        />
      ) : (
        <NoteEditor
          note={editingNote || undefined}
          defaultPage={currentPage}
          onSave={handleSave}
          onDelete={editingNote ? handleDelete : undefined}
          onBack={() => { setView('list'); setEditingNote(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/notes-panel.tsx
git commit -m "feat(notes): add NotesPanel container component"
```

---

## Chunk 3: Integration

### Task 7: Integrate NotesPanel into the paper detail page

**Files:**
- Modify: `src/app/paper/[id]/page.tsx`

- [ ] **Step 1: Add top-level tab state and import NotesPanel**

In `src/app/paper/[id]/page.tsx`, add the import at the top with the other imports:

```typescript
import { NotesPanel } from '@/components/notes-panel';
```

Add a new state variable after the existing state declarations (after `const [analysisError, setAnalysisError] = ...`):

```typescript
const [activePanel, setActivePanel] = useState<'analysis' | 'notes'>('analysis');
```

- [ ] **Step 2: Add the tab bar and conditionally render panels**

Replace the section between the error banner and the panel content (the `{/* Panel content */}` block) in the JSX. The area to replace starts after the `analysisError` banner and includes the panel content div.

Replace this block:

```tsx
          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            <AnalysisPanel
              analysis={displayAnalysis}
              isAnalyzing={isAnalyzing}
              analysisStep={analysisStep}
              analysisMessage={analysisMessage}
            />
          </div>
```

With:

```tsx
          {/* Top-level tab bar */}
          <div className="flex border-b border-slate-200 bg-white">
            <button
              onClick={() => setActivePanel('analysis')}
              className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
                activePanel === 'analysis' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Analysis
              {activePanel === 'analysis' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />
              )}
            </button>
            <button
              onClick={() => setActivePanel('notes')}
              className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
                activePanel === 'notes' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Notes
              {activePanel === 'notes' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />
              )}
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'analysis' ? (
              <AnalysisPanel
                analysis={displayAnalysis}
                isAnalyzing={isAnalyzing}
                analysisStep={analysisStep}
                analysisMessage={analysisMessage}
              />
            ) : (
              <NotesPanel
                paperId={paperId}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat(notes): integrate Notes tab into paper detail page"
```

---

### Task 8: Manual smoke test

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test the notes feature end-to-end**

Open a paper detail page in the browser and verify:

1. The right panel now shows "Analysis | Notes" tabs
2. Clicking "Notes" tab shows the notes panel with "0 notes" and "No notes yet" empty state
3. Clicking "+ New Note" opens the editor with the current PDF page pre-filled
4. Enter a title, write Markdown content, select some tags
5. Click Save → returns to list, note appears as a card
6. Click the note card → editor opens with all data populated
7. Modify and save → updates correctly
8. Click Delete → confirmation banner → confirm → note removed
9. If a note has a page number, clicking "p.X" in the list jumps the PDF
10. Switching back to "Analysis" tab shows the analysis content as before
11. All existing functionality (analyze, chat) still works

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(notes): address issues found during smoke testing"
```
