#!/usr/bin/env node

const { parseArgs } = require('node:util');
const { spawn } = require('node:child_process');
const net = require('node:net');
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
      readySignal: { type: 'boolean', default: false },
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
  --ready-signal       Output EASYPAPER_READY:<port> when server starts (for Tauri sidecar)

Data is stored in ~/.easypaper/
Environment variables can be set in ~/.easypaper/.env
`);
  process.exit(0);
}

if (values.version) {
  console.log(pkg.version);
  process.exit(0);
}

/**
 * Find available port starting from preferred port
 * Returns the first available port in range 3000-3100
 */
async function findAvailablePort(startPort) {
  const maxPort = 3100;

  for (let port = parseInt(startPort); port <= maxPort; port++) {
    const available = await checkPortAvailable(port);
    if (available) {
      return port.toString();
    }
  }
  return null;
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function main() {
  const preferredPort = values.port;
  const pkgDir = path.resolve(__dirname, '..');
  const easypaperDir = path.join(os.homedir(), '.easypaper');
  const dataDir = path.join(easypaperDir, 'data');
  const configDir = path.join(easypaperDir, 'config');

  // Load ~/.easypaper/.env
  const dotenvPath = path.join(easypaperDir, '.env');
  try {
    const dotenvContent = fs.readFileSync(dotenvPath, 'utf-8');
    for (const line of dotenvContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch { /* .env file doesn't exist */ }

  // Port discovery for sidecar mode
  let port;
  if (values.readySignal) {
    port = await findAvailablePort(preferredPort);
    if (!port) {
      console.log('EASYPAPER_ERROR:Port 3000-3100 all occupied');
      process.exit(1);
    }
  } else {
    port = preferredPort;
  }

  const env = {
    ...process.env,
    DATA_DIR: process.env.DATA_DIR || dataDir,
    CONFIG_DIR: process.env.CONFIG_DIR || configDir,
    PORT: port,
    EASYPAPER_PKG_DIR: pkgDir,
  };

  fs.mkdirSync(env.DATA_DIR, { recursive: true });
  fs.mkdirSync(env.CONFIG_DIR, { recursive: true });

  const nextBin = path.join(pkgDir, 'node_modules', '.bin', 'next');

  if (!values.readySignal) {
    console.log(`EasyPaper v${pkg.version}`);
    console.log(`EasyPaper is running at http://localhost:${port}`);
    console.log(`Data directory: ${env.DATA_DIR}`);
    console.log();
  }

  // Prepare spawn options - set up listeners BEFORE spawning to avoid race condition
  const spawnOptions = {
    cwd: pkgDir,
    env,
    stdio: values.readySignal ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  };

  const child = spawn(nextBin, ['start', '-p', port], spawnOptions);

  // Set up stdout/stderr listeners immediately after spawn (before next event loop tick)
  // This prevents missing any early output from the child process
  if (values.readySignal) {
    let serverReady = false;
    const readyTimeout = setTimeout(() => {
      if (!serverReady) {
        console.log('EASYPAPER_ERROR:Server startup timeout');
        child.kill();
        process.exit(1);
      }
    }, 10000);

    // Attach listeners immediately - Node.js event loop won't process I/O
    // until the current synchronous code completes, so this is safe
    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready') || output.includes('Local:')) {
        serverReady = true;
        clearTimeout(readyTimeout);
        console.log(`EASYPAPER_READY:${port}`);
      }
      process.stderr.write(output);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  }

  child.on('error', (err) => {
    const msg = err.code === 'ENOENT'
      ? 'next.js binary not found'
      : err.message;
    if (values.readySignal) {
      console.log(`EASYPAPER_ERROR:${msg}`);
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => child.kill(signal));
  }
}

main().catch((err) => {
  if (values.readySignal) {
    console.log(`EASYPAPER_ERROR:${err.message}`);
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
});
