import type { ChunkData } from '@/types';

const MIN_CHUNK_SIZE = 500; // Minimum tokens per chunk

/**
 * Estimate tokens in text (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split parsed markdown content into chunks for embedding
 */
export function chunkPaper(parsedContent: string): ChunkData[] {
  const blocks = parsedContent.split('\n\n');
  const chunks: ChunkData[] = [];
  let currentChunk = '';
  let currentPage = 1;
  let currentSection = '';
  let chunkId = 0;

  for (const block of blocks) {
    // Extract page marker if present
    const pageMatch = block.match(/<!-- page (\d+) -->/);
    if (pageMatch) currentPage = parseInt(pageMatch[1]);

    // Extract section header if present
    const sectionMatch = block.match(/^#{1,3} (.+)$/m);
    if (sectionMatch) currentSection = sectionMatch[1];

    // Accumulate chunk content
    currentChunk += block + '\n\n';

    // Check if chunk is large enough
    if (estimateTokens(currentChunk) >= MIN_CHUNK_SIZE) {
      chunks.push({
        id: `chunk_${chunkId++}`,
        page: currentPage,
        section: currentSection,
        text: currentChunk.trim(),
      });
      currentChunk = '';
    }
  }

  // Handle remaining content
  if (currentChunk.trim()) {
    chunks.push({
      id: `chunk_${chunkId++}`,
      page: currentPage,
      section: currentSection,
      text: currentChunk.trim(),
    });
  }

  return chunks;
}
