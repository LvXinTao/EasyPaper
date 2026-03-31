import { analysisQueue } from '@/lib/analysis-queue';
import { createErrorResponse } from '@/lib/errors';

export async function GET() {
  await analysisQueue.init();
  const status = await analysisQueue.getStatus();
  const queuedPapers = await analysisQueue.getQueuedPapers();

  return new Response(JSON.stringify({
    ...status,
    queuedPapers: queuedPapers.map((p, i) => ({
      id: p.id,
      position: i + 1,
      queuedAt: p.queuedAt,
    })),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get('paperId');

  if (!paperId) {
    return createErrorResponse('PAPER_ID_REQUIRED', 'paperId is required');
  }

  const cancelled = await analysisQueue.cancelQueued(paperId);
  if (!cancelled) {
    return createErrorResponse('NOT_QUEUED', 'Paper is not in queue');
  }

  return new Response(JSON.stringify({ status: 'cancelled' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}