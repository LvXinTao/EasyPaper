[中文文档](./README_CN.md)

# EasyPaper

[![npm version](https://img.shields.io/npm/v/@lvxintao/easypaper)](https://www.npmjs.com/package/@lvxintao/easypaper)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.9%2B-green)](https://nodejs.org)

Upload academic PDFs, get AI-powered analysis, chat about the content, and take sentence-level notes. Fully customizable API.

<img src="docs/images/screenshot.png" alt="EasyPaper Screenshot" width="1000"/>

## Features

- **PDF Upload & Viewing** — Drag-and-drop upload with built-in PDF viewer (zoom, page navigation, text selection).
- **AI Analysis** — Automatically extract summary, key contributions, methodology, and conclusions via MLLM (e.g. GPT-4o), with customizable prompts and batch progress tracking.
- **Interactive Chat** — Ask follow-up questions with full paper context. Supports multiple chat sessions per paper.
- **Sentence-Level Notes** — Select any text in the PDF and create notes linked to specific sentences, with tag management and Markdown support.
- **Bookmarks** — Mark important pages for quick navigation.
- **Folder Organization** — Organize papers in a hierarchical folder structure.
- **Custom Prompts** — Configure your own prompts for vision parsing, analysis, and chat (with Chinese/English presets).
- **Theme Customization** — Choose from 4 theme presets (dark-minimal, light-minimal, warm-light, warm-dark).
- **Flexible AI Backend** — Works with any OpenAI-compatible API (OpenAI, OpenRouter, etc.).
- **Local Storage** — All data stored locally in `~/.easypaper/`, no external database needed.

## Quick Start

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
npm run dev
```

### Option 4: Update existing installation

```bash
npm i -g @lvxintao/easypaper@latest
```

### Option 5: Desktop App (Tauri)

For a native desktop experience without opening a browser:

```bash
git clone https://github.com/lvxintao/EasyPaper.git
cd EasyPaper
npm install
npm run tauri:dev    # Development
npm run tauri:build  # Production build
```

**Prerequisites:** [Rust toolchain](https://rustup.rs/) is required for Tauri builds.

See [docs/TAURI_BUILD.md](./docs/TAURI_BUILD.md) for detailed build instructions.

## Usage

```bash
# npm install
easypaper # Default port 3000, optional --port <number>

# From source
cd EasyPaper
npm run start
```

Open [http://localhost:3000](http://localhost:3000) to get started.

## Configuration

Configure your AI provider in the app's **Settings** page, or via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_BASE_URL` | API endpoint | `https://api.openai.com/v1` |
| `AI_API_KEY` | Your API key | — |
| `AI_MODEL` | Chat model | `gpt-4o` |
| `AI_VISION_MODEL` | Vision model for PDF parsing | `gpt-4o` |

- **Environment variables:** Can also be set in `~/.easypaper/.env`, with lower priority than UI settings.

## How to Use

1. **Upload** — Upload a PDF on the home page (drag-and-drop or click to browse)
2. **Open** — Enter the paper detail page with PDF viewer on the left and analysis panel on the right
3. **Analyze** — Get a structured analysis with page-referenced insights
4. **Chat** — Ask specific questions about the paper content
5. **Take Notes** — Select text in the PDF and create notes linked to specific sentences

## CLI Options

```
easypaper [options]

  -p, --port <number>  Port to run on (default: 3000)
  -h, --help           Show help
  -v, --version        Show version
```

All data is stored locally in `~/.easypaper/`.

## Roadmap

- [x] Support sentence-level notes with PDF text selection
- [x] Support asking AI questions about specific sentences
- [x] Desktop app (macOS/Windows/Linux) via Tauri
- [ ] Support more file formats (currently only PDF)
- [ ] Support more PDF parsing methods (currently only MLLM)
- [ ] Support shared reading of papers
- [ ] Support asking AI questions about screenshots

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4
- [react-pdf](https://github.com/wojtekmaj/react-pdf) for frontend PDF rendering
- [mupdf](https://github.com/ArtifexSoftware/mupdf) for backend PDF page rendering

## License

MIT License
