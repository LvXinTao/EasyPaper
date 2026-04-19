# Folder Memory Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and restore homepage view state (selected folder, search, status filter, starred, sort mode) across browser sessions using localStorage.

**Architecture:** Add a single useEffect to auto-save state changes, and initialize all five state variables from a unified localStorage key on component mount with migration from the old separate key.

**Tech Stack:** React hooks (useState, useEffect), browser localStorage API, TypeScript

---

## File Structure

Only one file needs modification:

- **Modify:** `src/app/page.tsx` — Add localStorage helpers, state initialization, auto-save effect, remove old sortMode localStorage logic

No new files, no new tests needed (changes are straightforward localStorage plumbing; existing component tests cover UI behavior).

---

### Task 1: Add localStorage helpers and update state initialization

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add helper functions before the HomePage component**

Add these functions right before `export default function HomePage()`:

```typescript
const VIEW_STATE_KEY = 'homepageViewState';

interface SavedViewState {
  selectedFolderId: string | null;
  searchQuery: string;
  statusFilter: 'all' | 'analyzed' | 'pending' | 'error';
  starredOnly: boolean;
  sortMode: 'recent' | 'name' | 'starred' | 'date';
}

function loadSavedViewState(): SavedViewState {
  const defaults: SavedViewState = {
    selectedFolderId: null,
    searchQuery: '',
    statusFilter: 'all',
    starredOnly: false,
    sortMode: 'recent',
  };
  if (typeof window === 'undefined') return defaults;
  try {
    // Migration: check old standalone key
    const oldSortMode = localStorage.getItem('homepageSortMode');
    const raw = localStorage.getItem(VIEW_STATE_KEY);
    if (!raw) {
      if (oldSortMode) {
        // Migrate old key into unified state
        const migrated = { ...defaults, sortMode: oldSortMode as SavedViewState['sortMode'] };
        localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(migrated));
        localStorage.removeItem('homepageSortMode');
        return migrated;
      }
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<SavedViewState>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function saveViewState(state: SavedViewState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}
```

- [ ] **Step 2: Update state variable initialization**

Replace the existing state declarations (lines 23-50) with:

```typescript
const savedState = loadSavedViewState();
const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
const [selectedFolderId, setSelectedFolderId] = useState<string | null>(savedState.selectedFolderId);
const [searchQuery, setSearchQuery] = useState(savedState.searchQuery);
```

Replace lines 38-50 (statusFilter, starredOnly, sortMode initialization) with:

```typescript
const [statusFilter, setStatusFilter] = useState(savedState.statusFilter);
const [starredOnly, setStarredOnly] = useState(savedState.starredOnly);
const [sortMode, setSortMode] = useState(savedState.sortMode);
```

Remove the old sortMode initializer that reads from localStorage (lines 40-50).

- [ ] **Step 3: Update handleSortModeChange to remove localStorage write**

Change `handleSortModeChange` (line 52-55) to simply set state without localStorage:

```typescript
const handleSortModeChange = useCallback((newMode: 'recent' | 'name' | 'starred' | 'date') => {
  setSortMode(newMode);
}, []);
```

Remove the `localStorage.setItem` call from this function since the unified useEffect handles persistence.

- [ ] **Step 4: Add auto-save useEffect**

Add this useEffect after the toast hook (around line 57):

```typescript
// Persist view state changes to localStorage
useEffect(() => {
  saveViewState({ selectedFolderId, searchQuery, statusFilter, starredOnly, sortMode });
}, [selectedFolderId, searchQuery, statusFilter, starredOnly, sortMode]);
```

- [ ] **Step 5: Run dev server to verify**

Run: `npm run dev`

Expected: Dev server starts on localhost:3000 without errors. Select a folder, apply filters, navigate to a paper detail page, then navigate back — all state should be preserved.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: persist homepage view state (folder, filters, sort) in localStorage"
```

---

## Chunk 1: All tasks above (single logical change, one file)
