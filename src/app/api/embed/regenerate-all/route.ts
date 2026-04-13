import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import { generatePaperEmbeddings } from '@/lib/embedding';
import type { EmbeddingStatus } from '@/types';

const BATCH_SIZE = 5;
const DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// POST - Regenerate embeddings for all analyzed papers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(request: NextRequest) {
  const papers = await storage.listPapers();

  // Filter to only analyzed papers
  const analyzedPapers = papers.filter(p => p.status === 'analyzed');

  // Batch process with rate limiting
  for (const batch of chunk(analyzedPapers, BATCH_SIZE)) {
    await Promise.all(batch.map(async (paper) => {
      await storage.updateMetadata(paper.id, { embeddingStatus: 'generating' as EmbeddingStatus });
      try {
        const parsedContent = await storage.getParsedContent(paper.id);
        if (parsedContent) {
          const embeddingsData = await generatePaperEmbeddings(paper.id);
          await storage.saveEmbeddings(paper.id, embeddingsData);
          await storage.updateMetadata(paper.id, {
            embeddingStatus: 'generated' as EmbeddingStatus,
            embeddingGeneratedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await storage.updateMetadata(paper.id, {
          embeddingStatus: 'error' as EmbeddingStatus,
          embeddingError: errorMessage,
        });
      }
    }));
    await sleep(DELAY_MS);
  }

  return Response.json({
    success: true,
    processedCount: analyzedPapers.length,
    message: 'All embeddings regenerated'
  });
}
