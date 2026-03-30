import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import type { Note, NoteTag, TextSelection, HighlightRect } from '@/types';

const VALID_TAGS = new Set<NoteTag>(['important', 'question', 'todo', 'idea', 'summary']);

function validateTags(tags: unknown): NoteTag[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is NoteTag => typeof t === 'string' && VALID_TAGS.has(t as NoteTag));
}

function validatePage(page: unknown): number | undefined {
  if (typeof page === 'number' && page > 0) return Math.floor(page);
  return undefined;
}

function validateHighlightRect(rect: unknown): HighlightRect | null {
  if (typeof rect !== 'object' || rect === null) return null;
  const r = rect as Record<string, unknown>;

  // Validate and clamp each coordinate to 0-100 range
  const left = typeof r.left === 'number' ? Math.max(0, Math.min(100, r.left)) : null;
  const top = typeof r.top === 'number' ? Math.max(0, Math.min(100, r.top)) : null;
  const width = typeof r.width === 'number' ? Math.max(0, Math.min(100, r.width)) : null;
  const height = typeof r.height === 'number' ? Math.max(0, Math.min(100, r.height)) : null;

  if (left === null || top === null || width === null || height === null) return null;

  // Reject zero-area rectangles (degenerate)
  if (width === 0 || height === 0) return null;

  return { left, top, width, height };
}

// Sanitize user input to prevent XSS
function sanitizeString(input: string, maxLength: number): string {
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);
  // Remove any script tags or dangerous HTML
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  return sanitized;
}

function validateSelection(selection: unknown): TextSelection | undefined {
  if (typeof selection !== 'object' || selection === null) return undefined;
  const s = selection as Record<string, unknown>;

  // Validate text: required, 1-1000 characters, trimmed
  if (typeof s.text !== 'string' || s.text.length === 0 || s.text.length > 1000) return undefined;
  const text = s.text.trim();
  if (text.length === 0 || text.length > 1000) return undefined;

  // Validate rects: required, non-empty array
  if (!Array.isArray(s.rects) || s.rects.length === 0) return undefined;
  const rects: HighlightRect[] = [];
  for (const rect of s.rects) {
    const validated = validateHighlightRect(rect);
    if (validated === null) return undefined;
    rects.push(validated);
  }

  // Validate page: required, >= 1
  if (typeof s.page !== 'number' || s.page < 1 || !Number.isInteger(s.page)) return undefined;
  const page = Math.floor(s.page);

  return { text, rects, page };
}

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

  // Validate selection if provided
  const selection = validateSelection(body.selection);

  // Sanitize user inputs
  const title = sanitizeString(body.title || '', 200);
  const content = sanitizeString(body.content || '', 10000);

  const note: Note = {
    id: crypto.randomUUID(),
    title,
    content,
    tags: validateTags(body.tags),
    // Use selection.page if selection exists, otherwise use provided page
    page: selection?.page ?? validatePage(body.page),
    ...(selection ? { selection } : {}),
    createdAt: now,
    updatedAt: now,
  };
  const notes = await storage.getNotes(id);
  notes.push(note);
  await storage.saveNotes(id, notes);
  return NextResponse.json(note, { status: 201 });
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

  // Validate selection if provided
  const validatedSelection = body.selection !== undefined ? validateSelection(body.selection) : existing.selection;

  // Sanitize user inputs if provided
  const title = body.title !== undefined ? sanitizeString(body.title, 200) : existing.title;
  const content = body.content !== undefined ? sanitizeString(body.content, 10000) : existing.content;

  const updated: Note = {
    ...existing,
    title,
    content,
    tags: body.tags !== undefined ? validateTags(body.tags) : existing.tags,
    // Use selection.page if selection exists, otherwise use provided page or existing
    page: validatedSelection?.page ?? (body.page !== undefined ? validatePage(body.page) : existing.page),
    selection: validatedSelection,
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
