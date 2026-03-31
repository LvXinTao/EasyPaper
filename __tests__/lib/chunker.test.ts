import { chunkPaper } from '@/lib/chunker';

describe('chunkPaper', () => {
  it('should split content into chunks based on paragraphs', () => {
    const content = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
    const chunks = chunkPaper(content);
    // All paragraphs together are less than 500 tokens, so one chunk
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('Paragraph 1');
  });

  it('should extract page numbers from markers', () => {
    const content = '<!-- page 5 -->\n\nContent on page 5' + ' more content to reach 500 chars'.repeat(20);
    const chunks = chunkPaper(content);
    expect(chunks[0].page).toBe(5);
  });

  it('should extract section headers', () => {
    const content = '## Methods\n\nMethodology content' + ' more content to reach 500 chars'.repeat(20);
    const chunks = chunkPaper(content);
    expect(chunks[0].section).toBe('Methods');
  });

  it('should create multiple chunks for long content', () => {
    const longContent = 'Short para with more text to make it longer\n\n'.repeat(100);
    const chunks = chunkPaper(longContent);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle empty content', () => {
    const chunks = chunkPaper('');
    expect(chunks).toEqual([]);
  });
});
