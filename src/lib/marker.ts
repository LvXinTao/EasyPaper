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
      if (code === 0) { resolve(stdout); } else { reject(new Error(`Marker failed (exit ${code}): ${stderr}`)); }
    });
    proc.on('error', (err: Error) => { reject(new Error(`Failed to start Marker: ${err.message}`)); });
  });
}
