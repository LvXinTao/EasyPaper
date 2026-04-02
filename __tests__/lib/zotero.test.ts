import {
  getZoteroDbPath,
  getCollections,
  getItems,
  getPdfFileSize,
  resolveZoteroPdfPath,
} from '@/lib/zotero';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('zotero', () => {
  describe('getZoteroDbPath', () => {
    it('returns default path when no settings provided', () => {
      const result = getZoteroDbPath({});
      expect(result).toBe(path.join(os.homedir(), 'Zotero', 'zotero.sqlite'));
    });

    it('returns default path when zoteroDataDir is not set', () => {
      const result = getZoteroDbPath({ AI_API_KEY: 'sk-test' });
      expect(result).toBe(path.join(os.homedir(), 'Zotero', 'zotero.sqlite'));
    });

    it('returns custom path from settings', () => {
      const customPath = '/custom/zotero';
      const result = getZoteroDbPath({ zoteroDataDir: customPath });
      expect(result).toBe(path.join(customPath, 'zotero.sqlite'));
    });

    it('expands tilde in custom path', () => {
      const result = getZoteroDbPath({ zoteroDataDir: '~/my-zotero' });
      expect(result).toBe(path.join(os.homedir(), 'my-zotero', 'zotero.sqlite'));
    });
  });

  describe('getCollections', () => {
    it('returns empty collections when DB does not exist', () => {
      const result = getCollections('/nonexistent/path/zotero.sqlite');
      expect(result).toEqual({ collections: [], totalPapers: 0 });
    });

    it('returns collection tree from real Zotero DB', () => {
      // This test only works if user has a real Zotero DB
      const dbPath = path.join(os.homedir(), 'Zotero', 'zotero.sqlite');
      if (!fs.existsSync(dbPath)) {
        console.log('Skipping: No Zotero DB found');
        return;
      }
      const result = getCollections(dbPath);
      expect(result).toHaveProperty('collections');
      expect(result).toHaveProperty('totalPapers');
      expect(Array.isArray(result.collections)).toBe(true);
    });
  });

  describe('getItems', () => {
    it('returns empty items when DB does not exist', () => {
      const result = getItems('/nonexistent/path/zotero.sqlite');
      expect(result).toEqual([]);
    });

    it('returns items from real Zotero DB', () => {
      const dbPath = path.join(os.homedir(), 'Zotero', 'zotero.sqlite');
      if (!fs.existsSync(dbPath)) {
        console.log('Skipping: No Zotero DB found');
        return;
      }
      const result = getItems(dbPath);
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns items filtered by collectionId', () => {
      const dbPath = path.join(os.homedir(), 'Zotero', 'zotero.sqlite');
      if (!fs.existsSync(dbPath)) {
        console.log('Skipping: No Zotero DB found');
        return;
      }
      // Get collections first to find a valid collectionId
      const { collections } = getCollections(dbPath);
      if (collections.length > 0) {
        const collectionId = collections[0].id;
        const result = getItems(dbPath, collectionId);
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe('resolveZoteroPdfPath', () => {
    it('returns correct path for PDF file', () => {
      const zoteroDataDir = '/Users/test/Zotero';
      const attachmentKey = 'ABC123';
      const pdfFilename = 'paper.pdf';
      const result = resolveZoteroPdfPath(zoteroDataDir, attachmentKey, pdfFilename);
      expect(result).toBe(path.join(zoteroDataDir, 'storage', attachmentKey, pdfFilename));
    });

    it('handles filenames with spaces', () => {
      const zoteroDataDir = '/Users/test/Zotero';
      const attachmentKey = 'ABC123';
      const pdfFilename = 'my paper.pdf';
      const result = resolveZoteroPdfPath(zoteroDataDir, attachmentKey, pdfFilename);
      expect(result).toBe(path.join(zoteroDataDir, 'storage', 'ABC123', 'my paper.pdf'));
    });
  });

  describe('getPdfFileSize', () => {
    it('returns 0 when file does not exist', () => {
      const result = getPdfFileSize('/nonexistent', 'ABC123', 'missing.pdf');
      expect(result).toBe(0);
    });

    it('returns correct size for existing PDF', () => {
      // Create a temporary PDF file with proper storage path structure
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zotero-test-'));
      const storageDir = path.join(tempDir, 'storage', 'ABC123');
      fs.mkdirSync(storageDir, { recursive: true });
      const testFile = path.join(storageDir, 'test.pdf');
      fs.writeFileSync(testFile, Buffer.alloc(1024)); // 1KB file

      const result = getPdfFileSize(tempDir, 'ABC123', 'test.pdf');
      expect(result).toBe(1024);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });
});