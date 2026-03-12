import { createAIClient } from '@/lib/ai-client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('createAIClient', () => {
  const client = createAIClient({ baseUrl: 'https://api.test.com/v1', apiKey: 'sk-test', model: 'gpt-4o' });

  afterEach(() => { mockFetch.mockReset(); });

  describe('complete', () => {
    it('sends a request and returns the response content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"summary": "test"}' } }] }),
      });
      const result = await client.complete([{ role: 'user', content: 'Analyze this paper' }]);
      expect(result).toBe('{"summary": "test"}');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/chat/completions',
        expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }) })
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'Invalid API key' });
      await expect(client.complete([{ role: 'user', content: 'test' }])).rejects.toThrow('API error 401');
    });
  });

  describe('streamComplete', () => {
    it('yields chunks from SSE stream', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      mockFetch.mockResolvedValue({ ok: true, body: stream });
      const chunks: string[] = [];
      for await (const chunk of client.streamComplete([{ role: 'user', content: 'test' }])) { chunks.push(chunk); }
      expect(chunks).toEqual(['Hello', ' World']);
    });
  });
});
