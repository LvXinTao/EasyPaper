# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyPaper is a Next.js application for uploading academic PDFs, analyzing them with AI, and chatting about their content. It uses a file-based storage system (no database) and streams AI responses via Server-Sent Events (SSE). Key features include sentence-level notes, bookmarks, folders for organization, multiple chat sessions, custom prompts, and theme customization.

## Commands

```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build (uses webpack)
npm run start        # Start production server
npm run lint         # ESLint
npm test             # Run all Jest tests
npm run test:watch   # Jest watch mode
```

Run a single test file:
```bash
npx jest __tests__/lib/ai-client.test.ts
```

## Architecture

### Data Flow

1. **Upload:** PDF → `/api/upload` → stored in `~/.easypaper/papers/{id}/original.pdf` with `metadata.json`
2. **Analyze:** `/api/analyze` (SSE) → render PDF pages with mupdf → send images to Vision LLM in parallel batches → stream structured JSON result
3. **Chat:** `/api/chat` (SSE) → AI with paper context → stream markdown response

### Storage Layout (file-based, no DB)

```
~/.easypaper/
├── papers/{paperId}/
│   ├── original.pdf
│   ├── metadata.json
│   ├── parsed.md          # Cached markdown from Vision LLM parsing
│   ├── analysis.json      # Structured AI analysis
│   ├── chat-sessions.json # Multiple chat sessions
│   ├── notes.json         # Sentence-level notes with selections
│   ├── bookmarks.json     # Page bookmarks
│   └── images/            # Extracted images (optional)
├── folders.json           # Folder hierarchy
├── prompts.json           # Custom prompt configurations
├── settings.json          # Encrypted API key + model config
└── theme.json             # Theme preferences
```

### Key Modules

- `src/lib/ai-client.ts` — OpenAI-compatible API client (streaming + non-streaming)
- `src/lib/ai-config.ts` — AI configuration management
- `src/lib/storage.ts` — File system storage abstraction for all paper data
- `src/lib/pdf-parser.ts` — PDF rendering via mupdf + Vision LLM parsing with parallel batch execution
- `src/lib/prompts.ts` — All AI prompts (vision parsing + analysis structure + chat system prompt)
- `src/lib/crypto.ts` — AES-256-GCM encryption for API keys
- `src/lib/errors.ts` — Centralized error definitions
- `src/lib/format.ts` — Utility formatting functions
- `src/types/index.ts` — All TypeScript type definitions (centralized)

### Frontend Architecture

- **Next.js App Router** with client components (`'use client'`)
- **Paper detail page** (`/paper/[id]`): dual-column layout — PDF viewer (left 55%) + analysis/chat panel (right 45%)
- **PDF viewer** (`pdf-viewer.tsx`): uses react-pdf (pdfjs-dist wrapper) for rendering with text layer and highlight support
- **Sentence-level notes** (`notes-panel.tsx`, `inline-note-editor.tsx`): select text → create note linked to specific sentences
- **Bookmarks panel** (`bookmarks-panel.tsx`): mark important pages
- **Folder tree** (`folder-tree.tsx`): organize papers in folders
- **Chat sessions** (`chat-session-bar.tsx`): multiple chat sessions per paper
- **SSE hook** (`use-sse.ts`): manages streaming state for both analysis and chat
- **Analysis polling** (`use-analysis-polling.ts`): tracks analysis progress with batch updates

### API Routes

All under `src/app/api/`. Streaming endpoints (`/analyze`, `/chat`) use SSE with `text/event-stream` content type.

- `/api/upload` — PDF upload
- `/api/analyze` — SSE stream for AI analysis (parallel batch processing)
- `/api/chat` — SSE stream for AI chat
- `/api/papers` — List/reorder papers
- `/api/paper/[id]` — CRUD for paper metadata
- `/api/paper/[id]/status` — Analysis status polling
- `/api/paper/[id]/notes` — Sentence-level notes CRUD
- `/api/paper/[id]/bookmarks` — Bookmarks CRUD
- `/api/paper/[id]/chat-sessions` — Chat sessions management
- `/api/folders` — Folder hierarchy CRUD
- `/api/prompts` — Custom prompts CRUD
- `/api/settings` — AI settings CRUD

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript 5 (strict mode)
- Tailwind CSS 4, react-pdf 10 (pdfjs-dist wrapper), mupdf (backend PDF rendering)
- react-markdown 10 for content rendering
- Jest 30 + ts-jest for testing
- Path alias: `@/*` maps to `src/*`

## Environment Variables

Settings can be configured via the UI at `/settings` (stored encrypted in `~/.easypaper/settings.json`), or via environment variables in `~/.easypaper/.env`:

```
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_MODEL=gpt-4o
AI_VISION_MODEL=gpt-4o
```

UI settings have higher priority than environment variables.
