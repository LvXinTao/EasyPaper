# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyPaper is a Next.js application for uploading academic PDFs, analyzing them with AI, and chatting about their content. It uses a file-based storage system (no database) and streams AI responses via Server-Sent Events (SSE). Key features include sentence-level notes, bookmarks, folders for organization, multiple chat sessions, custom prompts, Zotero import, and optional Tauri desktop app packaging.

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

Tauri desktop app:
```bash
npm run tauri:dev      # Start Tauri dev mode (desktop app)
npm run tauri:build    # Build Tauri production app (includes sidecar)
```

## Architecture

### Data Flow

1. **Upload:** PDF → `/api/upload` → stored in `~/.easypaper/papers/{id}/original.pdf` with `metadata.json`
2. **Analyze:** `/api/analyze` (SSE) → render PDF pages with mupdf → send images to Vision LLM in parallel batches → stream structured JSON result
3. **Chat:** `/api/chat` (SSE) → AI with paper context → stream markdown response

### Storage Layout (file-based, no DB)

```
~/.easypaper/
├── data/
│   └── papers/{paperId}/
│       ├── original.pdf
│       ├── metadata.json
│       ├── parsed.md          # Cached markdown from Vision LLM parsing
│       ├── analysis.json      # Structured AI analysis
│       ├── chat-sessions/     # Each session stored as separate JSON file
│       │   └── session_{id}.json
│       ├── notes.json         # Sentence-level notes with selections
│       ├── bookmarks.json     # Page bookmarks
│       ├── embeddings.json    # RAG vector embeddings
│       └── images/            # Extracted images (optional)
├── config/
│   ├── folders.json           # Folder hierarchy
│   ├── prompts.json           # Custom prompt configurations
│   └── settings.json          # Encrypted API key + model config
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
- `src/lib/chunker.ts` — Paper chunking logic for RAG
- `src/lib/embedding.ts` — Embedding API calls
- `src/lib/retrieval.ts` — Vector similarity search
- `src/lib/analysis-queue.ts` — Concurrent analysis job queue (max 3 parallel)
- `src/lib/analysis-runner.ts` — Core analysis execution logic
- `src/lib/zotero.ts` — Zotero SQLite database access for import
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
- `/api/analyze/queue` — Analysis queue status (active count)
- `/api/chat` — SSE stream for AI chat
- `/api/papers` — List/reorder papers
- `/api/papers/reorder` — Batch reorder papers
- `/api/paper/[id]` — CRUD for paper metadata
- `/api/paper/[id]/pdf` — Serve PDF file for viewing
- `/api/paper/[id]/status` — Analysis status polling
- `/api/paper/[id]/notes` — Sentence-level notes CRUD
- `/api/paper/[id]/bookmarks` — Bookmarks CRUD
- `/api/paper/[id]/chat-sessions` — Chat sessions management
- `/api/paper/[id]/chat-sessions/[sessionId]` — Single chat session CRUD
- `/api/folders` — Folder hierarchy CRUD
- `/api/folders/[id]` — Single folder CRUD
- `/api/prompts` — Custom prompts CRUD
- `/api/settings` — AI settings CRUD
- `/api/embed/[id]` — Generate/get embeddings for a paper
- `/api/embed/regenerate-all` — Regenerate all paper embeddings
- `/api/zotero/collections` — List Zotero collections
- `/api/zotero/items` — List items in a Zotero collection
- `/api/zotero/import` — Import papers from Zotero
- `/api/health` — Health check endpoint

### RAG Context Optimization

When users chat with a paper, the system uses RAG (Retrieval-Augmented Generation) to reduce token consumption:

1. **Embedding Generation**: After analysis, parsed markdown is chunked and embedded via API
2. **Storage**: Embeddings stored in `~/.easypaper/data/papers/{id}/embeddings.json`
3. **Chat Query**: Query embedded, top-k relevant chunks retrieved + analysis summary sent as context
4. **Fallback**: If no embeddings exist, falls back to full text temporarily

### Zotero Integration

Import papers from Zotero library via direct SQLite database access:

1. **Collection Browse**: Navigate Zotero collections and items via `/api/zotero/*` endpoints
2. **Database Access**: Reads Zotero's SQLite `zotero.sqlite` database directly using better-sqlite3
3. **PDF Import**: Downloads PDFs from Zotero storage and creates paper entries
4. **Settings**: Zotero data directory configured in `/settings` page

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript 5 (strict mode)
- Tailwind CSS 4, react-pdf 10 (pdfjs-dist wrapper), mupdf (backend PDF rendering)
- react-markdown 10 for content rendering
- better-sqlite3 for Zotero database access
- @dnd-kit for drag-and-drop (paper reorder, folder tree)
- Jest 30 + ts-jest for unit testing, Playwright for e2e testing
- Tauri 2 for desktop app packaging (optional)
- Path alias: `@/*` maps to `src/*`

## Environment Variables

Settings can be configured via the UI at `/settings` (stored encrypted in `~/.easypaper/config/settings.json`), or via environment variables in `~/.easypaper/.env`:

```
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_MODEL=gpt-4o
AI_VISION_MODEL=gpt-4o
```

UI settings have higher priority than environment variables.
