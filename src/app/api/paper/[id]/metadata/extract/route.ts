import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import { extractPdfMetadata } from '@/lib/pdf-metadata';
import type { PdfMetadataResult } from '@/lib/pdf-metadata';

interface RouteContext { params: Promise<{ id: string }>; }

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const pdfPath = storage.getPdfPath(id);
  const newMetadata = await extractPdfMetadata(pdfPath);

  const current = await storage.getMetadata(id);
  const existingPdfMeta = current.pdfMetadata as PdfMetadataResult | undefined;

  // Preserve manually edited fields
  if (existingPdfMeta && existingPdfMeta.fieldSources) {
    for (const field of Object.keys(existingPdfMeta.fieldSources)) {
      if (existingPdfMeta.fieldSources[field] === 'manual') {
        (newMetadata as Record<string, unknown>)[field] = (existingPdfMeta as Record<string, unknown>)[field];
        newMetadata.fieldSources[field] = 'manual';
      }
    }
  }

  // Update page count with accurate mupdf count
  await storage.updateMetadata(id, {
    pages: newMetadata.pageCount,
    pdfMetadata: newMetadata,
  });

  return NextResponse.json({ pdfMetadata: newMetadata });
}
