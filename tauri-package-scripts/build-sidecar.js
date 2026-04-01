#!/usr/bin/env node

/**
 * Build sidecar for Tauri desktop app
 *
 * This script:
 * 1. Runs next build (standalone output)
 * 2. Creates sidecar directory with shell wrapper script
 * 3. Copies necessary files (server.js, node_modules, native modules)
 * 4. Generates version.json
 *
 * IMPORTANT: Tauri externalBin requires an EXECUTABLE file, not a directory.
 * We create a shell script wrapper that executes Node.js to run server.js.
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

  // Step 3: Build for current platform
  const currentPlatform = detectCurrentPlatform();
  buildForPlatform(currentPlatform);

  // Step 4: Generate version.json
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

function buildForPlatform(platform) {
  const targetTriple = PLATFORMS[platform];
  const outputDir = path.join(SIDECAR_DIST, `easypaper-server-${targetTriple}`);

  console.log(`Building for ${platform} (${targetTriple})...`);

  // Remove existing output
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  // Copy standalone Next.js files
  console.log('  Copying Next.js standalone...');
  copyDirectory(NEXT_STANDALONE, outputDir);

  // Copy native modules (mupdf)
  copyNativeModules(outputDir);

  // Copy static files (from .next/static to standalone/.next/static)
  const staticSrc = path.join(PROJECT_ROOT, '.next', 'static');
  const staticDest = path.join(outputDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    console.log('  Copying static files...');
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    copyDirectory(staticSrc, staticDest);
  }

  // Copy public folder
  const publicSrc = path.join(PROJECT_ROOT, 'public');
  const publicDest = path.join(outputDir, 'public');
  if (fs.existsSync(publicSrc)) {
    console.log('  Copying public files...');
    copyDirectory(publicSrc, publicDest);
  }

  // Create executable shell wrapper (THIS IS THE KEY)
  // Tauri expects the sidecar binary to be executable
  // We create a shell script that runs: node server.js --ready-signal "$@"
  createShellWrapper(outputDir, platform);

  console.log(`  -> ${outputDir}`);
}

function createShellWrapper(outputDir, platform) {
  console.log('  Creating executable shell wrapper...');

  if (platform === 'windows-x64') {
    // Windows: create a .bat file
    const batContent = `@echo off
node "%~dp0server.js" --ready-signal %*
`;
    fs.writeFileSync(path.join(outputDir, 'easypaper-server-x86_64-pc-windows-msvc.bat'), batContent);
  } else {
    // Unix: create shell script
    const shContent = `#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/server.js" --ready-signal "$@"
`;
    const wrapperPath = path.join(outputDir, `easypaper-server-${PLATFORMS[platform]}`);
    fs.writeFileSync(wrapperPath, shContent);
    fs.chmodSync(wrapperPath, 0o755);
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