# Zotero Import Design Spec

## Overview

Add a "one-click Zotero import" feature to EasyPaper that reads the local Zotero SQLite database, lets users browse their Zotero collections and select papers, then imports the PDFs with proper titles into EasyPaper.

## Connection Method

**Direct local SQLite read** — open `~/Zotero/zotero.sqlite` in read-only mode (`OPEN_READONLY`). Uses `better-sqlite3` npm package.

Note: Do NOT use `immutable=1` — if Zotero is running and writing in WAL mode, `immutable` could cause read errors. Plain `OPEN_READONLY` handles WAL safely. If Zotero is running, data may be slightly stale (acceptable).

The Zotero data directory path is configurable in EasyPaper settings (default: `~/Zotero/`).

## Zotero Database Schema (Relevant Tables)

- **collections** — `collectionID`, `collectionName`, `parentCollectionID` (tree structure)
- **collectionItems** — `collectionID`, `itemID` (junction table)
- **items** — `itemID`, `itemTypeID`, `key`, `libraryID`
- **itemAttachments** — `itemID`, `parentItemID`, `linkMode`, `contentType`, `path`
- **itemData** + **itemDataValues** + **fields** — normalized metadata (title via fieldName='title')

PDF files: `~/Zotero/storage/{attachment_key}/{filename}` where `attachment_key` is the attachment item's `key`, and `path` in `itemAttachments` is `storage:{filename}`.

## Backend API

All Zotero API routes must include `export const runtime = 'nodejs'` since `better-sqlite3` is a native C++ addon that cannot be bundled by webpack. Also add `better-sqlite3` to `serverExternalPackages` in `next.config.ts`.

### 1. `GET /api/zotero/collections`

Returns the Zotero collection tree.

**Response:**
```json
{
  "collections": [
    { "id": 1, "name": "多目标/多场景", "parentId": null, "children": [] }
  ],
  "totalPapers": 116
}
```

Opens SQLite read-only, queries `collections` table, builds tree from `parentCollectionID`. Counts total items with PDF attachments.

### 2. `GET /api/zotero/items?collectionId=xxx`

Returns papers in a collection with PDF info. If `collectionId` omitted, returns all papers with PDFs.

**Response:**
```json
{
  "items": [
    {
      "key": "ABC12345",
      "title": "Attention Is All You Need",
      "attachmentKey": "74ARZM5V",
      "pdfFilename": "1706.03762v7.pdf",
      "pdfSize": 2345678,
      "alreadyImported": false
    }
  ]
}
```

Joins `collectionItems` + `items` + `itemData` + `itemDataValues` for titles, `itemAttachments` for PDFs (`contentType = 'application/pdf'`). Checks existing EasyPaper papers by filename+size for `alreadyImported`.

**Dedup limitation:** filename+size matching is imperfect — the same paper uploaded via UI (e.g., `"paper.pdf"`) vs Zotero (e.g., `"1706.03762v7.pdf"`) won't match. Acceptable for v1; file hash dedup can be added later.

### 3. `POST /api/zotero/import`

**Request:** `{ items: [{ key, title, attachmentKey, pdfFilename }], folderId?: string }`

**Response:** `{ results: [{ key, paperId?, status: "success"|"error", error? }] }`

**Per item flow:**
1. Resolve PDF at `{zoteroDataDir}/storage/{attachmentKey}/{pdfFilename}`
2. Validate file exists and is readable
3. Read PDF binary into buffer
4. **Extract page count** from PDF buffer (reuse existing `countPdfPages()` logic from upload route — scan for `/Type /Page` entries)
5. Generate new UUID paperId
6. `storage.createPaperDir(paperId)`
7. `storage.savePdf(paperId, buffer)`
8. `storage.saveMetadata(paperId, { id, title, filename: pdfFilename, pages, status: 'pending', folderId, createdAt })`
9. Return success with paperId

## Type Definitions

Add to `src/types/index.ts`:

```typescript
// Zotero Import Types
interface ZoteroCollection {
  id: number;
  name: string;
  parentId: number | null;
  children: ZoteroCollection[];
}

interface ZoteroItem {
  key: string;
  title: string;
  attachmentKey: string;
  pdfFilename: string;
  pdfSize: number;
  alreadyImported: boolean;
}

interface ZoteroImportRequest {
  items: Array<{
    key: string;
    title: string;
    attachmentKey: string;
    pdfFilename: string;
  }>;
  folderId?: string;
}

interface ZoteroImportResult {
  key: string;
  paperId?: string;
  status: 'success' | 'error';
  error?: string;
}
```

Add to `AppSettings` type:
```typescript
zoteroDataDir?: string;  // default: ~/Zotero/
```

## Frontend UI

### Upload Modal Tab Extension

Add tab switcher in `upload-modal.tsx`: `本地上传` | `Zotero 导入`

### Zotero Import Panel (`zotero-import.tsx`)

Two-column layout:
- **Left:** Collection tree (expand/collapse, "全部文献" virtual node)
- **Right:** Item list (checkbox + title + "已导入" badge)
- **Bottom:** Selected count, optional folder picker, import button, progress

### Interaction Flow

1. Switch to "Zotero 导入" tab → collections load
2. If DB not found → show message linking to settings
3. Click collection → items load
4. Check papers → click "导入到 EasyPaper"
5. Progress shown → result summary → dispatch `paperUploaded` custom DOM event (same pattern as existing upload) → modal closes

### Error States

- **Zotero not found:** "未找到 Zotero 数据库，请在设置中配置路径"
- **SQLite open failure** (corrupted, permission denied): "无法读取 Zotero 数据库: {error}"
- **PDF missing:** individual item fails, others continue
- **Already imported:** shown with badge, unchecked by default

## Settings Extension

New field on `/settings`: "Zotero 数据目录" (default `~/Zotero/`), stored as `zoteroDataDir` in `~/.easypaper/config/settings.json` (follows existing `getConfigDir()` pattern). Validates `zotero.sqlite` exists at the given path.

## File Changes

**New files:**

| File | Purpose |
|------|---------|
| `src/lib/zotero.ts` | Zotero SQLite read logic |
| `src/app/api/zotero/collections/route.ts` | Collections API |
| `src/app/api/zotero/items/route.ts` | Items API |
| `src/app/api/zotero/import/route.ts` | Import API |
| `src/components/zotero-import.tsx` | Import panel component |

**Modified files:**

| File | Change |
|------|--------|
| `src/components/upload-modal.tsx` | Tab switcher + ZoteroImport integration |
| `src/lib/storage.ts` | Add method to find existing papers by filename+size |
| `src/app/settings/page.tsx` | Zotero path config field |
| `src/types/index.ts` | Zotero type definitions + `zoteroDataDir` in AppSettings |
| `package.json` | Add `better-sqlite3` + `@types/better-sqlite3` |
| `next.config.ts` | Add `better-sqlite3` to `serverExternalPackages` |

## Dependencies

- `better-sqlite3` + `@types/better-sqlite3`

## Post-Import

Papers enter `status: 'pending'`. Users manually trigger AI analysis.
