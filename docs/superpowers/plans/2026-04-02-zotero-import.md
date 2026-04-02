# Zotero Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click Zotero import that reads the local Zotero SQLite database, browses collections, and imports selected PDFs with titles into EasyPaper.

**Architecture:** New `src/lib/zotero.ts` module reads Zotero's SQLite DB via `better-sqlite3`. Three new API routes expose collections, items, and import endpoints. A new `zotero-import.tsx` component integrates into the existing upload modal as a second tab.

**Tech Stack:** better-sqlite3 (native SQLite binding), Next.js App Router API routes, React client components, existing storage/errors modules.

**Spec:** `docs/superpowers/specs/2026-04-02-zotero-import-design.md`

---

## Chunk 1: Foundation (Dependencies, Types, Config, Core Library)

### Task 1: Install dependencies and configure Next.js

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Install better-sqlite3**

```bash
npm install better-sqlite3 && npm install -D @types/better-sqlite3
```

- [ ] **Step 2: Add better-sqlite3 to serverExternalPackages in next.config.ts**

In `next.config.ts`, add `"better-sqlite3"` to the `serverExternalPackages` array (currently contains `["mupdf", "pdfjs-dist", "react-pdf"]`):

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mupdf", "pdfjs-dist", "react-pdf", "better-sqlite3"],
};
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore: add better-sqlite3 dependency for Zotero import"
```

---

### Task 2: Add Zotero type definitions

**Files:**
- Modify: `src/types/index.ts` (append after line 205, after the last `ToastMessage` interface)

- [ ] **Step 1: Add types to src/types/index.ts**

Append these types at the end of the file:

```typescript
// Zotero Import Types
export interface ZoteroCollection {
  id: number;
  name: string;
  parentId: number | null;
  children: ZoteroCollection[];
}

export interface ZoteroItem {
  key: string;
  title: string;
  attachmentKey: string;
  pdfFilename: string;
  pdfSize: number;
  alreadyImported: boolean;
}

export interface ZoteroImportRequest {
  items: Array<{
    key: string;
    title: string;
    attachmentKey: string;
    pdfFilename: string;
  }>;
  folderId?: string;
}

export interface ZoteroImportResult {
  key: string;
  paperId?: string;
  status: 'success' | 'error';
  error?: string;
}
```

- [ ] **Step 2: Add zoteroDataDir to AppSettings**

In the existing `AppSettings` interface (around line 86), add after `staleThresholdMinutes?`:

```typescript
  zoteroDataDir?: string;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Zotero import type definitions"
```

---

### Task 3: Add ZOTERO_NOT_FOUND error code

**Files:**
- Modify: `src/lib/errors.ts`

- [ ] **Step 1: Add error codes**

Add `'ZOTERO_NOT_FOUND'` and `'ZOTERO_IMPORT_FAILED'` to the `ErrorCode` type union (after `'VALIDATION_ERROR'`):

```typescript
  | 'ZOTERO_NOT_FOUND'
  | 'ZOTERO_IMPORT_FAILED';
```

Add to `STATUS_MAP`:

```typescript
  ZOTERO_NOT_FOUND: 404,
  ZOTERO_IMPORT_FAILED: 500,
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/errors.ts
git commit -m "feat: add Zotero error codes"
```

---

### Task 4: Write the Zotero core library with tests (TDD)

**Files:**
- Create: `src/lib/zotero.ts`
- Create: `__tests__/lib/zotero.test.ts`

This is the most complex module. It opens the Zotero SQLite DB and provides three functions:
- `getCollections(dbPath)` — returns collection tree
- `getItems(dbPath, collectionId?)` — returns items with PDF info
- `getZoteroDbPath(settings)` — resolves the DB path from settings

- [ ] **Step 1: Write failing test for getZoteroDbPath**

Create `__tests__/lib/zotero.test.ts`:

```typescript
import { getZoteroDbPath } from '@/lib/zotero';
import os from 'os';
import path from 'path';

// Mock better-sqlite3 for all tests in this file
jest.mock('better-sqlite3');

describe('getZoteroDbPath', () => {
  it('returns default path when no settings', () => {
    const result = getZoteroDbPath(undefined);
    expect(result).toBe(path.join(os.homedir(), 'Zotero', 'zotero.sqlite'));
  });

  it('uses custom path from settings', () => {
    const result = getZoteroDbPath('/custom/zotero');
    expect(result).toBe('/custom/zotero/zotero.sqlite');
  });

  it('expands tilde in path', () => {
    const result = getZoteroDbPath('~/Zotero');
    expect(result).toBe(path.join(os.homedir(), 'Zotero', 'zotero.sqlite'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/zotero.test.ts -v
```

Expected: FAIL — `getZoteroDbPath` not found.

- [ ] **Step 3: Implement getZoteroDbPath**

Create `src/lib/zotero.ts`:

```typescript
import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import fs from 'fs';
import type { ZoteroCollection, ZoteroItem } from '@/types';

export function getZoteroDbPath(zoteroDataDir?: string): string {
  let dir = zoteroDataDir || path.join(os.homedir(), 'Zotero');
  if (dir.startsWith('~')) {
    dir = path.join(os.homedir(), dir.slice(1).replace(/^\//, ''));
  }
  return path.join(dir, 'zotero.sqlite');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/zotero.test.ts --testNamePattern="getZoteroDbPath" -v
```

Expected: PASS

- [ ] **Step 5: Write failing test for getCollections**

Add to the test file:

```typescript
import Database from 'better-sqlite3';
import { getCollections } from '@/lib/zotero';

// We need to mock better-sqlite3 to return fake data
const mockAll = jest.fn();
const mockGet = jest.fn();
const mockStatement = { all: mockAll, get: mockGet };
const mockPrepare = jest.fn().mockReturnValue(mockStatement);
const mockClose = jest.fn();

(Database as unknown as jest.Mock).mockImplementation(() => ({
  prepare: mockPrepare,
  close: mockClose,
}));

describe('getCollections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database as unknown as jest.Mock).mockImplementation(() => ({
      prepare: mockPrepare,
      close: mockClose,
    }));
  });

  it('returns collection tree from database', () => {
    // First call: collections query
    mockAll.mockReturnValueOnce([
      { collectionID: 1, collectionName: 'ML Papers', parentCollectionID: null },
      { collectionID: 2, collectionName: 'Transformers', parentCollectionID: 1 },
    ]);
    // Second call: total papers count
    mockGet.mockReturnValueOnce({ count: 42 });

    const result = getCollections('/fake/zotero.sqlite');

    expect(result.collections).toHaveLength(1);
    expect(result.collections[0].name).toBe('ML Papers');
    expect(result.collections[0].children).toHaveLength(1);
    expect(result.collections[0].children[0].name).toBe('Transformers');
    expect(result.totalPapers).toBe(42);
    expect(mockClose).toHaveBeenCalled();
  });

  it('throws when database file not found', () => {
    (Database as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('SQLITE_CANTOPEN');
    });

    expect(() => getCollections('/nonexistent/zotero.sqlite')).toThrow();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest __tests__/lib/zotero.test.ts --testNamePattern="getCollections" -v
```

Expected: FAIL — `getCollections` not found.

- [ ] **Step 7: Implement getCollections**

Add to `src/lib/zotero.ts`:

```typescript
function openDb(dbPath: string): InstanceType<typeof Database> {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Zotero database not found at: ${dbPath}`);
  }
  return new Database(dbPath, { readonly: true });
}

function buildCollectionTree(
  rows: Array<{ collectionID: number; collectionName: string; parentCollectionID: number | null }>
): ZoteroCollection[] {
  const map = new Map<number, ZoteroCollection>();
  for (const row of rows) {
    map.set(row.collectionID, {
      id: row.collectionID,
      name: row.collectionName,
      parentId: row.parentCollectionID,
      children: [],
    });
  }
  const roots: ZoteroCollection[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function getCollections(dbPath: string): { collections: ZoteroCollection[]; totalPapers: number } {
  const db = openDb(dbPath);
  try {
    const rows = db.prepare(`
      SELECT collectionID, collectionName, parentCollectionID
      FROM collections
      ORDER BY collectionName
    `).all() as Array<{ collectionID: number; collectionName: string; parentCollectionID: number | null }>;

    const { count } = db.prepare(`
      SELECT COUNT(DISTINCT ia.parentItemID) as count
      FROM itemAttachments ia
      WHERE ia.contentType = 'application/pdf'
        AND ia.parentItemID IS NOT NULL
    `).get() as { count: number };

    return { collections: buildCollectionTree(rows), totalPapers: count };
  } finally {
    db.close();
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest __tests__/lib/zotero.test.ts --testNamePattern="getCollections" -v
```

Expected: PASS

- [ ] **Step 9: Write failing test for getItems**

Add to the test file:

```typescript
import { getItems } from '@/lib/zotero';

describe('getItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database as unknown as jest.Mock).mockImplementation(() => ({
      prepare: mockPrepare,
      close: mockClose,
    }));
  });

  it('returns items for a collection', () => {
    mockAll.mockReturnValueOnce([
      {
        key: 'PARENT1',
        title: 'Attention Is All You Need',
        attachmentKey: 'ATT123',
        pdfPath: 'storage:1706.03762v7.pdf',
      },
    ]);

    const result = getItems('/fake/zotero.sqlite', 1);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('PARENT1');
    expect(result[0].title).toBe('Attention Is All You Need');
    expect(result[0].attachmentKey).toBe('ATT123');
    expect(result[0].pdfFilename).toBe('1706.03762v7.pdf');
  });

  it('returns all items when no collectionId', () => {
    mockAll.mockReturnValueOnce([
      {
        key: 'P1',
        title: 'Paper One',
        attachmentKey: 'A1',
        pdfPath: 'storage:paper1.pdf',
      },
    ]);

    const result = getItems('/fake/zotero.sqlite');
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

```bash
npx jest __tests__/lib/zotero.test.ts --testNamePattern="getItems" -v
```

Expected: FAIL — `getItems` not found.

- [ ] **Step 11: Implement getItems**

Add to `src/lib/zotero.ts`:

```typescript
export function getItems(dbPath: string, collectionId?: number): Omit<ZoteroItem, 'pdfSize' | 'alreadyImported'>[] {
  const db = openDb(dbPath);
  try {
    let query: string;
    let params: unknown[];

    if (collectionId) {
      query = `
        SELECT
          parentItem.key as key,
          idv.value as title,
          attItem.key as attachmentKey,
          ia.path as pdfPath
        FROM itemAttachments ia
        JOIN items attItem ON attItem.itemID = ia.itemID
        JOIN items parentItem ON parentItem.itemID = ia.parentItemID
        JOIN itemData id ON id.itemID = ia.parentItemID
        JOIN itemDataValues idv ON idv.valueID = id.valueID
        JOIN fields f ON f.fieldID = id.fieldID
        JOIN collectionItems ci ON ci.itemID = ia.parentItemID
        WHERE ia.contentType = 'application/pdf'
          AND ia.parentItemID IS NOT NULL
          AND f.fieldName = 'title'
          AND ci.collectionID = ?
        ORDER BY idv.value
      `;
      params = [collectionId];
    } else {
      query = `
        SELECT
          parentItem.key as key,
          idv.value as title,
          attItem.key as attachmentKey,
          ia.path as pdfPath
        FROM itemAttachments ia
        JOIN items attItem ON attItem.itemID = ia.itemID
        JOIN items parentItem ON parentItem.itemID = ia.parentItemID
        JOIN itemData id ON id.itemID = ia.parentItemID
        JOIN itemDataValues idv ON idv.valueID = id.valueID
        JOIN fields f ON f.fieldID = id.fieldID
        WHERE ia.contentType = 'application/pdf'
          AND ia.parentItemID IS NOT NULL
          AND f.fieldName = 'title'
        ORDER BY idv.value
      `;
      params = [];
    }

    const rows = db.prepare(query).all(...params) as Array<{
      key: string;
      title: string;
      attachmentKey: string;
      pdfPath: string;
    }>;

    return rows.map((row) => ({
      key: row.key,
      title: row.title,
      attachmentKey: row.attachmentKey,
      pdfFilename: row.pdfPath.replace(/^storage:/, ''),
    }));
  } finally {
    db.close();
  }
}
```

- [ ] **Step 12: Run all zotero tests**

```bash
npx jest __tests__/lib/zotero.test.ts -v
```

Expected: ALL PASS

- [ ] **Step 13: Commit**

```bash
git add src/lib/zotero.ts __tests__/lib/zotero.test.ts
git commit -m "feat: add Zotero SQLite reader library with tests"
```

---

### Task 5: Add storage dedup helper

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `__tests__/lib/storage.test.ts`

- [ ] **Step 1: Write failing test**

Add to `__tests__/lib/storage.test.ts` (follows existing test patterns — `storage` is mocked/imported):

```typescript
describe('findPaperByFilename', () => {
  it('returns paperId when matching filename found', async () => {
    // Setup: create a paper with known filename
    const paperId = 'test-dedup-id';
    await storage.createPaperDir(paperId);
    await storage.saveMetadata(paperId, {
      id: paperId, title: 'Test', filename: 'test.pdf',
      pages: 1, createdAt: new Date().toISOString(), status: 'pending',
    });

    const result = await storage.findPaperByFilename('test.pdf');
    expect(result).toBe(paperId);
  });

  it('returns null when no match', async () => {
    const result = await storage.findPaperByFilename('nonexistent.pdf');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/storage.test.ts --testNamePattern="findPaperByFilename" -v
```

Expected: FAIL — `findPaperByFilename` not defined.

- [ ] **Step 3: Implement findPaperByFilename**

Add to the `storage` object in `src/lib/storage.ts` (after the `paperExists` method):

```typescript
  async findPaperByFilename(filename: string): Promise<string | null> {
    const papers = await this.listPapers();
    for (const paper of papers) {
      try {
        const metadata = await this.getMetadata(paper.id);
        if (metadata.filename === filename) return paper.id;
      } catch { /* skip */ }
    }
    return null;
  },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/storage.test.ts --testNamePattern="findPaperByFilename" -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts __tests__/lib/storage.test.ts
git commit -m "feat: add findPaperByFilename storage helper for dedup"
```

---

## Chunk 2: API Routes

### Task 6: GET /api/zotero/collections route

**Files:**
- Create: `src/app/api/zotero/collections/route.ts`
- Create: `__tests__/api/zotero-collections.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/api/zotero-collections.test.ts`:

```typescript
import { GET } from '@/app/api/zotero/collections/route';

jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/zotero', () => ({
  getZoteroDbPath: jest.fn().mockReturnValue('/fake/zotero.sqlite'),
  getCollections: jest.fn().mockReturnValue({
    collections: [{ id: 1, name: 'ML', parentId: null, children: [] }],
    totalPapers: 10,
  }),
}));

describe('GET /api/zotero/collections', () => {
  it('returns collection tree', async () => {
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.collections).toHaveLength(1);
    expect(data.collections[0].name).toBe('ML');
    expect(data.totalPapers).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/zotero-collections.test.ts -v
```

Expected: FAIL — route file not found.

- [ ] **Step 3: Implement route**

Create `src/app/api/zotero/collections/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { getZoteroDbPath, getCollections } from '@/lib/zotero';
import { createErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const settings = await storage.getSettings();
    const dbPath = getZoteroDbPath(settings?.zoteroDataDir as string | undefined);
    const result = getCollections(dbPath);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('not found')) {
      return createErrorResponse('ZOTERO_NOT_FOUND', msg);
    }
    return createErrorResponse('ZOTERO_IMPORT_FAILED', `Failed to read Zotero collections: ${msg}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/zotero-collections.test.ts -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/zotero/collections/route.ts __tests__/api/zotero-collections.test.ts
git commit -m "feat: add GET /api/zotero/collections route"
```

---

### Task 7: GET /api/zotero/items route

**Files:**
- Create: `src/app/api/zotero/items/route.ts`
- Create: `__tests__/api/zotero-items.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/api/zotero-items.test.ts`:

```typescript
import { GET } from '@/app/api/zotero/items/route';

jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: jest.fn().mockResolvedValue(null),
    findPaperByFilename: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/zotero', () => ({
  getZoteroDbPath: jest.fn().mockReturnValue('/fake/zotero.sqlite'),
  getItems: jest.fn().mockReturnValue([
    { key: 'P1', title: 'Paper One', attachmentKey: 'A1', pdfFilename: 'paper1.pdf' },
  ]),
  getPdfFileSize: jest.fn().mockReturnValue(12345),
}));

function createRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/zotero/items', () => {
  it('returns items for a collection', async () => {
    const request = createRequest('http://localhost/api/zotero/items?collectionId=1');
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe('Paper One');
    expect(data.items[0].alreadyImported).toBe(false);
  });

  it('returns all items when no collectionId', async () => {
    const request = createRequest('http://localhost/api/zotero/items');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/zotero-items.test.ts -v
```

Expected: FAIL

- [ ] **Step 3: Add getPdfFileSize to zotero.ts**

Add to `src/lib/zotero.ts`:

```typescript
export function getPdfFileSize(zoteroDataDir: string, attachmentKey: string, pdfFilename: string): number {
  const dir = zoteroDataDir.startsWith('~')
    ? path.join(os.homedir(), zoteroDataDir.slice(1).replace(/^\//, ''))
    : zoteroDataDir || path.join(os.homedir(), 'Zotero');
  const pdfPath = path.join(dir, 'storage', attachmentKey, pdfFilename);
  try {
    return fs.statSync(pdfPath).size;
  } catch {
    return 0;
  }
}
```

- [ ] **Step 4: Implement route**

Create `src/app/api/zotero/items/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { getZoteroDbPath, getItems, getPdfFileSize } from '@/lib/zotero';
import { createErrorResponse } from '@/lib/errors';
import type { ZoteroItem } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionIdParam = searchParams.get('collectionId');
    const collectionId = collectionIdParam ? parseInt(collectionIdParam, 10) : undefined;

    const settings = await storage.getSettings();
    const zoteroDataDir = (settings?.zoteroDataDir as string) || undefined;
    const dbPath = getZoteroDbPath(zoteroDataDir);
    const rawItems = getItems(dbPath, collectionId);

    const items: ZoteroItem[] = await Promise.all(
      rawItems.map(async (item) => {
        const existingId = await storage.findPaperByFilename(item.pdfFilename);
        const pdfSize = getPdfFileSize(zoteroDataDir || '~/Zotero', item.attachmentKey, item.pdfFilename);
        return {
          ...item,
          pdfSize,
          alreadyImported: existingId !== null,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('not found')) {
      return createErrorResponse('ZOTERO_NOT_FOUND', msg);
    }
    return createErrorResponse('ZOTERO_IMPORT_FAILED', `Failed to read Zotero items: ${msg}`);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/api/zotero-items.test.ts -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/zotero.ts src/app/api/zotero/items/route.ts __tests__/api/zotero-items.test.ts
git commit -m "feat: add GET /api/zotero/items route"
```

---

### Task 8: POST /api/zotero/import route

**Files:**
- Create: `src/app/api/zotero/import/route.ts`
- Create: `__tests__/api/zotero-import.test.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/api/zotero-import.test.ts`:

```typescript
import { POST } from '@/app/api/zotero/import/route';
import fs from 'fs/promises';

jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: jest.fn().mockResolvedValue(null),
    createPaperDir: jest.fn().mockResolvedValue(undefined),
    savePdf: jest.fn().mockResolvedValue(undefined),
    saveMetadata: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/zotero', () => ({
  getZoteroDbPath: jest.fn().mockReturnValue('/fake/zotero.sqlite'),
  resolveZoteroPdfPath: jest.fn().mockReturnValue('/fake/Zotero/storage/ATT1/paper.pdf'),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake pdf /Type /Page content')),
  access: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('uuid', () => ({ v4: () => 'import-uuid-123' }));

describe('POST /api/zotero/import', () => {
  it('imports papers successfully', async () => {
    const request = new Request('http://localhost/api/zotero/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ key: 'P1', title: 'Test Paper', attachmentKey: 'ATT1', pdfFilename: 'paper.pdf' }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toBe('success');
    expect(data.results[0].paperId).toBe('import-uuid-123');
  });

  it('handles missing PDF gracefully', async () => {
    (fs.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

    const request = new Request('http://localhost/api/zotero/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ key: 'P2', title: 'Missing', attachmentKey: 'ATT2', pdfFilename: 'gone.pdf' }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.results[0].status).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/zotero-import.test.ts -v
```

Expected: FAIL

- [ ] **Step 3: Add resolveZoteroPdfPath to zotero.ts**

Add to `src/lib/zotero.ts`:

```typescript
export function resolveZoteroPdfPath(zoteroDataDir: string | undefined, attachmentKey: string, pdfFilename: string): string {
  let dir = zoteroDataDir || path.join(os.homedir(), 'Zotero');
  if (dir.startsWith('~')) {
    dir = path.join(os.homedir(), dir.slice(1).replace(/^\//, ''));
  }
  return path.join(dir, 'storage', attachmentKey, pdfFilename);
}
```

- [ ] **Step 4: Implement import route**

Create `src/app/api/zotero/import/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { storage } from '@/lib/storage';
import { resolveZoteroPdfPath } from '@/lib/zotero';
import { createErrorResponse } from '@/lib/errors';
import type { ZoteroImportRequest, ZoteroImportResult } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body: ZoteroImportRequest = await request.json();
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return createErrorResponse('VALIDATION_ERROR', 'No items provided');
    }

    const settings = await storage.getSettings();
    const zoteroDataDir = settings?.zoteroDataDir as string | undefined;

    const results: ZoteroImportResult[] = [];

    for (const item of body.items) {
      try {
        const pdfPath = resolveZoteroPdfPath(zoteroDataDir, item.attachmentKey, item.pdfFilename);
        await fs.access(pdfPath);
        const buffer = await fs.readFile(pdfPath);

        // Extract page count (same logic as upload route)
        let pageCount = 0;
        try {
          const content = buffer.toString('binary');
          const matches = content.match(/\/Type\s*\/Page(?!s)/g);
          pageCount = matches ? matches.length : 0;
        } catch { /* default to 0 */ }

        const paperId = uuidv4();
        await storage.createPaperDir(paperId);
        await storage.savePdf(paperId, buffer);
        await storage.saveMetadata(paperId, {
          id: paperId,
          title: item.title,
          filename: item.pdfFilename,
          pages: pageCount,
          createdAt: new Date().toISOString(),
          status: 'pending',
          ...(body.folderId && { folderId: body.folderId }),
        });

        results.push({ key: item.key, paperId, status: 'success' });
      } catch (error) {
        results.push({
          key: item.key,
          status: 'error',
          error: error instanceof Error ? error.message : 'Import failed',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return createErrorResponse('ZOTERO_IMPORT_FAILED',
      `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/api/zotero-import.test.ts -v
```

Expected: PASS

- [ ] **Step 6: Run all tests to check nothing is broken**

```bash
npm test
```

Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/zotero.ts src/app/api/zotero/import/route.ts __tests__/api/zotero-import.test.ts
git commit -m "feat: add POST /api/zotero/import route"
```

---

## Chunk 3: Settings Extension

### Task 9: Add Zotero path to settings

**Files:**
- Modify: `src/components/settings-form.tsx`
- Modify: `src/app/api/settings/route.ts`

- [ ] **Step 1: Add zoteroDataDir to settings API GET response**

In `src/app/api/settings/route.ts`, in both the default response (no settings, ~line 18) and the existing settings response (~line 31):

Default response — add:
```typescript
    zoteroDataDir: '',
```

Existing settings response — add:
```typescript
    zoteroDataDir: (settings.zoteroDataDir as string) || '',
```

- [ ] **Step 2: Add zoteroDataDir to settings API POST handler**

In the POST handler, after the `maxConcurrent` block (~line 75), add:

```typescript
    if (body.zoteroDataDir !== undefined) merged.zoteroDataDir = body.zoteroDataDir;
```

- [ ] **Step 3: Add Zotero section to settings form**

In `src/components/settings-form.tsx`:

Add `zoteroDataDir: ''` to the `SettingsData` interface and initial state.

Add a new section before the save button (before line 260, the `{message && ...}` block). Follow the existing pattern:

```tsx
      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Zotero Integration
        </h3>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Zotero Data Directory
          </label>
          <input
            type="text"
            value={settings.zoteroDataDir}
            onChange={(e) => setSettings({ ...settings, zoteroDataDir: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
            placeholder="~/Zotero"
          />
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Path to your Zotero data directory. Leave empty for default (~/Zotero).
          </p>
        </div>
      </div>
```

Add `zoteroDataDir: settings.zoteroDataDir` to the `body` object in `handleSave` (after line 59).

- [ ] **Step 4: Run the dev server and manually verify settings page**

```bash
npm run dev
```

Open `http://localhost:3000/settings` and verify the Zotero section appears.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings-form.tsx src/app/api/settings/route.ts
git commit -m "feat: add Zotero data directory to settings"
```

---

## Chunk 4: Frontend — Zotero Import Component and Upload Modal Integration

### Task 10: Create zotero-import.tsx component

**Files:**
- Create: `src/components/zotero-import.tsx`

This is a client component with two-column layout: collection tree (left) and item list (right).

- [ ] **Step 1: Create the component**

Create `src/components/zotero-import.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ZoteroCollection, ZoteroItem, ZoteroImportResult } from '@/types';
import type { Folder } from '@/types';

interface ZoteroImportProps {
  folders: Folder[];
  onImportComplete: () => void;
  onClose: () => void;
}

type ImportState = 'idle' | 'importing' | 'done';

export function ZoteroImport({ folders, onImportComplete, onClose }: ZoteroImportProps) {
  const [collections, setCollections] = useState<ZoteroCollection[]>([]);
  const [totalPapers, setTotalPapers] = useState(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [items, setItems] = useState<ZoteroItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importResults, setImportResults] = useState<ZoteroImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Load collections on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/zotero/collections');
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || 'Failed to load collections');
        }
        const data = await res.json();
        setCollections(data.collections);
        setTotalPapers(data.totalPapers);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to connect to Zotero');
      } finally {
        setLoadingCollections(false);
      }
    }
    load();
  }, []);

  // Load items when collection changes
  const loadItems = useCallback(async (collectionId: number | null) => {
    setSelectedCollectionId(collectionId);
    setLoadingItems(true);
    setSelectedKeys(new Set());
    try {
      const url = collectionId
        ? `/api/zotero/items?collectionId=${collectionId}`
        : '/api/zotero/items';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load items');
      const data = await res.json();
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load items');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const importableItems = items.filter((i) => !i.alreadyImported);
    if (selectedKeys.size === importableItems.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(importableItems.map((i) => i.key)));
    }
  };

  const handleImport = async () => {
    const selectedItems = items
      .filter((i) => selectedKeys.has(i.key))
      .map(({ key, title, attachmentKey, pdfFilename }) => ({ key, title, attachmentKey, pdfFilename }));

    if (selectedItems.length === 0) return;

    setImportState('importing');
    try {
      const res = await fetch('/api/zotero/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems, folderId: targetFolderId || undefined }),
      });
      const data = await res.json();
      setImportResults(data.results);
      setImportState('done');

      const successCount = data.results.filter((r: ZoteroImportResult) => r.status === 'success').length;
      if (successCount > 0) {
        window.dispatchEvent(new CustomEvent('paperUploaded'));
        setTimeout(() => {
          onImportComplete();
          if (data.results.every((r: ZoteroImportResult) => r.status === 'success')) {
            onClose();
          }
        }, 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setImportState('idle');
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Render collection tree recursively
  function renderCollection(col: ZoteroCollection, depth: number = 0) {
    const hasChildren = col.children.length > 0;
    const isExpanded = expandedIds.has(col.id);
    const isSelected = selectedCollectionId === col.id;

    return (
      <div key={col.id}>
        <button
          onClick={() => {
            if (hasChildren) toggleExpand(col.id);
            loadItems(col.id);
          }}
          className="w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors"
          style={{
            paddingLeft: `${8 + depth * 16}px`,
            background: isSelected ? 'var(--glass)' : 'transparent',
            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          {hasChildren && (
            <span style={{ display: 'inline-block', width: '16px', fontSize: '10px' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!hasChildren && <span style={{ display: 'inline-block', width: '16px' }} />}
          {col.name}
        </button>
        {hasChildren && isExpanded && col.children.map((c) => renderCollection(c, depth + 1))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>{error}</p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Please configure the Zotero data directory in <a href="/settings" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>Settings</a>.
        </p>
      </div>
    );
  }

  if (loadingCollections) {
    return (
      <div className="flex items-center justify-center py-12">
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading Zotero library...</p>
      </div>
    );
  }

  if (importState === 'done') {
    const successCount = importResults.filter((r) => r.status === 'success').length;
    const failCount = importResults.filter((r) => r.status === 'error').length;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          Import Complete
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {successCount} imported successfully{failCount > 0 ? `, ${failCount} failed` : ''}
        </p>
        {failCount > 0 && (
          <div className="mt-4 text-left w-full max-w-md">
            {importResults.filter((r) => r.status === 'error').map((r) => (
              <p key={r.key} style={{ color: 'var(--rose)', fontSize: '12px' }}>
                {r.key}: {r.error}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '400px' }}>
      <div className="flex flex-1 min-h-0">
        {/* Left: Collection tree */}
        <div className="overflow-y-auto pr-2" style={{ width: '200px', borderRight: '1px solid var(--border)' }}>
          <button
            onClick={() => loadItems(null)}
            className="w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: selectedCollectionId === null ? 'var(--glass)' : 'transparent',
              color: selectedCollectionId === null ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            All Papers ({totalPapers})
          </button>
          {collections.map((c) => renderCollection(c))}
        </div>

        {/* Right: Item list */}
        <div className="flex-1 overflow-y-auto pl-3">
          {loadingItems ? (
            <div className="flex items-center justify-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                {selectedCollectionId === null && !loadingItems
                  ? 'Select a collection to browse papers'
                  : 'No papers with PDF attachments'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {selectedKeys.size === items.filter((i) => !i.alreadyImported).length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {items.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
                  style={{ opacity: item.alreadyImported ? 0.5 : 1 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(item.key)}
                    onChange={() => toggleSelect(item.key)}
                    style={{ accentColor: 'var(--text-primary)' }}
                  />
                  <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  {item.alreadyImported && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ color: 'var(--text-tertiary)', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}
                    >
                      Imported
                    </span>
                  )}
                </label>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between pt-3 mt-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
            {selectedKeys.size} selected
          </span>
          {folders.length > 0 && (
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="text-sm px-2 py-1 rounded-lg"
              style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={selectedKeys.size === 0 || importState === 'importing'}
            className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
          >
            {importState === 'importing' ? 'Importing...' : `Import ${selectedKeys.size} Papers`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/zotero-import.tsx
git commit -m "feat: add Zotero import panel component"
```

---

### Task 11: Integrate into upload-modal.tsx

**Files:**
- Modify: `src/components/upload-modal.tsx`

- [ ] **Step 1: Add tab state and imports**

At the top of `upload-modal.tsx`, add the import:

```typescript
import { ZoteroImport } from './zotero-import';
```

Inside the component function, add tab state (after existing state declarations ~line 84):

```typescript
const [activeTab, setActiveTab] = useState<'upload' | 'zotero'>('upload');
```

Also need folders — add state and fetch:

```typescript
const [folders, setFolders] = useState<Folder[]>([]);

useEffect(() => {
  async function loadFolders() {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch { /* ignore */ }
  }
  loadFolders();
}, []);
```

Add the `Folder` type to imports from `@/types`.

- [ ] **Step 2: Add tab switcher in the render**

At the top of the modal content (inside the modal container, before the drop zone), add:

```tsx
<div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--glass)' }}>
  <button
    onClick={() => setActiveTab('upload')}
    className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
    style={{
      background: activeTab === 'upload' ? 'var(--bg)' : 'transparent',
      color: activeTab === 'upload' ? 'var(--text-primary)' : 'var(--text-tertiary)',
    }}
  >
    Local Upload
  </button>
  <button
    onClick={() => setActiveTab('zotero')}
    className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
    style={{
      background: activeTab === 'zotero' ? 'var(--bg)' : 'transparent',
      color: activeTab === 'zotero' ? 'var(--text-primary)' : 'var(--text-tertiary)',
    }}
  >
    Zotero Import
  </button>
</div>
```

- [ ] **Step 3: Conditionally render tab content**

Wrap the existing upload content in `{activeTab === 'upload' && (...)}`.

Add after it:

```tsx
{activeTab === 'zotero' && (
  <ZoteroImport
    folders={folders}
    onImportComplete={() => {
      window.dispatchEvent(new CustomEvent('paperUploaded'));
    }}
    onClose={handleClose}
  />
)}
```

- [ ] **Step 4: Run dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000`, click Upload, verify both tabs work.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/upload-modal.tsx
git commit -m "feat: integrate Zotero import tab into upload modal"
```

---

### Task 12: Build verification

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: Build succeeds without errors. Watch for `better-sqlite3` webpack bundling issues — if the build fails with native module errors, verify `serverExternalPackages` is correct in `next.config.ts`.

- [ ] **Step 2: Run all tests one final time**

```bash
npm test
```

Expected: ALL PASS

- [ ] **Step 3: Final commit if any fixes needed**

If any fixes were required for the build, commit them:

```bash
git add -A
git commit -m "fix: resolve build issues for Zotero import"
```
