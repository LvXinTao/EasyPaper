import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

export async function PATCH(request: Request) {
  const body = await request.json();
  const { orders } = body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return createErrorResponse('VALIDATION_ERROR', 'orders must be a non-empty array');
  }

  for (const item of orders) {
    if (typeof item.id !== 'string' || typeof item.sortIndex !== 'number') {
      return createErrorResponse('VALIDATION_ERROR', 'Each order item must have id (string) and sortIndex (number)');
    }
  }

  await Promise.all(
    orders.map((item: { id: string; sortIndex: number }) =>
      storage.updateMetadata(item.id, { sortIndex: item.sortIndex })
    )
  );

  return NextResponse.json({ success: true });
}
