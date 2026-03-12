import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const [metadata, analysis, parsedContent, chatHistory] = await Promise.all([
    storage.getMetadata(id), storage.getAnalysis(id), storage.getParsedContent(id), storage.getChatHistory(id),
  ]);
  return NextResponse.json({ metadata, analysis, parsedContent, chatHistory });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  await storage.deletePaper(id);
  return NextResponse.json({ success: true });
}
