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
    // Skip wrapper spans (e.g. pdfjs markedContent containers) that contain
    // child spans — their textContent includes all descendants' text, which
    // would double-count characters and corrupt charMap indices.
    if (span.querySelector('span')) return;

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
 * Bounding box for a paragraph highlight overlay.
 */
export interface ParagraphBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Detect the paragraph boundary around a set of matched spans.
 * Groups all spans into lines by Y coordinate, then expands from matched lines
 * until the gap between consecutive lines exceeds lineHeight × 2.
 * Returns coordinates relative to the container's coordinate system.
 */
export function detectParagraphBounds(
  container: HTMLDivElement,
  matchedSpans: Set<HTMLElement>
): ParagraphBounds | null {
  if (matchedSpans.size === 0) return null;

  const allSpans = Array.from(container.querySelectorAll<HTMLElement>('span'))
    .filter((span) => !span.querySelector('span')); // skip wrapper/markedContent spans
  if (allSpans.length === 0) return null;

  // Get bounding rects for all spans
  const spanRects = allSpans.map((span) => ({
    span,
    rect: span.getBoundingClientRect(),
  }));

  // Group spans into lines by Y coordinate (tolerance ±3px)
  const lines: Array<{ y: number; height: number; spans: typeof spanRects }> = [];
  const yTolerance = 3;

  for (const sr of spanRects) {
    const existing = lines.find((line) => Math.abs(line.y - sr.rect.top) <= yTolerance);
    if (existing) {
      existing.spans.push(sr);
      existing.height = Math.max(existing.height, sr.rect.height);
    } else {
      lines.push({ y: sr.rect.top, height: sr.rect.height, spans: [sr] });
    }
  }

  // Sort lines by Y position
  lines.sort((a, b) => a.y - b.y);

  // Find which lines contain matched spans
  const matchedLineIndices = new Set<number>();
  lines.forEach((line, idx) => {
    if (line.spans.some((sr) => matchedSpans.has(sr.span))) {
      matchedLineIndices.add(idx);
    }
  });

  if (matchedLineIndices.size === 0) return null;

  // Determine typical line height
  const avgLineHeight =
    lines.reduce((sum, line) => sum + line.height, 0) / lines.length;
  const maxGap = avgLineHeight * 2;

  // Expand upward from first matched line
  let startLine = Math.min(...matchedLineIndices);
  while (startLine > 0) {
    const gap = lines[startLine].y - (lines[startLine - 1].y + lines[startLine - 1].height);
    if (gap > maxGap) break;
    startLine--;
  }

  // Expand downward from last matched line
  let endLine = Math.max(...matchedLineIndices);
  while (endLine < lines.length - 1) {
    const gap = lines[endLine + 1].y - (lines[endLine].y + lines[endLine].height);
    if (gap > maxGap) break;
    endLine++;
  }

  // Compute bounding box of paragraph
  const paragraphLines = lines.slice(startLine, endLine + 1);
  const allRects = paragraphLines.flatMap((line) => line.spans.map((sr) => sr.rect));

  const containerRect = container.getBoundingClientRect();
  const top = Math.min(...allRects.map((r) => r.top)) - containerRect.top;
  const left = Math.min(...allRects.map((r) => r.left)) - containerRect.left;
  const right = Math.max(...allRects.map((r) => r.right)) - containerRect.left;
  const bottom = Math.max(...allRects.map((r) => r.bottom)) - containerRect.top;

  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Find search text, detect its enclosing paragraph, and return the paragraph bounds.
 * Clears any previous paragraph highlight overlays.
 * Returns the ParagraphBounds if found, or null.
 */
export function applyParagraphHighlight(
  container: HTMLDivElement,
  text: string
): ParagraphBounds | null {
  // Clear previous paragraph highlights
  const overlay = container.querySelector('.highlight-overlay');
  if (overlay) {
    overlay.innerHTML = '';
  }

  // Also clear old per-span highlights (backwards compat during migration)
  container.querySelectorAll('.highlight-active').forEach((el) => {
    el.classList.remove('highlight-active');
  });

  if (!text || !text.trim()) return null;

  const { fullText, charMap } = buildTextMap(container);
  if (!fullText) return null;

  const range = findMatchRange(fullText, text);
  if (!range) return null;

  // Collect matched spans
  const matchedSpans = new Set<HTMLElement>();
  for (let i = range.startIdx; i <= range.endIdx; i++) {
    if (charMap[i]) {
      matchedSpans.add(charMap[i].span);
    }
  }

  if (matchedSpans.size === 0) return null;

  // Detect paragraph boundary
  const bounds = detectParagraphBounds(container, matchedSpans);
  if (!bounds) return null;

  // Render highlight rectangle in overlay
  if (overlay) {
    const box = document.createElement('div');
    box.className = 'paragraph-highlight-box';
    box.style.position = 'absolute';
    box.style.top = `${bounds.top - 6}px`;
    box.style.left = `${bounds.left - 6}px`;
    box.style.width = `${bounds.width + 12}px`;
    box.style.height = `${bounds.height + 12}px`;
    overlay.appendChild(box);

    // Scroll into view
    box.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  return bounds;
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
