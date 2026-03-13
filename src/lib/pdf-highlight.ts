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
