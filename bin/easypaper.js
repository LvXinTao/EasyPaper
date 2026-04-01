#!/usr/bin/env node

const { parseArgs } = require('node:util');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const pkg = require('../package.json');

// Check if a port is available
function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

// Find an available port in the range 3000-3100
async function findAvailablePort(startPort = 3000, endPort = 3100) {
  for (let port = startPort; port <= endPort; port++) {
    if (await checkPortAvailable(port)) {
      return port;
    }
  }
  throw new Error('No available port found in range 3000-3100');
}

// Main async function to handle CLI logic
async function main() {
  // Parse CLI arguments with friendly error handling
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        port: { type: 'string', short: 'p', default: '3000' },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
        'ready-signal': { type: 'boolean', default: false },
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
  -p, --port <number>      Port to run on (default: 3000)
      --ready-signal       Output EASYPAPER_READY:<port> when server starts (for Tauri integration)
  -h, --help               Show this help message
  -v, --version            Show version number

Data is stored in ~/.easypaper/
Environment variables can be set in ~/.easypaper/.env
`);
    process.exit(0);
  }

  if (values.version) {
    console.log(pkg.version);
    process.exit(0);
  }

  const readySignal = values['ready-signal'];
  let port = values.port;

  // If ready-signal mode, find an available port
  if (readySignal) {
    try {
      port = await findAvailablePort();
    } catch (err) {
      console.error(`EASYPAPER_ERROR:${err.message}`);
      process.exit(1);
    }
  }

  const pkgDir = path.resolve(__dirname, '..');
  const easypeperDir = path.join(os.homedir(), '.easypaper');
  const dataDir = path.join(easypeperDir, 'data');
  const configDir = path.join(easypeperDir, 'config');

  // Load ~/.easypaper/.env (low priority, does not override existing env vars)
  const dotenvPath = path.join(easypeperDir, '.env');
  try {
    const dotenvContent = fs.readFileSync(dotenvPath, 'utf-8');
    for (const line of dotenvContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      // Only set if not already defined in the environment
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch { /* .env file doesn't exist, that's fine */ }

  // Set environment variables
  const env = {
    ...process.env,
    DATA_DIR: process.env.DATA_DIR || dataDir,
    CONFIG_DIR: process.env.CONFIG_DIR || configDir,
    PORT: port,
    EASYPAPER_PKG_DIR: pkgDir,
  };

  // Ensure data directories exist (use resolved paths)
  fs.mkdirSync(env.DATA_DIR, { recursive: true });
  fs.mkdirSync(env.CONFIG_DIR, { recursive: true });

  // Resolve next binary from the package's own node_modules
  const nextBin = path.join(pkgDir, 'node_modules', '.bin', 'next');

  if (readySignal) {
    console.log(`EASYPAPER_READY:${port}`);
  } else {
    console.log(`EasyPaper v${pkg.version}`);
    console.log(`EasyPaper is running at http://localhost:${port}`);
    console.log(`Data directory: ${env.DATA_DIR}`);
    console.log();
  }

  const child = spawn(nextBin, ['start', '-p', port], {
    cwd: pkgDir,
    env,
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      const errorMsg = 'Error: next.js binary not found. Try reinstalling: npm install -g easypaper';
      if (readySignal) {
        console.error(`EASYPAPER_ERROR:${errorMsg}`);
      } else {
        console.error(errorMsg);
      }
    } else {
      if (readySignal) {
        console.error(`EASYPAPER_ERROR:${err.message}`);
      } else {
        console.error(`Error: ${err.message}`);
      }
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
}

main();
