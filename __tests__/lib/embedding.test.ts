import { getEmbeddingConfig, generateEmbeddings, generatePaperEmbeddings, triggerEmbeddingGeneration } from '@/lib/embedding';

// Mock storage module
jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: jest.fn().mockResolvedValue(null),
    getParsedContent: jest.fn(),
    saveEmbeddings: jest.fn(),
    updateMetadata: jest.fn(),
    getMetadata: jest.fn(),
  },
}));

// Mock crypto module
jest.mock('@/lib/crypto', () => ({
  decryptApiKey: jest.fn(),
}));

// Mock chunker module
jest.mock('@/lib/chunker', () => ({
  chunkPaper: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('embedding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_EMBEDDING_MODEL;
    delete process.env.AI_EMBEDDING_BASE_URL;
    delete process.env.AI_EMBEDDING_API_KEY;
  });

  describe('getEmbeddingConfig', () => {
    it('should return default embedding model', async () => {
      const { storage } = await import('@/lib/storage');
      (storage.getSettings as jest.Mock).mockResolvedValue(null);

      const config = await getEmbeddingConfig();
      expect(config.embeddingModel).toBe('text-embedding-3-small');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
    });

    it('should use settings values when available', async () => {
      const { storage } = await import('@/lib/storage');
      (storage.getSettings as jest.Mock).mockResolvedValue({
        baseUrl: 'https://custom.api.com/v1',
        embeddingModel: 'text-embedding-3-large',
        useSameApiForEmbedding: true,
        apiKeyEncrypted: 'encrypted',
        apiKeyIV: 'iv',
      });

      const { decryptApiKey } = await import('@/lib/crypto');
      (decryptApiKey as jest.Mock).mockReturnValue('decrypted-key');

      const config = await getEmbeddingConfig();
      expect(config.embeddingModel).toBe('text-embedding-3-large');
      expect(config.baseUrl).toBe('https://custom.api.com/v1');
      expect(config.apiKey).toBe('decrypted-key');
    });

    it('should use separate embedding API when configured', async () => {
      const { storage } = await import('@/lib/storage');
      (storage.getSettings as jest.Mock).mockResolvedValue({
        baseUrl: 'https://main.api.com/v1',
        useSameApiForEmbedding: false,
        embeddingBaseUrl: 'https://embedding.api.com/v1',
        embeddingApiKeyEncrypted: 'enc-emb',
        embeddingApiKeyIV: 'iv-emb',
      });

      const { decryptApiKey } = await import('@/lib/crypto');
      (decryptApiKey as jest.Mock).mockReturnValue('emb-key');

      const config = await getEmbeddingConfig();
      expect(config.baseUrl).toBe('https://embedding.api.com/v1');
      expect(config.apiKey).toBe('emb-key');
    });

    it('should fallback to environment variables', async () => {
      process.env.AI_BASE_URL = 'https://env.api.com/v1';
      process.env.AI_API_KEY = 'env-api-key';
      process.env.AI_EMBEDDING_MODEL = 'env-embedding-model';

      const { storage } = await import('@/lib/storage');
      (storage.getSettings as jest.Mock).mockResolvedValue(null);

      const config = await getEmbeddingConfig();
      expect(config.embeddingModel).toBe('env-embedding-model');
      expect(config.baseUrl).toBe('https://env.api.com/v1');
      expect(config.apiKey).toBe('env-api-key');
    });

    it('should use separate embedding env vars when configured', async () => {
      process.env.AI_EMBEDDING_BASE_URL = 'https://env-emb.api.com/v1';
      process.env.AI_EMBEDDING_API_KEY = 'env-emb-key';

      const { storage } = await import('@/lib/storage');
      (storage.getSettings as jest.Mock).mockResolvedValue({
        useSameApiForEmbedding: false,
      });

      const config = await getEmbeddingConfig();
      expect(config.baseUrl).toBe('https://env-emb.api.com/v1');
      expect(config.apiKey).toBe('env-emb-key');
    });
  });

  describe('generateEmbeddings', () => {
    it('should call embedding API and return vectors', async () => {
      const mockResponse = {
        data: [
          { embedding: [0.1, 0.2, 0.3], index: 0 },
          { embedding: [0.4, 0.5, 0.6], index: 1 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateEmbeddings(['test text 1', 'test text 2'], 'http://test', 'key', 'model');

      expect(mockFetch).toHaveBeenCalledWith('http://test/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: ['test text 1', 'test text 2'],
          model: 'model',
        }),
      });
      expect(result).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
    });

    it('should sort embeddings by index', async () => {
      const mockResponse = {
        data: [
          { embedding: [0.4, 0.5, 0.6], index: 1 },
          { embedding: [0.1, 0.2, 0.3], index: 0 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateEmbeddings(['text1', 'text2'], 'http://test', 'key', 'model');

      // Should be sorted by index
      expect(result).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
    });

    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(
        generateEmbeddings(['test'], 'http://test', 'key', 'model')
      ).rejects.toThrow('Embedding API error: 401 - Unauthorized');
    });
  });

  describe('generatePaperEmbeddings', () => {
    it('should generate embeddings for paper chunks', async () => {
      const { storage } = await import('@/lib/storage');
      const { chunkPaper } = await import('@/lib/chunker');

      (storage.getParsedContent as jest.Mock).mockResolvedValue('parsed content');
      (chunkPaper as jest.Mock).mockReturnValue([
        { id: 'chunk_0', page: 1, section: 'Intro', text: 'Text 1' },
        { id: 'chunk_1', page: 2, section: 'Methods', text: 'Text 2' },
      ]);
      (storage.getSettings as jest.Mock).mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.3, 0.4], index: 1 },
          ],
        }),
      });

      const result = await generatePaperEmbeddings('paper-123');

      expect(storage.updateMetadata).toHaveBeenCalledWith('paper-123', { embeddingStatus: 'generating' });
      expect(storage.saveEmbeddings).toHaveBeenCalled();
      expect(storage.updateMetadata).toHaveBeenLastCalledWith('paper-123', {
        embeddingStatus: 'generated',
        embeddingGeneratedAt: expect.any(String),
        embeddingError: undefined,
      });
      expect(result.chunks).toHaveLength(2);
      expect(result.embeddings).toHaveLength(2);
    });

    it('should handle missing parsed content', async () => {
      const { storage } = await import('@/lib/storage');
      (storage.getParsedContent as jest.Mock).mockResolvedValue(null);

      await expect(generatePaperEmbeddings('paper-123')).rejects.toThrow('No parsed content available');
      expect(storage.updateMetadata).toHaveBeenCalledWith('paper-123', {
        embeddingStatus: 'error',
        embeddingError: 'No parsed content available',
      });
    });

    it('should batch process large number of chunks', async () => {
      const { storage } = await import('@/lib/storage');
      const { chunkPaper } = await import('@/lib/chunker');

      const manyChunks = Array.from({ length: 150 }, (_, i) => ({
        id: `chunk_${i}`,
        page: Math.floor(i / 10) + 1,
        section: 'Section',
        text: `Text ${i}`,
      }));

      (storage.getParsedContent as jest.Mock).mockResolvedValue('parsed content');
      (chunkPaper as jest.Mock).mockReturnValue(manyChunks);
      (storage.getSettings as jest.Mock).mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: Array.from({ length: 100 }, (_, i) => ({
            embedding: [i * 0.01],
            index: i,
          })),
        }),
      });

      await generatePaperEmbeddings('paper-123');

      // Should be called twice for 150 chunks with batch size 100
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle API errors and update metadata', async () => {
      const { storage } = await import('@/lib/storage');
      const { chunkPaper } = await import('@/lib/chunker');

      (storage.getParsedContent as jest.Mock).mockResolvedValue('parsed content');
      (chunkPaper as jest.Mock).mockReturnValue([
        { id: 'chunk_0', page: 1, section: 'Intro', text: 'Text 1' },
      ]);
      (storage.getSettings as jest.Mock).mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      await expect(generatePaperEmbeddings('paper-123')).rejects.toThrow();
      expect(storage.updateMetadata).toHaveBeenLastCalledWith('paper-123', {
        embeddingStatus: 'error',
        embeddingError: expect.any(String),
      });
    });
  });

  describe('triggerEmbeddingGeneration', () => {
    it('should call embed API endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await triggerEmbeddingGeneration('paper-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/embed/paper-123'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should handle errors silently', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await triggerEmbeddingGeneration('paper-123');

      expect(consoleSpy).toHaveBeenCalledWith('Embedding generation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
