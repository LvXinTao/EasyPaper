import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import fs from 'fs/promises';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const exists = await storage.paperExists(id);
  if (!exists) {
    return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  }

  const pdfPath = storage.getPdfPath(id);

  try {
    const fileBuffer = await fs.readFile(pdfPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return createErrorResponse('PAPER_NOT_FOUND', 'PDF file not found');
  }
}
