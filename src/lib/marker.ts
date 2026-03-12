import { spawn } from 'child_process';
import path from 'path';

export async function parsePdfWithMarker(pdfPath: string, outputDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'parse-pdf.py');
    const proc = spawn('python3', [scriptPath, pdfPath, outputDir]);
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
