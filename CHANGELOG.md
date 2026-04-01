# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.1] - 2026-04-01

### Added

- **Desktop App (Tauri)** — Native desktop application for macOS, Windows, and Linux
  - Sidecar architecture: Next.js standalone server bundled with native wrapper
  - Graceful shutdown with SIGTERM signal handling
  - Server-side logging to `~/.easypaper/logs/server.log`
  - Port conflict detection (warns if CLI is already running)
  - Auto-retry on ports 3000-3100 if default port is occupied

### Changed

- Build system now generates sidecar bundle for Tauri
- Added `npm run tauri:dev` and `npm run tauri:build` scripts

### Technical Details

- **Sidecar Process Management**
  - Shell wrapper finds Node.js in common locations (Homebrew, NVM, etc.)
  - `start.js` entry point handles ready signal protocol
  - Signal handlers forward SIGTERM to child processes
  - Log rotation (5MB max, keep last 3 rotated files)

- **Tauri Integration**
  - Rust backend with plugins: shell, dialog, single-instance, window-state, log
  - Compile-time detection for dev/production mode
  - Window close handler sends SIGTERM for graceful shutdown

---

## [1.0.0] - 2025-03-15

### Added

- **PDF Upload & Viewing** — Drag-and-drop upload with built-in PDF viewer
- **AI Analysis** — Extract summary, key contributions, methodology via MLLM
- **Interactive Chat** — Ask questions with full paper context, multiple sessions
- **Sentence-Level Notes** — Select text and create notes linked to specific sentences
- **Bookmarks** — Mark important pages for quick navigation
- **Folder Organization** — Hierarchical folder structure for papers
- **Custom Prompts** — Configure prompts for vision parsing, analysis, and chat
- **Theme Customization** — 4 theme presets (dark-minimal, light-minimal, warm-light, warm-dark)
- **Flexible AI Backend** — Works with any OpenAI-compatible API
- **Local Storage** — All data in `~/.easypaper/`, no external database
- **CLI** — `npx @lvxintao/easypaper` for quick start

---

## Roadmap

- [ ] Support more file formats (currently only PDF)
- [ ] Support more PDF parsing methods (currently only MLLM)
- [ ] Support shared reading of papers
- [ ] Support asking AI questions about screenshots
