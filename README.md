# EasyPaper

Upload academic PDFs, get AI-powered analysis, and chat about the content — all in one place.

## Features

- **PDF Upload & Viewing** — Drag-and-drop upload with a built-in PDF viewer (zoom, page navigation, text selection)
- **AI Analysis** — Automatically extract summary, key contributions, methodology, and conclusions with page references
- **Interactive Chat** — Ask follow-up questions about the paper with full context awareness
- **Reference Linking** — Click a reference in the analysis to jump to the exact page in the PDF with text highlighting
- **Streaming Responses** — Real-time streamed AI output with typewriter effect
- **Flexible AI Backend** — Works with any OpenAI-compatible API (OpenAI, Ollama, LM Studio, etc.)
- **Local Storage** — All data stored locally on your machine, no external database required

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Python 3** with [`marker-pdf`](https://github.com/VikParuchuri/marker) installed (`pip install marker-pdf`)

### Setup

```bash
# Install dependencies
npm install

# Configure your AI provider
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-your-key-here
AI_MODEL=gpt-4o
AI_VISION_MODEL=gpt-4o
```

> You can also configure these from the Settings page in the app.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload** a PDF on the home page (drag-and-drop or click to browse)
2. **Open** the paper to see the dual-panel view — PDF on the left, analysis on the right
3. **Analyze** the paper to get a structured breakdown with page references
4. **Chat** to ask specific questions about the paper's content

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4
- [pdfjs-dist](https://github.com/nicedoc/pdfjs-dist) for PDF rendering
- [marker-pdf](https://github.com/VikParuchuri/marker) for PDF-to-Markdown parsing

## License

MIT
