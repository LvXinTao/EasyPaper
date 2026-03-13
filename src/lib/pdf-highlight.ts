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
