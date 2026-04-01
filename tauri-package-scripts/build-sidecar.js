#!/usr/bin/env node

/**
 * Build sidecar for Tauri desktop app
 *
 * This script:
 * 1. Runs next build (standalone output)
 * 2. Creates sidecar directory structure:
 *    - sidecar-dist/easypaper-server/  (contains server.js, node_modules, etc.)
 *    - sidecar-dist/easypaper-server-{target} (shell wrapper executable)
 * 3. Copies necessary files (server.js, node_modules, native modules)
 * 4. Generates version.json
 *
 * IMPORTANT: Tauri externalBin requires an EXECUTABLE file at the specified path.
 * We create a shell script wrapper that references the server directory.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SIDECAR_DIST = path.join(PROJECT_ROOT, 'sidecar-dist');
const NEXT_STANDALONE = path.join(PROJECT_ROOT, '.next', 'standalone');

const PLATFORMS = {
  'macos-x64': 'x86_64-apple-darwin',
  'macos-arm64': 'aarch64-apple-darwin',
  'windows-x64': 'x86_64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-gnu',
};

function main() {
  console.log('Building sidecar for Tauri...\n');

  // Step 1: Ensure Next.js standalone build exists
  if (!fs.existsSync(NEXT_STANDALONE)) {
    console.log('Running next build...');
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  }

  if (!fs.existsSync(NEXT_STANDALONE)) {
    console.error('ERROR: Next.js standalone build not found at', NEXT_STANDALONE);
    process.exit(1);
  }

  // Step 2: Create sidecar-dist directory
  fs.mkdirSync(SIDECAR_DIST, { recursive: true });

  // Step 3: Create the server directory (contains all the actual files)
  const serverDir = path.join(SIDECAR_DIST, 'easypaper-server');
  buildServerDirectory(serverDir);

  // Step 4: Create platform-specific wrapper executable
  const currentPlatform = detectCurrentPlatform();
  createPlatformWrapper(currentPlatform, serverDir);

  // Step 5: Generate version.json
  const packageJson = require(path.join(PROJECT_ROOT, 'package.json'));
  fs.writeFileSync(
    path.join(SIDECAR_DIST, 'version.json'),
    JSON.stringify({
      version: packageJson.version,
      tauri_version: packageJson.version,
      build_time: new Date().toISOString(),
    }, null, 2)
  );

  console.log('\nSidecar build complete!');
  console.log(`Output: ${SIDECAR_DIST}`);
}

function detectCurrentPlatform() {
  const os = require('node:os');
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'darwin') {
    return arch === 'x64' ? 'macos-x64' : 'macos-arm64';
  }
  if (platform === 'win32') return 'windows-x64';
  if (platform === 'linux') return 'linux-x64';

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

function buildServerDirectory(serverDir) {
  console.log('Building server directory...');

  // Remove existing directory
  if (fs.existsSync(serverDir)) {
    fs.rmSync(serverDir, { recursive: true });
  }
  fs.mkdirSync(serverDir, { recursive: true });

  // Copy standalone Next.js files
  console.log('  Copying Next.js standalone...');
  copyDirectory(NEXT_STANDALONE, serverDir);

  // Copy native modules (mupdf)
  copyNativeModules(serverDir);

  // Copy static files (from .next/static to server/.next/static)
  const staticSrc = path.join(PROJECT_ROOT, '.next', 'static');
  const staticDest = path.join(serverDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    console.log('  Copying static files...');
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    copyDirectory(staticSrc, staticDest);
  }

  // Copy public folder
  const publicSrc = path.join(PROJECT_ROOT, 'public');
  const publicDest = path.join(serverDir, 'public');
  if (fs.existsSync(publicSrc)) {
    console.log('  Copying public files...');
    copyDirectory(publicSrc, publicDest);
  }

  // Create start.js entry point that handles ready signal
  createStartScript(serverDir);

  console.log(`  -> ${serverDir}`);
}

function createStartScript(serverDir) {
  console.log('  Creating start.js entry point...');
  const startJs = `#!/usr/bin/env node

/**
 * Production entry point for Tauri sidecar
 * Runs Next.js standalone server and outputs ready signal
 */

const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const READY_SIGNAL = process.argv.includes('--ready-signal');

// Find available port
async function findAvailablePort(startPort) {
  const maxPort = 3100;
  for (let port = startPort; port <= maxPort; port++) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
    if (available) return port;
  }
  return null;
}

async function main() {
  // Find available port if in ready-signal mode
  let port = PORT;
  if (READY_SIGNAL) {
    port = await findAvailablePort(PORT);
    if (!port) {
      console.log('EASYPAPER_ERROR:Port 3000-3100 all occupied');
      process.exit(1);
    }
  }

  const serverPath = path.join(__dirname, 'server.js');

  // Start the Next.js server
  const env = {
    ...process.env,
    PORT: port.toString(),
    NODE_ENV: 'production',
  };

  const child = spawn(process.execPath, [serverPath], {
    cwd: __dirname,
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
    detached: true, // Create new process group so we can kill all descendants
  });

  // Store child PID for cleanup
  const childPid = child.pid;

  if (READY_SIGNAL) {
    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        console.log('EASYPAPER_ERROR:Server startup timeout');
        child.kill('SIGTERM');
        process.exit(1);
      }
    }, 10000);

    child.stdout.on('data', (data) => {
      const output = data.toString();
      // Next.js outputs "Ready" when server starts
      if (!serverReady && (output.includes('Ready') || output.includes('Local:'))) {
        serverReady = true;
        clearTimeout(timeout);
        console.log('EASYPAPER_READY:' + port);
      }
      process.stderr.write(output);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  } else {
    child.stdout.on('data', (data) => process.stdout.write(data));
    child.stderr.on('data', (data) => process.stderr.write(data));
  }

  child.on('error', (err) => {
    if (READY_SIGNAL) {
      console.log('EASYPAPER_ERROR:' + err.message);
    } else {
      console.error('Error: ' + err.message);
    }
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  // Handle shutdown signals - forward to child and kill process tree
  const shutdown = (signal) => {
    // Kill the entire process group (including grandchildren)
    // Negative PID means kill the process group
    try {
      process.kill(-childPid, signal);
    } catch (e) {
      // Process might already be dead
    }
    // Also kill direct child as fallback
    child.kill(signal);
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      shutdown(signal);
      process.exit(0);
    });
  }

  // Handle parent death (if parent exits, we should too)
  process.on('exit', () => {
    try {
      process.kill(-childPid, 'SIGTERM');
    } catch (e) {}
  });
}

main().catch((err) => {
  if (READY_SIGNAL) {
    console.log('EASYPAPER_ERROR:' + err.message);
  } else {
    console.error('Error: ' + err.message);
  }
  process.exit(1);
});
`;
  fs.writeFileSync(path.join(serverDir, 'start.js'), startJs);
}

function createPlatformWrapper(platform, serverDir) {
  const targetTriple = PLATFORMS[platform];
  console.log(`Creating wrapper for ${platform} (${targetTriple})...`);

  // The wrapper sits at the same level as the server directory
  // sidecar-dist/
  //   easypaper-server/           <- server directory (will be bundled to Resources/server/)
  //   easypaper-server-aarch64-apple-darwin  <- wrapper executable (will be bundled to MacOS)

  // In the final app bundle:
  //   MacOS/easypaper-server      <- wrapper
  //   Resources/server/           <- server directory

  if (platform === 'windows-x64') {
    // Windows: create a .bat file
    const wrapperPath = path.join(SIDECAR_DIST, `easypaper-server-${targetTriple}.bat`);
    const batContent = `@echo off
set RESOURCES_DIR=%~dp0..\\resources
node "%RESOURCES_DIR%\\server\\server.js" --ready-signal %*
`;
    fs.writeFileSync(wrapperPath, batContent);
    console.log(`  -> ${wrapperPath}`);
  } else {
    // Unix: create shell script with process group for clean shutdown
    // For macOS: Resources are at ../Resources relative to MacOS
    // For Linux: Resources are at ../resources relative to the binary
    const wrapperPath = path.join(SIDECAR_DIST, `easypaper-server-${targetTriple}`);
    // Use setsid to create new session/process group, then kill the group on exit
    const shContent = `#!/bin/bash
# Get the Resources directory (macOS) or resources directory (Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  RESOURCES_DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
else
  RESOURCES_DIR="$(cd "$(dirname "$0")/../resources" && pwd)"
fi

# Find node - check common locations in order
NODE_PATH=""
for candidate in \\
  "/opt/homebrew/bin/node" \\
  "/usr/local/bin/node" \\
  "/usr/bin/node" \\
  "$HOME/.nvm/versions/node/*/bin/node" \\
  "$HOME/.cargo/bin/node"; do
  if [[ -x "$candidate" ]]; then
    NODE_PATH="$candidate"
    break
  fi
done

# Fall back to node in PATH
if [[ -z "$NODE_PATH" ]]; then
  NODE_PATH="node"
fi

# Create new process group (setsid) so we can kill all children on exit
# This ensures that when Tauri kills this process, all Node.js children die too
exec "$NODE_PATH" "$RESOURCES_DIR/server/start.js" --ready-signal "$@"
`;
    fs.writeFileSync(wrapperPath, shContent);
    fs.chmodSync(wrapperPath, 0o755);
    console.log(`  -> ${wrapperPath}`);
  }
}

function copyDirectory(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      // Skip symlinks (can cause issues with cross-platform builds)
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyNativeModules(outputDir) {
  const mupdfSrc = path.join(PROJECT_ROOT, 'node_modules', 'mupdf');
  if (fs.existsSync(mupdfSrc)) {
    console.log('  Copying mupdf native module...');
    const mupdfDest = path.join(outputDir, 'node_modules', 'mupdf');
    fs.mkdirSync(path.dirname(mupdfDest), { recursive: true });
    copyDirectory(mupdfSrc, mupdfDest);
  } else {
    console.warn('  Warning: mupdf not found in node_modules');
  }
}

main();