import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import { generatePaperEmbeddings } from '@/lib/embedding';
import type { EmbeddingStatus } from '@/types';

// GET - Get embedding status for a paper
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const paperId = params.id;

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
  { params }: { params: { id: string } }
) {
  const paperId = params.id;

  const exists = await storage.paperExists(paperId);
  if (!exists) {
    return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  }

  const metadata = await storage.getMetadata(paperId);

  // Check if already generating or generated
  if (metadata.embeddingStatus === 'generating') {
    return Response.json({ status: 'generating', message: 'Embeddings are being generated' });
  }

  if (metadata.embeddingStatus === 'generated') {
    return Response.json({ status: 'generated', message: 'Embeddings already exist' });
  }

  // Update status to generating
  await storage.updateMetadata(paperId, { embeddingStatus: 'generating' as EmbeddingStatus });

  try {
    // Generate embeddings (this function handles getting parsed content internally)
    const embeddingsData = await generatePaperEmbeddings(paperId);

    // Update metadata to generated
    await storage.updateMetadata(paperId, {
      embeddingStatus: 'generated' as EmbeddingStatus,
      embeddingGeneratedAt: new Date().toISOString(),
      embeddingError: undefined,
    });

    return Response.json({
      status: 'generated',
      chunksCount: embeddingsData.chunks.length,
      message: 'Embeddings generated successfully'
    });
  } catch (error) {
    // Update status to error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await storage.updateMetadata(paperId, {
      embeddingStatus: 'error' as EmbeddingStatus,
      embeddingError: errorMessage,
    });

    return createErrorResponse('EMBEDDING_GENERATION_FAILED', errorMessage);
  }
}
