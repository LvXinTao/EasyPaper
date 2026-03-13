/**
 * @jest-environment jsdom
 */
import { normalizeText, buildTextMap } from '@/lib/pdf-highlight';

describe('normalizeText', () => {
  it('collapses consecutive whitespace into single space', () => {
    const result = normalizeText('deep   learning   model');
    expect(result.normalized).toBe('deep learning model');
  });

  it('maps normalized indices back to original positions', () => {
    // "a  b" → "a b"
    // index 0='a' → orig 0, index 1=' ' → orig 1, index 2='b' → orig 3
    const result = normalizeText('a  b');
    expect(result.normalized).toBe('a b');
    expect(result.indexMap).toEqual([0, 1, 3]);
  });

  it('converts to lowercase', () => {
    const result = normalizeText('Deep Learning');
    expect(result.normalized).toBe('deep learning');
  });

  it('trims leading and trailing whitespace', () => {
    const result = normalizeText('  hello world  ');
    expect(result.normalized).toBe('hello world');
  });

  it('handles tabs and newlines as whitespace', () => {
    const result = normalizeText("line1\n\tline2");
    expect(result.normalized).toBe('line1 line2');
  });

  it('works correctly with pre-NFC-normalized input', () => {
    // normalizeText expects NFC input; callers handle NFC normalization
    const precomposed = '\u00e9'; // é (NFC)
    const result = normalizeText(precomposed);
    expect(result.normalized).toBe('\u00e9');
    expect(result.indexMap).toEqual([0]);
  });

  it('returns empty indexMap for empty string', () => {
    const result = normalizeText('');
    expect(result.normalized).toBe('');
    expect(result.indexMap).toEqual([]);
  });

  it('handles whitespace-only string', () => {
    const result = normalizeText('   ');
    expect(result.normalized).toBe('');
    expect(result.indexMap).toEqual([]);
  });
});

describe('buildTextMap', () => {
  function makeSpans(texts: string[]): { container: HTMLDivElement; spans: HTMLSpanElement[] } {
    const container = document.createElement('div');
    const spans = texts.map((t) => {
      const span = document.createElement('span');
      span.textContent = t;
      container.appendChild(span);
      return span;
    });
    return { container, spans };
  }

  it('concatenates span texts into fullText', () => {
    const { container } = makeSpans(['hello ', 'world']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('hello world');
  });

  it('maps each character back to its source span', () => {
    const { container, spans } = makeSpans(['ab', 'cd']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('abcd');
    expect(result.charMap[0].span).toBe(spans[0]);
    expect(result.charMap[1].span).toBe(spans[0]);
    expect(result.charMap[2].span).toBe(spans[1]);
    expect(result.charMap[3].span).toBe(spans[1]);
  });

  it('tracks offsetInSpan correctly', () => {
    const { container } = makeSpans(['abc']);
    const result = buildTextMap(container);
    expect(result.charMap[0].offsetInSpan).toBe(0);
    expect(result.charMap[1].offsetInSpan).toBe(1);
    expect(result.charMap[2].offsetInSpan).toBe(2);
  });

  it('handles empty container', () => {
    const container = document.createElement('div');
    const result = buildTextMap(container);
    expect(result.fullText).toBe('');
    expect(result.charMap).toEqual([]);
  });

  it('handles spans with empty text', () => {
    const { container } = makeSpans(['', 'hello', '']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('hello');
    expect(result.charMap.length).toBe(5);
  });

  it('concatenates without inserting separators between spans', () => {
    const { container } = makeSpans(['hello', 'world']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('helloworld');
  });

  it('NFC-normalizes span text content', () => {
    const { container } = makeSpans(['e\u0301']);
    const result = buildTextMap(container);
    expect(result.fullText).toBe('\u00e9');
    expect(result.charMap.length).toBe(1);
  });
});
