import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import type { HighlightColor } from '@/types';

const VALID_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];
const MAX_COMMENT_LENGTH = 2000;

interface RouteContext {
  params: Promise<{ id: string; annotationId: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const { id, annotationId } = await context.params;

  const metadata = await storage.getMetadata(id);
  if (!metadata) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const annotations = await storage.getAnnotations(id);
  const index = annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
  }

  const body = await request.json();

  if (body.color !== undefined && !VALID_COLORS.includes(body.color)) {
    return NextResponse.json({ error: `color must be one of: ${VALID_COLORS.join(', ')}` }, { status: 400 });
  }
  if (body.comment !== undefined && typeof body.comment === 'string' && body.comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: `comment must be at most ${MAX_COMMENT_LENGTH} characters` }, { status: 400 });
  }

  if (body.color !== undefined) annotations[index].color = body.color;
  if (body.comment !== undefined) annotations[index].comment = body.comment;
  annotations[index].updatedAt = new Date().toISOString();

  await storage.saveAnnotations(id, annotations);

  return NextResponse.json({ annotation: annotations[index] });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, annotationId } = await context.params;

  const metadata = await storage.getMetadata(id);
  if (!metadata) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const annotations = await storage.getAnnotations(id);
  const index = annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
  }

  annotations.splice(index, 1);
  await storage.saveAnnotations(id, annotations);

  return NextResponse.json({ success: true });
}
