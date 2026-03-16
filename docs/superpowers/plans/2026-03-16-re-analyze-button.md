# Re-Analyze Button Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Re-analyze" button with timestamp info bar inside AnalysisPanel so users can re-trigger AI analysis on already-analyzed papers.

**Architecture:** Add a `formatRelativeTime` pure function and an info bar UI (with inline confirmation) to `analysis-panel.tsx`. Wire it up via a new `onReAnalyze` prop passed from the paper detail page. Guard the header Analyze button to prevent duplicate buttons when analysis exists.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS 4, Jest 30 (node env)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/analysis-panel.tsx` | Modify | Add `formatRelativeTime`, info bar with confirmation, `onReAnalyze` prop |
| `src/app/paper/[id]/page.tsx` | Modify | Pass `onReAnalyze={handleAnalyze}`, guard header button with `!displayAnalysis` |
| `__tests__/lib/format-relative-time.test.ts` | Create | Unit tests for `formatRelativeTime` |

---

## Chunk 1: Implementation

### Task 1: Add `formatRelativeTime` helper with tests

**Files:**
- Modify: `src/components/analysis-panel.tsx:1-5`
- Create: `__tests__/lib/format-relative-time.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/format-relative-time.test.ts`:

```typescript
import { formatRelativeTime } from '@/components/analysis-panel';

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-16T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "just now" for 0 seconds ago', () => {
    expect(formatRelativeTime('2026-03-16T12:00:00Z')).toBe('just now');
  });

  it('returns "just now" for 59 seconds ago', () => {
    expect(formatRelativeTime('2026-03-16T11:59:01Z')).toBe('just now');
  });

  it('returns "1 minute ago" for exactly 60 seconds', () => {
    expect(formatRelativeTime('2026-03-16T11:59:00Z')).toBe('1 minute ago');
  });

  it('returns "59 minutes ago" for 59 minutes', () => {
    expect(formatRelativeTime('2026-03-16T11:01:00Z')).toBe('59 minutes ago');
  });

  it('returns "1 hour ago" for exactly 60 minutes', () => {
    expect(formatRelativeTime('2026-03-16T11:00:00Z')).toBe('1 hour ago');
  });

  it('returns "23 hours ago" for 23 hours', () => {
    expect(formatRelativeTime('2026-03-15T13:00:00Z')).toBe('23 hours ago');
  });

  it('returns "1 day ago" for exactly 24 hours', () => {
    expect(formatRelativeTime('2026-03-15T12:00:00Z')).toBe('1 day ago');
  });

  it('returns "6 days ago" for 6 days', () => {
    expect(formatRelativeTime('2026-03-10T12:00:00Z')).toBe('6 days ago');
  });

  it('returns formatted date for 7+ days', () => {
    const result = formatRelativeTime('2026-03-09T12:00:00Z');
    expect(result).toMatch(/^on /);
  });

  it('returns null for future timestamps', () => {
    expect(formatRelativeTime('2026-03-17T00:00:00Z')).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(formatRelativeTime('not-a-date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatRelativeTime('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/format-relative-time.test.ts`
Expected: FAIL — `formatRelativeTime` is not exported from `analysis-panel.tsx`

- [ ] **Step 3: Implement `formatRelativeTime` in analysis-panel.tsx**

Add this exported function near the top of `src/components/analysis-panel.tsx` (after imports, before the interface):

```typescript
export function formatRelativeTime(dateStr: string): string | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return null;

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return `on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/format-relative-time.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/lib/format-relative-time.test.ts src/components/analysis-panel.tsx
git commit -m "feat(re-analyze): add formatRelativeTime helper with tests"
```

---

### Task 2: Add info bar and confirmation UI to AnalysisPanel

**Files:**
- Modify: `src/components/analysis-panel.tsx:7-12` (props), `src/components/analysis-panel.tsx:97-136` (component body)

- [ ] **Step 1: Add `onReAnalyze` to the AnalysisPanelProps interface**

In `src/components/analysis-panel.tsx`, update the interface at line 7-12:

```typescript
interface AnalysisPanelProps {
  analysis: PaperAnalysis | null;
  isAnalyzing?: boolean;
  analysisStep?: string | null;
  analysisMessage?: string | null;
  onReAnalyze?: () => void;
}
```

- [ ] **Step 2: Add `confirmingReAnalyze` state and destructure `onReAnalyze` in the component**

Update the component function signature and add state. In `src/components/analysis-panel.tsx`, update the component at line 97-103:

```typescript
export function AnalysisPanel({
  analysis,
  isAnalyzing,
  analysisStep,
  analysisMessage,
  onReAnalyze,
}: AnalysisPanelProps) {
  const [activeSection, setActiveSection] = useState('summary');
  const [confirmingReAnalyze, setConfirmingReAnalyze] = useState(false);
```

- [ ] **Step 3: Add the info bar / confirmation banner between SectionTabs and content**

In the `analysis` exists branch (line 125-135), insert the info bar between `<SectionTabs>` and the content div. Replace the return block:

```typescript
  return (
    <div className="flex flex-col h-full">
      <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />

      {/* Info bar with timestamp and re-analyze button */}
      {onReAnalyze && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          {confirmingReAnalyze ? (
            <>
              <span className="text-xs text-slate-500">
                Re-analyzing will replace the current analysis. Continue?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmingReAnalyze(false)}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmingReAnalyze(false);
                    onReAnalyze();
                  }}
                  className="px-3 py-1 text-xs font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 transition-colors"
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-400">
                {analysis.generatedAt ? (
                  formatRelativeTime(analysis.generatedAt)
                    ? `Analyzed ${formatRelativeTime(analysis.generatedAt)}`
                    : null
                ) : null}
              </span>
              <button
                onClick={() => setConfirmingReAnalyze(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Re-analyze
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <SectionContent
          analysis={analysis}
          section={activeSection}
        />
      </div>
    </div>
  );
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run all tests to verify nothing broke**

Run: `npm test`
Expected: All tests pass (including the new `formatRelativeTime` tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis-panel.tsx
git commit -m "feat(re-analyze): add info bar with confirmation to AnalysisPanel"
```

---

### Task 3: Wire up page integration and guard header button

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:160-161` (needsAnalysis guard), `src/app/paper/[id]/page.tsx:232-238` (AnalysisPanel props)

- [ ] **Step 1: Update `needsAnalysis` guard to prevent duplicate buttons**

In `src/app/paper/[id]/page.tsx`, change line 161 from:

```typescript
  const needsAnalysis = (data.metadata.status === 'pending' || data.metadata.status === 'error') && !isAnalyzing;
```

to:

```typescript
  const needsAnalysis = (data.metadata.status === 'pending' || data.metadata.status === 'error') && !isAnalyzing && !displayAnalysis;
```

This ensures the header "Analyze" button only shows when there's no existing analysis to display. If re-analysis fails after a previous success, the info bar Re-analyze button takes precedence.

- [ ] **Step 2: Pass `onReAnalyze` to AnalysisPanel**

In `src/app/paper/[id]/page.tsx`, update the AnalysisPanel usage at line 232-238:

```tsx
              <AnalysisPanel
                analysis={displayAnalysis}
                isAnalyzing={isAnalyzing}
                analysisStep={analysisStep}
                analysisMessage={analysisMessage}
                onReAnalyze={handleAnalyze}
              />
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add "src/app/paper/[id]/page.tsx"
git commit -m "feat(re-analyze): wire up onReAnalyze and guard header button"
```
