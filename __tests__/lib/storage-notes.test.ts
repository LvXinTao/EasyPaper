import { storage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Note } from '@/types';

describe('storage notes', () => {
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

  describe('getNotes', () => {
    it('returns empty array when no notes file exists', async () => {
      await storage.createPaperDir('test-no-notes');
      const notes = await storage.getNotes('test-no-notes');
      expect(notes).toEqual([]);
    });
  });

  describe('saveNotes / getNotes', () => {
    it('round-trips notes through JSON', async () => {
      const paperId = 'test-notes';
      await storage.createPaperDir(paperId);
      const notes: Note[] = [
        {
          id: 'note-1',
          title: 'Test Note',
          content: '# Hello\n\nWorld',
          tags: ['important', 'summary'],
          page: 3,
          createdAt: '2026-03-16T10:00:00Z',
          updatedAt: '2026-03-16T10:00:00Z',
        },
      ];
      await storage.saveNotes(paperId, notes);
      const loaded = await storage.getNotes(paperId);
      expect(loaded).toEqual(notes);
    });

    it('overwrites existing notes', async () => {
      const paperId = 'test-overwrite';
      await storage.createPaperDir(paperId);
      const first: Note[] = [{ id: '1', title: 'A', content: '', tags: [], createdAt: '', updatedAt: '' }];
      const second: Note[] = [{ id: '2', title: 'B', content: '', tags: ['idea'], createdAt: '', updatedAt: '' }];
      await storage.saveNotes(paperId, first);
      await storage.saveNotes(paperId, second);
      const loaded = await storage.getNotes(paperId);
      expect(loaded).toEqual(second);
    });
  });
});
