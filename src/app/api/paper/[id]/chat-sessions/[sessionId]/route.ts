import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

interface RouteContext { params: Promise<{ id: string; sessionId: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id, sessionId } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const session = await storage.getChatSession(id, sessionId);
  if (!session) return createErrorResponse('SESSION_NOT_FOUND', 'Session not found');

  return NextResponse.json(session);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, sessionId } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const session = await storage.getChatSession(id, sessionId);
  if (!session) return createErrorResponse('SESSION_NOT_FOUND', 'Session not found');

  await storage.deleteChatSession(id, sessionId);
  return NextResponse.json({ success: true });
}
