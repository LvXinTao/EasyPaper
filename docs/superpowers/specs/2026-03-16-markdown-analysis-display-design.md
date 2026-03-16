# Markdown-Structured Analysis Display Design Spec

## Goal

Render AI analysis sections using markdown formatting instead of plain text, so content is structured with headings, lists, bold text, etc. instead of large unformatted paragraphs.

## Context

Currently, the `SectionContent` component in `analysis-panel.tsx` renders analysis content as plain text using `whitespace-pre-wrap`. The AI prompt asks for plain text strings inside JSON fields. Meanwhile, the chat feature already uses `react-markdown` with custom-styled components via a `MarkdownContent` component in `chat-messages.tsx`.

The project already has `react-markdown` v10 installed.

## Design

### 1. Extract Shared MarkdownContent Component

Extract the `MarkdownContent` component from `src/components/chat-messages.tsx` into its own file `src/components/markdown-content.tsx`. This component already handles:

- Headings (h1/h2 → h3, h3 → h4, compact sizing)
- Paragraphs with proper spacing
- Ordered and unordered lists
- Bold/strong text
- Inline and block code
- Blockquotes

Both `chat-messages.tsx` and `analysis-panel.tsx` will import from the shared component.

### 2. Update SectionContent Rendering

In `src/components/analysis-panel.tsx`, the `SectionContent` component currently renders:

- **contributions**: `<ul>` with `<li>` items (array of strings)
- **other sections**: `<div className="whitespace-pre-wrap">` (plain text)

Change both to use `MarkdownContent`:

- **contributions**: Join items with `\n` separators, render each as a markdown list item (prefix with `- `), pass to `MarkdownContent`
- **other sections**: Pass `content` string directly to `MarkdownContent`

This is backwards-compatible: `react-markdown` renders plain text as paragraphs, so existing analyses without markdown formatting still display correctly (just without rich formatting).

### 3. Update AI Prompt

Modify `ANALYSIS_PROMPT` in `src/lib/prompts.ts` to instruct the AI to use markdown formatting within the JSON content fields:

- Add instruction: "Use Markdown formatting (headings, bullet lists, bold, etc.) within each content field to structure the text clearly"
- Keep the JSON structure requirement unchanged
- Keep the language-matching requirement unchanged

The contributions field remains `items: string[]` — each item is a short sentence, no markdown needed there.

## Files Changed

| File | Action | Change |
|------|--------|--------|
| `src/components/markdown-content.tsx` | Create | Extract `MarkdownContent` from chat-messages.tsx |
| `src/components/chat-messages.tsx` | Modify | Import `MarkdownContent` from shared component, remove local definition |
| `src/components/analysis-panel.tsx` | Modify | Use `MarkdownContent` in `SectionContent` for all sections |
| `src/lib/prompts.ts` | Modify | Add markdown formatting instruction to `ANALYSIS_PROMPT` |

## Files NOT Changed

- **Types** (`src/types/index.ts`): `PaperAnalysis` structure unchanged — content fields are still strings, just now containing markdown
- **Backend API**: No changes to `/api/analyze` route
- **Storage**: No schema changes

## Backwards Compatibility

- Existing plain-text analyses render correctly through `react-markdown` (plain text → paragraph elements)
- Users can click "Re-analyze" to regenerate with markdown formatting
- No migration needed

## Testing

- Verify `MarkdownContent` renders markdown correctly (headings, lists, bold, code)
- Verify `SectionContent` passes content to `MarkdownContent`
- Verify contributions section joins items and renders as markdown list
- Verify chat messages still render correctly after extraction
- Verify plain text content (old analyses) renders without errors
