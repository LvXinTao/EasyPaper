import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

export async function GET() {
  const folders = await storage.getFolders();
  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return createErrorResponse('VALIDATION_ERROR', 'Folder name cannot be empty');
  if (name.length > 100) return createErrorResponse('VALIDATION_ERROR', 'Folder name must be 100 characters or less');

  const parentId = body.parentId ?? null;
  const folders = await storage.getFolders();
  if (parentId !== null) {
    if (!folders.some((f) => f.id === parentId)) {
      return createErrorResponse('FOLDER_NOT_FOUND', 'Parent folder not found');
    }
  }

  const folder = { id: `f_${uuidv4().slice(0, 8)}`, name, parentId };
  folders.push(folder);
  await storage.saveFolders(folders);
  return NextResponse.json({ folder }, { status: 201 });
}
