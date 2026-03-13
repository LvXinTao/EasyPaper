/**
 * @jest-environment jsdom
 */
import { HIGHLIGHT_COLORS, getHighlightClass, applyUserHighlights } from '@/lib/pdf-annotations';

describe('HIGHLIGHT_COLORS', () => {
  it('contains four color definitions', () => {
    expect(Object.keys(HIGHLIGHT_COLORS)).toEqual(['yellow', 'green', 'blue', 'pink']);
  });

  it('each color has bg, border, solid, and className', () => {
    for (const color of Object.values(HIGHLIGHT_COLORS)) {
      expect(color.bg).toBeDefined();
      expect(color.border).toBeDefined();
      expect(color.solid).toBeDefined();
      expect(color.className).toBeDefined();
    }
  });
});

describe('getHighlightClass', () => {
  it('returns correct class for each color', () => {
    expect(getHighlightClass('yellow')).toBe('user-highlight user-highlight-yellow');
    expect(getHighlightClass('green')).toBe('user-highlight user-highlight-green');
    expect(getHighlightClass('blue')).toBe('user-highlight user-highlight-blue');
    expect(getHighlightClass('pink')).toBe('user-highlight user-highlight-pink');
  });
});

describe('applyUserHighlights', () => {
  function makeSpans(texts: string[]): HTMLDivElement {
    const container = document.createElement('div');
    texts.forEach((t) => {
      const span = document.createElement('span');
      span.textContent = t;
      container.appendChild(span);
    });
    return container;
  }

  it('applies highlight class to matching spans', () => {
    const container = makeSpans(['hello ', 'world ', 'foo']);
    const annotations = [
      {
        id: '1', page: 1, text: 'hello world',
        color: 'yellow' as const, comment: '',
        spanRange: { startIdx: 0, endIdx: 10 },
        createdAt: '', updatedAt: '',
      },
    ];

    applyUserHighlights(container, annotations);
    const highlighted = container.querySelectorAll('.user-highlight-yellow');
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it('clears previous user highlights before applying', () => {
    const container = makeSpans(['hello']);
    const span = container.querySelector('span')!;
    span.classList.add('user-highlight', 'user-highlight-green');

    applyUserHighlights(container, []);
    expect(span.classList.contains('user-highlight')).toBe(false);
    expect(span.classList.contains('user-highlight-green')).toBe(false);
  });

  it('handles multiple annotations on same page', () => {
    const container = makeSpans(['aaa ', 'bbb ', 'ccc']);
    const annotations = [
      { id: '1', page: 1, text: 'aaa', color: 'yellow' as const, comment: '', spanRange: { startIdx: 0, endIdx: 2 }, createdAt: '', updatedAt: '' },
      { id: '2', page: 1, text: 'ccc', color: 'blue' as const, comment: '', spanRange: { startIdx: 8, endIdx: 10 }, createdAt: '', updatedAt: '' },
    ];

    applyUserHighlights(container, annotations);
    expect(container.querySelectorAll('.user-highlight-yellow').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.user-highlight-blue').length).toBeGreaterThan(0);
  });
});
