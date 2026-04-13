import fs from 'fs/promises';
import type { MetadataSource, PdfMetadata } from '@/types';

/** Result of metadata extraction — includes page count for upload route convenience */
export interface PdfMetadataResult extends PdfMetadata {
  pageCount: number;
}

// Dynamic import to avoid Turbopack rewriting the ESM+WASM package name
async function loadMupdf() {
  return await import('mupdf');
}

/**
 * Split an author string into an array of individual authors.
 * Strategy: semicolons → "and"/"&" → comma (if not "Last, First") → single.
 */
export function splitAuthors(authorStr: string): string[] {
  const trimmed = authorStr.trim();
  if (!trimmed) return [];

  // Try semicolons first
  if (trimmed.includes(';')) {
    return trimmed.split(';').map(a => a.trim()).filter(Boolean);
  }

  // Try "and" / "&" (case-insensitive)
  const andMatch = trimmed.split(/\s+and\s+/i);
  if (andMatch.length > 1) {
    return andMatch.map(a => a.trim()).filter(Boolean);
  }
  const ampMatch = trimmed.split(/\s*&\s*/);
  if (ampMatch.length > 1) {
    return ampMatch.map(a => a.trim()).filter(Boolean);
  }

  // Try commas, but only if it doesn't look like "Last, First" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    // "Last, First" pattern: exactly 2 parts, second part is short (first name)
    if (parts.length === 2 && parts[1].trim().split(/\s+/).length <= 2) {
      return [trimmed]; // "Last, First" — keep as-is
    }
    return parts.map(a => a.trim()).filter(Boolean);
  }

  // Single author
  return [trimmed];
}

/**
 * Parse a PDF date string (D:YYYYMMDDHHmmSS format) to ISO 8601.
 */
export function parsePdfDate(pdfDate: string): string | undefined {
  if (!pdfDate) return undefined;

  // Remove D: prefix
  const raw = pdfDate.replace(/^D:/, '');

  // Minimum YYYY (4 digits)
  if (raw.length < 4) return undefined;

  const year = raw.slice(0, 4);
  if (raw.length >= 6) {
    const month = raw.slice(4, 6);
    if (raw.length >= 8) {
      const day = raw.slice(6, 8);
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}`;
  }
  return year;
}

/**
 * Extract metadata from a PDF file using mupdf.
 * Two layers: (1) PDF document properties, (2) first-page text extraction.
 */
export async function extractPdfMetadata(pdfPath: string): Promise<PdfMetadataResult> {
  const mupdf = await loadMupdf();
  const fileBuffer = await fs.readFile(pdfPath);
  const doc = mupdf.Document.openDocument(fileBuffer, 'application/pdf');
  const pageCount = doc.countPages();

  const extractedAt = new Date().toISOString();

  const metadata: Partial<PdfMetadata> = {};
  const fieldSources: Record<string, MetadataSource> = {};

  // Layer 1: PDF Document Properties
  // mupdf uses getMetaData(key) with keys like 'info:Title', 'info:Author', etc.
  const title = doc.getMetaData('info:Title')?.trim();
  const author = doc.getMetaData('info:Author')?.trim();
  const subject = doc.getMetaData('info:Subject')?.trim();
  const keywords = doc.getMetaData('info:Keywords')?.trim();
  const creationDate = doc.getMetaData('info:CreationDate')?.trim();
  const creator = doc.getMetaData('info:Creator')?.trim();
  const producer = doc.getMetaData('info:Producer')?.trim();

  if (title) {
    metadata.title = title;
    fieldSources.title = 'pdf-properties';
  }
  if (author) {
    metadata.authors = splitAuthors(author);
    fieldSources.authors = 'pdf-properties';
  }
  if (subject) {
    metadata.subject = subject;
    fieldSources.subject = 'pdf-properties';
  }
  if (keywords) {
    metadata.keywords = keywords.split(/[,;]/).map(k => k.trim()).filter(Boolean);
    fieldSources.keywords = 'pdf-properties';
  }
  if (creationDate) {
    const parsedDate = parsePdfDate(creationDate);
    if (parsedDate) {
      metadata.date = parsedDate;
      fieldSources.date = 'pdf-properties';
    }
  }
  if (creator) {
    metadata.creator = creator;
    fieldSources.creator = 'pdf-properties';
  }
  if (producer) {
    metadata.producer = producer;
    fieldSources.producer = 'pdf-properties';
  }

  // Layer 2: First-page text extraction (only for fields missing from Layer 1)
  const needsTextExtraction = !metadata.title || !metadata.authors || !metadata.date;
  if (needsTextExtraction && pageCount > 0) {
    try {
      const page = doc.loadPage(0);
      const stext = page.toStructuredText();

      // Collect characters with font sizes using walker
      interface CharInfo { text: string; size: number; x: number; y: number }
      const chars: CharInfo[] = [];
      stext.walk({
        onChar(c: string, _origin: number[], _font: unknown, size: number, _quad: unknown, _color: unknown) {
          if (c.trim()) {
            chars.push({ text: c, size, x: _origin[0], y: _origin[1] });
          }
        },
      });

      // Group chars into lines by Y coordinate (within 2px tolerance)
      const lineMap = new Map<number, CharInfo[]>();
      for (const ch of chars) {
        const lineKey = Math.round(ch.y / 2) * 2;
        if (!lineMap.has(lineKey)) lineMap.set(lineKey, []);
        lineMap.get(lineKey)!.push(ch);
      }

      // Sort lines by Y (top first) and find largest font-size line
      const sortedLines = [...lineMap.entries()].sort((a, b) => a[0] - b[0]);
      const lines = sortedLines.map(([, lineChars]) => {
        const avgSize = lineChars.reduce((sum, c) => sum + c.size, 0) / lineChars.length;
        const text = lineChars.sort((a, b) => a.x - b.x).map(c => c.text).join('').trim();
        return { text, avgSize };
      });

      const largestLine = lines.reduce((best, line) =>
        line.avgSize > best.avgSize ? line : best, { text: '', avgSize: 0 });

      // Use largest-font line as title if not found in properties
      if (!metadata.title && largestLine.text.length > 5) {
        metadata.title = largestLine.text;
        fieldSources.title = 'text-extraction';
      }
    } catch (err) {
      console.warn('[pdf-metadata] Layer 2 text extraction failed:', err instanceof Error ? err.message : err);
    }
  }

  return {
    title: metadata.title,
    authors: metadata.authors,
    date: metadata.date,
    subject: metadata.subject,
    keywords: metadata.keywords,
    creator: metadata.creator,
    producer: metadata.producer,
    fieldSources,
    extractedAt,
    pageCount,
  };
}
