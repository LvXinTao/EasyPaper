/**
 * @jest-environment jsdom
 */
import { normalizeText } from '@/lib/pdf-highlight';

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
