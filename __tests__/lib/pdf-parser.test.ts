import { parsePdfWithVision, detectTruncation, deduplicateByPageMarkers } from '@/lib/pdf-parser';

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
    mockCompleteVision.mockResolvedValue('<!-- page 1 -->\n# Paper Title\n<!-- page 2 -->\nParsed content.');

    const result = await parsePdfWithVision('/test.pdf', config);

    expect(result).toContain('Paper Title');
    expect(result).toContain('Parsed content');
    const callArgs = streamCompleteVision.mock.calls[0][0];
    expect(callArgs[0].content).toHaveLength(3); // prompt + 2 images
    expect(callArgs[0].content[0].type).toBe('text');
    expect(callArgs[0].content[1].type).toBe('image_url');
  });

  it('falls back to text extraction when Vision fails', async () => {
    mockCompleteVision.mockRejectedValue(new Error('API error 400: model does not support images'));

    const result = await parsePdfWithVision('/test.pdf', config);

    expect(result).toContain('Fallback text content from page');
  });

  it('reports progress via callback', async () => {
    mockCompleteVision.mockResolvedValue('<!-- page 1 -->\n# Content.');
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

  it('batches long papers and deduplicates by page markers', async () => {
    mupdfMocks.mockCountPages.mockReturnValue(20);
    mockCompleteVision
      .mockResolvedValueOnce('<!-- page 1 -->\nBatch 1 ending.\n<!-- page 14 -->\nOverlap page.')
      .mockResolvedValueOnce('<!-- page 14 -->\nOverlap different.\n<!-- page 20 -->\nBatch 2 content.');

    const result = await parsePdfWithVision('/test.pdf', config);

    expect(mockCompleteVision).toHaveBeenCalledTimes(2);
    expect(result).toContain('Batch 1 ending');
    expect(result).toContain('Batch 2 content');
    // Page 14 should come from first batch (first wins)
    expect(result).toContain('Overlap page');
    expect(result).not.toContain('Overlap different');
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

  it('sends batches in parallel for large papers', async () => {
    mupdfMocks.mockCountPages.mockReturnValue(35);

    // Use mockResolvedValueOnce to avoid race conditions with shared counters
    mockCompleteVision
      .mockResolvedValueOnce('<!-- page 1 -->\nBatch 1 content.')
      .mockResolvedValueOnce('<!-- page 14 -->\nBatch 2 content.')
      .mockResolvedValueOnce('<!-- page 27 -->\nBatch 3 content.');

    await parsePdfWithVision('/test.pdf', config);

    // 35 pages = 3 batches (1-15, 14-28, 27-35)
    expect(mockCompleteVision).toHaveBeenCalledTimes(3);
  });

  it('calls onBatchDone for each completed batch', async () => {
    mupdfMocks.mockCountPages.mockReturnValue(20);
    mockCompleteVision
      .mockResolvedValueOnce('<!-- page 1 -->\nBatch 1.')
      .mockResolvedValueOnce('<!-- page 14 -->\nBatch 2.');

    const batchDones: Array<{ index: number; total: number }> = [];
    await parsePdfWithVision('/test.pdf', config, {
      onBatchDone: (idx, total) => batchDones.push({ index: idx, total }),
    });

    expect(batchDones).toHaveLength(2);
    expect(batchDones[0].total).toBe(2);
    expect(batchDones[1].total).toBe(2);
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

describe('deduplicateByPageMarkers', () => {
  it('joins single batch without modification', () => {
    const result = deduplicateByPageMarkers(['<!-- page 1 -->\nContent page 1\n<!-- page 2 -->\nContent page 2']);
    expect(result).toBe('<!-- page 1 -->\nContent page 1\n<!-- page 2 -->\nContent page 2');
  });

  it('deduplicates overlapping pages between batches', () => {
    const batch1 = '<!-- page 1 -->\nContent 1\n<!-- page 2 -->\nContent 2\n<!-- page 3 -->\nContent 3';
    const batch2 = '<!-- page 3 -->\nContent 3 different\n<!-- page 4 -->\nContent 4';
    const result = deduplicateByPageMarkers([batch1, batch2]);
    expect(result).toContain('Content 1');
    expect(result).toContain('Content 2');
    expect(result).toContain('Content 3');  // from batch1 (first wins)
    expect(result).toContain('Content 4');
    expect(result).not.toContain('Content 3 different');  // batch2 overlap discarded
  });

  it('handles batches without page markers (fallback join)', () => {
    const result = deduplicateByPageMarkers(['No markers batch 1', 'No markers batch 2']);
    expect(result).toBe('No markers batch 1\n\nNo markers batch 2');
  });

  it('handles empty results', () => {
    expect(deduplicateByPageMarkers([])).toBe('');
  });
});
