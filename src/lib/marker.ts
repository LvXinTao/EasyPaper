import { spawn, execSync } from 'child_process';
import path from 'path';

let cachedPython: string | null = null;

function findPythonWithMarker(): string {
  if (cachedPython) return cachedPython;

  // Candidates to try, in order of preference
  const candidates = ['python3', 'python'];

  // Also check common conda/venv locations
  const home = process.env.HOME || '';
  if (home) {
    candidates.push(
      path.join(home, 'miniconda3', 'bin', 'python3'),
      path.join(home, 'anaconda3', 'bin', 'python3'),
      path.join(home, '.conda', 'bin', 'python3'),
    );
  }

  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" -c "import marker"`, {
        stdio: 'ignore',
        timeout: 5000,
      });
      cachedPython = candidate;
      return candidate;
    } catch {
      // Try next candidate
    }
  }

  throw new Error(
    'marker-pdf not found in any Python installation. ' +
    'Install with: pip install marker-pdf (in the Python environment accessible to this app)'
  );
}

export async function parsePdfWithMarker(pdfPath: string, outputDir: string): Promise<string> {
  const pythonBin = findPythonWithMarker();

  return new Promise((resolve, reject) => {
    const scriptPath = process.env.EASYPAPER_PKG_DIR
      ? path.join(process.env.EASYPAPER_PKG_DIR, 'scripts', 'parse-pdf.py')
      : path.join(__dirname, '..', '..', 'scripts', 'parse-pdf.py');
    const proc = spawn(pythonBin, [scriptPath, pdfPath, outputDir], {
      shell: true,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const errorDetail = stderr || stdout || 'Unknown error';
        const hint = errorDetail.includes('marker-pdf not installed') || errorDetail.includes('No module named')
          ? '. Install with: pip install marker-pdf'
          : '';
        reject(new Error(`PDF parsing failed: ${errorDetail.trim()}${hint}`));
      }
    });
    proc.on('error', (err: Error) => {
      reject(new Error(
        err.message.includes('ENOENT')
          ? 'python3 not found. Please install Python 3 to use PDF parsing.'
          : `Failed to start PDF parser: ${err.message}`
      ));
    });
  });
}
