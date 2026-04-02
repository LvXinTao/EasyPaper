#!/usr/bin/env node

/**
 * Build sidecar for Tauri desktop app
 *
 * This script:
 * 1. Runs next build (standalone output)
 * 2. Downloads and bundles Node.js runtime (ensures native module ABI compatibility)
 * 3. Creates sidecar directory structure:
 *    - sidecar-dist/easypaper-server/  (contains server.js, node_modules, bundled node, etc.)
 *    - sidecar-dist/easypaper-server-{target} (shell wrapper executable)
 * 4. Copies necessary files (server.js, node_modules, native modules)
 * 5. Rebuilds native modules (better-sqlite3) for bundled Node.js version
 * 6. Generates version.json
 *
 * IMPORTANT: Tauri externalBin requires an EXECUTABLE file at the specified path.
 * We create a shell script wrapper that references the server directory.
 *
 * CRITICAL: Native modules like better-sqlite3 use legacy NAN APIs (not Node-API),
 * so they are NOT ABI-stable. Bundling Node.js ensures version consistency.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SIDECAR_DIST = path.join(PROJECT_ROOT, 'sidecar-dist');
const NEXT_STANDALONE = path.join(PROJECT_ROOT, '.next', 'standalone');

// Node.js version to bundle - must match better-sqlite3 supported versions
// Using Node.js 22.x LTS (MODULE_VERSION 131)
const BUNDLED_NODE_VERSION = '22.14.0';

const PLATFORMS = {
  'macos-x64': 'x86_64-apple-darwin',
  'macos-arm64': 'aarch64-apple-darwin',
  'windows-x64': 'x86_64-pc-windows-msvc',
  'linux-x64': 'x86_64-unknown-linux-gnu',
};

const NODE_DOWNLOAD_URLS = {
  'macos-arm64': `https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/node-v${BUNDLED_NODE_VERSION}-darwin-arm64.tar.gz`,
  'macos-x64': `https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/node-v${BUNDLED_NODE_VERSION}-darwin-x64.tar.gz`,
  'windows-x64': `https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/node-v${BUNDLED_NODE_VERSION}-win-x64.zip`,
  'linux-x64': `https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/node-v${BUNDLED_NODE_VERSION}-linux-x64.tar.gz`,
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

  // Step 3: Detect platform and download Node.js
  const currentPlatform = detectCurrentPlatform();
  const serverDir = path.join(SIDECAR_DIST, 'easypaper-server');
  const nodeDir = path.join(serverDir, 'node-runtime');

  // Download and extract Node.js for bundling
  downloadAndExtractNodeJs(currentPlatform, nodeDir);

  // Step 4: Build server directory
  buildServerDirectory(serverDir, nodeDir);

  // Step 5: Rebuild native modules for bundled Node.js version
  rebuildNativeModulesForBundledNode(nodeDir, serverDir);

  // Step 6: Create platform-specific wrapper executable
  createPlatformWrapper(currentPlatform, serverDir);

  // Step 7: Generate version.json
  const packageJson = require(path.join(PROJECT_ROOT, 'package.json'));
  fs.writeFileSync(
    path.join(SIDECAR_DIST, 'version.json'),
    JSON.stringify({
      version: packageJson.version,
      tauri_version: packageJson.version,
      build_time: new Date().toISOString(),
      bundled_node_version: BUNDLED_NODE_VERSION,
    }, null, 2)
  );

  console.log('\nSidecar build complete!');
  console.log(`Output: ${SIDECAR_DIST}`);
  console.log(`Bundled Node.js: v${BUNDLED_NODE_VERSION}`);
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

/**
 * Downloads and extracts Node.js runtime for bundling.
 * This ensures native modules are compiled for the exact Node.js version used at runtime.
 */
function downloadAndExtractNodeJs(platform, nodeDir) {
  const downloadUrl = NODE_DOWNLOAD_URLS[platform];
  if (!downloadUrl) {
    throw new Error(`No Node.js download URL for platform: ${platform}`);
  }

  // Check if already downloaded
  const nodeBinaryPath = platform === 'windows-x64'
    ? path.join(nodeDir, 'node.exe')
    : path.join(nodeDir, 'bin', 'node');

  if (fs.existsSync(nodeBinaryPath)) {
    // Verify version matches
    try {
      const version = execSync(`"${nodeBinaryPath}" --version`, { encoding: 'utf-8' }).trim();
      if (version === `v${BUNDLED_NODE_VERSION}`) {
        console.log(`  Node.js v${BUNDLED_NODE_VERSION} already downloaded at ${nodeDir}`);
        return;
      }
    } catch (e) {
      // Version check failed, re-download
    }
  }

  console.log(`  Downloading Node.js v${BUNDLED_NODE_VERSION} for ${platform}...`);
  console.log(`  URL: ${downloadUrl}`);

  // Remove existing directory
  if (fs.existsSync(nodeDir)) {
    fs.rmSync(nodeDir, { recursive: true });
  }
  fs.mkdirSync(nodeDir, { recursive: true });

  const archivePath = path.join(nodeDir, 'node-archive.tar.gz');

  // Download archive using curl
  execSync(`curl -L -o "${archivePath}" "${downloadUrl}"`, { stdio: 'inherit' });

  // Extract archive
  console.log('  Extracting Node.js...');
  if (downloadUrl.endsWith('.tar.gz')) {
    // Use tar for .tar.gz files (macOS and Linux)
    execSync(`tar -xzf "${archivePath}" -C "${nodeDir}"`, { stdio: 'inherit' });

    // Move contents from node-v{version}-{platform}/ to nodeDir
    const extractedDir = path.join(nodeDir, `node-v${BUNDLED_NODE_VERSION}-${getNodePlatformSuffix(platform)}`);
    if (fs.existsSync(extractedDir)) {
      // Move all contents up one level
      for (const entry of fs.readdirSync(extractedDir)) {
        const srcPath = path.join(extractedDir, entry);
        const destPath = path.join(nodeDir, entry);
        fs.renameSync(srcPath, destPath);
      }
      fs.rmSync(extractedDir, { recursive: true });
    }
  } else if (downloadUrl.endsWith('.zip')) {
    // Use unzip for Windows .zip files
    execSync(`unzip -o "${archivePath}" -d "${nodeDir}"`, { stdio: 'inherit' });

    // Move contents from node-v{version}-win-x64/ to nodeDir
    const extractedDir = path.join(nodeDir, `node-v${BUNDLED_NODE_VERSION}-win-x64`);
    if (fs.existsSync(extractedDir)) {
      for (const entry of fs.readdirSync(extractedDir)) {
        const srcPath = path.join(extractedDir, entry);
        const destPath = path.join(nodeDir, entry);
        fs.renameSync(srcPath, destPath);
      }
      fs.rmSync(extractedDir, { recursive: true });
    }
    // Rename archive for cleanup
    fs.renameSync(archivePath, path.join(nodeDir, 'node-archive.zip'));
  }

  // Clean up archive
  const archiveFiles = ['node-archive.tar.gz', 'node-archive.zip'];
  for (const f of archiveFiles) {
    const p = path.join(nodeDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // Verify extraction
  if (!fs.existsSync(nodeBinaryPath)) {
    throw new Error(`Node.js binary not found at ${nodeBinaryPath} after extraction`);
  }

  const version = execSync(`"${nodeBinaryPath}" --version`, { encoding: 'utf-8' }).trim();
  console.log(`  Node.js ${version} ready at ${nodeDir}`);
}

function getNodePlatformSuffix(platform) {
  switch (platform) {
    case 'macos-arm64': return 'darwin-arm64';
    case 'macos-x64': return 'darwin-x64';
    case 'linux-x64': return 'linux-x64';
    case 'windows-x64': return 'win-x64';
    default: return platform;
  }
}

/**
 * Rebuilds native modules (better-sqlite3) for the bundled Node.js version.
 * This is CRITICAL because better-sqlite3 uses legacy NAN APIs (not Node-API),
 * so it's NOT ABI-stable across Node.js versions.
 *
 * Strategy: Rebuild in project root (where binding.gyp exists), then copy to sidecar.
 */
function rebuildNativeModulesForBundledNode(nodeDir, serverDir) {
  const nodeBinaryPath = fs.existsSync(path.join(nodeDir, 'node.exe'))
    ? path.join(nodeDir, 'node.exe')
    : path.join(nodeDir, 'bin', 'node');

  if (!fs.existsSync(nodeBinaryPath)) {
    throw new Error(`Bundled Node.js binary not found at ${nodeBinaryPath}`);
  }

  console.log('  Rebuilding native modules for bundled Node.js...');
  console.log(`  Using Node.js: ${nodeBinaryPath}`);

  // Verify bundled Node.js version
  const versionOutput = execSync(`"${nodeBinaryPath}" --version`, { encoding: 'utf-8' }).trim();
  console.log(`  Bundled Node.js version: ${versionOutput}`);

  // Rebuild better-sqlite3 in the PROJECT ROOT (where full source exists)
  const projectBetterSqlite3Dir = path.join(PROJECT_ROOT, 'node_modules', 'better-sqlite3');
  const sidecarBetterSqlite3Dir = path.join(serverDir, 'node_modules', 'better-sqlite3');

  if (!fs.existsSync(projectBetterSqlite3Dir)) {
    console.log('  better-sqlite3 not found in project, skipping rebuild');
    return;
  }

  console.log(`  Rebuilding better-sqlite3 for bundled Node.js...`);

  // Remove existing build in project
  const projectBuildDir = path.join(projectBetterSqlite3Dir, 'build');
  if (fs.existsSync(projectBuildDir)) {
    fs.rmSync(projectBuildDir, { recursive: true });
  }

  // Use node-gyp directly with bundled Node.js - this ensures correct ABI
  const nodeGypPath = path.join(nodeDir, 'lib', 'node_modules', 'npm', 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');

  if (!fs.existsSync(nodeGypPath)) {
    throw new Error('node-gyp not found in bundled Node.js');
  }

  // Run node-gyp rebuild using bundled Node.js
  execSync(`"${nodeBinaryPath}" "${nodeGypPath}" rebuild`, {
    cwd: projectBetterSqlite3Dir,
    stdio: 'inherit',
  });

  console.log('  better-sqlite3 rebuilt successfully');

  // Verify the rebuilt module
  const testScript = `
    try {
      const Database = require('${projectBetterSqlite3Dir}');
      console.log('SUCCESS: Module loads correctly');
    } catch (e) {
      console.error('FAILED:', e.message);
      process.exit(1);
    }
  `;
  execSync(`"${nodeBinaryPath}" -e "${testScript.replace(/\n/g, ' ')}"`, {
    encoding: 'utf-8',
  });
  console.log('  Verified: better-sqlite3 loads with bundled Node.js');

  // Copy the rebuilt .node binary to sidecar
  const rebuiltBinary = path.join(projectBetterSqlite3Dir, 'build', 'Release', 'better_sqlite3.node');
  const sidecarBinary = path.join(sidecarBetterSqlite3Dir, 'build', 'Release', 'better_sqlite3.node');

  if (fs.existsSync(rebuiltBinary)) {
    // Ensure target directory exists
    const targetDir = path.dirname(sidecarBinary);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.copyFileSync(rebuiltBinary, sidecarBinary);
    console.log(`  Copied rebuilt binary to sidecar`);
  } else {
    throw new Error('Rebuilt better_sqlite3.node not found');
  }
}

function buildServerDirectory(serverDir, nodeDir) {
  console.log('Building server directory...');

  // Remove existing directory (except node-runtime which we just downloaded)
  if (fs.existsSync(serverDir)) {
    for (const entry of fs.readdirSync(serverDir)) {
      if (entry !== 'node-runtime') {
        const entryPath = path.join(serverDir, entry);
        fs.rmSync(entryPath, { recursive: true });
      }
    }
  } else {
    fs.mkdirSync(serverDir, { recursive: true });
  }

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
  console.log(`  Bundled Node.js at: ${nodeDir}`);
}

function createStartScript(serverDir) {
  console.log('  Creating start.js entry point...');
  const startJs = `#!/usr/bin/env node

/**
 * Production entry point for Tauri sidecar
 * Runs Next.js standalone server and outputs ready signal
 * Logs to ~/.easypaper/logs/server.log
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const READY_SIGNAL = process.argv.includes('--ready-signal');

// Setup logging
const LOG_DIR = path.join(os.homedir(), '.easypaper', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');
let logStream = null;

function setupLogging() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    // Rotate old logs (keep last 3)
    rotateLogs();
    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  } catch (e) {
    // Fallback if logging setup fails
    console.error('Failed to setup logging:', e.message);
  }
}

function rotateLogs() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      // Rotate if file is larger than 5MB
      if (stats.size > 5 * 1024 * 1024) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = path.join(LOG_DIR, \`server-\${timestamp}.log\`);
        fs.renameSync(LOG_FILE, rotatedFile);
        // Clean up old rotated logs (keep last 3)
        const rotatedLogs = fs.readdirSync(LOG_DIR)
          .filter(f => f.startsWith('server-') && f.endsWith('.log'))
          .sort()
          .reverse();
        rotatedLogs.slice(3).forEach(f => {
          try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch (e) {}
        });
      }
    }
  } catch (e) {}
}

function log(message) {
  const timestamp = new Date().toISOString();
  const line = \`[\${timestamp}] \${message}\\n\`;
  // Write to log file
  if (logStream) {
    logStream.write(line);
  }
  // Also write to stderr for Tauri to capture
  process.stderr.write(line);
}

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
  setupLogging();
  log('Starting EasyPaper server...');

  // Find available port if in ready-signal mode
  let port = PORT;
  if (READY_SIGNAL) {
    port = await findAvailablePort(PORT);
    if (!port) {
      log('ERROR: Port 3000-3100 all occupied');
      console.log('EASYPAPER_ERROR:Port 3000-3100 all occupied');
      if (logStream) logStream.end();
      process.exit(1);
    }
  }
  log(\`Using port: \${port}\`);

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
  });

  // Store child PID for cleanup
  const childPid = child.pid;
  log(\`Server process started with PID: \${childPid}\`);

  if (READY_SIGNAL) {
    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        log('ERROR: Server startup timeout after 10s');
        console.log('EASYPAPER_ERROR:Server startup timeout');
        child.kill('SIGTERM');
        if (logStream) logStream.end();
        process.exit(1);
      }
    }, 10000);

    // HTTP health check to verify server is actually responding
    const http = require('http');
    const checkHealth = () => {
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/api/health',
        method: 'HEAD',
        timeout: 500,
      }, (res) => {
        if (res.headers['x-app'] === 'EasyPaper' && !serverReady) {
          serverReady = true;
          clearTimeout(timeout);
          log(\`Server verified via health check on port \${port}\`);
          console.log('EASYPAPER_READY:' + port);
        }
      });
      req.on('error', () => {}); // Ignore errors, will retry
      req.end();
    };

    child.stdout.on('data', (data) => {
      const output = data.toString();
      // Log all stdout
      log(\`[stdout] \${output.trim()}\`);
      // Next.js outputs "Ready" or "Local:" when server starts
      // Start health check polling after detecting startup indicator
      if (!serverReady && (output.includes('Ready') || output.includes('Local:'))) {
        log('Detected server startup, verifying with health check...');
        // Poll health endpoint until it responds or timeout
        const healthInterval = setInterval(() => {
          if (serverReady) {
            clearInterval(healthInterval);
            return;
          }
          checkHealth();
        }, 200);
        // Stop polling after 5 seconds (timeout will catch overall failure)
        setTimeout(() => clearInterval(healthInterval), 5000);
      }
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      log(\`[stderr] \${output.trim()}\`);
    });
  } else {
    child.stdout.on('data', (data) => {
      const output = data.toString();
      log(\`[stdout] \${output.trim()}\`);
    });
    child.stderr.on('data', (data) => {
      const output = data.toString();
      log(\`[stderr] \${output.trim()}\`);
    });
  }

  child.on('error', (err) => {
    log(\`ERROR: \${err.message}\`);
    if (READY_SIGNAL) {
      console.log('EASYPAPER_ERROR:' + err.message);
    } else {
      console.error('Error: ' + err.message);
    }
    if (logStream) logStream.end();
    process.exit(1);
  });

  child.on('exit', (code) => {
    log(\`Server process exited with code: \${code}\`);
    if (logStream) logStream.end();
    process.exit(code ?? 0);
  });

  // Handle shutdown signals - forward to child
  // When start.js receives SIGTERM from Tauri, we forward it to server.js
  // Both processes are in same process group (no detached), so signal propagation works
  const shutdown = (signal) => {
    log(\`Received \${signal}, shutting down...\`);
    child.kill(signal);
    if (logStream) logStream.end();
    process.exit(0);
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      shutdown(signal);
    });
  }

  // Handle parent death (if parent exits, we should too)
  process.on('exit', () => {
    try {
      child.kill('SIGTERM');
    } catch (e) {}
  });
}

main().catch((err) => {
  log(\`ERROR: \${err.message}\`);
  if (READY_SIGNAL) {
    console.log('EASYPAPER_ERROR:' + err.message);
  } else {
    console.error('Error: ' + err.message);
  }
  if (logStream) logStream.end();
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
  //   Resources/server/           <- server directory (including bundled node-runtime)

  if (platform === 'windows-x64') {
    // Windows: Tauri externalBin expects a .exe file
    // We create a PowerShell wrapper script
    const psPath = path.join(SIDECAR_DIST, `easypaper-server-${targetTriple}.ps1`);
    const psContent = `
$ErrorActionPreference = "Stop"
$resourcesDir = Join-Path $PSScriptRoot "..\\resources"
$serverPath = Join-Path $resourcesDir "server\\start.js"

# Use bundled Node.js from server/node-runtime
$nodePath = Join-Path $resourcesDir "server\\node-runtime\\node.exe"

if (-not (Test-Path $nodePath)) {
  Write-Error "Bundled Node.js not found at $nodePath"
  exit 1
}

& $nodePath $serverPath --ready-signal @args
`;
    fs.writeFileSync(psPath, psContent);
    console.log(`  -> ${psPath}`);

    // Create a simple .bat that calls PowerShell (Tauri will need .exe, documented)
    const batPath = path.join(SIDECAR_DIST, `easypaper-server-${targetTriple}.bat`);
    const batContent = `@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0easypaper-server-${targetTriple}.ps1" %*
`;
    fs.writeFileSync(batPath, batContent);
    console.log(`  -> ${batPath}`);

    console.log('  NOTE: Windows requires building a .exe wrapper for Tauri sidecar.');
    console.log('        The .bat/.ps1 files are provided for manual testing.');
    console.log('        For production, use a tool like "bat2exe" or build a native launcher.');
  } else {
    // Unix: create shell script with bundled Node.js
    // Bundled Node.js is at Resources/server/node-runtime/bin/node (macOS)
    // For macOS: Resources are at ../Resources relative to MacOS
    // For Linux: Resources are at ../resources relative to the binary
    const wrapperPath = path.join(SIDECAR_DIST, `easypaper-server-${targetTriple}`);
    const shContent = `#!/bin/bash
# Get the Resources directory (macOS) or resources directory (Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  RESOURCES_DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
else
  RESOURCES_DIR="$(cd "$(dirname "$0")/../resources" && pwd)"
fi

# Use bundled Node.js - this ensures native modules (better-sqlite3) work correctly
# because they are compiled for this exact Node.js version
NODE_PATH="$RESOURCES_DIR/server/node-runtime/bin/node"

if [[ ! -x "$NODE_PATH" ]]; then
  echo "ERROR: Bundled Node.js not found at $NODE_PATH"
  exit 1
fi

# Run start.js with bundled Node.js
exec "$NODE_PATH" "$RESOURCES_DIR/server/start.js" --ready-signal "$@"
`;
    fs.writeFileSync(wrapperPath, shContent);
    fs.chmodSync(wrapperPath, 0o755);
    console.log(`  -> ${wrapperPath}`);
    console.log('  Using bundled Node.js for native module ABI compatibility');
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
    fs.mkdirSync(mupdfDest, { recursive: true });

    // Only copy essential files: .node binaries, package.json, and index.js
    const essentialFiles = ['package.json', 'index.js'];
    for (const file of essentialFiles) {
      const srcPath = path.join(mupdfSrc, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(mupdfDest, file));
      }
    }

    // Copy native addon files (*.node)
    for (const entry of fs.readdirSync(mupdfSrc, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.node')) {
        const srcPath = path.join(mupdfSrc, entry.name);
        fs.copyFileSync(srcPath, path.join(mupdfDest, entry.name));
        console.log(`    Copied: ${entry.name}`);
      }
    }
  } else {
    console.warn('  Warning: mupdf not found in node_modules');
  }
}

main();