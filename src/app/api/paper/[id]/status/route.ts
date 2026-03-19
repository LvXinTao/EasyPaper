import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params;
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

    const metadata = await storage.getMetadata(paperId);
    return Response.json({
      status: metadata.status,
      analysisProgress: metadata.analysisProgress ?? null,
    });
  } catch (error) {
    return createErrorResponse(
      'ANALYSIS_FAILED',
      `Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
