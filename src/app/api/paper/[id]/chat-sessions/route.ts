import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const sessions = await storage.listChatSessions(id);
  return NextResponse.json({ sessions });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const session = await storage.createChatSession(id);

  try {
    const body = await request.json();
    if (body.title) {
      session.title = body.title;
      await storage.saveChatSession(id, session);
    }
  } catch { /* empty body is fine */ }

  return NextResponse.json(session, { status: 201 });
}
