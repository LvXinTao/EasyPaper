import { parsePdfWithVision, detectTruncation } from '@/lib/pdf-parser';

jest.mock('mupdf', () => {
  const mockAsText = jest.fn().mockReturnValue('Fallback text content from page');
  const mockAsPNG = jest.fn().mockReturnValue(Buffer.from('fake-png'));
  const mockToPixmap = jest.fn().mockReturnValue({ asPNG: mockAsPNG });
  const mockToStructuredText = jest.fn().mockReturnValue({ asText: mockAsText });
  const mockLoadPage = jest.fn().mockReturnValue({
    toPixmap: mockToPixmap,
    toStructuredText: mockToStructuredText,
  });
  const mockCountPages = jest.fn().mockReturnValue(2);
  const mockOpenDocument = jest.fn().mockReturnValue({
    countPages: mockCountPages,
    loadPage: mockLoadPage,
  });
  return {
    __esModule: true,
    Document: { openDocument: mockOpenDocument },
    Matrix: { scale: jest.fn().mockReturnValue('scaled-matrix') },
    ColorSpace: { DeviceRGB: 'rgb-colorspace' },
    __mocks: { mockOpenDocument, mockCountPages, mockLoadPage, mockToPixmap, mockAsPNG, mockToStructuredText, mockAsText },
  };
});

jest.mock('@/lib/ai-client', () => {
  const mockCompleteVision = jest.fn();
  // streamCompleteVision is an async generator; wrap mockCompleteVision so tests
  // can control it with mockResolvedValue / mockRejectedValue as before.
  const streamCompleteVision = jest.fn().mockImplementation(async function* () {
    const result = await mockCompleteVision();
    yield result;
  });
  return {
    createAIClient: jest.fn().mockReturnValue({ streamCompleteVision, completeVision: mockCompleteVision }),
    __mocks: { mockCompleteVision, streamCompleteVision },
  };
});

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-bytes')),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mupdfMocks = require('mupdf').__mocks as {
  mockCountPages: jest.Mock;
  mockLoadPage: jest.Mock;
  mockToPixmap: jest.Mock;
  mockAsPNG: jest.Mock;
  mockToStructuredText: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mockCompleteVision, streamCompleteVision } = require('@/lib/ai-client').__mocks as { mockCompleteVision: jest.Mock; streamCompleteVision: jest.Mock };

describe('parsePdfWithVision', () => {
  const config = { baseUrl: 'https://api.test.com/v1', apiKey: 'sk-test', visionModel: 'gpt-4o' };

  afterEach(() => {
    mockCompleteVision.mockReset();
    mupdfMocks.mockCountPages.mockReturnValue(2);
    mupdfMocks.mockAsPNG.mockReturnValue(Buffer.from('fake-png'));
    mupdfMocks.mockToPixmap.mockReturnValue({ asPNG: mupdfMocks.mockAsPNG });
    mupdfMocks.mockLoadPage.mockReturnValue({
      toPixmap: mupdfMocks.mockToPixmap,
      toStructuredText: mupdfMocks.mockToStructuredText,
    });
  });

  it('renders PDF pages and sends to Vision LLM', async () => {
    mockCompleteVision.mockResolvedValue('# Paper Title\n\nParsed content.');

    const result = await parsePdfWithVision('/test.pdf', config);

    expect(result).toBe('# Paper Title\n\nParsed content.');
    const callArgs = streamCompleteVision.mock.calls[0][0];
    expect(callArgs[0].content).toHaveLength(3);
    expect(callArgs[0].content[0].type).toBe('text');
    expect(callArgs[0].content[1].type).toBe('image_url');
    expect(callArgs[0].content[2].type).toBe('image_url');
  });

  it('falls back to text extraction when Vision fails', async () => {
    mockCompleteVision.mockRejectedValue(new Error('API error 400: model does not support images'));

    const result = await parsePdfWithVision('/test.pdf', config);

    expect(result).toContain('Fallback text content from page');
  });

  it('reports progress via callback', async () => {
    mockCompleteVision.mockResolvedValue('# Content.');
    const progress: string[] = [];

    await parsePdfWithVision('/test.pdf', config, {
      onProgress: (msg) => progress.push(msg),
    });

    expect(progress.some(p => p.includes('Rendering'))).toBe(true);
    expect(progress.some(p => p.includes('Vision AI'))).toBe(true);
  });

  it('skips pages that fail to render and still succeeds', async () => {
    mupdfMocks.mockToPixmap
      .mockReturnValueOnce({ asPNG: jest.fn().mockReturnValue(Buffer.from('ok-png')) })
      .mockImplementationOnce(() => { throw new Error('render crash'); });

    mockCompleteVision.mockResolvedValue('# Page 1 content.');

    const result = await parsePdfWithVision('/test.pdf', config);

    expect(result).toContain('Page 1 content');
  });

  it('batches long papers with overlap', async () => {
    mupdfMocks.mockCountPages.mockReturnValue(20);
    mockCompleteVision
      .mockResolvedValueOnce('# Batch 1 content ending here.')
      .mockResolvedValueOnce('# Batch 2 content.');

    await parsePdfWithVision('/test.pdf', config);

    expect(mockCompleteVision).toHaveBeenCalledTimes(2);
  });

  it('warns on truncated output but still returns it', async () => {
    mockCompleteVision.mockResolvedValue('# Paper Title\n\nContent starts but ends mid-sen');
    const warnings: string[] = [];

    const result = await parsePdfWithVision('/test.pdf', config, {
      onProgress: (msg) => warnings.push(msg),
    });

    expect(result).toContain('mid-sen');
    expect(warnings.some(w => w.toLowerCase().includes('truncat') || w.toLowerCase().includes('incomplete'))).toBe(true);
  });
});

describe('detectTruncation', () => {
  it('detects unclosed code fence', () => {
    expect(detectTruncation('```python\ncode here')).toBe(true);
  });

  it('detects unclosed table', () => {
    expect(detectTruncation('| col1 | col2 |\n| val1')).toBe(true);
  });

  it('returns false for complete text', () => {
    expect(detectTruncation('# Title\n\nComplete paragraph here.')).toBe(false);
  });
});
