[中文文档](./README_CN.md)

# EasyPaper

[![npm version](https://img.shields.io/npm/v/@lvxintao/easypaper)](https://www.npmjs.com/package/@lvxintao/easypaper)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)

Upload academic PDFs, get AI-powered analysis, and chat about the content — all in one place.

<!-- Add your screenshot here -->
<!-- ![EasyPaper Screenshot](docs/images/screenshot.png) -->

## Quick Start

No installation needed — just run:

```bash
npx @lvxintao/easypaper
```

Open [http://localhost:3000](http://localhost:3000), go to **Settings** to configure your AI provider, and start uploading papers.

> **Prerequisites:** [Node.js](https://nodejs.org) 18+ and Python 3 with [`marker-pdf`](https://github.com/VikParuchuri/marker) installed (`pip install marker-pdf`)

## Features

- **PDF Upload & Viewing** — Drag-and-drop upload with built-in PDF viewer (zoom, page navigation, text selection)
- **AI Analysis** — Extract summary, key contributions, methodology, and conclusions with page references
- **Interactive Chat** — Ask follow-up questions with full paper context
- **Reference Linking** — Click references to jump to the exact page with text highlighting
- **Streaming Responses** — Real-time AI output with typewriter effect
- **Flexible AI Backend** — Works with any OpenAI-compatible API (OpenAI, Ollama, LM Studio, etc.)
- **Local Storage** — All data on your machine, no external database

## Installation

### Option 1: npx (no install)

```bash
npx @lvxintao/easypaper
```

### Option 2: Global install

```bash
npm install -g @lvxintao/easypaper
easypaper
```

### Option 3: From source

```bash
git clone https://github.com/lvxintao/EasyPaper.git
cd EasyPaper
npm install
cp .env.example .env.local   # Edit with your AI provider settings
npm run dev
```

## Configuration

Configure your AI provider in the app's **Settings** page, or via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_BASE_URL` | API endpoint | `https://api.openai.com/v1` |
| `AI_API_KEY` | Your API key | — |
| `AI_MODEL` | Chat model | `gpt-4o` |
| `AI_VISION_MODEL` | Vision model | `gpt-4o` |

- **npm install:** place a `.env` file at `~/.easypaper/.env`
- **From source:** copy `.env.example` to `.env.local`

## Usage

1. **Upload** a PDF on the home page (drag-and-drop or click to browse)
2. **Open** the paper — PDF on the left, analysis panel on the right
3. **Analyze** to get a structured breakdown with page references
4. **Chat** to ask specific questions about the paper

## CLI Options

```
easypaper [options]

  -p, --port <number>  Port to run on (default: 3000)
  -h, --help           Show help
  -v, --version        Show version
```

Data is stored in `~/.easypaper/`.

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4
- [pdfjs-dist](https://github.com/nicedoc/pdfjs-dist) for PDF rendering
- [marker-pdf](https://github.com/VikParuchuri/marker) for PDF-to-Markdown parsing

## License

MIT
