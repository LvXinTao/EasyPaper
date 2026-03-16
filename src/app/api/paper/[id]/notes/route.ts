import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import type { Note } from '@/types';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const notes = await storage.getNotes(id);
  return NextResponse.json(notes);
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const body = await request.json();
  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    title: body.title || '',
    content: body.content || '',
    tags: body.tags || [],
    ...(body.page != null && { page: body.page }),
    createdAt: now,
    updatedAt: now,
  };
  const notes = await storage.getNotes(id);
  notes.push(note);
  await storage.saveNotes(id, notes);
  return NextResponse.json(note);
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const body = await request.json();
  const notes = await storage.getNotes(id);
  const index = notes.findIndex((n) => n.id === body.id);
  if (index === -1) return createErrorResponse('NOTE_NOT_FOUND', 'Note not found');
  const existing = notes[index];
  const updated: Note = {
    ...existing,
    title: body.title ?? existing.title,
    content: body.content ?? existing.content,
    tags: body.tags ?? existing.tags,
    ...(body.page !== undefined ? { page: body.page ?? undefined } : {}),
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  notes[index] = updated;
  await storage.saveNotes(id, notes);
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const url = new URL(request.url);
  const noteId = url.searchParams.get('noteId');
  const notes = await storage.getNotes(id);
  const index = notes.findIndex((n) => n.id === noteId);
  if (index === -1) return createErrorResponse('NOTE_NOT_FOUND', 'Note not found');
  const updated = notes.filter((n) => n.id !== noteId);
  await storage.saveNotes(id, updated);
  return NextResponse.json({ success: true });
}
