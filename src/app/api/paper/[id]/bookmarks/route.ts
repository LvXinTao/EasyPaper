import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import type { Bookmark } from '@/types';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  const bookmarks = await storage.getBookmarks(id);
  // Sort by page number
  bookmarks.sort((a, b) => a.page - b.page);
  return NextResponse.json(bookmarks);
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const body = await request.json();

  // Validate page
  if (typeof body.page !== 'number' || body.page < 1) {
    return createErrorResponse('VALIDATION_ERROR', 'page must be a positive number');
  }

  const bookmarks = await storage.getBookmarks(id);

  // Check if bookmark already exists for this page (one per page)
  const existingIndex = bookmarks.findIndex(b => b.page === body.page);
  if (existingIndex !== -1) {
    // Return existing bookmark instead of creating duplicate
    return NextResponse.json(bookmarks[existingIndex]);
  }

  const now = new Date().toISOString();
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    page: body.page,
    ...(body.label ? { label: body.label } : {}),
    createdAt: now,
  };

  bookmarks.push(bookmark);
  bookmarks.sort((a, b) => a.page - b.page);
  await storage.saveBookmarks(id, bookmarks);
  return NextResponse.json(bookmark, { status: 201 });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const body = await request.json();
  if (!body.id) {
    return createErrorResponse('VALIDATION_ERROR', 'bookmark id is required');
  }

  const bookmarks = await storage.getBookmarks(id);
  const index = bookmarks.findIndex(b => b.id === body.id);
  if (index === -1) {
    return createErrorResponse('BOOKMARK_NOT_FOUND', 'Bookmark not found');
  }

  // Only update label
  if (body.label !== undefined) {
    if (body.label) {
      bookmarks[index].label = body.label;
    } else {
      delete bookmarks[index].label;
    }
  }

  await storage.saveBookmarks(id, bookmarks);
  return NextResponse.json(bookmarks[index]);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const url = new URL(request.url);
  const bookmarkId = url.searchParams.get('bookmarkId');
  if (!bookmarkId) {
    return createErrorResponse('VALIDATION_ERROR', 'bookmarkId query param is required');
  }

  const bookmarks = await storage.getBookmarks(id);
  const index = bookmarks.findIndex(b => b.id === bookmarkId);
  if (index === -1) {
    return createErrorResponse('BOOKMARK_NOT_FOUND', 'Bookmark not found');
  }

  const updated = bookmarks.filter(b => b.id !== bookmarkId);
  await storage.saveBookmarks(id, updated);
  return NextResponse.json({ success: true });
}