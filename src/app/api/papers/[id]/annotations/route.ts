import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '@/lib/storage';
import type { Annotation, HighlightColor } from '@/types';

const VALID_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];
const MAX_COMMENT_LENGTH = 2000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const metadata = await storage.getMetadata(id);
  if (!metadata) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const annotations = await storage.getAnnotations(id);
  return NextResponse.json({ annotations });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const metadata = await storage.getMetadata(id);
  if (!metadata) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const body = await request.json();

  if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (!body.page || typeof body.page !== 'number' || body.page < 1) {
    return NextResponse.json({ error: 'page must be a positive integer' }, { status: 400 });
  }
  if (!body.color || !VALID_COLORS.includes(body.color)) {
    return NextResponse.json({ error: `color must be one of: ${VALID_COLORS.join(', ')}` }, { status: 400 });
  }
  if (!body.spanRange || typeof body.spanRange.startIdx !== 'number' || typeof body.spanRange.endIdx !== 'number') {
    return NextResponse.json({ error: 'spanRange with startIdx and endIdx is required' }, { status: 400 });
  }
  if (body.comment && typeof body.comment === 'string' && body.comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: `comment must be at most ${MAX_COMMENT_LENGTH} characters` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const annotation: Annotation = {
    id: uuidv4(),
    page: body.page,
    text: body.text,
    color: body.color,
    comment: body.comment || '',
    spanRange: body.spanRange,
    createdAt: now,
    updatedAt: now,
  };

  const annotations = await storage.getAnnotations(id);
  annotations.push(annotation);
  await storage.saveAnnotations(id, annotations);

  return NextResponse.json({ annotation }, { status: 201 });
}
