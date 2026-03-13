import fs from 'fs/promises';
import path from 'path';
import type { PaperMetadata, PaperAnalysis, ChatHistory, PaperListItem, Annotation, AnnotationsFile } from '@/types';

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

function getConfigDir(): string {
  return process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
}

function paperDir(paperId: string): string {
  return path.join(getDataDir(), 'papers', paperId);
}

export const storage = {
  async createPaperDir(paperId: string): Promise<void> {
    const dir = paperDir(paperId);
    await fs.mkdir(path.join(dir, 'images'), { recursive: true });
  },
  async saveMetadata(paperId: string, metadata: PaperMetadata): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'metadata.json');
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
  },
  async getMetadata(paperId: string): Promise<PaperMetadata> {
    const filePath = path.join(paperDir(paperId), 'metadata.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  },
  async savePdf(paperId: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'original.pdf');
    await fs.writeFile(filePath, buffer);
  },
  getPdfPath(paperId: string): string {
    return path.join(paperDir(paperId), 'original.pdf');
  },
  async saveParsedContent(paperId: string, markdown: string): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'parsed.md');
    await fs.writeFile(filePath, markdown);
  },
  async getParsedContent(paperId: string): Promise<string | null> {
    try {
      const filePath = path.join(paperDir(paperId), 'parsed.md');
      return await fs.readFile(filePath, 'utf-8');
    } catch { return null; }
  },
  async saveAnalysis(paperId: string, analysis: PaperAnalysis): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'analysis.json');
    await fs.writeFile(filePath, JSON.stringify(analysis, null, 2));
  },
  async getAnalysis(paperId: string): Promise<PaperAnalysis | null> {
    try {
      const filePath = path.join(paperDir(paperId), 'analysis.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return null; }
  },
  async saveChatHistory(paperId: string, history: ChatHistory): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'chat-history.json');
    await fs.writeFile(filePath, JSON.stringify(history, null, 2));
  },
  async getChatHistory(paperId: string): Promise<ChatHistory> {
    try {
      const filePath = path.join(paperDir(paperId), 'chat-history.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return { messages: [] }; }
  },
  async listPapers(): Promise<PaperListItem[]> {
    const papersDir = path.join(getDataDir(), 'papers');
    try {
      const dirs = await fs.readdir(papersDir);
      const papers: PaperListItem[] = [];
      for (const dir of dirs) {
        try {
          const metadata = await this.getMetadata(dir);
          papers.push({ id: metadata.id, title: metadata.title, createdAt: metadata.createdAt, status: metadata.status });
        } catch { /* Skip directories without valid metadata */ }
      }
      return papers;
    } catch { return []; }
  },
  async deletePaper(paperId: string): Promise<void> {
    const dir = paperDir(paperId);
    await fs.rm(dir, { recursive: true, force: true });
  },
  async paperExists(paperId: string): Promise<boolean> {
    try { await fs.stat(paperDir(paperId)); return true; } catch { return false; }
  },
  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    const configDir = getConfigDir();
    await fs.mkdir(configDir, { recursive: true });
    const filePath = path.join(configDir, 'settings.json');
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2));
  },
  async getSettings(): Promise<Record<string, unknown> | null> {
    try {
      const filePath = path.join(getConfigDir(), 'settings.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return null; }
  },
  async getAnnotations(paperId: string): Promise<Annotation[]> {
    try {
      const filePath = path.join(paperDir(paperId), 'annotations.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed: AnnotationsFile = JSON.parse(data);
      return parsed.annotations || [];
    } catch {
      return [];
    }
  },
  async saveAnnotations(paperId: string, annotations: Annotation[]): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'annotations.json');
    const data: AnnotationsFile = { annotations };
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  },
};
