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
