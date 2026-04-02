import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { storage } from '@/lib/storage';
import { resolveZoteroPdfPath } from '@/lib/zotero';
import { createErrorResponse } from '@/lib/errors';
import type { ZoteroImportRequest, ZoteroImportResult } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body: ZoteroImportRequest = await request.json();
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return createErrorResponse('VALIDATION_ERROR', 'No items provided');
    }

    const settings = await storage.getSettings();
    const zoteroDataDir = settings?.zoteroDataDir as string | undefined;

    const results: ZoteroImportResult[] = [];

    for (const item of body.items) {
      try {
        const pdfPath = resolveZoteroPdfPath(zoteroDataDir ?? '', item.attachmentKey, item.pdfFilename);
        await fs.access(pdfPath);
        const buffer = await fs.readFile(pdfPath);

        // Extract page count (same logic as upload route)
        let pageCount = 0;
        try {
          const content = buffer.toString('binary');
          const matches = content.match(/\/Type\s*\/Page(?!s)/g);
          pageCount = matches ? matches.length : 0;
        } catch { /* default to 0 */ }

        const paperId = uuidv4();
        await storage.createPaperDir(paperId);
        await storage.savePdf(paperId, buffer);
        await storage.saveMetadata(paperId, {
          id: paperId,
          title: item.title,
          filename: item.pdfFilename,
          pages: pageCount,
          createdAt: new Date().toISOString(),
          status: 'pending',
          ...(body.folderId && { folderId: body.folderId }),
        });

        results.push({ key: item.key, paperId, status: 'success' });
      } catch (error) {
        results.push({
          key: item.key,
          status: 'error',
          error: error instanceof Error ? error.message : 'Import failed',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return createErrorResponse('ZOTERO_IMPORT_FAILED',
      `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
