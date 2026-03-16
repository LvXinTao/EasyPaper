# Re-Analyze Button Design Spec

## Goal

Allow users to re-trigger AI analysis on a paper that has already been analyzed, via a small info bar inside the Analysis panel.

## Context

Currently, the "Analyze" button in the paper detail page header only appears when `metadata.status` is `'pending'` or `'error'`. Once analysis succeeds (`'analyzed'`), there is no way to re-run it. The backend `/api/analyze` already supports re-analysis — it reuses cached PDF parsing and only re-runs the AI step. This feature simply exposes that capability in the UI.

## Design

### UI: Info Bar in AnalysisPanel

When analysis exists and no analysis is in progress, render a slim info bar inside `AnalysisPanel`, between the `<SectionTabs>` component and the `<SectionContent>` div (i.e., after line 127 and before line 128 of the current `analysis-panel.tsx`):

- **Left side:** Relative timestamp — "Analyzed 2 hours ago" (derived from `analysis.generatedAt`)
- **Right side:** Small "Re-analyze" button with a refresh icon, indigo-tinted outline style
- **Bar style:** `bg-slate-50` background, bottom border, compact padding (`py-2 px-4`)

The info bar is **only visible** when:
- `analysis` is not null (analysis exists)
- `isAnalyzing` is false (no analysis in progress)
- `onReAnalyze` callback is provided

### Confirmation Dialog

Clicking "Re-analyze" shows a simple inline confirmation banner (not a modal):
- Text: "Re-analyzing will replace the current analysis. Continue?"
- Two buttons: "Cancel" (secondary) and "Continue" (primary indigo)
- Replaces the info bar temporarily until user confirms or cancels

### Props Change

`AnalysisPanelProps` gains one new optional prop:

```typescript
onReAnalyze?: () => void;
```

### Page Integration

In `src/app/paper/[id]/page.tsx`:
- Pass `handleAnalyze` as `onReAnalyze` to `AnalysisPanel`
- The existing header "Analyze" button for `pending`/`error` states remains unchanged

### During Re-Analysis Behavior

When the user triggers re-analysis:
- The `AnalysisPanel` shows the progress indicator (existing `isAnalyzing` guard hides the info bar and shows `AnalysisProgress`)
- Old analysis data is **preserved** in state — it is NOT cleared. This ensures that if re-analysis fails, `refetch()` restores the previous analysis from disk
- On success: `refetch()` loads the new analysis, info bar reappears with updated timestamp
- On failure: `isAnalyzing` resets to false, `refetch()` restores previous analysis, error banner is shown, info bar reappears with the original timestamp

### Relative Time Display

Use a simple helper function (no external library) to format `generatedAt` as relative time:
- < 1 min: "just now"
- < 60 min: "X minutes ago"
- < 24 hours: "X hours ago"
- < 7 days: "X days ago"
- Otherwise: "on Mar 16, 2026" (date string)

This helper lives in a `formatRelativeTime` function inside `analysis-panel.tsx` (no separate file needed for a single utility).

## Files Changed

| File | Change |
|------|--------|
| `src/components/analysis-panel.tsx` | Add info bar with timestamp + re-analyze button, confirmation banner, `onReAnalyze` prop, `formatRelativeTime` helper |
| `src/app/paper/[id]/page.tsx` | Pass `onReAnalyze={handleAnalyze}` to AnalysisPanel |

## Files NOT Changed

- **Backend:** `/api/analyze` already supports re-analysis
- **Storage:** No schema changes
- **Types:** `PaperAnalysis.generatedAt` already exists

## Testing

- Unit test `formatRelativeTime` with boundary values: 0s, 59s, 60s, 59min, 60min, 23h, 24h, 6d, 7d, future timestamps, and invalid input
- Unit test AnalysisPanel renders info bar when analysis exists and `onReAnalyze` is provided
- Unit test AnalysisPanel does NOT render info bar when `onReAnalyze` is not provided
- Unit test confirmation flow: click Re-analyze → shows confirmation → click Continue → calls `onReAnalyze`
- Unit test confirmation flow: click Re-analyze → shows confirmation → click Cancel → hides confirmation
- Unit test panel switching: confirmation banner resets when switching away from Analysis panel and back

## Edge Cases

- `generatedAt` is missing or invalid → hide the timestamp, still show re-analyze button
- User clicks Re-analyze while already analyzing → button is hidden during analysis (info bar not shown when `isAnalyzing` is true)
- Re-analysis fails after previous success → backend sets `metadata.status` to `'error'`, which would show the header Analyze button. Since `data.analysis` still exists on disk, the info bar would also render. To avoid duplicate buttons, guard the header Analyze button: only show it when `displayAnalysis` is null (no prior analysis to display)
- Concurrent usage: single-user app, no concurrency concerns
