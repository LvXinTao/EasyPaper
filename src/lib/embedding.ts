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
  model: string,
  options?: { logPrefix?: string }
): Promise<number[][]> {
  const prefix = options?.logPrefix || '[embed]';
  if (!apiKey) {
    throw new Error('API key is not configured for embedding generation');
  }

  console.log(`${prefix} Calling embedding API...`);
  console.log(`${prefix}   URL: ${baseUrl}/embeddings`);
  console.log(`${prefix}   Model: ${model}`);
  console.log(`${prefix}   Batch size: ${texts.length} texts`);

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
    console.error(`${prefix} API error: ${response.status} - ${error}`);
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.data || !Array.isArray(data.data)) {
    console.error(`${prefix} Unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
    throw new Error(`Unexpected embedding API response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  console.log(`${prefix} API success: ${data.data.length} embeddings returned`);
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding);
}

/**
 * Generate embeddings for a paper and save to storage.
 */
export async function generatePaperEmbeddings(paperId: string): Promise<EmbeddingsData> {
  console.log(`[embed] Paper ${paperId}: Starting embedding generation`);
  await storage.updateMetadata(paperId, { embeddingStatus: 'generating' });

  try {
    const parsedContent = await storage.getParsedContent(paperId);
    if (!parsedContent) {
      throw new Error('No parsed content available');
    }
    console.log(`[embed] Paper ${paperId}: Parsed content loaded (${parsedContent.length} chars)`);

    const chunks = chunkPaper(parsedContent);
    console.log(`[embed] Paper ${paperId}: Chunked into ${chunks.length} chunks`);
    const config = await getEmbeddingConfig();
    console.log(`[embed] Paper ${paperId}: Config loaded - model: ${config.embeddingModel}`);

    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.text);
      console.log(`[embed] Paper ${paperId}: Processing batch ${batchIndex}/${totalBatches}`);
      const embeddings = await generateEmbeddings(
        texts,
        config.baseUrl,
        config.apiKey,
        config.embeddingModel,
        { logPrefix: `[embed] Paper ${paperId}: Batch ${batchIndex}` }
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

    console.log(`[embed] Paper ${paperId}: Embeddings generated successfully (${chunks.length} chunks)`);
    return embeddingsData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[embed] Paper ${paperId}: Error - ${errorMessage}`);
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
