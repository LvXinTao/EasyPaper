import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import { generatePaperEmbeddings } from '@/lib/embedding';
import type { EmbeddingStatus } from '@/types';

interface RouteContext { params: Promise<{ id: string }>; }

// GET - Get embedding status for a paper
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id: paperId } = await context.params;

  const exists = await storage.paperExists(paperId);
  if (!exists) {
    return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  }

  const metadata = await storage.getMetadata(paperId);
  return Response.json({
    status: metadata.embeddingStatus || 'pending',
    error: metadata.embeddingError,
    generatedAt: metadata.embeddingGeneratedAt,
  });
}

// POST - Generate embeddings for a paper
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id: paperId } = await context.params;
  console.log(`[embed] Paper ${paperId}: Starting embedding generation`);

  const exists = await storage.paperExists(paperId);
  if (!exists) {
    return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  }

  const metadata = await storage.getMetadata(paperId);
  console.log(`[embed] Paper ${paperId}: Current embedding status = ${metadata.embeddingStatus || 'pending'}`);

  // Check if already generating
  if (metadata.embeddingStatus === 'generating') {
    console.log(`[embed] Paper ${paperId}: Already generating, skipping`);
    return Response.json({ status: 'generating', message: 'Embeddings are being generated' });
  }

  // Check if force regenerate is requested via URL param
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === 'true';

  if (metadata.embeddingStatus === 'generated' && !force) {
    console.log(`[embed] Paper ${paperId}: Already generated, skipping (use ?force=true to regenerate)`);
    return Response.json({ status: 'generated', message: 'Embeddings already exist' });
  }

  if (force) {
    console.log(`[embed] Paper ${paperId}: Force regenerating embeddings`);
  }

  try {
    // Generate embeddings (this function handles getting parsed content internally)
    console.log(`[embed] Paper ${paperId}: Calling generatePaperEmbeddings...`);
    const embeddingsData = await generatePaperEmbeddings(paperId);

    // Update metadata to generated
    await storage.updateMetadata(paperId, {
      embeddingStatus: 'generated' as EmbeddingStatus,
      embeddingGeneratedAt: new Date().toISOString(),
      embeddingError: undefined,
    });

    console.log(`[embed] Paper ${paperId}: Embeddings generated successfully (${embeddingsData.chunks.length} chunks)`);
    return Response.json({
      status: 'generated',
      chunksCount: embeddingsData.chunks.length,
      message: 'Embeddings generated successfully'
    });
  } catch (error) {
    // Update status to error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[embed] Paper ${paperId}: Error - ${errorMessage}`);
    await storage.updateMetadata(paperId, {
      embeddingStatus: 'error' as EmbeddingStatus,
      embeddingError: errorMessage,
    });

    return createErrorResponse('EMBEDDING_GENERATION_FAILED', errorMessage);
  }
}
