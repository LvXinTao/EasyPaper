import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import { getAIConfig } from '@/lib/ai-config';
import { analysisQueue } from '@/lib/analysis-queue';
import { runAnalysisCore } from '@/lib/analysis-runner';

type SendFn = (data: Record<string, unknown>) => void;

export async function POST(request: Request) {
  try {
    const { paperId, force } = await request.json();
    if (!paperId) return createErrorResponse('PAPER_NOT_FOUND', 'paperId is required');
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    const config = await getAIConfig();
    if (!config.apiKey) return createErrorResponse('API_KEY_MISSING', 'API key is not configured');

    // Initialize queue (once)
    await analysisQueue.init();

    // Check current status for idempotency
    const metadata = await storage.getMetadata(paperId);
    if (metadata?.status === 'queued') {
      // Handle force re-analyze for queued papers
      if (force) {
        await analysisQueue.cancelQueued(paperId);
        // Continue to tryAcquire below
      } else {
        const queuedPapers = await analysisQueue.getQueuedPapers();
        const position = queuedPapers.findIndex(p => p.id === paperId) + 1;
        return new Response(JSON.stringify({ status: 'already_queued', queuePosition: position }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (metadata && (metadata.status === 'parsing' || metadata.status === 'analyzing') && metadata.analysisProgress) {
      const updatedAt = new Date(metadata.analysisProgress.updatedAt).getTime();
      const ageMs = Date.now() - updatedAt;
      const tenMinMs = 10 * 60 * 1000;

      if (ageMs < tenMinMs && !force) {
        return new Response(JSON.stringify({ status: 'already_running' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Stale or force: reset to pending
      const resetMeta = await storage.getMetadata(paperId);
      if (resetMeta) {
        delete resetMeta.analysisProgress;
        resetMeta.status = 'pending';
        await storage.saveMetadata(paperId, resetMeta);
      }
    }

    // Try to acquire slot
    if (!(await analysisQueue.tryAcquire(paperId))) {
      const queueStatus = await analysisQueue.getStatus();
      const queuePosition = queueStatus.queued + 1;
      await storage.updateMetadata(paperId, {
        status: 'queued',
        analysisProgress: {
          step: 'queued',
          message: `Waiting in queue (position: ${queuePosition})...`,
          updatedAt: new Date().toISOString(),
          queuePosition,
        },
      });
      return new Response(JSON.stringify({ status: 'queued', queuePosition }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send: SendFn = (data) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };
        await runAnalysisCore(paperId, config, send, () => analysisQueue.release(paperId));
        try { controller.close(); } catch {}
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (error) {
    return createErrorResponse('ANALYSIS_FAILED', `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}