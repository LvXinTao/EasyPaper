import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PaperMetadata } from '@/types';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const [metadata, analysis, parsedContent, chatHistory] = await Promise.all([
    storage.getMetadata(id), storage.getAnalysis(id), storage.getParsedContent(id), storage.getChatHistory(id),
  ]);

  // Backfill page count for papers uploaded before page extraction was added
  if (metadata && (!metadata.pages || metadata.pages === 0)) {
    try {
      const pdfPath = storage.getPdfPath(id);
      const pdfBuffer = await readFile(pdfPath);
      const pdf = await getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
      metadata.pages = pdf.numPages;
      await storage.updateMetadata(id, { pages: pdf.numPages });
    } catch { /* PDF read failed, keep pages as 0 */ }
  }

  return NextResponse.json({ metadata, analysis, parsedContent, chatHistory });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  await storage.deletePaper(id);
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const body = await request.json();
  const updates: Partial<PaperMetadata> = {};

  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return createErrorResponse('VALIDATION_ERROR', 'Title cannot be empty');
    if (title.length > 200) return createErrorResponse('VALIDATION_ERROR', 'Title must be 200 characters or less');
    updates.title = title;
  }

  if (body.folderId !== undefined) {
    if (body.folderId !== null && typeof body.folderId !== 'string') {
      return createErrorResponse('VALIDATION_ERROR', 'folderId must be a string or null');
    }
    updates.folderId = body.folderId;
  }

  if (Object.keys(updates).length === 0) {
    return createErrorResponse('VALIDATION_ERROR', 'No valid fields to update');
  }

  const metadata = await storage.updateMetadata(id, updates);
  return NextResponse.json({ success: true, metadata });
}
