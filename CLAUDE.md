# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyPaper is a Next.js application for uploading academic PDFs, analyzing them with AI, and chatting about their content. It uses a file-based storage system (no database) and streams AI responses via Server-Sent Events (SSE).

## Commands

```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
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

1. **Upload:** PDF → `/api/upload` → stored as `data/papers/{id}/original.pdf` with `metadata.json`
2. **Analyze:** `/api/analyze` (SSE) → parse PDF with `marker-pdf` (Python) → send to AI → stream structured JSON result
3. **Chat:** `/api/chat` (SSE) → AI with paper context → stream markdown response

### Storage Layout (file-based, no DB)

```
data/papers/{paperId}/
├── original.pdf
├── metadata.json
├── parsed.md          # Cached markdown from PDF parsing
├── analysis.json      # Structured AI analysis
├── chat-history.json
└── images/
config/settings.json   # Encrypted API key + model config
```

### Key Modules

- `src/lib/ai-client.ts` — OpenAI-compatible API client (streaming + non-streaming)
- `src/lib/storage.ts` — File system storage abstraction for all paper data
- `src/lib/marker.ts` — PDF parsing via `marker-pdf` Python child process
- `src/lib/prompts.ts` — All AI prompts (analysis structure + chat system prompt)
- `src/lib/crypto.ts` — AES-256-GCM encryption for API keys (uses machine hostname as key)
- `src/types/index.ts` — All TypeScript type definitions (centralized)

### Frontend Architecture

- **Next.js App Router** with client components (`'use client'`)
- **Paper detail page** (`/paper/[id]`): dual-column layout — PDF viewer (left 55%) + analysis/chat panel (right 45%)
- **PDF viewer** (`pdf-viewer.tsx`): uses `pdfjs-dist` directly for rendering with text layer and highlight support
- **SSE hook** (`use-sse.ts`): manages streaming state for both analysis and chat
- **Typewriter hook** (`use-typewriter.ts`): character-by-character display for streamed text

### API Routes

All under `src/app/api/`. Streaming endpoints (`/analyze`, `/chat`) use SSE with `text/event-stream` content type. The AI client targets any OpenAI-compatible `/chat/completions` endpoint.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript 5 (strict mode)
- Tailwind CSS 4, pdfjs-dist 5, react-markdown 10
- Jest 30 + ts-jest for testing
- Path alias: `@/*` maps to `src/*`

## Environment Variables

Copy `.env.example` → `.env.local`. Settings can also be configured via the UI at `/settings` (stored encrypted in `config/settings.json`).

```
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_MODEL=gpt-4o
AI_VISION_MODEL=gpt-4o
```

## External Dependency

PDF parsing requires the Python `marker-pdf` package installed system-wide (`marker-pdf` CLI must be available in PATH).
