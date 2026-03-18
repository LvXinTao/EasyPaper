# EasyPaper NPM Packaging Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package EasyPaper as a globally installable npm package (`npm install -g easypaper`) with user data stored in `~/.easypaper/`.

**Architecture:** Add a CLI entry point (`bin/easypaper.js`) that sets environment variables and delegates to `next start`. Change default storage paths from `process.cwd()` to `~/.easypaper/`. Ship pre-built `.next/` in the npm package.

**Tech Stack:** Node.js built-in `util.parseArgs` for CLI, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-18-npm-packaging-design.md`

---

## Chunk 1: Storage and Marker Path Changes

### Task 1: Update storage.ts default paths

**Files:**
- Modify: `src/lib/storage.ts:1-11`
- Test: `__tests__/lib/storage.test.ts`

- [ ] **Step 1: Write test for default path using os.homedir()**

Add a **new top-level** `describe` block at the **end** of `__tests__/lib/storage.test.ts` (outside the existing `describe('storage', ...)` block, so its `beforeEach` that sets `DATA_DIR` does not interfere). The file already imports `path` and `os`:

```typescript
describe('default data directory', () => {
  let originalDataDir: string | undefined;

  beforeEach(() => {
    originalDataDir = process.env.DATA_DIR;
    delete process.env.DATA_DIR;
  });

  afterEach(() => {
    if (originalDataDir !== undefined) {
      process.env.DATA_DIR = originalDataDir;
    } else {
      delete process.env.DATA_DIR;
    }
  });

  it('uses ~/.easypaper/data when DATA_DIR is not set', () => {
    const expectedBase = path.join(os.homedir(), '.easypaper', 'data');
    const pdfPath = storage.getPdfPath('test-id');
    expect(pdfPath).toBe(path.join(expectedBase, 'papers', 'test-id', 'original.pdf'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/storage.test.ts -t "default data directory" --no-coverage`
Expected: FAIL — path will contain `process.cwd()/data` instead of `~/.easypaper/data`

- [ ] **Step 3: Update storage.ts to use os.homedir()**

In `src/lib/storage.ts`, add `import os from 'os';` at line 2, then change the two path functions:

```typescript
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { PaperMetadata, PaperAnalysis, ChatHistory, ChatSession, ChatSessionMeta, PaperListItem, Note, Folder } from '@/types';

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(os.homedir(), '.easypaper', 'data');
}

function getConfigDir(): string {
  return process.env.CONFIG_DIR || path.join(os.homedir(), '.easypaper', 'config');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/storage.test.ts -t "default data directory" --no-coverage`
Expected: PASS

- [ ] **Step 5: Run all storage tests to check nothing is broken**

Run: `npx jest __tests__/lib/storage --no-coverage`
Expected: All tests PASS (existing tests use `DATA_DIR` env var override, so they are unaffected)

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts __tests__/lib/storage.test.ts
git commit -m "feat: change default storage path to ~/.easypaper/"
```

---

### Task 2: Fix marker.ts script path resolution

**Files:**
- Modify: `src/lib/marker.ts:45`
- Test: `__tests__/lib/marker.test.ts`

- [ ] **Step 1: Write test for script path using __dirname**

Add a test inside the existing `describe('parsePdfWithMarker')` block in `__tests__/lib/marker.test.ts`. Mock `process.cwd()` to return a fake directory so we can assert the script path does NOT use it:

```typescript
it('resolves parse-pdf.py relative to module location, not cwd', async () => {
  const originalCwd = process.cwd;
  process.cwd = jest.fn().mockReturnValue('/tmp/fake-user-dir') as any;

  const mockProcess = { stdout: { on: jest.fn() }, stderr: { on: jest.fn() }, on: jest.fn() };
  mockSpawn.mockReturnValue(mockProcess as any);

  parsePdfWithMarker('/test.pdf', '/output');

  const spawnArgs = mockSpawn.mock.calls[0];
  const scriptPath = spawnArgs[1][0]; // first arg after python binary
  // Should NOT use the fake cwd
  expect(scriptPath).not.toContain('/tmp/fake-user-dir');
  // Should end with scripts/parse-pdf.py
  expect(scriptPath).toMatch(/scripts[/\\]parse-pdf\.py$/);

  process.cwd = originalCwd;

  // Clean up the promise
  const closeCallback = mockProcess.on.mock.calls.find((c: any[]) => c[0] === 'close')![1];
  closeCallback(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/marker.test.ts -t "resolves parse-pdf.py" --no-coverage`
Expected: FAIL — script path currently uses `process.cwd()`

- [ ] **Step 3: Fix marker.ts to use __dirname**

In `src/lib/marker.ts`, change line 45 from:

```typescript
const scriptPath = path.join(process.cwd(), 'scripts', 'parse-pdf.py');
```

To:

```typescript
const scriptPath = process.env.EASYPAPER_PKG_DIR
  ? path.join(process.env.EASYPAPER_PKG_DIR, 'scripts', 'parse-pdf.py')
  : path.join(__dirname, '..', '..', 'scripts', 'parse-pdf.py');
```

Note: `__dirname` in `src/lib/marker.ts` is `<project>/src/lib/`, so `../..` gets to project root where `scripts/` lives.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/marker.test.ts -t "resolves parse-pdf.py" --no-coverage`
Expected: PASS

- [ ] **Step 5: Run all marker tests**

Run: `npx jest __tests__/lib/marker.test.ts --no-coverage`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/marker.ts __tests__/lib/marker.test.ts
git commit -m "fix: resolve parse-pdf.py via __dirname for global install compatibility"
```

---

## Chunk 2: CLI Entry Point and Tests

### Task 3: Create CLI entry point with tests (TDD)

**Files:**
- Create: `bin/easypaper.js`
- Create: `__tests__/bin/easypaper.test.ts`

- [ ] **Step 1: Write CLI tests first**

Create `__tests__/bin/easypaper.test.ts`:

```typescript
import { execFileSync } from 'child_process';
import path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../bin/easypaper.js');

describe('easypaper CLI', () => {
  it('shows version with --version flag', () => {
    const output = execFileSync('node', [CLI_PATH, '--version'], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('shows version with -v flag', () => {
    const output = execFileSync('node', [CLI_PATH, '-v'], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('shows help with --help flag', () => {
    const output = execFileSync('node', [CLI_PATH, '--help'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(output).toContain('Usage: easypaper');
    expect(output).toContain('--port');
    expect(output).toContain('--help');
    expect(output).toContain('--version');
    expect(output).toContain('~/.easypaper/');
  });

  it('shows help with -h flag', () => {
    const output = execFileSync('node', [CLI_PATH, '-h'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(output).toContain('Usage: easypaper');
  });

  it('accepts --port flag combined with --help', () => {
    const output = execFileSync('node', [CLI_PATH, '--port', '9999', '--help'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(output).toContain('Usage: easypaper');
  });

  it('rejects unknown flags with a friendly message', () => {
    try {
      execFileSync('node', [CLI_PATH, '--unknown'], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.status).not.toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/bin/easypaper.test.ts --no-coverage`
Expected: FAIL — `bin/easypaper.js` does not exist yet.

- [ ] **Step 3: Create bin/easypaper.js**

```javascript
#!/usr/bin/env node

const { parseArgs } = require('node:util');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const pkg = require('../package.json');

// Parse CLI arguments with friendly error handling
let values;
try {
  ({ values } = parseArgs({
    options: {
      port: { type: 'string', short: 'p', default: '3000' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    strict: true,
  }));
} catch (err) {
  console.error(`Error: ${err.message}`);
  console.error('Run "easypaper --help" for usage information.');
  process.exit(1);
}

if (values.help) {
  console.log(`
EasyPaper v${pkg.version}

Usage: easypaper [options]

Options:
  -p, --port <number>  Port to run on (default: 3000)
  -h, --help           Show this help message
  -v, --version        Show version number

Data is stored in ~/.easypaper/
`);
  process.exit(0);
}

if (values.version) {
  console.log(pkg.version);
  process.exit(0);
}

const port = values.port;
const pkgDir = path.resolve(__dirname, '..');
const dataDir = path.join(os.homedir(), '.easypaper', 'data');
const configDir = path.join(os.homedir(), '.easypaper', 'config');

// Ensure data directories exist
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });

// Set environment variables
const env = {
  ...process.env,
  DATA_DIR: process.env.DATA_DIR || dataDir,
  CONFIG_DIR: process.env.CONFIG_DIR || configDir,
  PORT: port,
  EASYPAPER_PKG_DIR: pkgDir,
};

// Resolve next binary from the package's own node_modules
const nextBin = path.join(pkgDir, 'node_modules', '.bin', 'next');

console.log(`EasyPaper v${pkg.version}`);
console.log(`Starting on http://localhost:${port}`);
console.log(`Data directory: ${env.DATA_DIR}`);
console.log();

const child = spawn(nextBin, ['start', '-p', port], {
  cwd: pkgDir,
  env,
  stdio: 'inherit',
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('Error: next.js binary not found. Try reinstalling: npm install -g easypaper');
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

// Forward signals to child process
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
```

- [ ] **Step 4: Make the file executable**

Run: `chmod +x bin/easypaper.js`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/bin/easypaper.test.ts --no-coverage`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add bin/easypaper.js __tests__/bin/easypaper.test.ts
git commit -m "feat: add CLI entry point with tests for global npm install"
```

---

## Chunk 3: Package.json and Final Integration

### Task 5: Update package.json for npm publishing

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json**

Apply these changes to `package.json`:

1. Set `"private": false`
2. Add `"description": "Upload academic PDFs, analyze them with AI, and chat about their content"`
3. Add `"license": "MIT"`
4. Add `"bin"` field:
   ```json
   "bin": {
     "easypaper": "bin/easypaper.js"
   }
   ```
5. Add `"files"` field:
   ```json
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
   ]
   ```
6. Add `"engines"` field:
   ```json
   "engines": {
     "node": ">=18.0.0"
   }
   ```
7. Update `"prepublishOnly"` script:
   ```json
   "prepublishOnly": "npm run lint && npm test && npm run build"
   ```

- [ ] **Step 2: Run full test suite to verify nothing is broken**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Verify npm pack output contains expected files**

Run:
```bash
# Verify expected files are included
npm pack --dry-run 2>&1 | grep "bin/easypaper.js"
npm pack --dry-run 2>&1 | grep ".next/"
npm pack --dry-run 2>&1 | grep "scripts/parse-pdf.py"
# Verify excluded files are NOT included
npm pack --dry-run 2>&1 | grep -c "__tests__" | grep "^0$"
```
Expected: First three greps find matches; last command outputs `0` (no test files in pack).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: configure package.json for npm publishing"
```

---

### Task 6: End-to-end local install test

**Files:** None (verification only)

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Build completes successfully, `.next/` directory created.

- [ ] **Step 2: Create a tarball and test global install**

Run:
```bash
TARBALL=$(npm pack) && npm install -g ./$TARBALL
```
Expected: Package installs successfully, `easypaper` command is available.

- [ ] **Step 3: Test CLI flags**

Run:
```bash
easypaper --version
easypaper --help
```
Expected: Version matches the value in `package.json`, help shows usage info.

- [ ] **Step 4: Test server start (briefly)**

Run:
```bash
easypaper --port 3456 & PID=$!; sleep 5; kill $PID 2>/dev/null; wait $PID 2>/dev/null
```
Expected: Output includes "Starting on http://localhost:3456" and "Data directory:" pointing to `~/.easypaper/data`. Verify `~/.easypaper/data` and `~/.easypaper/config` directories were created.

- [ ] **Step 5: Clean up**

Run:
```bash
npm uninstall -g easypaper
rm -f easypaper-*.tgz
```

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass. If any fixes were needed during verification, commit them.
