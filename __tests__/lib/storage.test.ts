import { storage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('storage', () => {
  let testDir: string;
  let originalDataDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'easypaper-test-'));
    originalDataDir = process.env.DATA_DIR || '';
    process.env.DATA_DIR = testDir;
  });

  afterEach(async () => {
    process.env.DATA_DIR = originalDataDir;
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('createPaperDir', () => {
    it('creates the paper directory structure', async () => {
      const paperId = 'test-123';
      await storage.createPaperDir(paperId);
      const dirPath = path.join(testDir, 'papers', paperId);
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
      const imagesStat = await fs.stat(path.join(dirPath, 'images'));
      expect(imagesStat.isDirectory()).toBe(true);
    });
  });

  describe('saveMetadata / getMetadata', () => {
    it('round-trips metadata through JSON', async () => {
      const paperId = 'test-456';
      await storage.createPaperDir(paperId);
      const metadata = {
        id: paperId, title: 'Test Paper', filename: 'test.pdf',
        pages: 10, createdAt: '2025-03-11T10:00:00Z', status: 'pending' as const,
      };
      await storage.saveMetadata(paperId, metadata);
      const loaded = await storage.getMetadata(paperId);
      expect(loaded).toEqual(metadata);
    });
  });

  describe('savePdf / getPdfPath', () => {
    it('saves PDF buffer and returns correct path', async () => {
      const paperId = 'test-789';
      await storage.createPaperDir(paperId);
      const pdfBuffer = Buffer.from('fake pdf content');
      await storage.savePdf(paperId, pdfBuffer);
      const pdfPath = storage.getPdfPath(paperId);
      const content = await fs.readFile(pdfPath);
      expect(content).toEqual(pdfBuffer);
    });
  });

  describe('saveParsedContent / getParsedContent', () => {
    it('saves and retrieves markdown content', async () => {
      const paperId = 'test-md';
      await storage.createPaperDir(paperId);
      await storage.saveParsedContent(paperId, '# Title\n\nContent');
      const content = await storage.getParsedContent(paperId);
      expect(content).toBe('# Title\n\nContent');
    });
  });

  describe('saveAnalysis / getAnalysis', () => {
    it('round-trips analysis JSON', async () => {
      const paperId = 'test-analysis';
      await storage.createPaperDir(paperId);
      const analysis = {
        summary: { content: 'test' },
        contributions: { items: ['a'] },
        methodology: { content: 'test' },
        experiments: { content: 'test' },
        conclusions: { content: 'test' },
        generatedAt: '2025-03-11T10:05:00Z',
      };
      await storage.saveAnalysis(paperId, analysis);
      const loaded = await storage.getAnalysis(paperId);
      expect(loaded).toEqual(analysis);
    });
  });

  describe('saveChatHistory / getChatHistory', () => {
    it('round-trips chat history', async () => {
      const paperId = 'test-chat';
      await storage.createPaperDir(paperId);
      const history = { messages: [{ role: 'user' as const, content: 'hello' }] };
      await storage.saveChatHistory(paperId, history);
      const loaded = await storage.getChatHistory(paperId);
      expect(loaded).toEqual(history);
    });
    it('returns empty messages when no history exists', async () => {
      const paperId = 'test-empty';
      await storage.createPaperDir(paperId);
      const history = await storage.getChatHistory(paperId);
      expect(history).toEqual({ messages: [] });
    });
  });

  describe('listPapers', () => {
    it('lists all papers with metadata', async () => {
      await storage.createPaperDir('paper-1');
      await storage.saveMetadata('paper-1', { id: 'paper-1', title: 'Paper 1', filename: 'p1.pdf', pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'analyzed' });
      await storage.createPaperDir('paper-2');
      await storage.saveMetadata('paper-2', { id: 'paper-2', title: 'Paper 2', filename: 'p2.pdf', pages: 8, createdAt: '2025-03-11T11:00:00Z', status: 'pending' });
      const papers = await storage.listPapers();
      expect(papers).toHaveLength(2);
      expect(papers.map(p => p.id).sort()).toEqual(['paper-1', 'paper-2']);
    });
    it('returns empty array when no papers exist', async () => {
      const papers = await storage.listPapers();
      expect(papers).toEqual([]);
    });
  });

  describe('deletePaper', () => {
    it('removes the paper directory', async () => {
      await storage.createPaperDir('to-delete');
      await storage.saveMetadata('to-delete', { id: 'to-delete', title: 'Delete Me', filename: 'd.pdf', pages: 1, createdAt: '2025-03-11T10:00:00Z', status: 'pending' });
      await storage.deletePaper('to-delete');
      const papers = await storage.listPapers();
      expect(papers).toEqual([]);
    });
  });
});
