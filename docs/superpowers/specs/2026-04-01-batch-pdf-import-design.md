# Batch PDF Import Design

## Overview

Enhance the existing upload modal to support batch importing multiple PDF files at once, via multi-file selection, folder selection, and multi-file drag-and-drop. Papers can optionally be assigned to a folder during import. No automatic AI analysis is triggered.

## Approach

**Frontend-only batch logic (Approach A):** Enhance `upload-modal.tsx` to accept multiple files, then serially call the existing single-file `POST /api/upload` API for each file. This requires zero backend changes and minimal risk.

## Requirements

- Multi-file selection via file picker (`multiple` attribute)
- Folder selection via file picker (`webkitdirectory` attribute) with automatic PDF filtering
- Drag-and-drop multiple files into the upload zone
- Optional folder assignment via dropdown (using existing folders from `/api/folders`)
- Simple progress bar showing "Uploading X/N..."
- Continue uploading remaining files if one fails
- Summary message on completion showing success/failure counts
- No automatic AI analysis after import
- Existing single-file upload experience preserved

## Architecture

### Data Flow

```
User selects multiple PDFs + optional target folder
    ↓
Frontend filters non-PDF files from selection
    ↓
Serial loop for each file:
    POST /api/upload (single file via FormData)
    → Success → if folder selected → PATCH /api/paper/{id} (set folderId)
    → Failure → record error, continue to next file
    → Update progress bar
    ↓
All complete → refresh paper list → show result summary → auto-close
```

### Components

#### Modified: `src/components/upload-modal.tsx`

Primary changes:

1. **File Input Enhancement**
   - Add `multiple` attribute to existing `<input type="file">`
   - Add second input with `webkitdirectory` attribute for folder selection
   - "Choose Files" and "Choose Folder" as two separate buttons

2. **State Management**
   - `selectedFiles: File[]` — list of PDF files selected for upload
   - `uploadProgress: { current: number; total: number }` — progress tracking
   - `uploadResults: { success: number; failed: number }` — completion summary
   - `targetFolderId: string | null` — optional folder assignment
   - `folders: Folder[]` — available folders fetched from API

3. **Upload Flow**
   - On file selection/drop: filter to `.pdf` files only, update `selectedFiles`
   - On confirm: serial loop calling existing `uploadFile()` for each file
   - After each successful upload with `targetFolderId`: call `PATCH /api/paper/{id}` to set `folderId`
   - Update `uploadProgress` after each file
   - On completion: show summary, auto-close after 2 seconds if all succeeded

4. **Drag-and-Drop**
   - `handleDrop` adapted to collect all PDF files from `dataTransfer.files`
   - For folder drops, use `dataTransfer.items` with `webkitGetAsEntry()` to recursively collect PDFs

5. **UI States**
   - **Selection state**: Shows file count + folder selector + "Start Upload" button
   - **Uploading state**: Progress bar + "Uploading 3/10..." text
   - **Complete state**: "X files uploaded successfully" (+ "Y failed" if any)

#### Modified: `src/app/page.tsx`

- `handleCol2Drop`: Adapt to pass array of files when multiple PDFs are dropped onto paper list column

### API Usage

No new API endpoints. Existing endpoints used:

- `POST /api/upload` — unchanged, called once per file
- `PATCH /api/paper/[id]` — unchanged, called to set `folderId` after each successful upload
- `GET /api/folders` — unchanged, called to populate folder dropdown

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Non-PDF file in selection | Filtered out before upload, not counted |
| File exceeds 50MB | API returns error, recorded as failed, continue |
| Network error | Recorded as failed, continue with next file |
| All files fail | Show error summary, keep modal open |
| Partial success | Show "X succeeded, Y failed" summary |

### Testing Strategy

Manual testing scenarios:
- Multi-select PDF files via file picker → all upload successfully
- Select folder containing mix of PDF and non-PDF → only PDFs uploaded
- Drag multiple files onto modal → all PDFs uploaded
- Drag multiple files onto paper list → batch upload triggered
- Select target folder → uploaded papers appear in correct folder
- Include oversized file → skipped with error, others continue
- Single file upload → existing behavior unchanged
