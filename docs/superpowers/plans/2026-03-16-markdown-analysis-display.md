# Markdown-Structured Analysis Display Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render AI analysis sections using markdown formatting (headings, lists, bold) instead of plain text paragraphs, by extracting the existing `MarkdownContent` component into a shared module and using it in the analysis panel.

**Architecture:** Extract `MarkdownContent` from `chat-messages.tsx` into `markdown-content.tsx`. Update `SectionContent` in `analysis-panel.tsx` to render all sections through `MarkdownContent`. Update the AI prompt in `prompts.ts` to instruct markdown formatting in content fields.

**Tech Stack:** React 19, TypeScript strict, react-markdown 10, Tailwind CSS 4, Jest 30

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/markdown-content.tsx` | Create | Shared `MarkdownContent` component with `ReactMarkdown` and custom element mappings |
| `src/components/chat-messages.tsx` | Modify | Remove local `MarkdownContent` definition, import from `markdown-content.tsx` |
| `src/components/analysis-panel.tsx` | Modify | Use `MarkdownContent` in `SectionContent` for all section types |
| `src/lib/prompts.ts` | Modify | Add markdown formatting instruction to `ANALYSIS_PROMPT` |

---

## Chunk 1: Implementation

### Task 1: Extract MarkdownContent into shared component

**Files:**
- Create: `src/components/markdown-content.tsx`
- Modify: `src/components/chat-messages.tsx:1-48`

- [ ] **Step 1: Create `src/components/markdown-content.tsx`**

Create the new file with the exact component extracted from `chat-messages.tsx` lines 14-48, adding the `export` keyword:

```tsx
'use client';

import ReactMarkdown from 'react-markdown';

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`prose prose-sm max-w-none ${className || ''}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-bold mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.startsWith('language-');
            if (isBlock) {
              return (
                <pre className="bg-slate-800 text-slate-100 rounded-lg p-3 my-2 overflow-x-auto text-xs">
                  <code>{children}</code>
                </pre>
              );
            }
            return <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-xs">{children}</code>;
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-300 pl-3 my-2 text-slate-500 italic">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/components/chat-messages.tsx` to import from shared component**

Remove the local `MarkdownContent` function (lines 14-48) and the `ReactMarkdown` import (line 4). Add an import for the shared component. The file's imports should become:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types';
import { useTypewriter } from '@/hooks/use-typewriter';
import { MarkdownContent } from './markdown-content';
```

The rest of `chat-messages.tsx` (lines 50-116, the `ChatMessages` component) stays exactly the same — it already references `MarkdownContent` by name.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass (no behavior changed, only extraction)

- [ ] **Step 5: Commit**

```bash
git add src/components/markdown-content.tsx src/components/chat-messages.tsx
git commit -m "refactor: extract MarkdownContent into shared component"
```

---

### Task 2: Use MarkdownContent in analysis panel SectionContent

**Files:**
- Modify: `src/components/analysis-panel.tsx:1-63`

- [ ] **Step 1: Add import for MarkdownContent**

In `src/components/analysis-panel.tsx`, add the import after the existing imports (after line 5):

```tsx
import { MarkdownContent } from './markdown-content';
```

- [ ] **Step 2: Replace SectionContent rendering with MarkdownContent**

Replace the `SectionContent` function body (lines 36-63) with:

```tsx
function SectionContent({
  analysis,
  section,
}: {
  analysis: PaperAnalysis;
  section: string;
}) {
  const sectionData = analysis[section as keyof PaperAnalysis];
  if (!sectionData || typeof sectionData === 'string') return null;

  if (section === 'contributions' && 'items' in sectionData) {
    const markdown = sectionData.items.map((item) => `- ${item}`).join('\n');
    return <MarkdownContent content={markdown} />;
  }

  if ('content' in sectionData) {
    return <MarkdownContent content={sectionData.content} />;
  }

  return null;
}
```

Key changes:
- **contributions**: Joins items with `- ` prefix into a markdown list string, passes to `MarkdownContent`
- **other sections**: Passes `content` directly to `MarkdownContent` instead of wrapping in `<div className="whitespace-pre-wrap">`

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis-panel.tsx
git commit -m "feat: render analysis sections with markdown formatting"
```

---

### Task 3: Update AI prompt to generate markdown content

**Files:**
- Modify: `src/lib/prompts.ts:1-27`

- [ ] **Step 1: Update ANALYSIS_PROMPT**

In `src/lib/prompts.ts`, replace the entire `ANALYSIS_PROMPT` export (lines 1-27) with:

```typescript
export const ANALYSIS_PROMPT = `You are an academic paper analyst. Given the following paper content in Markdown format, provide a structured analysis.

Respond in the SAME LANGUAGE as the paper content. If the paper is in Chinese, respond in Chinese. If in English, respond in English.

Paper content:
{content}

Provide your analysis in the following JSON format:
{
  "summary": {
    "content": "Core summary of the paper's main ideas and innovations"
  },
  "contributions": {
    "items": ["Contribution 1", "Contribution 2"]
  },
  "methodology": {
    "content": "Overview of research methods and technical approach"
  },
  "experiments": {
    "content": "Description of experimental setup, datasets, metrics, and key results"
  },
  "conclusions": {
    "content": "Key findings and conclusions"
  }
}

Use Markdown formatting within each "content" field to structure the text clearly. Use ## and ### for headings, bullet lists, **bold** for emphasis, and other Markdown syntax as appropriate. Do NOT use Markdown in the "items" array — each item should be a plain sentence.

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no extra text.`;
```

The only change is adding the paragraph about Markdown formatting before the final IMPORTANT line. The `CHAT_PROMPT` stays unchanged.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat: instruct AI to use markdown formatting in analysis content"
```
