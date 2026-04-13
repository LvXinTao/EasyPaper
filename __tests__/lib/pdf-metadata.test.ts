import { extractPdfMetadata, splitAuthors, parsePdfDate } from '@/lib/pdf-metadata';

// Mock mupdf module
jest.mock('mupdf', () => {
  const mockGetMetaData = jest.fn().mockReturnValue({
    Title: 'Test Paper Title',
    Author: 'John Smith; Jane Doe',
    Subject: 'Machine Learning',
    Keywords: 'AI, ML, Deep Learning',
    CreationDate: 'D:20240101120000',
    Creator: 'LaTeX with hyperref',
    Producer: 'pdfTeX-1.40.25',
  });
  const mockCountPages = jest.fn().mockReturnValue(10);
  const mockLoadPage = jest.fn().mockReturnValue({
    toStructuredText: jest.fn().mockReturnValue({
      walk: jest.fn(),
    }),
  });
  const mockOpenDocument = jest.fn().mockReturnValue({
    getMetaData: mockGetMetaData,
    countPages: mockCountPages,
    loadPage: mockLoadPage,
  });
  return {
    __esModule: true,
    Document: { openDocument: mockOpenDocument },
    __mocks: { mockGetMetaData, mockCountPages, mockLoadPage, mockOpenDocument },
  };
});

const mupdfMocks = require('mupdf').__mocks as {
  mockGetMetaData: jest.Mock;
  mockCountPages: jest.Mock;
  mockLoadPage: jest.Mock;
  mockOpenDocument: jest.Mock;
};

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake-pdf')),
}));

describe('splitAuthors', () => {
  it('splits by semicolons', () => {
    expect(splitAuthors('Smith, J.; Doe, J.')).toEqual(['Smith, J.', 'Doe, J.']);
  });

  it('splits by "and"', () => {
    expect(splitAuthors('John Smith and Jane Doe')).toEqual(['John Smith', 'Jane Doe']);
  });

  it('splits by &', () => {
    expect(splitAuthors('John Smith & Jane Doe')).toEqual(['John Smith', 'Jane Doe']);
  });

  it('preserves "Last, First" format (no comma split)', () => {
    expect(splitAuthors('Smith, John')).toEqual(['Smith, John']);
  });

  it('handles empty string', () => {
    expect(splitAuthors('')).toEqual([]);
  });

  it('handles whitespace', () => {
    expect(splitAuthors('  John Smith  ')).toEqual(['John Smith']);
  });
});

describe('parsePdfDate', () => {
  it('parses full date format with time', () => {
    expect(parsePdfDate('D:20240115123045')).toBe('2024-01-15');
  });

  it('parses date without time', () => {
    expect(parsePdfDate('D:20240115')).toBe('2024-01-15');
  });

  it('parses year-month only', () => {
    expect(parsePdfDate('D:202401')).toBe('2024-01');
  });

  it('parses year only', () => {
    expect(parsePdfDate('D:2024')).toBe('2024');
  });

  it('returns undefined for empty or too short', () => {
    expect(parsePdfDate('')).toBeUndefined();
    expect(parsePdfDate('D:')).toBeUndefined();
    expect(parsePdfDate('D:20')).toBeUndefined();
  });
});

describe('extractPdfMetadata', () => {
  afterEach(() => {
    mupdfMocks.mockGetMetaData.mockReset();
    mupdfMocks.mockGetMetaData.mockReturnValue({
      Title: 'Test Paper Title',
      Author: 'John Smith; Jane Doe',
      Subject: 'Machine Learning',
      Keywords: 'AI, ML, Deep Learning',
      CreationDate: 'D:20240101120000',
      Creator: 'LaTeX with hyperref',
      Producer: 'pdfTeX-1.40.25',
    });
    mupdfMocks.mockCountPages.mockReturnValue(10);
  });

  it('extracts all fields from PDF properties', async () => {
    mupdfMocks.mockGetMetaData.mockReturnValue({
      Title: 'Attention Is All You Need',
      Author: 'Vaswani, A.; Shazeer, N.',
      Subject: 'Neural Networks',
      Keywords: 'transformer, attention',
      CreationDate: 'D:20170612',
      Creator: 'LaTeX',
      Producer: 'pdfTeX',
    });

    const result = await extractPdfMetadata('/test.pdf');

    expect(result.title).toBe('Attention Is All You Need');
    expect(result.authors).toEqual(['Vaswani, A.', 'Shazeer, N.']);
    expect(result.subject).toBe('Neural Networks');
    expect(result.keywords).toEqual(['transformer', 'attention']);
    expect(result.creator).toBe('LaTeX');
    expect(result.producer).toBe('pdfTeX');
    expect(result.fieldSources).toEqual({
      title: 'pdf-properties',
      authors: 'pdf-properties',
      date: 'pdf-properties',
      subject: 'pdf-properties',
      keywords: 'pdf-properties',
      creator: 'pdf-properties',
      producer: 'pdf-properties',
    });
    expect(result.extractedAt).toBeDefined();
  });

  it('returns empty metadata when PDF has no properties', async () => {
    mupdfMocks.mockGetMetaData.mockReturnValue({});

    const result = await extractPdfMetadata('/test.pdf');

    expect(result.fieldSources).toEqual({});
    expect(result.extractedAt).toBeDefined();
  });

  it('returns accurate page count', async () => {
    mupdfMocks.mockCountPages.mockReturnValue(42);

    const result = await extractPdfMetadata('/test.pdf');

    expect(result.pageCount).toBe(42);
  });

  it('verifies mupdf openDocument was called', async () => {
    await extractPdfMetadata('/test.pdf');
    expect(mupdfMocks.mockOpenDocument).toHaveBeenCalledWith(
      expect.any(Buffer),
      'application/pdf'
    );
  });
});
