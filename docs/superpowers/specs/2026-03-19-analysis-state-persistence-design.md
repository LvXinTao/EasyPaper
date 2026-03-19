# Analysis State Persistence Design

**Date:** 2026-03-19
**Status:** Draft

## Problem

When a user triggers paper analysis and navigates away before it completes, the loading UI (spinner + progress steps) disappears on return. The page relies on in-memory React state (`isAnalyzing`) to show progress, which is lost on unmount. Additionally, the backend analysis may fail silently because the SSE stream disconnects when the page unmounts, causing `controller.enqueue()` to throw and the catch block to set `status: 'error'`.

## Solution Overview

Decouple the analysis task from the SSE response stream. The backend runs analysis independently and persists progress to `metadata.json`. The frontend uses a hybrid approach: SSE for real-time streaming on first trigger, polling for recovery after navigation.

## Backend Changes

### 1. Decouple `/api/analyze` POST

Split the current monolithic SSE handler into two parts:

**Trigger endpoint** (`POST /api/analyze`):
- Validates params (paperId exists, API key configured)
- Checks if analysis is already running (`status === 'parsing' | 'analyzing'`); if so, returns `{ status: 'already_running' }`
- Starts the analysis function asynchronously (fire-and-forget)
- Returns a **SSE stream** that relays progress events in real-time (same as current behavior)
- The key difference: the analysis function runs independently of the stream. If the stream closes, analysis continues.

**Analysis function** (internal, not an endpoint):
- An async function that performs: parse PDF → AI analysis → save results
- Updates `metadata.json` at each step with progress info
- Does NOT depend on any SSE controller — writes to disk only
- On completion: sets `status: 'analyzed'`, clears `analysisProgress`
- On error: sets `status: 'error'`, clears `analysisProgress`

**SSE relay**: The POST endpoint creates a ReadableStream that observes the analysis function's progress callbacks. If the client disconnects, the stream closes gracefully — the analysis function is unaffected.

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
- Complete → `status: 'analyzed'`, `analysisProgress: undefined`
- Error → `status: 'error'`, `analysisProgress: undefined`

### 3. Duplicate Trigger Guard

When `POST /api/analyze` is called while `status` is `parsing` or `analyzing`:
- Return `200 { status: 'already_running' }` (not an error)
- Frontend interprets this as "enter polling mode"

## Frontend Changes

### 1. New Hook: `useAnalysisPolling`

```typescript
function useAnalysisPolling(paperId: string, metadata: PaperMetadata | null) {
  // Returns: { isPolling, analysisStep, analysisMessage }

  // Behavior:
  // - On mount: if metadata.status is 'parsing' or 'analyzing', start polling
  // - Poll interval: 2 seconds (GET /api/paper/{id})
  // - Extract analysisProgress from metadata to provide step/message
  // - Stop polling when status becomes 'analyzed' or 'error'
  // - Stale detection: if analysisProgress.updatedAt > 5 minutes old, treat as error
  // - Cleanup: clear interval on unmount
}
```

### 2. Page Component (`page.tsx`) Changes

The page uses a **hybrid approach** combining SSE and polling:

**First trigger flow** (user clicks Analyze):
1. `handleAnalyze()` calls `POST /api/analyze`
2. If response is SSE stream → use existing `useSSE` to show real-time progress + Vision Stream Box
3. If response is `{ status: 'already_running' }` → fall through to polling

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
| Analysis stale (>5min no update) | Polling → Error | Shows timeout error + retry | No |

## Error Handling

1. **Backend `send()` tolerance**: The SSE relay wraps `controller.enqueue()` in try-catch. If it fails (client disconnected), it stops relaying but does NOT affect the analysis function.

2. **Stale detection**: Frontend checks `analysisProgress.updatedAt`. If more than 5 minutes old, shows error: "Analysis appears to be stuck. Try re-analyzing." with a retry button.

3. **Duplicate trigger prevention**: Backend returns `already_running` for concurrent requests. Frontend disables the Analyze button when `effectiveIsAnalyzing` is true.

4. **Race condition**: User clicks Analyze (SSE mode) → navigates away → SSE stream closes → analysis function continues → user returns → polling picks up from current progress. Seamless transition.

## Files to Modify

### Backend
- `src/types/index.ts` — Add `analysisProgress` to `PaperMetadata`
- `src/app/api/analyze/route.ts` — Refactor: extract analysis function, add SSE relay wrapper, add duplicate guard

### Frontend
- `src/hooks/use-analysis-polling.ts` — New file: polling hook
- `src/app/paper/[id]/page.tsx` — Integrate polling hook, merge SSE + polling state
- `src/components/analysis-panel.tsx` — No changes needed (interface unchanged)

### No Changes
- `src/lib/storage.ts` — Already supports saving metadata with arbitrary fields
- `src/hooks/use-sse.ts` — Still used for first-trigger SSE flow
- `src/hooks/use-paper.ts` — Still used for initial data load

## Testing Strategy

1. **Unit test**: `useAnalysisPolling` — mock fetch, verify polling starts/stops based on status
2. **Unit test**: Refactored analyze route — verify analysis function continues after stream close
3. **Integration test**: Trigger analysis → verify metadata.json updates through each step
4. **Manual test**: Trigger analysis → navigate to home → return → verify spinner + progress shown
