import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { getZoteroDbPath, getItems, getPdfFileSize } from '@/lib/zotero';
import { createErrorResponse } from '@/lib/errors';
import type { ZoteroItem } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionIdParam = searchParams.get('collectionId');
    const collectionId = collectionIdParam ? parseInt(collectionIdParam, 10) : undefined;

    const settings = await storage.getSettings();
    // Explicitly handle undefined/null/empty string to ensure default value
    const rawZoteroDir = settings?.zoteroDataDir;
    const zoteroDataDir = rawZoteroDir && rawZoteroDir.trim() !== '' ? rawZoteroDir : '~/Zotero';
    const dbPath = getZoteroDbPath({ zoteroDataDir });
    const rawItems = getItems(dbPath, collectionId);

    const items: ZoteroItem[] = await Promise.all(
      rawItems.map(async (item) => {
        const existingId = await storage.findPaperByFilename(item.pdfFilename);
        const pdfSize = getPdfFileSize(zoteroDataDir, item.attachmentKey, item.pdfFilename);
        return {
          ...item,
          pdfSize,
          alreadyImported: existingId !== null,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('not found')) {
      return createErrorResponse('ZOTERO_NOT_FOUND', msg);
    }
    return createErrorResponse('ZOTERO_IMPORT_FAILED', `Failed to read Zotero items: ${msg}`);
  }
}
