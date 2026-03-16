import { storage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('storage - updateMetadata', () => {
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

  it('merges updates into existing metadata', async () => {
    await storage.createPaperDir('paper-1');
    await storage.saveMetadata('paper-1', {
      id: 'paper-1', title: 'Original', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'pending',
    });
    const result = await storage.updateMetadata('paper-1', { title: 'Renamed' });
    expect(result.title).toBe('Renamed');
    expect(result.filename).toBe('test.pdf');
    const persisted = await storage.getMetadata('paper-1');
    expect(persisted.title).toBe('Renamed');
  });

  it('ignores id field in updates', async () => {
    await storage.createPaperDir('paper-2');
    await storage.saveMetadata('paper-2', {
      id: 'paper-2', title: 'Test', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'pending',
    });
    const result = await storage.updateMetadata('paper-2', { id: 'hacked' } as Partial<import('@/types').PaperMetadata>);
    expect(result.id).toBe('paper-2');
  });

  it('can set folderId on a paper', async () => {
    await storage.createPaperDir('paper-3');
    await storage.saveMetadata('paper-3', {
      id: 'paper-3', title: 'Test', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'pending',
    });
    const result = await storage.updateMetadata('paper-3', { folderId: 'f_abc123' });
    expect(result.folderId).toBe('f_abc123');
  });
});

describe('storage - listPapers with folderId', () => {
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

  it('includes folderId in listed papers', async () => {
    await storage.createPaperDir('paper-f');
    await storage.saveMetadata('paper-f', {
      id: 'paper-f', title: 'Foldered', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'analyzed', folderId: 'f_abc',
    });
    const papers = await storage.listPapers();
    expect(papers[0].folderId).toBe('f_abc');
  });

  it('returns null folderId for papers without one', async () => {
    await storage.createPaperDir('paper-nf');
    await storage.saveMetadata('paper-nf', {
      id: 'paper-nf', title: 'No Folder', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11T10:00:00Z', status: 'pending',
    });
    const papers = await storage.listPapers();
    expect(papers[0].folderId).toBeNull();
  });
});

describe('storage - folders', () => {
  let testDir: string;
  let originalConfigDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'easypaper-test-'));
    originalConfigDir = process.env.CONFIG_DIR || '';
    process.env.CONFIG_DIR = testDir;
  });

  afterEach(async () => {
    process.env.CONFIG_DIR = originalConfigDir;
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('returns empty array when no folders.json exists', async () => {
    const folders = await storage.getFolders();
    expect(folders).toEqual([]);
  });

  it('round-trips folders through JSON', async () => {
    const folders = [
      { id: 'f_1', name: 'NLP', parentId: null },
      { id: 'f_2', name: 'Transformer', parentId: 'f_1' },
    ];
    await storage.saveFolders(folders);
    const loaded = await storage.getFolders();
    expect(loaded).toEqual(folders);
  });

  it('overwrites existing folders', async () => {
    await storage.saveFolders([{ id: 'f_1', name: 'Old', parentId: null }]);
    await storage.saveFolders([{ id: 'f_2', name: 'New', parentId: null }]);
    const loaded = await storage.getFolders();
    expect(loaded).toEqual([{ id: 'f_2', name: 'New', parentId: null }]);
  });
});
