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

  console.log(`  -> ${serverDir}`);
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
    // Unix: create shell script
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
exec node "$RESOURCES_DIR/server/server.js" --ready-signal "$@"
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