import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import type { PdfMetadata } from '@/types';

interface RouteContext { params: Promise<{ id: string }>; }

const EDITABLE_FIELDS: (keyof Omit<PdfMetadata, 'fieldSources' | 'extractedAt'>)[] = [
  'title', 'authors', 'date', 'subject', 'keywords', 'creator', 'producer',
];

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const body = await request.json();
  const current = await storage.getMetadata(id);
  const existingPdfMeta = (current as any).pdfMetadata || {
    fieldSources: {},
    extractedAt: new Date().toISOString(),
  };

  const updated = { ...existingPdfMeta };
  const fieldSources = { ...updated.fieldSources };

  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      if (field === 'title' && (typeof body.title !== 'string' || !body.title.trim())) {
        return createErrorResponse('VALIDATION_ERROR', 'Title cannot be empty');
      }
      (updated as any)[field] = body[field];
      fieldSources[field] = 'manual';
    }
  }

  updated.fieldSources = fieldSources;
  updated.extractedAt = new Date().toISOString();

  const newMetadata = await storage.updateMetadata(id, {
    pdfMetadata: updated,
  } as any);

  return NextResponse.json({ pdfMetadata: (newMetadata as any).pdfMetadata });
}
