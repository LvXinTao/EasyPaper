import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
export async function GET() {
  const papers = await storage.listPapers();
  return NextResponse.json({ papers });
}
