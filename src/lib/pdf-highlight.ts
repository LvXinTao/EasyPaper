/**
 * Result of normalizing text for highlight matching.
 * indexMap[i] = position of normalized char i in the original string.
 */
export interface NormalizeResult {
  normalized: string;
  indexMap: number[];
}

/**
 * Normalize text for comparison: lowercase, collapse whitespace, trim.
 * Input MUST already be NFC-normalized (buildTextMap handles this).
 * Returns a mapping from each normalized char index to its position in the input.
 */
export function normalizeText(text: string): NormalizeResult {
  const normalized: string[] = [];
  const indexMap: number[] = [];
  let prevWasSpace = true; // true to trim leading whitespace

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!prevWasSpace) {
        normalized.push(' ');
        indexMap.push(i);
        prevWasSpace = true;
      }
    } else {
      normalized.push(ch.toLowerCase());
      indexMap.push(i);
      prevWasSpace = false;
    }
  }

  // Trim trailing space
  if (normalized.length > 0 && normalized[normalized.length - 1] === ' ') {
    normalized.pop();
    indexMap.pop();
  }

  return { normalized: normalized.join(''), indexMap };
}

/**
 * A character in the full page text mapped back to its source span.
 */
export interface CharMapping {
  span: HTMLElement;
  offsetInSpan: number;
}

/**
 * Build a full-text string from all spans in the container,
 * with a character-to-span mapping for traceback.
 * Text is NFC-normalized so indices align with normalizeText output.
 */
export function buildTextMap(container: HTMLDivElement): { fullText: string; charMap: CharMapping[] } {
  const spans = container.querySelectorAll<HTMLElement>('span');
  const chars: string[] = [];
  const charMap: CharMapping[] = [];

  spans.forEach((span) => {
    const text = (span.textContent || '').normalize('NFC');
    for (let i = 0; i < text.length; i++) {
      chars.push(text[i]);
      charMap.push({ span, offsetInSpan: i });
    }
  });

  return { fullText: chars.join(''), charMap };
}

/**
 * Result of finding a match range in page text.
 * Indices refer to the raw (unnormalized) fullText from buildTextMap.
 * Both startIdx and endIdx are inclusive (endIdx = index of last matched char).
 */
export interface MatchRange {
  startIdx: number;
  endIdx: number;
}

/**
 * Find search text within page text using normalized matching.
 * Uses progressive fallback: exact match → longest word subsequence.
 * Returns indices into the raw (unnormalized) pageText, or null if not found.
 */
export function findMatchRange(pageText: string, searchText: string): MatchRange | null {
  if (!searchText || !searchText.trim()) return null;
  if (!pageText) return null;

  const pageNorm = normalizeText(pageText);
  const searchNorm = normalizeText(searchText.normalize('NFC'));

  if (!searchNorm.normalized) return null;

  let matchIndex = pageNorm.normalized.indexOf(searchNorm.normalized);
  let matchLength = searchNorm.normalized.length;

  if (matchIndex === -1) {
    const searchWords = searchNorm.normalized.split(' ').filter(w => w.length > 2);
    const minWords = Math.max(2, Math.ceil(searchWords.length * 0.4));

    for (let len = searchWords.length; len >= minWords; len--) {
      let found = false;
      for (let start = 0; start <= searchWords.length - len; start++) {
        const subSearch = searchWords.slice(start, start + len).join(' ');
        matchIndex = pageNorm.normalized.indexOf(subSearch);
        if (matchIndex !== -1) {
          matchLength = subSearch.length;
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  if (matchIndex === -1) return null;

  const startIdx = pageNorm.indexMap[matchIndex];
  const endIdx = pageNorm.indexMap[matchIndex + matchLength - 1];

  return { startIdx, endIdx };
}

/**
 * Find search text within page text using normalized matching.
 * Uses progressive fallback: exact match → longest word subsequence.
 * Returns true if any spans were highlighted.
 */
export function applyHighlight(container: HTMLDivElement, text: string): boolean {
  container.querySelectorAll('.highlight-active').forEach((el) => {
    el.classList.remove('highlight-active');
  });

  if (!text || !text.trim()) return false;

  const { fullText, charMap } = buildTextMap(container);
  if (!fullText) return false;

  const range = findMatchRange(fullText, text);
  if (!range) return false;

  const matchedSpans = new Set<HTMLElement>();
  for (let i = range.startIdx; i <= range.endIdx; i++) {
    if (charMap[i]) {
      matchedSpans.add(charMap[i].span);
    }
  }

  matchedSpans.forEach((span) => {
    span.classList.add('highlight-active');
  });

  if (matchedSpans.size > 0) {
    const first = container.querySelector('.highlight-active');
    first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  return matchedSpans.size > 0;
}
