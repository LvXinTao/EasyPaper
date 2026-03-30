import {
  cosineSimilarity,
  search,
  ensureQuoteIncluded,
  buildRAGContext,
  LOW_CONFIDENCE_THRESHOLD,
} from '@/lib/retrieval';
import type { ChunkData, EmbeddingsData, PaperAnalysis, TextSelection } from '@/types';

// Mock the embedding module
jest.mock('@/lib/embedding', () => ({
  generateEmbeddings: jest.fn(),
}));

import { generateEmbeddings } from '@/lib/embedding';

const mockedGenerateEmbeddings = generateEmbeddings as jest.MockedFunction<typeof generateEmbeddings>;

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('should return 0 for different length vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should handle zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeNaN();
  });

  it('should return correct value for similar vectors', () => {
    const a = [1, 1, 0];
    const b = [1, 0, 1];
    // Dot product = 1, normA = sqrt(2), normB = sqrt(2), result = 1/2 = 0.5
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });
});

describe('search', () => {
  const mockConfig = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    model: 'text-embedding-3-small',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return top-k most similar chunks', async () => {
    // Query embedding: [1, 0, 0]
    mockedGenerateEmbeddings.mockResolvedValueOnce([[1, 0, 0]]);

    const embeddingsData: EmbeddingsData = {
      chunks: [
        { id: 'chunk1', page: 1, section: 'Intro', text: 'First chunk' },
        { id: 'chunk2', page: 2, section: 'Methods', text: 'Second chunk' },
        { id: 'chunk3', page: 3, section: 'Results', text: 'Third chunk' },
      ],
      embeddings: [
        [1, 0, 0], // Most similar to query
        [0, 1, 0], // Orthogonal
        [0.5, 0.5, 0], // 45 degree angle
      ],
      generatedAt: '2024-01-01T00:00:00Z',
      model: 'text-embedding-3-small',
    };

    const results = await search('test query', embeddingsData, 2, mockConfig);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('chunk1'); // Most similar
    expect(results[0].similarity).toBeCloseTo(1, 5);
    expect(results[1].id).toBe('chunk3'); // Second most similar
  });

  it('should handle empty embeddings data', async () => {
    mockedGenerateEmbeddings.mockResolvedValueOnce([[1, 0, 0]]);

    const embeddingsData: EmbeddingsData = {
      chunks: [],
      embeddings: [],
      generatedAt: '2024-01-01T00:00:00Z',
      model: 'text-embedding-3-small',
    };

    const results = await search('test query', embeddingsData, 2, mockConfig);

    expect(results).toHaveLength(0);
  });

  it('should call generateEmbeddings with correct parameters', async () => {
    mockedGenerateEmbeddings.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);

    const embeddingsData: EmbeddingsData = {
      chunks: [{ id: 'chunk1', page: 1, section: '', text: 'Test' }],
      embeddings: [[1, 0, 0]],
      generatedAt: '2024-01-01T00:00:00Z',
      model: 'text-embedding-3-small',
    };

    await search('my query', embeddingsData, 1, mockConfig);

    expect(mockedGenerateEmbeddings).toHaveBeenCalledWith(
      ['my query'],
      mockConfig.baseUrl,
      mockConfig.apiKey,
      mockConfig.model
    );
  });
});

describe('ensureQuoteIncluded', () => {
  const allChunks: ChunkData[] = [
    { id: 'chunk1', page: 1, section: 'Intro', text: 'This is the first chunk with some content' },
    { id: 'chunk2', page: 2, section: 'Methods', text: 'The methodology section explains the approach' },
    { id: 'chunk3', page: 3, section: 'Results', text: 'Results show significant improvements in accuracy' },
  ];

  it('should return chunks unchanged if quote is already included', () => {
    const relevantChunks: ChunkData[] = [
      { id: 'chunk1', page: 1, section: 'Intro', text: 'This is the first chunk', similarity: 0.9 },
      { id: 'chunk2', page: 2, section: 'Methods', text: 'The methodology section', similarity: 0.7 },
    ];

    const quote: TextSelection = {
      text: 'This is the first chunk',
      rects: [],
      page: 1,
    };

    const result = ensureQuoteIncluded(relevantChunks, quote, allChunks);

    expect(result).toEqual(relevantChunks);
  });

  it('should replace lowest similarity chunk when quote not included', () => {
    const relevantChunks: ChunkData[] = [
      { id: 'chunk1', page: 1, section: 'Intro', text: 'This is the first chunk', similarity: 0.9 },
      { id: 'chunk2', page: 2, section: 'Methods', text: 'The methodology section', similarity: 0.7 },
    ];

    const quote: TextSelection = {
      text: 'Results show significant improvements',
      rects: [],
      page: 3,
    };

    const result = ensureQuoteIncluded(relevantChunks, quote, allChunks);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(relevantChunks[0]);
    expect(result[1].id).toBe('chunk3'); // Replaced with quoted chunk
  });

  it('should return unchanged if quoted text not found in any chunk', () => {
    const relevantChunks: ChunkData[] = [
      { id: 'chunk1', page: 1, section: 'Intro', text: 'This is the first chunk', similarity: 0.9 },
    ];

    const quote: TextSelection = {
      text: 'This text does not exist in any chunk',
      rects: [],
      page: 1,
    };

    const result = ensureQuoteIncluded(relevantChunks, quote, allChunks);

    expect(result).toEqual(relevantChunks);
  });

  it('should handle partial text match with 80% overlap', () => {
    const relevantChunks: ChunkData[] = [
      { id: 'chunk1', page: 1, section: 'Intro', text: 'This is the first chunk', similarity: 0.9 },
    ];

    // Quote with slight variation but enough overlap
    const quote: TextSelection = {
      text: 'Results show significant improvements',
      rects: [],
      page: 3,
    };

    const result = ensureQuoteIncluded(relevantChunks, quote, allChunks);

    expect(result[result.length - 1].id).toBe('chunk3');
  });
});

describe('buildRAGContext', () => {
  it('should build context with analysis and chunks', () => {
    const analysis: PaperAnalysis = {
      summary: { content: 'A novel approach to ML' },
      contributions: { items: ['Item 1'] },
      methodology: { content: 'Using deep learning' },
      experiments: { content: 'Tested on benchmark' },
      conclusions: { content: 'Achieved SOTA results' },
      generatedAt: '2024-01-01T00:00:00Z',
    };

    const chunks: ChunkData[] = [
      { id: 'chunk1', page: 1, section: 'Intro', text: 'Introduction text here' },
      { id: 'chunk2', page: 2, section: 'Methods', text: 'Methods description' },
    ];

    const context = buildRAGContext(analysis, chunks);

    expect(context).toContain('[论文摘要]');
    expect(context).toContain('核心思想：A novel approach to ML');
    expect(context).toContain('方法论：Using deep learning');
    expect(context).toContain('[与您问题相关的段落]');
    expect(context).toContain('段落 (第1页，Intro)：');
    expect(context).toContain('Introduction text here');
    expect(context).toContain('段落 (第2页，Methods)：');
  });

  it('should build context without analysis', () => {
    const chunks: ChunkData[] = [
      { id: 'chunk1', page: 1, section: '', text: 'Some text' },
    ];

    const context = buildRAGContext(null, chunks);

    expect(context).not.toContain('[论文摘要]');
    expect(context).toContain('[与您问题相关的段落]');
    expect(context).toContain('段落 (第1页，正文)：');
  });

  it('should handle empty chunks', () => {
    const analysis: PaperAnalysis = {
      summary: { content: 'Summary' },
      contributions: { items: [] },
      methodology: { content: 'Method' },
      experiments: { content: 'Exp' },
      conclusions: { content: 'Conclusion' },
      generatedAt: '2024-01-01T00:00:00Z',
    };

    const context = buildRAGContext(analysis, []);

    expect(context).toContain('[论文摘要]');
    expect(context).toContain('[与您问题相关的段落]');
  });
});

describe('LOW_CONFIDENCE_THRESHOLD', () => {
  it('should be 0.3', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.3);
  });
});
