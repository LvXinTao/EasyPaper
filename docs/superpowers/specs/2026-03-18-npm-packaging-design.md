# EasyPaper NPM Packaging Design

## Goal

Package EasyPaper as a globally installable npm package (`npm install -g easypaper`) with user data stored in `~/.easypaper/`.

## User Experience

```bash
npm install -g easypaper
easypaper              # starts on port 3000
easypaper --port 8080  # starts on port 8080
easypaper --help       # shows usage
easypaper --version    # shows version
```

Starts instantly — the npm package ships with pre-built assets.

## Approach

**Pre-built Next.js + CLI Wrapper** — keep the existing Next.js architecture unchanged. Pre-build before publishing so the npm package includes `.next/` build output. Add a CLI entry point that configures environment variables and delegates to `next start`.

Pre-building solves three problems at once:
- No devDependencies needed at install time (global install only provides `dependencies`)
- No write-permission issues in global `node_modules/` directories
- No first-run build delay for users

## Components

### 1. CLI Entry Point (`bin/easypaper.js`)

A Node.js script registered as the `easypaper` command via the `bin` field in `package.json`.

**Responsibilities:**

1. Parse CLI arguments using Node.js built-in `util.parseArgs` (no new dependencies)
   - `--port, -p <number>` — server port (default: 3000)
   - `--help, -h` — usage info
   - `--version, -v` — version from package.json
2. Set environment variables:
   - `DATA_DIR` → `~/.easypaper/data`
   - `CONFIG_DIR` → `~/.easypaper/config`
   - `PORT` → specified port
3. Create `~/.easypaper/data/` and `~/.easypaper/config/` if they don't exist
4. Resolve the package install directory via `path.resolve(__dirname, '..')` to ensure correct working directory
5. Spawn `next start -p <port>` as a child process with `cwd` set to the package install directory, forwarding stdio
6. Print startup message: `EasyPaper is running at http://localhost:<port>`

### 2. Storage Path Changes (`src/lib/storage.ts`)

Modify `getDataDir()` and `getConfigDir()` defaults:

**Before:**
```typescript
function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}
function getConfigDir(): string {
  return process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
}
```

**After:**
```typescript
function getDataDir(): string {
  return process.env.DATA_DIR || path.join(os.homedir(), '.easypaper', 'data');
}
function getConfigDir(): string {
  return process.env.CONFIG_DIR || path.join(os.homedir(), '.easypaper', 'config');
}
```

Environment variable overrides are preserved for backward compatibility and development flexibility.

### 3. Script Path Fix (`src/lib/marker.ts`)

The `marker.ts` module uses `process.cwd()` to locate `scripts/parse-pdf.py`. When installed globally, `process.cwd()` is the user's shell directory, not the package directory.

**Fix:** Resolve `parse-pdf.py` relative to the module's own location using `__dirname`:

```typescript
// Before:
const scriptPath = path.join(process.cwd(), 'scripts', 'parse-pdf.py');

// After:
const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'parse-pdf.py');
```

Note: The CLI entry point also sets `EASYPAPER_PKG_DIR` as a fallback:
```typescript
const scriptPath = process.env.EASYPAPER_PKG_DIR
  ? path.join(process.env.EASYPAPER_PKG_DIR, 'scripts', 'parse-pdf.py')
  : path.join(__dirname, '..', '..', 'scripts', 'parse-pdf.py');
```

### 4. Data Directory Structure

```
~/.easypaper/
├── data/
│   └── papers/{paperId}/
│       ├── original.pdf
│       ├── metadata.json
│       ├── parsed.md
│       ├── analysis.json
│       ├── notes.json
│       ├── chat-sessions/
│       └── images/
└── config/
    ├── settings.json      # Encrypted API key + model config
    └── folders.json       # Folder hierarchy
```

### 5. package.json Changes

```json
{
  "name": "easypaper",
  "version": "0.1.0",
  "private": false,
  "description": "Upload academic PDFs, analyze them with AI, and chat about their content",
  "license": "MIT",
  "bin": {
    "easypaper": "bin/easypaper.js"
  },
  "files": [
    ".next/",
    "src/",
    "public/",
    "bin/",
    "scripts/",
    "next.config.ts",
    "next-env.d.ts",
    "tsconfig.json",
    "postcss.config.mjs"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "jest",
    "test:watch": "jest --watch",
    "prepublishOnly": "npm run lint && npm test && npm run build"
  }
}
```

Key changes from original spec:
- `.next/` added to `files` — ships pre-built assets
- `next-env.d.ts` added to `files`
- `prepublishOnly` now includes `npm run build` — ensures build before every publish

### 6. Startup Flow

```
easypaper [--port N]
    │
    ├─ Set DATA_DIR=~/.easypaper/data
    ├─ Set CONFIG_DIR=~/.easypaper/config
    ├─ Set EASYPAPER_PKG_DIR=<package install dir>
    ├─ Ensure ~/.easypaper/data/ and ~/.easypaper/config/ exist
    │
    └─ next start -p <port> (cwd = package install dir)
       → "EasyPaper is running at http://localhost:<port>"
```

### 7. Version Upgrade Handling

After `npm update -g easypaper`:
- npm replaces the package directory with the new version (which includes fresh `.next/` build)
- No rebuild needed — new version ships pre-built
- User data in `~/.easypaper/` is untouched

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `bin/easypaper.js` | Create | CLI entry point |
| `src/lib/storage.ts` | Modify | Change default paths to `~/.easypaper/` |
| `src/lib/marker.ts` | Modify | Fix `process.cwd()` → `__dirname` for script path |
| `package.json` | Modify | Add `bin`, `files`, `engines`; set `private: false`; add build to prepublishOnly |

## System Requirements

- Node.js >= 18
- Python 3 + `marker-pdf` (for PDF parsing)

## Out of Scope

- Docker packaging
- Auto-update mechanism
- Data migration from old `./data` paths (users who previously ran via `npm run dev` will need to manually copy `./data` to `~/.easypaper/data`)
