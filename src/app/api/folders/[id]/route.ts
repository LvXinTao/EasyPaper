import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

interface RouteContext { params: Promise<{ id: string }>; }

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const folders = await storage.getFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx === -1) return createErrorResponse('FOLDER_NOT_FOUND', 'Folder not found');

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return createErrorResponse('VALIDATION_ERROR', 'Folder name cannot be empty');
  if (name.length > 100) return createErrorResponse('VALIDATION_ERROR', 'Folder name must be 100 characters or less');

  folders[idx] = { ...folders[idx], name };
  await storage.saveFolders(folders);
  return NextResponse.json({ folder: folders[idx] });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const folders = await storage.getFolders();
  const target = folders.find((f) => f.id === id);
  if (!target) return createErrorResponse('FOLDER_NOT_FOUND', 'Folder not found');

  // Collect all descendant folder IDs
  const toDelete = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        changed = true;
      }
    }
  }

  // Move papers from deleted folders to the target's parent
  const moveToFolderId = target.parentId ?? null;
  const papers = await storage.listPapers();
  for (const paper of papers) {
    if (paper.folderId && toDelete.has(paper.folderId)) {
      await storage.updateMetadata(paper.id, { folderId: moveToFolderId });
    }
  }

  // Remove deleted folders
  const remaining = folders.filter((f) => !toDelete.has(f.id));
  await storage.saveFolders(remaining);
  return NextResponse.json({ success: true });
}
