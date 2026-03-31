import type { ChunkData, EmbeddingsData, PaperAnalysis, TextSelection } from '@/types';
import { generateEmbeddings } from '@/lib/embedding';

const LOW_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search for top-k relevant chunks using query embedding
 */
export async function search(
  query: string,
  embeddingsData: EmbeddingsData,
  topK: number,
  config: { baseUrl: string; apiKey: string; model: string }
): Promise<ChunkData[]> {
  // Embed the query
  const queryEmbedding = await generateEmbeddings([query], config.baseUrl, config.apiKey, config.model);

  // Compute similarities
  const results: ChunkData[] = [];
  for (let i = 0; i < embeddingsData.embeddings.length; i++) {
    const similarity = cosineSimilarity(queryEmbedding[0], embeddingsData.embeddings[i]);
    results.push({
      ...embeddingsData.chunks[i],
      similarity,
    });
  }

  // Sort by similarity descending and return top-k
  results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  return results.slice(0, topK);
}

/**
 * Ensure quoted chunk is included in results
 */
export function ensureQuoteIncluded(
  relevantChunks: ChunkData[],
  quote: TextSelection,
  allChunks: ChunkData[]
): ChunkData[] {
  // Find chunk containing the quoted text
  const quotedChunk = findChunkByText(allChunks, quote.text);
  if (!quotedChunk) return relevantChunks;

  // Check if already in top-k
  const alreadyIncluded = relevantChunks.some(c => c.id === quotedChunk.id);
  if (alreadyIncluded) return relevantChunks;

  // Replace lowest similarity chunk with quoted chunk
  const result = [...relevantChunks];
  result[result.length - 1] = quotedChunk;
  return result;
}

function findChunkByText(chunks: ChunkData[], searchText: string): ChunkData | null {
  const normalizedSearch = normalizeText(searchText);
  for (const chunk of chunks) {
    const normalizedChunk = normalizeText(chunk.text);
    const overlapRatio = calculateOverlap(normalizedSearch, normalizedChunk);
    if (overlapRatio >= 0.8) return chunk;
  }
  return null;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function calculateOverlap(search: string, chunk: string): number {
  // Simple overlap: check if chunk contains at least 80% of search words
  const searchWords = search.split(' ');
  const matchedWords = searchWords.filter(w => chunk.includes(w));
  return matchedWords.length / searchWords.length;
}

/**
 * Build RAG context from analysis and chunks
 */
export function buildRAGContext(
  analysis: PaperAnalysis | null,
  chunks: ChunkData[]
): string {
  const parts: string[] = [];

  // Helper to get content from section (handles both object and string format)
  const getSectionContent = (section: unknown): string => {
    if (typeof section === 'string') return section;
    if (section && typeof section === 'object' && 'content' in section) {
      return String((section as { content: string }).content);
    }
    return String(section || '');
  };

  // Macro: Analysis summary
  if (analysis) {
    parts.push('[论文摘要]');
    parts.push(`- 核心思想：${getSectionContent(analysis.summary)}`);
    parts.push(`- 方法论：${getSectionContent(analysis.methodology)}`);
    parts.push(`- 实验：${getSectionContent(analysis.experiments)}`);
    parts.push(`- 结论：${getSectionContent(analysis.conclusions)}`);
    parts.push('');
  }

  // Micro: Relevant chunks
  parts.push('[与您问题相关的段落]');
  for (const chunk of chunks) {
    parts.push(`段落 (第${chunk.page}页，${chunk.section || '正文'})：`);
    parts.push(chunk.text);
    parts.push('');
  }

  return parts.join('\n');
}

export { LOW_CONFIDENCE_THRESHOLD };
