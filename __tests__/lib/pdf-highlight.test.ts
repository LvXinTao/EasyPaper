/**
 * @jest-environment jsdom
 */
import { normalizeText, buildTextMap, findMatchRange, detectParagraphBounds, applyHighlight } from '@/lib/pdf-highlight';

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

describe('findMatchRange', () => {
  it('returns match indices for exact normalized match', () => {
    const result = findMatchRange('hello world foo bar', 'world foo');
    expect(result).not.toBeNull();
    expect(result!.startIdx).toBe(6);
    expect(result!.endIdx).toBe(14);
  });

  it('returns null when no match found', () => {
    const result = findMatchRange('hello world', 'nonexistent');
    expect(result).toBeNull();
  });

  it('matches case-insensitively', () => {
    const result = findMatchRange('Deep Learning Model', 'deep learning');
    expect(result).not.toBeNull();
  });

  it('matches with whitespace normalization', () => {
    const result = findMatchRange('deep   learning   model', 'deep learning model');
    expect(result).not.toBeNull();
  });

  it('falls back to word subsequence when exact match fails', () => {
    const result = findMatchRange(
      'novel deep learning framework for NLP',
      'we propose a novel deep learning framework for NLP tasks'
    );
    expect(result).not.toBeNull();
  });

  it('returns null for empty search text', () => {
    expect(findMatchRange('hello', '')).toBeNull();
    expect(findMatchRange('hello', '   ')).toBeNull();
  });
});

describe('detectParagraphBounds', () => {
  function makePositionedSpans(
    items: Array<{ text: string; top: number; left: number; width: number; height: number }>
  ): HTMLDivElement {
    const container = document.createElement('div');
    items.forEach((item) => {
      const span = document.createElement('span');
      span.textContent = item.text;
      span.getBoundingClientRect = () => ({
        top: item.top,
        left: item.left,
        width: item.width,
        height: item.height,
        bottom: item.top + item.height,
        right: item.left + item.width,
        x: item.left,
        y: item.top,
        toJSON: () => ({}),
      });
      container.appendChild(span);
    });
    return container;
  }

  it('returns bounding box of a single-line paragraph', () => {
    const container = makePositionedSpans([
      { text: 'hello world', top: 100, left: 50, width: 200, height: 16 },
    ]);
    const matchedSpans = new Set([container.querySelectorAll('span')[0]]);
    const bounds = detectParagraphBounds(container, matchedSpans);
    expect(bounds).toEqual({ top: 100, left: 50, width: 200, height: 16 });
  });

  it('expands to include adjacent lines in same paragraph', () => {
    const container = makePositionedSpans([
      { text: 'line 1', top: 100, left: 50, width: 200, height: 16 },
      { text: 'line 2', top: 118, left: 50, width: 180, height: 16 }, // gap=2, same paragraph
      { text: 'line 3', top: 136, left: 50, width: 190, height: 16 }, // gap=2, same paragraph
    ]);
    const matchedSpans = new Set([container.querySelectorAll('span')[1]]);
    const bounds = detectParagraphBounds(container, matchedSpans);
    expect(bounds!.top).toBe(100);
    expect(bounds!.height).toBe(52); // 136 + 16 - 100
  });

  it('stops at paragraph boundary (large gap)', () => {
    const container = makePositionedSpans([
      { text: 'para 1', top: 100, left: 50, width: 200, height: 16 },
      { text: 'para 1 line 2', top: 118, left: 50, width: 200, height: 16 },
      // Large gap = new paragraph
      { text: 'para 2', top: 170, left: 50, width: 200, height: 16 },
      { text: 'para 2 line 2', top: 188, left: 50, width: 200, height: 16 },
    ]);
    const matchedSpans = new Set([container.querySelectorAll('span')[2]]); // para 2
    const bounds = detectParagraphBounds(container, matchedSpans);
    expect(bounds!.top).toBe(170);
    expect(bounds!.height).toBe(34); // 188 + 16 - 170
  });

  it('returns null for empty matchedSpans', () => {
    const container = makePositionedSpans([]);
    const bounds = detectParagraphBounds(container, new Set());
    expect(bounds).toBeNull();
  });
});

describe('applyHighlight', () => {
  function makeSpans(texts: string[]): HTMLDivElement {
    const container = document.createElement('div');
    texts.forEach((t) => {
      const span = document.createElement('span');
      span.textContent = t;
      container.appendChild(span);
    });
    return container;
  }

  function getHighlighted(container: HTMLDivElement): string[] {
    return Array.from(container.querySelectorAll('.highlight-active'))
      .map((el) => el.textContent || '');
  }

  it('highlights entire span when search text is a substring', () => {
    const container = makeSpans(['deep learning model']);
    applyHighlight(container, 'deep learning');
    expect(getHighlighted(container)).toEqual(['deep learning model']);
  });

  it('highlights multiple spans when search text crosses span boundaries', () => {
    const container = makeSpans(['deep ', 'learning ', 'model']);
    applyHighlight(container, 'deep learning model');
    expect(getHighlighted(container)).toEqual(['deep ', 'learning ', 'model']);
  });

  it('handles whitespace differences between search and page text', () => {
    const container = makeSpans(['deep  ', ' learning']);
    applyHighlight(container, 'deep learning');
    expect(getHighlighted(container)).toEqual(['deep  ', ' learning']);
  });

  it('is case-insensitive', () => {
    const container = makeSpans(['Deep Learning']);
    applyHighlight(container, 'deep learning');
    expect(getHighlighted(container)).toEqual(['Deep Learning']);
  });

  it('does not highlight when text is not found', () => {
    const container = makeSpans(['hello world']);
    applyHighlight(container, 'nonexistent');
    expect(getHighlighted(container)).toEqual([]);
  });

  it('clears previous highlights before applying new ones', () => {
    const container = makeSpans(['hello', ' world']);
    applyHighlight(container, 'hello');
    expect(getHighlighted(container)).toEqual(['hello']);

    applyHighlight(container, 'world');
    expect(getHighlighted(container)).toEqual([' world']);
  });

  it('does nothing for empty search text', () => {
    const container = makeSpans(['hello']);
    applyHighlight(container, '');
    expect(getHighlighted(container)).toEqual([]);
  });

  it('does nothing for whitespace-only search text', () => {
    const container = makeSpans(['hello']);
    applyHighlight(container, '   ');
    expect(getHighlighted(container)).toEqual([]);
  });

  it('highlights partial span match (search text within a longer span)', () => {
    const container = makeSpans(['the deep learning model is powerful']);
    applyHighlight(container, 'deep learning model');
    expect(getHighlighted(container)).toEqual(['the deep learning model is powerful']);
  });

  it('falls back to word subsequence when exact match fails', () => {
    // AI reference has extra words not in the PDF
    const container = makeSpans(['novel deep learning ', 'framework for NLP']);
    applyHighlight(container, 'we propose a novel deep learning framework for NLP tasks');
    // Should match the longest word subsequence found: "novel deep learning framework for nlp"
    expect(getHighlighted(container)).toEqual(['novel deep learning ', 'framework for NLP']);
  });

  it('falls back to partial word match when text differs significantly', () => {
    const container = makeSpans(['deep learning ', 'model achieves state']);
    applyHighlight(container, 'the deep learning model achieves excellent results');
    // Should find "deep learning model achieves"
    expect(getHighlighted(container)).toEqual(['deep learning ', 'model achieves state']);
  });
});
