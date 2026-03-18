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

First run triggers an automatic `next build` (~30-60 seconds). Subsequent runs start instantly.

## Approach

**Next.js + CLI Wrapper** — keep the existing Next.js architecture unchanged. Add a CLI entry point that configures environment variables and delegates to `next start`.

Chosen over alternatives (pre-built publish, standalone mode) for minimal risk and smallest diff.

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
4. Check if `.next/` exists in the package install directory; if not, run `next build`
5. Detect version mismatch (compare `package.json` version with a stored build version) to trigger rebuild after upgrades
6. Spawn `next start -p <port>` as a child process, forwarding stdio
7. Print startup message: `EasyPaper is running at http://localhost:<port>`

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

### 3. Data Directory Structure

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

### 4. package.json Changes

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
    "src/",
    "public/",
    "bin/",
    "scripts/",
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "package.json"
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
    "prepublishOnly": "npm run lint && npm test"
  }
}
```

### 5. Build & Startup Flow

```
easypaper [--port N]
    │
    ├─ Set DATA_DIR=~/.easypaper/data
    ├─ Set CONFIG_DIR=~/.easypaper/config
    ├─ Ensure directories exist
    │
    ├─ .next/ exists and version matches?
    │   ├─ YES → skip build
    │   └─ NO  → "First run: building EasyPaper..."
    │           → next build (in package install dir)
    │           → save version marker
    │
    └─ next start -p <port>
       → "EasyPaper is running at http://localhost:<port>"
```

### 6. Version Upgrade Handling

After `npm update -g easypaper`:
- npm replaces the package directory, removing the old `.next/`
- CLI detects missing `.next/` or version mismatch → triggers rebuild
- User data in `~/.easypaper/` is untouched

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `bin/easypaper.js` | Create | CLI entry point |
| `src/lib/storage.ts` | Modify | Change default paths to `~/.easypaper/` |
| `package.json` | Modify | Add `bin`, `files`, `engines`; set `private: false` |

## System Requirements

- Node.js >= 18
- Python 3 + `marker-pdf` (for PDF parsing)

## Out of Scope

- Pre-building before publish (future optimization)
- Docker packaging
- Auto-update mechanism
- Data migration from old `./data` paths
