import { storage } from '@/lib/storage';
import { decryptApiKey } from '@/lib/crypto';
import type { EmbeddingsData } from '@/types';
import { chunkPaper } from './chunker';

interface EmbeddingConfig {
  embeddingModel: string;
  baseUrl: string;
  apiKey: string;
}

/**
 * Get embedding configuration from settings or environment.
 */
export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  const settings = await storage.getSettings();

  const embeddingModel = (settings?.embeddingModel as string) ||
    process.env.AI_EMBEDDING_MODEL ||
    'text-embedding-3-small';

  const useSameApi = settings?.useSameApiForEmbedding !== false;

  let baseUrl: string;
  let apiKey: string;

  if (useSameApi) {
    baseUrl = (settings?.baseUrl as string) || process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    apiKey = process.env.AI_API_KEY || '';
    if (settings?.apiKeyEncrypted && settings?.apiKeyIV) {
      try {
        apiKey = decryptApiKey(settings.apiKeyEncrypted as string, settings.apiKeyIV as string);
      } catch { /* Fall back to env var */ }
    }
  } else {
    baseUrl = (settings?.embeddingBaseUrl as string) || process.env.AI_EMBEDDING_BASE_URL || 'https://api.openai.com/v1';
    apiKey = process.env.AI_EMBEDDING_API_KEY || '';
    if (settings?.embeddingApiKeyEncrypted && settings?.embeddingApiKeyIV) {
      try {
        apiKey = decryptApiKey(settings.embeddingApiKeyEncrypted as string, settings.embeddingApiKeyIV as string);
      } catch { /* Fall back to env var */ }
    }
  }

  return { embeddingModel, baseUrl, apiKey };
}

/**
 * Generate embeddings for an array of texts.
 */
export async function generateEmbeddings(
  texts: string[],
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<number[][]> {
  if (!apiKey) {
    throw new Error('API key is not configured for embedding generation');
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error(`Unexpected embedding API response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding);
}

/**
 * Generate embeddings for a paper and save to storage.
 */
export async function generatePaperEmbeddings(paperId: string): Promise<EmbeddingsData> {
  await storage.updateMetadata(paperId, { embeddingStatus: 'generating' });

  try {
    const parsedContent = await storage.getParsedContent(paperId);
    if (!parsedContent) {
      throw new Error('No parsed content available');
    }

    const chunks = chunkPaper(parsedContent);
    const config = await getEmbeddingConfig();

    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.text);
      const embeddings = await generateEmbeddings(
        texts,
        config.baseUrl,
        config.apiKey,
        config.embeddingModel
      );
      allEmbeddings.push(...embeddings);
    }

    const embeddingsData: EmbeddingsData = {
      chunks,
      embeddings: allEmbeddings,
      generatedAt: new Date().toISOString(),
      model: config.embeddingModel,
    };

    await storage.saveEmbeddings(paperId, embeddingsData);
    await storage.updateMetadata(paperId, {
      embeddingStatus: 'generated',
      embeddingGeneratedAt: new Date().toISOString(),
      embeddingError: undefined,
    });

    return embeddingsData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await storage.updateMetadata(paperId, {
      embeddingStatus: 'error',
      embeddingError: errorMessage,
    });
    throw error;
  }
}

/**
 * Trigger embedding generation in background.
 * Calls generatePaperEmbeddings directly instead of HTTP request.
 */
export async function triggerEmbeddingGeneration(paperId: string): Promise<void> {
  // Fire-and-forget: don't await, let it run in background
  generatePaperEmbeddings(paperId).catch(err => {
    console.error('Embedding generation failed:', err);
  });
}
