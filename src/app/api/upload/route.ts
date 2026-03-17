import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return createErrorResponse('INVALID_FILE_TYPE', 'No file provided');
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))
      return createErrorResponse('INVALID_FILE_TYPE', 'Only PDF files are supported');
    if (file.size > MAX_FILE_SIZE)
      return createErrorResponse('FILE_TOO_LARGE', 'File exceeds 50MB limit');

    const paperId = uuidv4();
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.createPaperDir(paperId);
    await storage.savePdf(paperId, buffer);

    // Extract page count by scanning PDF structure
    let pageCount = 0;
    try {
      const content = buffer.toString('binary');
      const matches = content.match(/\/Type\s*\/Page(?!s)/g);
      pageCount = matches ? matches.length : 0;
    } catch {
      // If page extraction fails, default to 0
    }

    await storage.saveMetadata(paperId, {
      id: paperId, title: file.name.replace(/\.pdf$/i, ''), filename: file.name,
      pages: pageCount, createdAt: new Date().toISOString(), status: 'pending',
    });
    return NextResponse.json({ id: paperId, status: 'pending' }, { status: 201 });
  } catch (error) {
    return createErrorResponse('PARSING_FAILED', `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
