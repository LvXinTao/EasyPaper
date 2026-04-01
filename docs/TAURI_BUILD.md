# Tauri Desktop App Build Guide

This document describes how to build the EasyPaper Tauri desktop application.

## Prerequisites

1. **Node.js 20.9+** - For Next.js and build scripts
2. **Rust toolchain** - For Tauri
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **Platform-specific dependencies:**
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
   - **Windows:** Microsoft Visual Studio C++ Build Tools
   - **Linux:** `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

## Development

### Run in Development Mode

```bash
npm run tauri:dev
```

This will:
1. Start Next.js dev server on port 3000
2. Compile Tauri Rust code
3. Open WebView window

### Run CLI Mode (Existing)

```bash
npm run dev
```

## Production Build

### Build Sidecar Only

```bash
npm run build:sidecar
```

This creates:
- `sidecar-dist/easypaper-server-<target>/` with:
  - `server.js` - Next.js standalone server
  - Shell wrapper script (executable)
  - `node_modules/` with mupdf
  - `.next/static/` and `public/`

### Build Tauri App

```bash
npm run tauri:build
```

This creates:
- **macOS:** `src-tauri/target/release/bundle/macos/EasyPaper.app`
- **macOS DMG:** `src-tauri/target/release/bundle/dmg/EasyPaper.dmg`

## Architecture

```
EasyPaper.app
├── Tauri Main Process (Rust)
│   ├── Starts Node.js sidecar
│   ├── Manages WebView window
│   └── Handles app lifecycle
│
├── Node.js Sidecar
│   ├── Next.js server (localhost:3000-3100)
│   ├── All API routes
│   ├── mupdf PDF rendering
│   └── SSE streaming
│
└── WebView Window
    └── Renders Next.js frontend
```

## Communication Protocol

Sidecar outputs signals via stdout:
- `EASYPAPER_READY:<port>` - Server started successfully
- `EASYPAPER_ERROR:<message>` - Startup failed

Tauri waits for ready signal with 10-second timeout.

## Data Storage

Data is stored in `~/.easypaper/`:
- `data/` - Papers, images, analysis
- `config/` - Settings, prompts

Logs are in:
- **macOS:** `~/Library/Logs/EasyPaper/`
- **Windows:** `%APPDATA%/EasyPaper/logs/`
- **Linux:** `~/.local/share/easypaper/logs/`

## Troubleshooting

### Sidecar Binary Not Found

Run `npm run build:sidecar` before `npm run tauri:build`.

### Port Already in Use

Close any existing EasyPaper CLI instances before launching the desktop app.

### Rust Compilation Errors

Ensure Rust toolchain is installed:
```bash
rustc --version
cargo --version
```

### Build Sidecar Fails

Ensure Next.js standalone build exists:
```bash
npm run build  # Creates .next/standalone/
```

## CLI vs Desktop App

Both modes use the same data directory (`~/.easypaper/`) and are compatible.

- **CLI Mode:** `npm run dev` or `easypaper` command
- **Desktop Mode:** `npm run tauri:dev` or EasyPaper.app

Note: CLI and Desktop app cannot run simultaneously (port conflict).