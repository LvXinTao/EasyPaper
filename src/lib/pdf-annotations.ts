import type { Annotation, HighlightColor } from '@/types';
import { buildTextMap, findMatchRange } from './pdf-highlight';

export const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; border: string; solid: string; className: string }> = {
  yellow: { bg: 'rgba(250, 204, 21, 0.4)', border: 'rgba(234, 179, 8, 0.6)', solid: '#facc15', className: 'user-highlight-yellow' },
  green:  { bg: 'rgba(74, 222, 128, 0.4)', border: 'rgba(34, 197, 94, 0.6)', solid: '#4ade80', className: 'user-highlight-green' },
  blue:   { bg: 'rgba(96, 165, 250, 0.4)', border: 'rgba(59, 130, 246, 0.6)', solid: '#60a5fa', className: 'user-highlight-blue' },
  pink:   { bg: 'rgba(244, 114, 182, 0.4)', border: 'rgba(236, 72, 153, 0.6)', solid: '#f472b6', className: 'user-highlight-pink' },
};

const ALL_HIGHLIGHT_CLASSES = [
  'user-highlight',
  ...Object.values(HIGHLIGHT_COLORS).map((c) => c.className),
];

export function getHighlightClass(color: HighlightColor): string {
  return `user-highlight ${HIGHLIGHT_COLORS[color].className}`;
}

export function applyUserHighlights(
  container: HTMLDivElement,
  annotations: Annotation[]
): void {
  const spans = container.querySelectorAll<HTMLElement>('span');
  spans.forEach((span) => {
    ALL_HIGHLIGHT_CLASSES.forEach((cls) => span.classList.remove(cls));
    delete span.dataset.annotationId;
  });

  if (annotations.length === 0) return;

  const { fullText, charMap } = buildTextMap(container);
  if (!fullText) return;

  for (const annotation of annotations) {
    let startIdx = annotation.spanRange.startIdx;
    let endIdx = annotation.spanRange.endIdx;

    const textAtIndices = fullText.slice(startIdx, endIdx + 1);
    if (textAtIndices.toLowerCase().trim() !== annotation.text.toLowerCase().trim()) {
      const range = findMatchRange(fullText, annotation.text);
      if (!range) continue;
      startIdx = range.startIdx;
      endIdx = range.endIdx;
    }

    const colorClass = getHighlightClass(annotation.color);
    for (let i = startIdx; i <= endIdx; i++) {
      if (charMap[i]) {
        const span = charMap[i].span;
        colorClass.split(' ').forEach((cls) => span.classList.add(cls));
        span.dataset.annotationId = annotation.id;
      }
    }
  }
}

export function getSelectionInfo(container: HTMLDivElement): {
  text: string;
  startIdx: number;
  endIdx: number;
  rect: DOMRect;
} | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const { fullText } = buildTextMap(container);
  const matchRange = findMatchRange(fullText, text);
  if (!matchRange) return null;

  const rect = range.getBoundingClientRect();

  return {
    text,
    startIdx: matchRange.startIdx,
    endIdx: matchRange.endIdx,
    rect,
  };
}
