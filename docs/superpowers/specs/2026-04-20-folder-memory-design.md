# Design: Homepage View State Persistence

## Problem

When navigating back to the homepage after visiting a paper detail page, the selected folder and other filter/sort settings are lost. Users must re-select their folder and re-apply filters each time.

## Scope

Persist the following homepage view state in `localStorage` and restore it on page load:

| State | Current Behavior | Target Behavior |
|-------|-----------------|-----------------|
| `selectedFolderId` | Lost on navigation | Persisted |
| `searchQuery` | Lost on navigation | Persisted |
| `statusFilter` | Lost on navigation | Persisted |
| `starredOnly` | Lost on navigation | Persisted |
| `sortMode` | Already persisted (separate key) | Merged into unified key |

Storage: `localStorage` — per-browser, no server sync.

## Architecture

### Unified State Key

Replace the existing `homepageSortMode` localStorage key with a single unified key: `homepageViewState`.

```json
{
  "selectedFolderId": "folder_abc123",
  "searchQuery": "",
  "statusFilter": "all",
  "starredOnly": false,
  "sortMode": "recent"
}
```

### Initialization

Each state variable initializes from localStorage on component mount:

```ts
const savedState = loadSavedViewState();
const [selectedFolderId, setSelectedFolderId] = useState<string | null>(savedState.selectedFolderId);
// ... same pattern for other states
```

### Auto-save on Change

Use a single `useEffect` that watches all state variables and writes to localStorage whenever any changes:

```ts
useEffect(() => {
  saveViewState({ selectedFolderId, searchQuery, statusFilter, starredOnly, sortMode });
}, [selectedFolderId, searchQuery, statusFilter, starredOnly, sortMode]);
```

### SortMode Migration

The existing `homepageSortMode` key is removed. On first load, if `homepageViewState` doesn't exist but `homepageSortMode` does, migrate its value into the new unified key, then delete the old key.

### Error Handling

- Wrap all localStorage reads/writes in try/catch (matching existing sortMode pattern)
- If localStorage is unavailable or data is corrupted, fall back to default values silently

### Reset Behavior

No explicit reset button needed. Users can clear individual filters manually or refresh from a clean browser context.

## Files Changed

- `src/app/page.tsx` — Add unified state persistence logic, reset button

## Dependencies

None — uses existing React hooks and browser localStorage API.
