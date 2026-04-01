# Batch PDF Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable batch importing multiple PDF files via multi-file selection, folder selection, and multi-file drag-and-drop, with optional folder assignment.

**Architecture:** Enhance the existing `upload-modal.tsx` to accept multiple files and serially call the existing `POST /api/upload` API for each file. No backend changes needed. The modal gains a two-phase flow: selection phase (pick files + optional folder) then upload phase (serial uploads with progress bar).

**Tech Stack:** React 19, Next.js App Router, existing `/api/upload` and `/api/paper/[id]` endpoints.

**Spec:** `docs/superpowers/specs/2026-04-01-batch-pdf-import-design.md`

---

## Chunk 1: Batch Upload Modal

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/components/upload-modal.tsx` | Add multi-file selection, folder selection, folder picker dropdown, serial batch upload with progress |
| Modify | `src/app/page.tsx` | Adapt `handleCol2Drop` and `droppedFile` state for multi-file drops, pass `initialFiles` array |

### Task 1: Enhance upload-modal.tsx for batch file selection and upload

**Files:**
- Modify: `src/components/upload-modal.tsx` (full rewrite of this 138-line component)

- [ ] **Step 1: Update the UploadModal props and state**

Change `initialFile?: File | null` to `initialFiles?: File[] | null` in the props interface. Add new state variables for batch mode:

```tsx
interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (paperId: string) => void;
  initialFiles?: File[] | null;   // Changed from initialFile
}
```

Remove the `useRouter` import and `router` variable — they are no longer needed since batch mode uses `onUploadComplete` callback instead of `router.push`.

Carry forward existing refs and add new ones:
```tsx
const inputRef = useRef<HTMLInputElement>(null);
const folderInputRef = useRef<HTMLInputElement>(null);
```

New state:
```tsx
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
const [folders, setFolders] = useState<Folder[]>([]);  // Uses Folder type from @/types
const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
const [uploadResults, setUploadResults] = useState<{ success: number; failed: number } | null>(null);
```

Add import at top of file:
```tsx
import type { Folder } from '@/types';
```

- [ ] **Step 2: Add folder fetching**

Fetch folders when modal opens:
```tsx
useEffect(() => {
  if (isOpen) {
    fetch('/api/folders').then(res => res.json()).then(data => setFolders(data.folders || [])).catch(() => {});
  }
}, [isOpen]);
```

- [ ] **Step 3: Add PDF filtering helper**

```tsx
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const filterPdfFiles = (files: FileList | File[]): File[] => {
  return Array.from(files).filter(
    f => (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
  );
};
```

- [ ] **Step 4: Add file selection handlers**

Multi-file input handler:
```tsx
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (files) {
    setSelectedFiles(prev => [...prev, ...filterPdfFiles(files)]);
  }
  e.target.value = ''; // Reset so same files can be re-selected
};
```

Folder input handler (second hidden input with `webkitdirectory`):
```tsx
const folderInputRef = useRef<HTMLInputElement>(null);

const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (files) {
    setSelectedFiles(prev => [...prev, ...filterPdfFiles(files)]);
  }
  e.target.value = '';
};
```

- [ ] **Step 5: Update drag-and-drop handler for multiple files (including folder drops)**

Handle both file drops and folder drops. When a folder is dropped, use `webkitGetAsEntry()` to recursively traverse and collect PDF files:

```tsx
// Helper to recursively read entries from a dropped folder
const collectPdfFilesFromEntries = async (items: DataTransferItemList): Promise<File[]> => {
  const files: File[] = [];

  const readEntry = (entry: FileSystemEntry): Promise<void> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file) => {
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            files.push(file);
          }
          resolve();
        }, () => resolve());
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        reader.readEntries(async (entries) => {
          for (const e of entries) {
            await readEntry(e);
          }
          resolve();
        }, () => resolve());
      } else {
        resolve();
      }
    });
  };

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  for (const entry of entries) {
    await readEntry(entry);
  }
  return files;
};

const handleDrop = useCallback(async (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);

  // Try webkitGetAsEntry first for folder support
  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    const hasEntries = e.dataTransfer.items[0].webkitGetAsEntry;
    if (hasEntries) {
      const files = await collectPdfFilesFromEntries(e.dataTransfer.items);
      if (files.length > 0) {
        setSelectedFiles(prev => [...prev, ...files]);
        return;
      }
    }
  }

  // Fallback: direct file list
  const files = filterPdfFiles(e.dataTransfer.files);
  if (files.length > 0) {
    setSelectedFiles(prev => [...prev, ...files]);
  }
}, []);
```

- [ ] **Step 6: Add handleClose to reset state**

This must be defined before `startBatchUpload` since it references `handleClose`:

```tsx
const handleClose = useCallback(() => {
  setSelectedFiles([]);
  setUploadProgress(null);
  setUploadResults(null);
  setError(null);
  setTargetFolderId(null);
  onClose();
}, [onClose]);
```

Replace all `onClose` references in the JSX (backdrop click, cancel/close buttons) with `handleClose`.

- [ ] **Step 7: Implement batch upload function**

Replace the single-file `uploadFile` with a batch upload function:

```tsx
const startBatchUpload = useCallback(async () => {
  if (selectedFiles.length === 0) return;
  setUploading(true);
  setError(null);
  const total = selectedFiles.length;
  let success = 0;
  let failed = 0;
  const uploadedIds: string[] = [];

  setUploadProgress({ current: 0, total });
  for (let i = 0; i < total; i++) {
    const file = selectedFiles[i];

    // Client-side size check
    if (file.size > MAX_FILE_SIZE) {
      failed++;
      continue;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) {
        failed++;
        continue;
      }
      const { id } = await response.json();
      uploadedIds.push(id);

      // Assign to folder if selected
      if (targetFolderId) {
        await fetch(`/api/paper/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: targetFolderId }),
        });
      }
      success++;
    } catch {
      failed++;
    }
    setUploadProgress({ current: i + 1, total });
  }

  setUploadProgress(null);
  setUploadResults({ success, failed });
  setUploading(false);

  if (success > 0) {
    // Notify parent of last uploaded paper
    const lastId = uploadedIds[uploadedIds.length - 1];
    setTimeout(() => {
      handleClose();
      if (onUploadComplete && lastId) {
        onUploadComplete(lastId);
      }
    }, 2000);
  }
}, [selectedFiles, targetFolderId, handleClose, onUploadComplete]);
```

- [ ] **Step 8: Handle initialFiles pre-population**

Replace the `initialFile` effect. Note: the old single-file behavior auto-uploaded immediately on drop. In batch mode, we pre-populate the file list instead, so users can review the selection, optionally assign a folder, then click "Upload". This is an intentional UX change for batch mode.

```tsx
useEffect(() => {
  if (initialFiles && initialFiles.length > 0 && isOpen) {
    setSelectedFiles(filterPdfFiles(initialFiles));
  }
}, [initialFiles, isOpen]);
```

- [ ] **Step 9: Update the modal UI with three states**

Replace the modal body with three states: selection, uploading, and results.

**Selection state** (when `selectedFiles.length === 0` and not uploading):
- Drop zone with icon
- Text: "Drag & drop PDFs here"
- Subtext: "or choose files / folder"
- Two buttons inside drop zone: "Choose Files" and "Choose Folder"

**Files selected state** (when `selectedFiles.length > 0` and not uploading):
- Text: "{N} PDF files selected"
- Folder dropdown selector (optional)
- A "Remove all" link to clear selection
- "Start Upload" button in the footer

**Uploading state** (when `uploading` is true):
- Progress bar
- Text: "Uploading {current}/{total}..."

**Results state** (when `uploadResults` is not null):
- Success: "X files uploaded successfully"
- With failures: "X succeeded, Y failed"

Full JSX for the modal body:

```tsx
<div className="p-6">
  <div className="flex items-center justify-between mb-1">
    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Upload Papers</h3>
    <button onClick={handleClose} className="cursor-pointer" style={{ color: 'var(--text-tertiary)', fontSize: '18px' }}>×</button>
  </div>
  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
    Upload PDFs to add them to your library
  </p>

  {/* Drop zone / file selection */}
  {!uploading && !uploadResults && (
    <div
      className="rounded-xl text-center transition-all cursor-pointer"
      style={{
        border: isDragging ? '2px dashed var(--accent)' : '2px dashed var(--border-strong)',
        background: isDragging ? 'var(--accent-subtle)' : 'transparent',
        padding: '32px',
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={folderInputRef} type="file" accept=".pdf,application/pdf" {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>} onChange={handleFolderSelect} className="hidden" />

      {selectedFiles.length === 0 ? (
        <div>
          <div className="mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ width: '44px', height: '44px', background: 'var(--accent-subtle)' }}>
            <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Drag & drop PDFs here</div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="cursor-pointer rounded-lg"
              style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              Choose Files
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
              className="cursor-pointer rounded-lg"
              style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              Choose Folder
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)' }}>
            {selectedFiles.length} PDF {selectedFiles.length === 1 ? 'file' : 'files'} selected
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="cursor-pointer rounded-lg"
              style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              Add More
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedFiles([]); }}
              className="cursor-pointer rounded-lg"
              style={{ padding: '5px 12px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', textDecoration: 'underline' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )}

  {/* Uploading progress */}
  {uploading && uploadProgress && (
    <div className="rounded-xl text-center" style={{ border: '2px solid var(--border-strong)', padding: '32px' }}>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)' }}>
        Uploading {uploadProgress.current}/{uploadProgress.total}...
      </div>
      <div className="mt-3 mx-auto h-1.5 rounded-full overflow-hidden" style={{ width: '200px', background: 'var(--surface)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ background: 'var(--accent)', width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
        />
      </div>
    </div>
  )}

  {/* Results */}
  {uploadResults && (
    <div className="rounded-xl text-center" style={{ border: '2px solid var(--border-strong)', padding: '32px' }}>
      <div style={{ fontSize: '13px', fontWeight: 500, color: uploadResults.failed > 0 && uploadResults.success === 0 ? 'var(--rose)' : 'var(--accent)' }}>
        {uploadResults.failed === 0
          ? `${uploadResults.success} ${uploadResults.success === 1 ? 'file' : 'files'} uploaded successfully`
          : `${uploadResults.success} succeeded, ${uploadResults.failed} failed`
        }
      </div>
    </div>
  )}

  {/* Folder selector - shown when files are selected and not uploading */}
  {selectedFiles.length > 0 && !uploading && !uploadResults && folders.length > 0 && (
    <div className="mt-3 flex items-center gap-2">
      <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Add to folder:</label>
      <select
        value={targetFolderId || ''}
        onChange={(e) => setTargetFolderId(e.target.value || null)}
        className="flex-1 rounded-lg"
        style={{
          height: '28px', padding: '0 8px', fontSize: '11px',
          background: 'var(--glass)', border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)', outline: 'none',
        }}
      >
        <option value="">None</option>
        {folders.map(f => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </div>
  )}

  {error && (
    <div className="mt-3 rounded-lg" style={{ fontSize: '12px', color: 'var(--rose)', background: 'var(--rose-subtle)', padding: '8px 12px' }}>
      {error}
    </div>
  )}

  <div className="flex justify-end gap-2 mt-4">
    <button
      onClick={handleClose}
      className="cursor-pointer rounded-lg transition-colors"
      style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
    >
      {uploadResults ? 'Close' : 'Cancel'}
    </button>
    {selectedFiles.length > 0 && !uploading && !uploadResults && (
      <button
        onClick={startBatchUpload}
        className="cursor-pointer rounded-lg transition-colors"
        style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', fontWeight: 500 }}
      >
        Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'}
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 10: Commit**

```bash
git add src/components/upload-modal.tsx
git commit -m "feat: enhance upload modal for batch PDF import with folder selection"
```

### Task 2: Adapt page.tsx for multi-file drops

**Files:**
- Modify: `src/app/page.tsx` (lines 21, 65-68, 152-159, 371-376)

- [ ] **Step 1: Change droppedFile state to droppedFiles array**

In `src/app/page.tsx`, change the state:
```tsx
// Before:
const [droppedFile, setDroppedFile] = useState<File | null>(null);

// After:
const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
```

- [ ] **Step 2: Update handleUploadComplete**

```tsx
// Before:
const handleUploadComplete = (paperId: string) => {
  setDroppedFile(null);
  fetchPapers().then(() => setSelectedPaperId(paperId));
};

// After:
const handleUploadComplete = (paperId: string) => {
  setDroppedFiles(null);
  fetchPapers().then(() => setSelectedPaperId(paperId));
};
```

- [ ] **Step 3: Update handleCol2Drop for multiple files**

```tsx
// Before:
const handleCol2Drop = (e: React.DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
    setDroppedFile(file);
    setUploadOpen(true);
  }
};

// After:
const handleCol2Drop = (e: React.DragEvent) => {
  e.preventDefault();
  const pdfFiles = Array.from(e.dataTransfer.files).filter(
    f => f.type === 'application/pdf' || f.name.endsWith('.pdf')
  );
  if (pdfFiles.length > 0) {
    setDroppedFiles(pdfFiles);
    setUploadOpen(true);
  }
};
```

- [ ] **Step 4: Update UploadModal usage**

```tsx
// Before:
<UploadModal
  isOpen={uploadOpen}
  onClose={() => { setUploadOpen(false); setDroppedFile(null); }}
  onUploadComplete={handleUploadComplete}
  initialFile={droppedFile}
/>

// After:
<UploadModal
  isOpen={uploadOpen}
  onClose={() => { setUploadOpen(false); setDroppedFiles(null); }}
  onUploadComplete={handleUploadComplete}
  initialFiles={droppedFiles}
/>
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Build completes with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: adapt homepage for multi-file drag-and-drop upload"
```

### Task 3: Manual testing and final verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test single file upload**

Open http://localhost:3000, click "+ Upload", select one PDF. Verify it uploads normally and appears in the list.

- [ ] **Step 3: Test multi-file selection**

Click "+ Upload" → "Choose Files" → select multiple PDFs. Verify file count shown. Click "Upload N Files". Verify progress bar and all papers appear.

- [ ] **Step 4: Test folder selection**

Click "+ Upload" → "Choose Folder" → select a folder containing PDFs and non-PDFs. Verify only PDFs are counted. Upload and verify.

- [ ] **Step 5: Test drag-and-drop multiple files**

Drag multiple PDFs onto the modal drop zone. Verify they are added to the selection.

- [ ] **Step 6: Test drag-and-drop on paper list**

Drag multiple PDFs onto the paper list column. Verify the upload modal opens with files pre-selected.

- [ ] **Step 7: Test folder assignment**

Select files, choose a target folder from dropdown, upload. Verify papers appear in the correct folder.

- [ ] **Step 8: Test oversized file handling**

Include a file >50MB in the batch. Verify it's skipped and the results show the failure count.
