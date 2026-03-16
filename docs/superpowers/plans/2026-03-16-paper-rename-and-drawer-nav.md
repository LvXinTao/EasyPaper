# Paper Rename & Folder Navigation Drawer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline paper title renaming and a left-side drawer with multi-level folder navigation for organizing and switching between papers.

**Architecture:** Two independent features built bottom-up (types → storage → API → UI). Feature 1 (rename) adds `updateMetadata` to storage, a `PATCH` endpoint, and an `EditableTitle` component. Feature 2 (drawer) adds folder types/storage/APIs, then builds a `PaperDrawer` component with tree view, search, and context menus. The hamburger trigger is rendered by the paper detail page with fixed positioning to overlay the Navbar area.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5 (strict), Tailwind CSS 4, Jest 30

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Add `Folder` type, `folderId?` to `PaperMetadata` and `PaperListItem` |
| `src/lib/storage.ts` | Modify | Add `updateMetadata()`, `getFolders()`, `saveFolders()`, update `listPapers()` |
| `src/lib/errors.ts` | Modify | Add `FOLDER_NOT_FOUND` error code |
| `src/app/api/paper/[id]/route.ts` | Modify | Add `PATCH` handler for rename + move |
| `src/app/api/folders/route.ts` | Create | `GET` list folders, `POST` create folder |
| `src/app/api/folders/[id]/route.ts` | Create | `PATCH` rename folder, `DELETE` remove folder |
| `src/components/editable-title.tsx` | Create | Inline-editable title with save/cancel |
| `src/components/paper-drawer.tsx` | Create | Drawer shell: overlay, panel, slide animation, Esc close |
| `src/lib/format.ts` | Create | Shared `formatRelativeTime` utility (extracted from analysis-panel) |
| `src/components/folder-tree.tsx` | Create | Tree view: folders (expand/collapse) + papers, search filter |
| `src/components/context-menu.tsx` | Create | Generic context menu popover (shared by folder and paper menus) |
| `src/components/move-to-picker.tsx` | Create | Folder picker modal for moving papers |
| `src/app/paper/[id]/page.tsx` | Modify | Integrate EditableTitle, drawer state, hamburger button, PaperDrawer |
| `__tests__/lib/storage-folders.test.ts` | Create | Tests for folder storage + updateMetadata |
| `__tests__/api/paper-patch.test.ts` | Create | Tests for PATCH /api/paper/[id] |
| `__tests__/api/folders.test.ts` | Create | Tests for folder CRUD endpoints |

---

## Chunk 1: Paper Rename (Types, Storage, API, UI)

### Task 1: Add types and storage for paper rename

**Files:**
- Modify: `src/types/index.ts:1-10` (PaperMetadata)
- Modify: `src/lib/storage.ts:1-3,81-93`
- Create: `__tests__/lib/storage-folders.test.ts`

- [ ] **Step 1: Add `folderId` to `PaperMetadata` and `PaperListItem` types**

In `src/types/index.ts`, add `folderId` to `PaperMetadata` (after `status` on line 9, before the closing brace):

```ts
export interface PaperMetadata {
  id: string;
  title: string;
  filename: string;
  pages: number;
  createdAt: string;
  status: PaperStatus;
  folderId?: string | null;
}
```

And add `folderId` to `PaperListItem` (after line 68):

```ts
export interface PaperListItem {
  id: string;
  title: string;
  createdAt: string;
  status: PaperStatus;
  folderId?: string | null;
}
```

Also add the `Folder` type at the end of the file (before the `Note` types):

```ts
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}
```

- [ ] **Step 2: Add `Folder` import and `updateMetadata` to storage**

In `src/lib/storage.ts`, update the import line to include `Folder`:

```ts
import type { PaperMetadata, PaperAnalysis, ChatHistory, PaperListItem, Note, Folder } from '@/types';
```

Add `updateMetadata` method after `getMetadata` (after line 30):

```ts
  async updateMetadata(paperId: string, updates: Partial<PaperMetadata>): Promise<PaperMetadata> {
    const current = await this.getMetadata(paperId);
    const { id: _ignoreId, ...safeUpdates } = updates;
    const merged = { ...current, ...safeUpdates };
    await this.saveMetadata(paperId, merged);
    return merged;
  },
```

Update `listPapers` to include `folderId` (modify the `papers.push` line):

```ts
  papers.push({ id: metadata.id, title: metadata.title, createdAt: metadata.createdAt, status: metadata.status, folderId: metadata.folderId ?? null });
```

- [ ] **Step 3: Write test for `updateMetadata`**

Create `__tests__/lib/storage-folders.test.ts`:

```ts
import { storage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('storage - updateMetadata', () => {
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

  it('merges updates into existing metadata', async () => {
    await storage.createPaperDir('paper-1');
    await storage.saveMetadata('paper-1', {
      id: 'paper-1', title: 'Original', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'pending',
    });
    const result = await storage.updateMetadata('paper-1', { title: 'Renamed' });
    expect(result.title).toBe('Renamed');
    expect(result.filename).toBe('test.pdf');
    const persisted = await storage.getMetadata('paper-1');
    expect(persisted.title).toBe('Renamed');
  });

  it('ignores id field in updates', async () => {
    await storage.createPaperDir('paper-2');
    await storage.saveMetadata('paper-2', {
      id: 'paper-2', title: 'Test', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'pending',
    });
    const result = await storage.updateMetadata('paper-2', { id: 'hacked' } as Partial<import('@/types').PaperMetadata>);
    expect(result.id).toBe('paper-2');
  });

  it('can set folderId on a paper', async () => {
    await storage.createPaperDir('paper-3');
    await storage.saveMetadata('paper-3', {
      id: 'paper-3', title: 'Test', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'pending',
    });
    const result = await storage.updateMetadata('paper-3', { folderId: 'f_abc123' });
    expect(result.folderId).toBe('f_abc123');
  });
});

describe('storage - listPapers with folderId', () => {
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

  it('includes folderId in listed papers', async () => {
    await storage.createPaperDir('paper-f');
    await storage.saveMetadata('paper-f', {
      id: 'paper-f', title: 'Foldered', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'analyzed', folderId: 'f_abc',
    });
    const papers = await storage.listPapers();
    expect(papers[0].folderId).toBe('f_abc');
  });

  it('returns null folderId for papers without one', async () => {
    await storage.createPaperDir('paper-nf');
    await storage.saveMetadata('paper-nf', {
      id: 'paper-nf', title: 'No Folder', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'pending',
    });
    const papers = await storage.listPapers();
    expect(papers[0].folderId).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify**

Run: `npx jest __tests__/lib/storage-folders.test.ts -v`
Expected: All 5 tests pass

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing `listPapers` test in `storage.test.ts` still works because `folderId` is optional)

- [ ] **Step 6: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/storage.ts __tests__/lib/storage-folders.test.ts
git commit -m "feat: add Folder type, folderId to PaperMetadata, and updateMetadata storage method"
```

---

### Task 2: Add PATCH API endpoint for paper rename/move

**Files:**
- Modify: `src/app/api/paper/[id]/route.ts:1-23`
- Create: `__tests__/api/paper-patch.test.ts`

- [ ] **Step 1: Write tests for PATCH endpoint**

Create `__tests__/api/paper-patch.test.ts`:

```ts
import { PATCH } from '@/app/api/paper/[id]/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    updateMetadata: jest.fn(),
  },
}));

describe('PATCH /api/paper/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates paper title', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.updateMetadata as jest.Mock).mockResolvedValue({
      id: 'test-123', title: 'New Title', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11', status: 'analyzed',
    });
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.metadata.title).toBe('New Title');
    expect(storage.updateMetadata).toHaveBeenCalledWith('test-123', { title: 'New Title' });
  });

  it('updates paper folderId', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.updateMetadata as jest.Mock).mockResolvedValue({
      id: 'test-123', title: 'Test', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11', status: 'analyzed', folderId: 'f_abc',
    });
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: 'f_abc' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(storage.updateMetadata).toHaveBeenCalledWith('test-123', { folderId: 'f_abc' });
  });

  it('rejects empty title', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    expect(response.status).toBe(400);
  });

  it('rejects title over 200 characters', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'a'.repeat(201) }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    expect(response.status).toBe(400);
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/paper/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nope' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'missing' }) });
    expect(response.status).toBe(404);
  });

  it('rejects request with no valid fields', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    expect(response.status).toBe(400);
  });

  it('rejects non-string folderId', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: 42 }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api/paper-patch.test.ts -v`
Expected: FAIL — `PATCH` is not exported from the route file

- [ ] **Step 3: Implement PATCH handler**

In `src/app/api/paper/[id]/route.ts`, add the `PaperMetadata` type import at the top:

```ts
import type { PaperMetadata } from '@/types';
```

Then add this after the `DELETE` handler:

```ts
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const body = await request.json();
  const updates: Partial<PaperMetadata> = {};

  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return createErrorResponse('VALIDATION_ERROR', 'Title cannot be empty');
    if (title.length > 200) return createErrorResponse('VALIDATION_ERROR', 'Title must be 200 characters or less');
    updates.title = title;
  }

  if (body.folderId !== undefined) {
    if (body.folderId !== null && typeof body.folderId !== 'string') {
      return createErrorResponse('VALIDATION_ERROR', 'folderId must be a string or null');
    }
    updates.folderId = body.folderId;
  }

  if (Object.keys(updates).length === 0) {
    return createErrorResponse('VALIDATION_ERROR', 'No valid fields to update');
  }

  const metadata = await storage.updateMetadata(id, updates);
  return NextResponse.json({ success: true, metadata });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/api/paper-patch.test.ts -v`
Expected: All 7 tests pass

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/api/paper/[id]/route.ts __tests__/api/paper-patch.test.ts
git commit -m "feat: add PATCH endpoint for paper rename and folder move"
```

---

### Task 3: Create EditableTitle component

**Files:**
- Create: `src/components/editable-title.tsx`

- [ ] **Step 1: Create the EditableTitle component**

Create `src/components/editable-title.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableTitleProps {
  value: string;
  onSave: (newTitle: string) => Promise<void>;
}

export function EditableTitle({ value, onSave }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const trimmed = editValue.trim();
    if (!trimmed || trimmed.length > 200 || trimmed === value) {
      setEditValue(value);
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      setEditValue(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave, isSaving]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        maxLength={200}
        className="text-base font-semibold text-slate-800 bg-white border-2 border-indigo-500 rounded-md px-2 py-1 outline-none w-full ring-2 ring-indigo-100 disabled:opacity-50"
      />
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      className="text-base font-semibold text-slate-800 truncate cursor-pointer hover:border-b hover:border-dashed hover:border-slate-400 transition-colors"
      title="Click to rename"
    >
      {value}
    </h1>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/editable-title.tsx
git commit -m "feat: create EditableTitle inline-edit component"
```

---

### Task 4: Integrate EditableTitle into paper detail page

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:1-12,178-181`

- [ ] **Step 1: Add import and handler**

In `src/app/paper/[id]/page.tsx`, add the import after line 9:

```tsx
import { EditableTitle } from '@/components/editable-title';
```

Add the rename handler after `handleAnalyze` (after line 80):

```tsx
  const handleRename = useCallback(
    async (newTitle: string) => {
      const response = await fetch(`/api/paper/${paperId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) throw new Error('Failed to rename');
      await refetch();
    },
    [paperId, refetch]
  );
```

- [ ] **Step 2: Replace the title `<h1>` with `EditableTitle`**

Replace in the header section (lines 179-181):

```tsx
            <h1 className="text-base font-semibold text-slate-800 truncate mr-3">
              {data.metadata.title}
            </h1>
```

With:

```tsx
            <div className="flex-1 min-w-0 mr-3">
              <EditableTitle value={data.metadata.title} onSave={handleRename} />
            </div>
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: integrate inline paper title editing in detail page"
```

---

## Chunk 2: Folder Storage & API

### Task 5: Add folder storage methods

**Files:**
- Modify: `src/lib/storage.ts:1-3,98-114`
- Modify: `__tests__/lib/storage-folders.test.ts`

- [ ] **Step 1: Add folder storage methods**

In `src/lib/storage.ts`, add these methods before `saveSettings` (before the current line 102):

```ts
  async getFolders(): Promise<Folder[]> {
    try {
      const filePath = path.join(getConfigDir(), 'folders.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.folders || [];
    } catch { return []; }
  },
  async saveFolders(folders: Folder[]): Promise<void> {
    const configDir = getConfigDir();
    await fs.mkdir(configDir, { recursive: true });
    const filePath = path.join(configDir, 'folders.json');
    await fs.writeFile(filePath, JSON.stringify({ folders }, null, 2));
  },
```

- [ ] **Step 2: Add folder storage tests**

Append to `__tests__/lib/storage-folders.test.ts`:

```ts
describe('storage - folders', () => {
  let testDir: string;
  let originalConfigDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'easypaper-test-'));
    originalConfigDir = process.env.CONFIG_DIR || '';
    process.env.CONFIG_DIR = testDir;
  });

  afterEach(async () => {
    process.env.CONFIG_DIR = originalConfigDir;
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('returns empty array when no folders.json exists', async () => {
    const folders = await storage.getFolders();
    expect(folders).toEqual([]);
  });

  it('round-trips folders through JSON', async () => {
    const folders = [
      { id: 'f_1', name: 'NLP', parentId: null },
      { id: 'f_2', name: 'Transformer', parentId: 'f_1' },
    ];
    await storage.saveFolders(folders);
    const loaded = await storage.getFolders();
    expect(loaded).toEqual(folders);
  });

  it('overwrites existing folders', async () => {
    await storage.saveFolders([{ id: 'f_1', name: 'Old', parentId: null }]);
    await storage.saveFolders([{ id: 'f_2', name: 'New', parentId: null }]);
    const loaded = await storage.getFolders();
    expect(loaded).toEqual([{ id: 'f_2', name: 'New', parentId: null }]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/lib/storage-folders.test.ts -v`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts __tests__/lib/storage-folders.test.ts
git commit -m "feat: add folder storage methods (getFolders, saveFolders)"
```

---

### Task 6: Create folder API endpoints

**Files:**
- Modify: `src/lib/errors.ts:1-12`
- Create: `src/app/api/folders/route.ts`
- Create: `src/app/api/folders/[id]/route.ts`
- Create: `__tests__/api/folders.test.ts`

- [ ] **Step 1: Add FOLDER_NOT_FOUND error code**

In `src/lib/errors.ts`, add `'FOLDER_NOT_FOUND'` to the `ErrorCode` type union (after `'NOTE_NOT_FOUND'`):

```ts
export type ErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PARSING_FAILED'
  | 'ANALYSIS_FAILED'
  | 'API_KEY_MISSING'
  | 'API_CALL_FAILED'
  | 'PAPER_NOT_FOUND'
  | 'NOTE_NOT_FOUND'
  | 'FOLDER_NOT_FOUND'
  | 'VALIDATION_ERROR';
```

And add the status mapping (in `STATUS_MAP`):

```ts
  FOLDER_NOT_FOUND: 404,
```

- [ ] **Step 2: Create `src/app/api/folders/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

export async function GET() {
  const folders = await storage.getFolders();
  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return createErrorResponse('VALIDATION_ERROR', 'Folder name cannot be empty');
  if (name.length > 100) return createErrorResponse('VALIDATION_ERROR', 'Folder name must be 100 characters or less');

  const parentId = body.parentId ?? null;
  const folders = await storage.getFolders();
  if (parentId !== null) {
    if (!folders.some((f) => f.id === parentId)) {
      return createErrorResponse('FOLDER_NOT_FOUND', 'Parent folder not found');
    }
  }

  const folder = { id: `f_${uuidv4().slice(0, 8)}`, name, parentId };
  folders.push(folder);
  await storage.saveFolders(folders);
  return NextResponse.json({ folder }, { status: 201 });
}
```

- [ ] **Step 3: Create `src/app/api/folders/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

interface RouteContext { params: Promise<{ id: string }>; }

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const folders = await storage.getFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx === -1) return createErrorResponse('FOLDER_NOT_FOUND', 'Folder not found');

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return createErrorResponse('VALIDATION_ERROR', 'Folder name cannot be empty');
  if (name.length > 100) return createErrorResponse('VALIDATION_ERROR', 'Folder name must be 100 characters or less');

  folders[idx] = { ...folders[idx], name };
  await storage.saveFolders(folders);
  return NextResponse.json({ folder: folders[idx] });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const folders = await storage.getFolders();
  const target = folders.find((f) => f.id === id);
  if (!target) return createErrorResponse('FOLDER_NOT_FOUND', 'Folder not found');

  // Collect all descendant folder IDs
  const toDelete = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        changed = true;
      }
    }
  }

  // Move papers from deleted folders to the target's parent
  const moveToFolderId = target.parentId ?? null;
  const papers = await storage.listPapers();
  for (const paper of papers) {
    if (paper.folderId && toDelete.has(paper.folderId)) {
      await storage.updateMetadata(paper.id, { folderId: moveToFolderId });
    }
  }

  // Remove deleted folders
  const remaining = folders.filter((f) => !toDelete.has(f.id));
  await storage.saveFolders(remaining);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Write tests for folder endpoints**

Create `__tests__/api/folders.test.ts`:

```ts
import { GET, POST } from '@/app/api/folders/route';
import { PATCH, DELETE } from '@/app/api/folders/[id]/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    getFolders: jest.fn(),
    saveFolders: jest.fn(),
    listPapers: jest.fn(),
    updateMetadata: jest.fn(),
  },
}));

jest.mock('uuid', () => ({ v4: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }));

describe('GET /api/folders', () => {
  it('returns folders list', async () => {
    const folders = [{ id: 'f_1', name: 'NLP', parentId: null }];
    (storage.getFolders as jest.Mock).mockResolvedValue(folders);
    const response = await GET();
    const data = await response.json();
    expect(data.folders).toEqual(folders);
  });
});

describe('POST /api/folders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a root folder', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NLP' }),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.folder.name).toBe('NLP');
    expect(data.folder.id).toBe('f_aaaaaaaa');
    expect(data.folder.parentId).toBeNull();
    expect(storage.saveFolders).toHaveBeenCalled();
  });

  it('creates a sub-folder under an existing parent', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([{ id: 'f_parent', name: 'NLP', parentId: null }]);
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Transformer', parentId: 'f_parent' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.folder.parentId).toBe('f_parent');
  });

  it('rejects empty name', async () => {
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects non-existent parentId', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sub', parentId: 'f_nonexistent' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('rejects name exceeding 100 characters', async () => {
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x'.repeat(101) }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/folders/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renames a folder', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([{ id: 'f_1', name: 'Old', parentId: null }]);
    const request = new Request('http://localhost/api/folders/f_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'f_1' }) });
    const data = await response.json();
    expect(data.folder.name).toBe('New');
  });

  it('returns 404 for unknown folder', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/folders/f_missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'f_missing' }) });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/folders/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes a folder and moves papers to parent', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([
      { id: 'f_parent', name: 'NLP', parentId: null },
      { id: 'f_child', name: 'Transformer', parentId: 'f_parent' },
    ]);
    (storage.listPapers as jest.Mock).mockResolvedValue([
      { id: 'p1', title: 'Paper', folderId: 'f_child', createdAt: '', status: 'analyzed' },
    ]);
    const request = new Request('http://localhost/api/folders/f_parent', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'f_parent' }) });
    expect(response.status).toBe(200);
    // Paper in f_child (descendant) moved to f_parent's parent (null/root)
    expect(storage.updateMetadata).toHaveBeenCalledWith('p1', { folderId: null });
    // Both f_parent and f_child removed
    expect(storage.saveFolders).toHaveBeenCalledWith([]);
  });

  it('returns 404 for unknown folder', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/folders/f_nope', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'f_nope' }) });
    expect(response.status).toBe(404);
  });

  it('cascade deletes multi-level descendants', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([
      { id: 'f_root', name: 'Root', parentId: null },
      { id: 'f_child', name: 'Child', parentId: 'f_root' },
      { id: 'f_grandchild', name: 'Grandchild', parentId: 'f_child' },
    ]);
    (storage.listPapers as jest.Mock).mockResolvedValue([
      { id: 'p1', title: 'Deep Paper', folderId: 'f_grandchild', createdAt: '', status: 'analyzed' },
    ]);
    const request = new Request('http://localhost/api/folders/f_root', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'f_root' }) });
    expect(response.status).toBe(200);
    expect(storage.updateMetadata).toHaveBeenCalledWith('p1', { folderId: null });
    expect(storage.saveFolders).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npx jest __tests__/api/folders.test.ts -v`
Expected: All 12 tests pass

- [ ] **Step 6: Run full test suite + TypeScript check**

Run: `npm test && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/errors.ts src/app/api/folders/route.ts src/app/api/folders/[id]/route.ts __tests__/api/folders.test.ts
git commit -m "feat: add folder CRUD API endpoints (list, create, rename, delete)"
```

---

## Chunk 3: Paper Drawer UI

### Task 7: Create PaperDrawer shell component

**Files:**
- Create: `src/components/paper-drawer.tsx`

- [ ] **Step 1: Create the drawer shell**

Create `src/components/paper-drawer.tsx`:

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface PaperDrawerProps {
  open: boolean;
  onClose: () => void;
  currentPaperId: string;
}

export function PaperDrawer({ open, onClose, currentPaperId }: PaperDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 top-[52px] z-30 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Paper navigation"
        className={`fixed top-[52px] left-0 bottom-0 w-80 z-30 bg-white shadow-xl transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-slate-400">Loading papers...</p>
          </div>
        </div>
      </div>
    </>
  );
}
```

This is a placeholder shell — the folder tree content will be added in the next task.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/paper-drawer.tsx
git commit -m "feat: create PaperDrawer shell with overlay and slide animation"
```

---

### Task 8: Integrate hamburger button and drawer into paper detail page

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:1-12,163-269`

- [ ] **Step 1: Add imports and drawer state**

In `src/app/paper/[id]/page.tsx`, add the import:

```tsx
import { PaperDrawer } from '@/components/paper-drawer';
```

Inside `PaperDetailPage`, add drawer state after the chat state declarations (after line 32):

```tsx
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
```

- [ ] **Step 2: Add hamburger button and PaperDrawer to the JSX**

In the return statement, add the hamburger button and PaperDrawer before the existing `<div className="flex h-[calc(100vh-52px)]">` (after the `<>` on line 164):

```tsx
      {/* Hamburger menu button - overlays Navbar area */}
      <button
        onClick={() => setDrawerOpen((prev) => !prev)}
        className="fixed top-0 left-0 z-40 h-[52px] w-12 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Toggle paper navigation"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <PaperDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentPaperId={paperId}
      />
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: add hamburger button and paper drawer to detail page"
```

---

### Task 9: Build folder tree content for the drawer

**Files:**
- Create: `src/lib/format.ts`
- Modify: `src/components/analysis-panel.tsx:1-8`
- Create: `src/components/folder-tree.tsx`
- Modify: `src/components/paper-drawer.tsx`

- [ ] **Step 1: Extract `formatRelativeTime` into a shared utility**

Create `src/lib/format.ts`:

```ts
export function formatRelativeTime(dateStr: string): string | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return null;

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return `on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
```

Then update `src/components/analysis-panel.tsx` to import from the shared utility instead of defining it locally. Remove the `formatRelativeTime` function definition (lines 8-27) and add an import:

```ts
import { formatRelativeTime } from '@/lib/format';
```

Keep the `export { formatRelativeTime }` re-export line so existing tests for `formatRelativeTime` that import from `analysis-panel` still work:

```ts
export { formatRelativeTime } from '@/lib/format';
```

- [ ] **Step 2: Create the FolderTree component**

Create `src/components/folder-tree.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Folder, PaperListItem } from '@/types';
import { formatRelativeTime } from '@/lib/format';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  parsing: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Parsing' },
  analyzing: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Analyzing' },
  analyzed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Analyzed' },
  error: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Error' },
};

interface FolderTreeProps {
  folders: Folder[];
  papers: PaperListItem[];
  currentPaperId: string;
  searchQuery: string;
  onClose: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onMovePaper: (paperId: string, folderId: string | null) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
}

function PaperRow({
  paper,
  isCurrent,
  depth,
  onClose,
  onMovePaper,
  onDeletePaper,
  folders,
}: {
  paper: PaperListItem;
  isCurrent: boolean;
  depth: number;
  onClose: () => void;
  onMovePaper: (paperId: string, folderId: string | null) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
  folders: Folder[];
}) {
  const router = useRouter();
  const status = STATUS_COLORS[paper.status] || STATUS_COLORS.pending;
  const relTime = formatRelativeTime(paper.createdAt);
  const [showMenu, setShowMenu] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);

  return (
    <div className="relative">
      <div
        onClick={() => {
          if (!isCurrent) {
            router.push(`/paper/${paper.id}`);
            onClose();
          }
        }}
        className={`flex items-start gap-2 px-3 py-2 cursor-pointer text-sm transition-colors ${
          isCurrent
            ? 'bg-indigo-50 border-l-2 border-indigo-500'
            : 'hover:bg-slate-50 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <span className="text-slate-400 mt-0.5 flex-shrink-0">📄</span>
        <div className="flex-1 min-w-0">
          <div className={`truncate ${isCurrent ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}>
            {paper.title}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            {relTime && <span className="text-[11px] text-slate-400">{relTime}</span>}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="text-slate-300 hover:text-slate-500 flex-shrink-0 p-0.5"
        >
          ⋯
        </button>
      </div>

      {showMenu && (
        <div className="absolute right-2 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-40">
          <button
            onClick={() => { setShowMenu(false); setShowMovePicker(true); }}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            📂 Move to...
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              if (confirm('Delete this paper? This cannot be undone.')) {
                onDeletePaper(paper.id);
              }
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {showMovePicker && (
        <MoveToPicker
          folders={folders}
          currentFolderId={paper.folderId ?? null}
          onSelect={(folderId) => { setShowMovePicker(false); onMovePaper(paper.id, folderId); }}
          onClose={() => setShowMovePicker(false)}
        />
      )}
    </div>
  );
}

function MoveToPicker({
  folders,
  currentFolderId,
  onSelect,
  onClose,
}: {
  folders: Folder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentFolderId);

  const rootFolders = folders.filter((f) => !f.parentId);

  function renderFolderOption(folder: Folder, depth: number): React.ReactNode {
    const children = folders.filter((f) => f.parentId === folder.id);
    return (
      <div key={folder.id}>
        <label
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <input
            type="radio"
            name="moveTarget"
            checked={selected === folder.id}
            onChange={() => setSelected(folder.id)}
            className="accent-indigo-500"
          />
          <span className="text-sm text-slate-700">📁 {folder.name}</span>
        </label>
        {children.map((c) => renderFolderOption(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg w-56 py-2">
      <div className="px-3 py-1 text-xs font-medium text-slate-400 uppercase">Move to</div>
      <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
        <input
          type="radio"
          name="moveTarget"
          checked={selected === null}
          onChange={() => setSelected(null)}
          className="accent-indigo-500"
        />
        <span className="text-sm text-slate-700">📁 Root (no folder)</span>
      </label>
      {rootFolders.map((f) => renderFolderOption(f, 0))}
      <div className="flex justify-end gap-2 px-3 pt-2 mt-1 border-t border-slate-100">
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        <button
          onClick={() => onSelect(selected)}
          className="text-xs text-white bg-indigo-500 px-2.5 py-1 rounded hover:bg-indigo-600"
        >
          Move
        </button>
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  depth,
  papers,
  folders,
  currentPaperId,
  searchQuery,
  onClose,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMovePaper,
  onDeletePaper,
}: {
  folder: Folder;
  depth: number;
  papers: PaperListItem[];
  folders: Folder[];
  currentPaperId: string;
  searchQuery: string;
  onClose: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onMovePaper: (paperId: string, folderId: string | null) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');

  const childFolders = folders.filter((f) => f.parentId === folder.id).sort((a, b) => a.name.localeCompare(b.name));
  const folderPapers = papers
    .filter((p) => p.folderId === folder.id)
    .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Count all papers in this folder and descendants
  const allDescendantIds = new Set<string>([folder.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId && allDescendantIds.has(f.parentId) && !allDescendantIds.has(f.id)) {
        allDescendantIds.add(f.id);
        changed = true;
      }
    }
  }
  const totalPapers = papers.filter((p) => p.folderId && allDescendantIds.has(p.folderId)).length;

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      await onRenameFolder(folder.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleCreateChild = async () => {
    const trimmed = newChildName.trim();
    if (trimmed) {
      await onCreateFolder(trimmed, folder.id);
      setNewChildName('');
    }
    setIsCreatingChild(false);
  };

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer group"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-slate-400 w-4 flex-shrink-0"
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="flex-shrink-0">📁</span>

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setRenameValue(folder.name); setIsRenaming(false); }
            }}
            className="text-sm font-medium border border-indigo-400 rounded px-1 py-0.5 outline-none flex-1 min-w-0"
            maxLength={100}
          />
        ) : (
          <span
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-medium text-slate-800 truncate flex-1"
          >
            {folder.name}
          </span>
        )}

        <span className="text-[11px] text-slate-400 flex-shrink-0">{totalPapers}</span>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
          >
            ⋯
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-44">
              <button
                onClick={() => { setShowMenu(false); setIsCreatingChild(true); setExpanded(true); }}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                📁 New sub-folder
              </button>
              <button
                onClick={() => { setShowMenu(false); setIsRenaming(true); setRenameValue(folder.name); }}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                ✏️ Rename
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  if (confirm(`Delete folder "${folder.name}" and all sub-folders? Papers will be moved to the parent.`)) {
                    onDeleteFolder(folder.id);
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
              >
                🗑️ Delete folder
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className={depth > 0 ? 'border-l border-slate-200' : ''} style={{ marginLeft: `${20 + depth * 20}px` }}>
          {isCreatingChild && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span>📁</span>
              <input
                autoFocus
                placeholder="Folder name"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onBlur={handleCreateChild}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateChild();
                  if (e.key === 'Escape') setIsCreatingChild(false);
                }}
                className="text-sm border border-indigo-400 rounded px-1 py-0.5 outline-none flex-1"
                maxLength={100}
              />
            </div>
          )}
          {childFolders.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              papers={papers}
              folders={folders}
              currentPaperId={currentPaperId}
              searchQuery={searchQuery}
              onClose={onClose}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMovePaper={onMovePaper}
              onDeletePaper={onDeletePaper}
            />
          ))}
          {folderPapers.map((paper) => (
            <PaperRow
              key={paper.id}
              paper={paper}
              isCurrent={paper.id === currentPaperId}
              depth={depth + 1}
              onClose={onClose}
              onMovePaper={onMovePaper}
              onDeletePaper={onDeletePaper}
              folders={folders}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree(props: FolderTreeProps) {
  const { folders, papers, currentPaperId, searchQuery, onClose, onCreateFolder, onRenameFolder, onDeleteFolder, onMovePaper, onDeletePaper } = props;

  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parentId).sort((a, b) => a.name.localeCompare(b.name)),
    [folders]
  );

  const rootPapers = useMemo(
    () => papers
      .filter((p) => !p.folderId)
      .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [papers, searchQuery]
  );

  return (
    <div>
      {rootFolders.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          depth={0}
          papers={papers}
          folders={folders}
          currentPaperId={currentPaperId}
          searchQuery={searchQuery}
          onClose={onClose}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onMovePaper={onMovePaper}
          onDeletePaper={onDeletePaper}
        />
      ))}
      {rootPapers.map((paper) => (
        <PaperRow
          key={paper.id}
          paper={paper}
          isCurrent={paper.id === currentPaperId}
          depth={0}
          onClose={onClose}
          onMovePaper={onMovePaper}
          onDeletePaper={onDeletePaper}
          folders={folders}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/format.ts src/components/analysis-panel.tsx src/components/folder-tree.tsx
git commit -m "feat: create FolderTree component with nested folders, papers, and context menus"
```

---

### Task 10: Wire FolderTree into PaperDrawer with data fetching

**Files:**
- Modify: `src/components/paper-drawer.tsx`

- [ ] **Step 1: Replace PaperDrawer placeholder with full implementation**

Replace `src/components/paper-drawer.tsx` entirely:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Folder, PaperListItem } from '@/types';
import { FolderTree } from './folder-tree';

interface PaperDrawerProps {
  open: boolean;
  onClose: () => void;
  currentPaperId: string;
}

export function PaperDrawer({ open, onClose, currentPaperId }: PaperDrawerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingRootFolder, setIsCreatingRootFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [foldersRes, papersRes] = await Promise.all([
        fetch('/api/folders'),
        fetch('/api/papers'),
      ]);
      const foldersData = await foldersRes.json();
      const papersData = await papersRes.json();
      setFolders(foldersData.folders || []);
      setPapers(papersData.papers || []);
    } catch {
      // Silently fail, show whatever data we have
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchData();
      setSearchQuery('');
    }
  }, [open, fetchData]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
    if (res.ok) {
      const data = await res.json();
      setFolders((prev) => [...prev, data.folder]);
    }
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      setFolders((prev) => prev.map((f) => (f.id === folderId ? data.folder : f)));
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    if (res.ok) await fetchData();
  };

  const handleMovePaper = async (paperId: string, folderId: string | null) => {
    const res = await fetch(`/api/paper/${paperId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    });
    if (res.ok) {
      setPapers((prev) => prev.map((p) => (p.id === paperId ? { ...p, folderId } : p)));
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    const res = await fetch(`/api/paper/${paperId}`, { method: 'DELETE' });
    if (res.ok) {
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
    }
  };

  const handleCreateRootFolder = async () => {
    const trimmed = newFolderName.trim();
    if (trimmed) {
      await handleCreateFolder(trimmed, null);
      setNewFolderName('');
    }
    setIsCreatingRootFolder(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 top-[52px] z-30 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Paper navigation"
        className={`fixed top-[52px] left-0 bottom-0 w-80 z-30 bg-white shadow-xl transform transition-transform duration-200 flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Search + Add folder */}
        <div className="p-3 border-b border-slate-200 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-md px-3 py-1.5">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-slate-700 outline-none flex-1 placeholder-slate-400"
            />
          </div>
          <button
            onClick={() => setIsCreatingRootFolder(true)}
            className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors text-lg font-semibold flex-shrink-0"
            title="New folder"
          >
            +
          </button>
        </div>

        {/* New root folder input */}
        {isCreatingRootFolder && (
          <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
            <span>📁</span>
            <input
              autoFocus
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={handleCreateRootFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateRootFolder();
                if (e.key === 'Escape') setIsCreatingRootFolder(false);
              }}
              className="text-sm border border-indigo-400 rounded px-2 py-1 outline-none flex-1"
              maxLength={100}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <FolderTree
              folders={folders}
              papers={papers}
              currentPaperId={currentPaperId}
              searchQuery={searchQuery}
              onClose={onClose}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onMovePaper={handleMovePaper}
              onDeletePaper={handleDeletePaper}
            />
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/paper-drawer.tsx
git commit -m "feat: wire FolderTree into PaperDrawer with data fetching and folder CRUD"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Manual smoke test checklist**

Start dev server: `npm run dev`

Test paper rename:
- Open a paper detail page
- Click the paper title → should show input with text selected
- Type a new name, press Enter → title should update
- Click title, press Escape → should revert
- Click title, clear text, press Enter → should revert (empty not allowed)

Test drawer navigation:
- Click hamburger (☰) button in top-left → drawer slides out
- Papers listed with status badges and relative times
- Click a different paper → navigates and drawer closes
- Current paper is highlighted
- Click backdrop or press Escape → drawer closes

Test folder management:
- Click "+" to create a root folder → enter name → folder appears
- Click folder ⋯ → "New sub-folder" → creates nested folder
- Click folder ⋯ → "Rename" → inline edit works
- Click folder ⋯ → "Delete folder" → confirmation → papers move to parent
- Click paper ⋯ → "Move to..." → select folder → paper moves
- Click paper ⋯ → "Delete" → confirmation → paper removed
- Search bar filters papers by title
- Folders expand/collapse with ▶/▼ chevrons

- [ ] **Step 5: Commit any remaining fixes if needed**
