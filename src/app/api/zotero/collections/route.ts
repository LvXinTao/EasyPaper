import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { getZoteroDbPath, getCollections } from '@/lib/zotero';
import { createErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const settings = await storage.getSettings();
    const dbPath = getZoteroDbPath({ zoteroDataDir: settings?.zoteroDataDir });
    const result = getCollections(dbPath);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('not found')) {
      return createErrorResponse('ZOTERO_NOT_FOUND', msg);
    }
    return createErrorResponse('ZOTERO_IMPORT_FAILED', `Failed to read Zotero collections: ${msg}`);
  }
}
