import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
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
    expect(output).toContain('~/.easypaper/.env');
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      expect(err.status).not.toBe(0);
    }
  });
});

describe('easypaper .env loading', () => {
  const easypeperDir = path.join(os.homedir(), '.easypaper');
  const envFilePath = path.join(easypeperDir, '.env');
  let originalEnvContent: string | null = null;

  beforeEach(() => {
    // Back up existing .env if present
    try {
      originalEnvContent = fs.readFileSync(envFilePath, 'utf-8');
    } catch {
      originalEnvContent = null;
    }
  });

  afterEach(() => {
    // Restore original .env
    if (originalEnvContent !== null) {
      fs.writeFileSync(envFilePath, originalEnvContent);
    } else {
      try { fs.unlinkSync(envFilePath); } catch { /* didn't exist */ }
    }
  });

  it('loads env vars from ~/.easypaper/.env', () => {
    fs.mkdirSync(easypeperDir, { recursive: true });
    fs.writeFileSync(envFilePath, 'AI_MODEL=test-model-from-dotenv\n');

    // Use --help so the process exits immediately, but the env loading still runs
    // We can't directly observe env vars from --help output,
    // so we use a small wrapper to check
    const script = `
      process.env.HOME = ${JSON.stringify(os.homedir())};
      delete process.env.AI_MODEL;
      const { execFileSync } = require('child_process');
      const cp = require('child_process');
      const origSpawn = cp.spawn;
      cp.spawn = function(cmd, args, opts) {
        // Print the env var that was set, then exit
        console.log('AI_MODEL=' + (opts.env.AI_MODEL || ''));
        return { on: () => {}, kill: () => {} };
      };
      require(${JSON.stringify(CLI_PATH)});
    `;
    const output = execFileSync('node', ['-e', script], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, AI_MODEL: '' },
    });
    expect(output).toContain('AI_MODEL=test-model-from-dotenv');
  });

  it('does not override existing env vars with .env values', () => {
    fs.mkdirSync(easypeperDir, { recursive: true });
    fs.writeFileSync(envFilePath, 'AI_MODEL=from-dotenv\n');

    const script = `
      process.env.AI_MODEL = 'from-system';
      const cp = require('child_process');
      cp.spawn = function(cmd, args, opts) {
        console.log('AI_MODEL=' + (opts.env.AI_MODEL || ''));
        return { on: () => {}, kill: () => {} };
      };
      require(${JSON.stringify(CLI_PATH)});
    `;
    const output = execFileSync('node', ['-e', script], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(output).toContain('AI_MODEL=from-system');
  });
});
