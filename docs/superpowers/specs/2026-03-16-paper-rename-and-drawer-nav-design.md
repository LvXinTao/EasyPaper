# Paper Rename & Folder Navigation Drawer Design Spec

## Goal

Two features:

1. **Paper Rename** — Allow users to rename papers by clicking the title inline on the paper detail page.
2. **Folder Navigation Drawer** — A left-side drawer with a multi-level folder tree for organizing and switching between papers.

## Context

Currently:
- Paper titles are extracted from filenames on upload (e.g., `2509.20904v2.pdf` → `2509.20904v2`) and cannot be edited.
- There is no way to navigate between papers from the detail page — users must go back to the home page.
- Papers are stored flat in `data/papers/{paperId}/` with no folder/grouping concept.
- The Navbar component (`navbar.tsx`) contains only the logo and settings button.

## Feature 1: Paper Rename

### Interaction

In the paper detail page header, the `<h1>` that displays `data.metadata.title` becomes an inline-editable field:

- **Default state**: Title text displayed with `cursor-pointer` and a dashed underline on hover, signaling editability.
- **Edit state**: Clicking the title replaces it with an `<input>` element. The input is auto-focused with text fully selected.
- **Save**: Press Enter or blur the input → call `PATCH /api/paper/{id}` with the new title → return to default state.
- **Cancel**: Press Escape → discard changes, restore original title.
- **Loading**: While the PATCH request is in-flight, the input shows a disabled state.
- **Error**: If the API call fails, restore the original title and show a brief error indication.

### Component

Create `src/components/editable-title.tsx`:

```tsx
interface EditableTitleProps {
  value: string;
  onSave: (newTitle: string) => Promise<void>;
}
```

- Manages its own `isEditing` and `editValue` state internally.
- Validates: trims whitespace, rejects empty strings, max 200 characters.
- Used in the paper detail page header, replacing the current `<h1>` that displays `data.metadata.title`.

### API

Add `PATCH` handler to `src/app/api/paper/[id]/route.ts`:

- Request body: `{ title: string }`
- Validation: `title` must be a non-empty string after trimming, max 200 characters.
- Reads existing `metadata.json` → updates `title` field → writes back.
- Response: `{ success: true, metadata: PaperMetadata }`

### Storage

Add `updateMetadata` method to `storage` object in `src/lib/storage.ts`:

```ts
async updateMetadata(paperId: string, updates: Partial<PaperMetadata>): Promise<PaperMetadata>
```

Reads the current metadata, merges with `updates`, writes back, and returns the merged result. The `id` field in `updates` is ignored (cannot change paper ID).

Note: This is a read-modify-write pattern on a JSON file. Concurrent calls could race (e.g., rename + status change from analyze). This is an accepted limitation for a file-based single-user app. If it becomes an issue, a simple file lock (e.g., `proper-lockfile`) can be added later.

### Frontend Integration

In `src/app/paper/[id]/page.tsx`:
- Replace the `<h1>{data.metadata.title}</h1>` with `<EditableTitle value={data.metadata.title} onSave={handleRename} />`.
- `handleRename` calls `PATCH /api/paper/{paperId}` then calls `refetch()` (from the existing `usePaper` hook) to refresh paper data. The `usePaper` hook already provides `refetch` — no hook changes needed.

## Feature 2: Folder Navigation Drawer

### Folder Data Model

Create a new file `config/folders.json` to store the folder tree:

```json
{
  "folders": [
    { "id": "f_abc123", "name": "NLP", "parentId": null },
    { "id": "f_def456", "name": "Transformer", "parentId": "f_abc123" },
    { "id": "f_ghi789", "name": "计算机视觉", "parentId": null }
  ]
}
```

Add a `Folder` type to `src/types/index.ts`:

```ts
interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}
```

Folder `id` uses a UUID-style format with a `f_` prefix (e.g., `f_abc123`). This avoids conflicts with Next.js dynamic routing (no slashes in IDs) and ensures uniqueness.

### Paper-Folder Association

Add an optional `folderId` field to `PaperMetadata`:

```ts
interface PaperMetadata {
  // ... existing fields
  folderId?: string | null;  // null or missing = root level
}
```

Add `folderId` to `PaperListItem` as well so the drawer can build the tree from the papers list API.

### Folder API Endpoints

Create `src/app/api/folders/route.ts`:

- `GET /api/folders` — Returns `{ folders: Folder[] }` from `config/folders.json`.
- `POST /api/folders` — Create a folder. Body: `{ name: string, parentId?: string }`. Generates a unique `id` with `f_` prefix + short UUID. Folder name must be non-empty after trimming, max 100 characters. Duplicate names under the same parent are allowed (distinguished by ID). Returns `{ folder: Folder }`.

Create `src/app/api/folders/[id]/route.ts`:

- `PATCH /api/folders/{id}` — Rename a folder. Body: `{ name: string }`. Returns `{ folder: Folder }`.
- `DELETE /api/folders/{id}` — Delete a folder and all its descendant sub-folders. All papers in the deleted folder and any descendant folders are moved to the deleted folder's parent (or root if the deleted folder was top-level). Returns `{ success: true }`. Confirmation is handled client-side before calling this endpoint.

### Moving Papers Between Folders

Extend the existing `PATCH /api/paper/[id]` endpoint (added for rename) to also accept `folderId`:

- Body: `{ folderId: string | null }` — `null` moves the paper to root.
- Updates `metadata.json` with the new `folderId`.

### Storage Layer

Add folder CRUD methods to `storage` in `src/lib/storage.ts`:

- `getFolders(): Promise<Folder[]>` — Read `config/folders.json`, return empty array if file doesn't exist.
- `saveFolders(folders: Folder[]): Promise<void>` — Write `config/folders.json`.

Update `listPapers()` to include `folderId` in the returned `PaperListItem` objects.

### Drawer Trigger

Currently `Navbar` is rendered in `layout.tsx` (a server component), so the paper detail page cannot pass props to it directly. To solve this, the hamburger button and drawer are rendered **inside the paper detail page** rather than inside Navbar.

Add the hamburger button as a fixed-position element that visually appears in the Navbar area but is actually rendered by the paper detail page. It sits at the left edge of the Navbar, using `fixed` positioning with matching Navbar height and styling:

```tsx
// Rendered by paper detail page, visually overlays the Navbar's left area
<button
  className="fixed top-0 left-0 z-40 h-[52px] px-3 flex items-center"
  onClick={() => setDrawerOpen(prev => !prev)}
>
  {/* hamburger icon */}
</button>
```

To make room for this button, adjust the Navbar's left padding when on a paper detail page. This can be done by adding a CSS class to the `<main>` element or by having the Navbar always include left padding (since it doesn't hurt on the home page — the slight extra padding is negligible).

Alternative: simply render the hamburger button overlapping the Navbar area. Since the Navbar's left side has the "EP EasyPaper" logo with some padding, the hamburger button can be placed to the left of the logo using absolute positioning within the paper detail page.

The `Navbar` component itself is **not modified**. The `layout.tsx` is **not modified**.

### Drawer Component

Create `src/components/paper-drawer.tsx`:

```ts
interface PaperDrawerProps {
  open: boolean;
  onClose: () => void;
  currentPaperId: string;
}
```

**Layout:**
- Overlay: semi-transparent black backdrop (`bg-black/30`), click to close. Uses `z-30` (below the Settings modal at `z-50` and below the hamburger button at `z-40`).
- Panel: slides in from the left, 320px wide, white background, full height below Navbar. Uses `z-30` (same layer as overlay, but rendered after it).
- Animation: CSS transition, 200ms slide in/out.
- Close: click backdrop, press Escape, or click a paper to navigate.
- Accessibility: drawer panel has `role="dialog"`, `aria-label="Paper navigation"`. Focus is trapped inside the drawer while open. On close, focus returns to the hamburger button.

**Content (top to bottom):**

1. **Search bar** — Text input with search icon. Filters papers by title in real-time (client-side filter). Adjacent "+" button to create a new root-level folder.

2. **Folder tree** — Renders folders and papers in a tree structure:
   - **Folder row**: Expand/collapse chevron (▶/▼), folder icon, name, paper count badge, "⋯" menu button.
   - **Paper row**: Document icon, title (truncated), status badge (reusing PaperCard color scheme), relative time. Current paper highlighted with left border + background color.
   - Indentation increases with nesting level (20px per level) with a left border line for visual hierarchy.
   - Root-level papers (no folder) appear at the top or bottom of the tree.
   - Folders are sorted alphabetically. Papers within folders sorted by creation date (newest first).

3. **Folder context menu** (⋯ button): New sub-folder, Rename, Delete folder.

4. **Paper context menu** (right-click or long-press): "Move to..." (opens a folder picker), "Delete paper" (shows confirmation dialog before deleting).

**Move-to picker**: A small modal/popover showing the folder tree with radio-button selection. Includes a "Root (no folder)" option. Selecting a folder and confirming moves the paper.

**Data fetching:**
- On drawer open, fetch `GET /api/papers` and `GET /api/folders` in parallel.
- Cache results in component state. Re-fetch each time the drawer opens (ensures freshness).
- Tree building: client-side — group papers by `folderId`, nest folders by `parentId`.

### State Management

The drawer open/close state lives in the paper detail page (`page.tsx`):

```tsx
const [drawerOpen, setDrawerOpen] = useState(false);
```

The paper detail page renders:
- The hamburger button (fixed-position overlay on Navbar area)
- `<PaperDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} currentPaperId={paperId} />`

The Navbar component is not involved in drawer state management.

### Home Page Integration

The home page (`page.tsx`) is not changed in this iteration. Folder management only happens through the drawer on paper detail pages. The home page continues to show a flat list of all papers.

Future consideration: the home page could adopt the folder view, but that's out of scope for now.

### Upload with Folder Selection

Not changed in this iteration. Uploads always go to root (no `folderId`). Users can move papers to folders via the drawer after upload.

Future consideration: add a folder picker to the upload dialog.

## Files Changed

| File | Action | Change |
|------|--------|--------|
| `src/types/index.ts` | Modify | Add `Folder` type, add `folderId?` to `PaperMetadata` and `PaperListItem` |
| `src/lib/storage.ts` | Modify | Add `updateMetadata()`, `getFolders()`, `saveFolders()`, update `listPapers()` |
| `src/app/api/paper/[id]/route.ts` | Modify | Add `PATCH` handler for rename + move |
| `src/app/api/folders/route.ts` | Create | `GET` and `POST` for folder list/create |
| `src/app/api/folders/[id]/route.ts` | Create | `PATCH` and `DELETE` for folder rename/delete |
| `src/components/editable-title.tsx` | Create | Inline-editable title component |
| `src/components/paper-drawer.tsx` | Create | Drawer with folder tree, search, context menus |
| `src/app/paper/[id]/page.tsx` | Modify | Integrate EditableTitle, drawer state, hamburger button |

## Files NOT Changed

- `src/components/navbar.tsx` — Hamburger button is rendered by the paper detail page, not inside Navbar
- `src/app/layout.tsx` — No changes to the root layout
- `src/app/page.tsx` — Home page stays as flat list (future scope)
- `src/components/upload-zone.tsx` — Upload doesn't include folder picker (future scope)
- `src/app/api/upload/route.ts` — No upload changes (future scope)
- `src/lib/prompts.ts` — No AI prompt changes
- Storage layout on disk — Papers stay in `data/papers/{paperId}/`, folder association is metadata-only

## Backwards Compatibility

- `folderId` is optional on `PaperMetadata`. Existing papers have no `folderId` and appear at root level.
- `config/folders.json` is created lazily on first folder creation. Empty folder list returned when file doesn't exist.
- No data migration needed.
