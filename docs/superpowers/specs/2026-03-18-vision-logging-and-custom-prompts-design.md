# Vision Model Streaming Logs & Custom Prompts

**Date:** 2026-03-18
**Status:** Approved

## Overview

Two enhancements to EasyPaper:

1. **Vision Model streaming logs** — stream Vision Model output in real-time during PDF parsing, with detailed progress info and console logs matching Chat behavior.
2. **Custom Prompts** — allow users to customize Vision and Chat system prompts via a dedicated `/prompts` page, with Chinese/English presets for both.

---

## Feature 1: Vision Model Streaming Logs

### Problem

Currently, PDF parsing via Vision Model shows only step-based progress ("Parsing with Vision AI batch 1/1..."). Users see no content feedback during potentially long waits. Chat, by contrast, streams content character-by-character.

### Design

#### Backend Changes

**`src/lib/pdf-parser.ts`:**

- Replace `client.complete()` with `client.streamComplete()` for Vision Model calls.
- Accept a `onChunk` callback parameter that receives each streamed text chunk.
- Emit console logs matching Chat's pattern:
  ```
  [pdf-parser] Vision stream started (batch 1/1, pages 1-12)
  [pdf-parser] Vision streaming: "# Attention Is All You Need\n## Abstract\nThe domin..."
  [pdf-parser] Vision stream completed (batch 1/1, 3241 tokens, 12.3s)
  ```
- Log lines are truncated to ~80 chars for readability; logged every N tokens (not every chunk).

**`src/app/api/analyze/route.ts`:**

- Forward Vision stream chunks as SSE events:
  - `{ type: "vision_stream", content: "<chunk text>" }` — per-chunk content
  - `{ type: "vision_progress", batch: 1, totalBatches: 1, pages: "1-12", elapsed: 12.3 }` — metadata updates
- Existing step-based events (`{ step: "parsing" }`, etc.) remain unchanged.

#### Frontend Changes

**`src/components/analysis-panel.tsx`:**

During Step 2 ("AI Analysis"), when `vision_stream` events arrive:

- **Top bar:** Compact single-line showing: spinning icon + "Parsing with Vision AI" + batch info + page range + elapsed time.
- **Progress bar:** Thin bar showing batch completion percentage.
- **Streaming box:** Fixed-height container (~200px) with `overflow-y: auto`, auto-scrolling to bottom. Displays raw Markdown text as it arrives. Uses monospace font.
- **Footer line:** Token count (left) + estimated remaining time (right).

When parsing completes, the streaming box disappears and Step 3 begins.

**`src/hooks/use-sse.ts`:**

- No changes needed. The existing `onMessage` callback pattern handles new event types.

**Paper detail page (`src/app/paper/[id]/page.tsx`):**

- Add state for vision stream content and progress metadata.
- Handle `vision_stream` and `vision_progress` event types in the SSE `onMessage` handler.
- Pass new state to `AnalysisPanel`.

#### Console Log Format

```
[pdf-parser] Vision stream started (batch 1/2, pages 1-15)
[pdf-parser] Vision streaming: "# Introduction\nRecent advances in natural language..."
[pdf-parser] Vision streaming: "...processing have shown that pre-trained models ca..."
[pdf-parser] Vision stream completed (batch 1/2, 8432 tokens, 45.2s)
[pdf-parser] Vision stream started (batch 2/2, pages 14-30)
[pdf-parser] Vision streaming: "## 3. Methodology\nWe propose a novel approach..."
[pdf-parser] Vision stream completed (batch 2/2, 4201 tokens, 23.1s)
```

---

## Feature 2: Custom Prompts

### Problem

Users cannot customize the AI prompts used for PDF parsing (Vision) or Chat. The prompts are hardcoded in `src/lib/prompts.ts`. Users want to tailor behavior (language, detail level, focus areas) without modifying source code.

### Design

#### Data Model

**`config/settings.json` new field:**

```json
{
  "prompts": {
    "vision": {
      "preset": "zh",
      "custom": "用户编辑后的 prompt..."
    },
    "chat": {
      "preset": "en",
      "custom": "You are a helpful academic assistant..."
    }
  }
}
```

- `preset`: Which preset is currently selected (`"zh"` or `"en"`). Used to detect if custom text diverges from preset.
- `custom`: The actual prompt text sent to the AI. May be preset original or user-modified.
- If `prompts` field is absent, all behavior falls back to current hardcoded defaults (backward compatible).

#### Prompt Presets (`src/lib/prompts.ts`)

Existing prompts become English presets. New Chinese presets added:

| Key | Role | Language |
|-----|------|----------|
| `PDF_PARSE_PROMPT` | Vision PDF parsing | English (existing) |
| `PDF_PARSE_PROMPT_ZH` | Vision PDF parsing | Chinese (new) |
| `CHAT_PROMPT` | Chat system prompt | English (existing) |
| `CHAT_PROMPT_ZH` | Chat system prompt | Chinese (new) |

Export a `PROMPT_PRESETS` object:

```typescript
export const PROMPT_PRESETS = {
  vision: {
    en: { label: "English", content: PDF_PARSE_PROMPT },
    zh: { label: "中文", content: PDF_PARSE_PROMPT_ZH },
  },
  chat: {
    en: { label: "English", content: CHAT_PROMPT },
    zh: { label: "中文", content: CHAT_PROMPT_ZH },
  },
};
```

#### API Endpoints

**`GET /api/prompts`:**

Returns:
```json
{
  "current": {
    "vision": { "preset": "zh", "custom": "..." },
    "chat": { "preset": "en", "custom": "..." }
  },
  "presets": {
    "vision": { "en": { "label": "English", "content": "..." }, "zh": { "label": "中文", "content": "..." } },
    "chat": { "en": { "label": "English", "content": "..." }, "zh": { "label": "中文", "content": "..." } }
  }
}
```

If no custom prompts configured, `current` returns null and consumers use presets.

**`POST /api/prompts`:**

Body:
```json
{
  "vision": { "preset": "zh", "custom": "..." },
  "chat": { "preset": "en", "custom": "..." }
}
```

Merges into `settings.json` under the `prompts` key. Partial updates supported (can send only `vision` or only `chat`).

#### Prompt Configuration Page (`/prompts`)

**Layout:** Two sections stacked vertically — "Vision Model Prompt" and "Chat Prompt".

**Each section contains:**

1. **Section header** with icon and title.
2. **Preset selector** — tabs or buttons: "中文" / "English".
   - Switching preset: if current `custom` text differs from the previously selected preset, show confirmation dialog ("Switching preset will replace your customizations. Continue?").
   - On confirm: replace `custom` with new preset content.
3. **Text editor** — multi-line textarea showing `custom` content. User can freely edit.
4. **Action bar:**
   - "Restore Preset" button — resets `custom` to the currently selected preset's original content. Requires confirmation.
   - "Save" button — persists to settings via `POST /api/prompts`.
   - Unsaved changes indicator (dot or text).

**Navigation:** Add "Prompts" link in the app's navigation/sidebar alongside "Settings".

#### Integration with AI Calls

**`src/lib/pdf-parser.ts`:**

- Before calling Vision Model, check `settings.prompts.vision.custom`.
- If present, use it instead of hardcoded `PDF_PARSE_PROMPT`.
- Fallback chain: `settings.prompts.vision.custom` → `PDF_PARSE_PROMPT` (default English).

**`src/app/api/chat/route.ts`:**

- Before building messages, check `settings.prompts.chat.custom`.
- If present, use it as the system prompt instead of hardcoded `CHAT_PROMPT`.
- Fallback chain: `settings.prompts.chat.custom` → `CHAT_PROMPT` (default English).

**`src/lib/storage.ts`:**

- Add `getPromptSettings()` and `savePromptSettings()` methods for reading/writing the `prompts` section of `settings.json`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/pdf-parser.ts` | Stream Vision Model, add onChunk callback, console logs |
| `src/app/api/analyze/route.ts` | Forward vision_stream/vision_progress SSE events |
| `src/components/analysis-panel.tsx` | Add streaming box UI with fixed height |
| `src/app/paper/[id]/page.tsx` | Handle new SSE event types, pass state to panel |
| `src/lib/prompts.ts` | Add Chinese presets, export PROMPT_PRESETS |
| `src/lib/storage.ts` | Add prompt settings read/write methods |
| `src/app/api/prompts/route.ts` | New API endpoint (GET/POST) |
| `src/app/prompts/page.tsx` | New prompt configuration page |
| `src/app/api/chat/route.ts` | Use custom prompt if configured |
| `src/types/index.ts` | Add PromptSettings types |
| Navigation component | Add "Prompts" link |

## Files NOT Modified

| File | Reason |
|------|--------|
| `src/hooks/use-sse.ts` | Existing onMessage pattern handles new event types |
| `src/lib/crypto.ts` | Prompts don't need encryption |
| `src/lib/ai-client.ts` | Already supports streaming; no changes needed |

## Out of Scope

- Per-paper prompt customization (global only for now)
- Analysis prompt (`ANALYSIS_PROMPT`) customization (only Vision and Chat)
- Prompt versioning or history
- Prompt import/export
