# Analysis State Persistence Design

**Date:** 2026-03-19
**Status:** Reviewed

## Problem

When a user triggers paper analysis and navigates away before it completes, the loading UI (spinner + progress steps) disappears on return. The page relies on in-memory React state (`isAnalyzing`) to show progress, which is lost on unmount. Additionally, the backend analysis may fail silently because the SSE stream disconnects when the page unmounts, causing `controller.enqueue()` to throw and the catch block to set `status: 'error'`.

## Solution Overview

Decouple the analysis task from the SSE response stream. The backend runs analysis independently and persists progress to `metadata.json`. The frontend uses a hybrid approach: SSE for real-time streaming on first trigger, polling for recovery after navigation.

## Backend Changes

### 1. Decouple `/api/analyze` POST

Split the current monolithic SSE handler into two parts:

**Trigger endpoint** (`POST /api/analyze`):
- Validates params (paperId exists, API key configured)
- Checks if analysis is already running (`status === 'parsing' | 'analyzing'`); if so, returns `200` with `Content-Type: application/json` and body `{ status: 'already_running' }`
- Otherwise, returns a **SSE stream** (`Content-Type: text/event-stream`) that runs the analysis

**Analysis function** (extracted from current handler):
- An async function that performs: parse PDF → AI analysis → save results
- Updates `metadata.json` at each step with progress info
- Accepts a `send` callback for SSE relay; the callback is **fault-tolerant** (wrapped in try-catch)
- On completion: sets `status: 'analyzed'`, deletes `analysisProgress` from metadata
- On error: sets `status: 'error'`, deletes `analysisProgress` from metadata

**Runtime model — analysis runs WITHIN the stream lifecycle:**
The analysis `Promise` is `await`-ed inside the `ReadableStream.start()` callback. The stream stays open until analysis completes. This ensures the Next.js runtime does not terminate the function prematurely (since the response is still being sent). The key change from today: `controller.enqueue()` failures (caused by client disconnect) are caught and silently ignored — the analysis continues to completion and writes results to disk. The stream is merely a relay; its failure does not abort the work.

**Heartbeat during long AI calls:** During `client.complete()` (which can block for several minutes), the analysis function writes a periodic heartbeat to `metadata.json` every 60 seconds, updating `analysisProgress.updatedAt` without changing the message. This prevents false stale detection on the frontend.

### 2. Extend `PaperMetadata`

Add an `analysisProgress` field to track fine-grained progress:

```typescript
interface PaperMetadata {
  // ... existing fields
  status: PaperStatus;
  analysisProgress?: {
    step: 'parsing' | 'analyzing' | 'saving';
    message: string;
    updatedAt: string;
  };
}
```

Progress updates during analysis:
- Start parsing → `{ step: 'parsing', message: 'Parsing PDF...', updatedAt: '...' }`
- Vision batch progress → `{ step: 'parsing', message: 'Batch 2/5, Pages 3-6...', updatedAt: '...' }`
- AI analysis → `{ step: 'analyzing', message: 'Analyzing with AI (gpt-4o, ~5000 tokens)...', updatedAt: '...' }`
- Saving → `{ step: 'saving', message: 'Saving results...', updatedAt: '...' }`
- Complete → `status: 'analyzed'`, `analysisProgress` deleted from metadata object before writing to disk
- Error → `status: 'error'`, `analysisProgress` deleted from metadata object before writing to disk

Note: To clear `analysisProgress`, use `delete metadata.analysisProgress` before `JSON.stringify`. Do not set it to `undefined` (which would be omitted by JSON.stringify but remain in memory as a truthy `in` check).

**Status during saving step:** `metadata.status` remains `'analyzing'` during the saving step. The finer-grained `'saving'` state is only in `analysisProgress.step`.

### 3. Duplicate Trigger Guard

When `POST /api/analyze` is called while `status` is `parsing` or `analyzing`:
- Check `analysisProgress.updatedAt` — if fresh (< 10 minutes old), return `200 { status: 'already_running' }` with `Content-Type: application/json`
- If stale (> 10 minutes old), treat as a stuck analysis: reset status to `'pending'`, delete `analysisProgress`, and allow the new analysis to proceed
- Frontend interprets `already_running` as "enter polling mode"

### 4. Metadata Write Concurrency

Multiple sources may write to `metadata.json` concurrently (analysis progress updates, GET route backfill, etc.). The `analysisProgress` updates are best-effort — if a write is occasionally clobbered by a concurrent read-modify-write, the next progress update will overwrite it. The authoritative `status` field is written less frequently (only on state transitions: parsing → analyzing → analyzed/error) and is unlikely to conflict. This trade-off is acceptable for a progress display use case.

### 5. Lightweight Status Endpoint

Add `GET /api/paper/{id}/status` returning only:
```json
{ "status": "analyzing", "analysisProgress": { "step": "analyzing", "message": "...", "updatedAt": "..." } }
```
This avoids fetching the full paper data (analysis JSON, parsed markdown, chat history) on every poll. The polling hook uses this endpoint instead of the heavyweight `GET /api/paper/{id}`.

## Frontend Changes

### 1. New Hook: `useAnalysisPolling`

```typescript
function useAnalysisPolling(paperId: string, metadata: PaperMetadata | null) {
  // Returns: { isPolling, analysisStep, analysisMessage, isStale }

  // Behavior:
  // - On mount: if metadata.status is 'parsing' or 'analyzing', start polling
  // - Poll interval: 2 seconds via GET /api/paper/{id}/status (lightweight endpoint)
  // - Extract analysisProgress from response to provide step/message
  // - Stop polling when status becomes 'analyzed' or 'error'
  // - Stale detection: if analysisProgress.updatedAt > 10 minutes old, treat as error
  //   (10 minutes to accommodate long AI analysis calls with 60s heartbeat)
  // - Cleanup: clear interval on unmount
}
```

### 2. Page Component (`page.tsx`) Changes

The page uses a **hybrid approach** combining SSE and polling:

**First trigger flow** (user clicks Analyze):
1. `handleAnalyze()` makes its own `fetch('POST /api/analyze')` call
2. Checks `Content-Type` header of the response:
   - If `text/event-stream` → pass the response body to SSE reading logic (extracted from `useSSE` or a new variant that accepts an existing `Response`) for real-time progress + Vision Stream Box
   - If `application/json` → parse body; if `{ status: 'already_running' }`, activate polling mode via `useAnalysisPolling`
3. This means `handleAnalyze` no longer uses `useSSE.start()` directly — it handles the fetch itself to distinguish response types

**Navigation recovery flow** (page loads with `status === 'parsing' | 'analyzing'`):
1. `useAnalysisPolling` detects in-progress status on mount
2. Starts polling → feeds `analysisStep` and `analysisMessage` to `AnalysisPanel`
3. No Vision Stream Box (unavailable in polling mode)
4. When polling detects `status: 'analyzed'` → call `refetch()` to load full analysis

**State merging**:
```typescript
// SSE state takes priority when active (first trigger)
// Polling state takes over when SSE is not active (navigation recovery)
const effectiveIsAnalyzing = isSSEAnalyzing || isPolling;
const effectiveStep = isSSEAnalyzing ? sseStep : pollingStep;
const effectiveMessage = isSSEAnalyzing ? sseMessage : pollingMessage;
```

### 3. `AnalysisPanel` Changes

Minimal changes — the component interface stays the same:
- Receives `isAnalyzing`, `analysisStep`, `analysisMessage` (source-agnostic)
- Vision Stream Box only renders when `visionStreamContent` has data (naturally absent in polling mode)
- No changes to `AnalysisProgress` component

### 4. Top Bar Status Badge

Current behavior already shows status from `metadata.status`. No changes needed — the badge will correctly show "parsing" or "analyzing" on return.

## Behavior Matrix

| Scenario | Mode | Progress UI | Vision Stream |
|----------|------|-------------|---------------|
| Click Analyze (first time) | SSE | Full real-time steps | Yes |
| Click Analyze (already running) | Polling | Simplified steps | No |
| Navigate away, come back (still running) | Polling | Simplified steps | No |
| Navigate away, come back (completed) | None | Shows analysis results | No |
| Navigate away, come back (errored) | None | Shows error + retry button | No |
| Analysis stale (>10min no update) | Polling → Error | Shows timeout error + retry | No |

## Error Handling

1. **Backend `send()` tolerance**: The SSE relay wraps `controller.enqueue()` in try-catch. If it fails (client disconnected), it stops relaying but does NOT affect the analysis function.

2. **Stale detection**: Frontend checks `analysisProgress.updatedAt`. If more than 10 minutes old (accommodating long AI calls with 60s heartbeat), shows error: "Analysis appears to be stuck. Try re-analyzing." with a retry button. The retry button calls `POST /api/analyze` with `{ paperId, force: true }`. The backend, upon receiving `force: true`, resets `status` to `'pending'` and deletes `analysisProgress` before starting a new analysis, bypassing the `already_running` guard.

3. **Duplicate trigger prevention**: Backend returns `already_running` for concurrent requests. Frontend disables the Analyze button when `effectiveIsAnalyzing` is true.

4. **Race condition**: User clicks Analyze (SSE mode) → navigates away → SSE stream closes → analysis function continues → user returns → polling picks up from current progress. Seamless transition.

## Files to Modify

### Backend
- `src/types/index.ts` — Add `analysisProgress` to `PaperMetadata`
- `src/app/api/analyze/route.ts` — Refactor: extract analysis function, fault-tolerant SSE relay, duplicate guard, `force` parameter support, heartbeat during AI calls
- `src/app/api/paper/[id]/status/route.ts` — New file: lightweight status endpoint returning only `{ status, analysisProgress }`

### Frontend
- `src/hooks/use-analysis-polling.ts` — New file: polling hook using `/api/paper/{id}/status`
- `src/app/paper/[id]/page.tsx` — Refactor `handleAnalyze` to handle Content-Type branching (SSE vs JSON), integrate polling hook, merge SSE + polling state
- `src/components/analysis-panel.tsx` — No changes needed (interface unchanged)

### No Changes
- `src/lib/storage.ts` — Already supports saving metadata with arbitrary fields
- `src/hooks/use-sse.ts` — May need minor refactor to accept existing Response, or SSE reading logic extracted into a shared utility
- `src/hooks/use-paper.ts` — Still used for initial data load

## Testing Strategy

1. **Unit test**: `useAnalysisPolling` — mock fetch, verify polling starts/stops based on status
2. **Unit test**: Refactored analyze route — verify analysis function continues after `send()` failure (simulating client disconnect)
3. **Unit test**: Duplicate trigger guard — verify `already_running` response when status is `parsing`/`analyzing`; verify `force: true` bypasses the guard
4. **Unit test**: Stale detection — verify frontend shows error when `updatedAt` exceeds 10 minutes
5. **Unit test**: State merging — verify SSE state takes priority when active; polling state used when SSE inactive
6. **Unit test**: Lightweight status endpoint — verify returns only `{ status, analysisProgress }`
7. **Integration test**: Trigger analysis → verify metadata.json updates through each step including heartbeat
8. **Manual test**: Trigger analysis → navigate to home → return → verify spinner + progress shown
9. **Manual test**: Trigger analysis → navigate away → wait for completion → return → verify results loaded
