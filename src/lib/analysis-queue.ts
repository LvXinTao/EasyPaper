import { storage } from '@/lib/storage';
import { getAIConfig } from '@/lib/ai-config';
import { runAnalysisCore } from '@/lib/analysis-runner';

interface QueueState {
  activeCount: number;
  activePaperIds: Set<string>;
  maxConcurrent: number;
  initPromise: Promise<void> | null;
  lock: Promise<void>;
}

const state: QueueState = {
  activeCount: 0,
  activePaperIds: new Set(),
  maxConcurrent: 3,
  initPromise: null,
  lock: Promise.resolve(),
};

export const analysisQueue = {
  async init(): Promise<void> {
    if (state.initPromise) return state.initPromise;
    state.initPromise = doInit();
    return state.initPromise;
  },

  async tryAcquire(paperId: string): Promise<boolean> {
    // Chain new lock BEFORE awaiting to ensure mutual exclusion
    const oldLock = state.lock;
    let resolveLock: () => void;
    state.lock = oldLock.then(() => new Promise<void>((resolve) => { resolveLock = resolve; }));

    await oldLock;
    try {
      if (state.activeCount < state.maxConcurrent) {
        state.activeCount++;
        state.activePaperIds.add(paperId);
        return true;
      }
      return false;
    } finally {
      resolveLock!();
    }
  },

  async release(paperId: string): Promise<void> {
    state.activePaperIds.delete(paperId);
    state.activeCount--;

    // Check for queued papers and trigger the next one
    const queuedPapers = await this.getQueuedPapers();
    for (const next of queuedPapers) {
      // Verify paper still exists
      const exists = await storage.paperExists(next.id);
      if (!exists) continue; // Skip deleted, continue to next

      // Acquire slot for the queued paper
      const acquired = await this.tryAcquire(next.id);
      if (!acquired) {
        console.warn(`[queue] Failed to acquire slot for queued paper ${next.id}`);
        return;
      }

      // Update metadata: set to 'analyzing' since queued papers may have cached content
      // and won't trigger 'parsing' status update
      await storage.updateMetadata(next.id, {
        status: 'analyzing',
        analysisProgress: {
          step: 'analyzing',
          message: 'Starting analysis...',
          updatedAt: new Date().toISOString(),
        },
      });

      // Start analysis in background (don't await)
      const config = await getAIConfig();
      runAnalysisCore(next.id, config, undefined, () => this.release(next.id)).catch(console.error);
      return; // Started one paper, done
    }
  },

  async getQueuedPapers(): Promise<{ id: string; queuedAt: string }[]> {
    const papers = await storage.listPapers();
    const queued: { id: string; queuedAt: string }[] = [];
    for (const paper of papers) {
      const meta = await storage.getMetadata(paper.id);
      if (meta?.status === 'queued' && meta.analysisProgress?.step === 'queued') {
        queued.push({ id: paper.id, queuedAt: meta.analysisProgress.updatedAt });
      }
    }
    return queued.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
  },

  async getStatus(): Promise<{ active: number; max: number; queued: number }> {
    const queuedPapers = await this.getQueuedPapers();
    return {
      active: state.activeCount,
      max: state.maxConcurrent,
      queued: queuedPapers.length,
    };
  },

  async cancelQueued(paperId: string): Promise<boolean> {
    const meta = await storage.getMetadata(paperId);
    if (meta?.status !== 'queued') return false;
    await storage.updateMetadata(paperId, { status: 'pending', analysisProgress: undefined });
    return true;
  },
};

async function doInit(): Promise<void> {
  const settings = await storage.getSettings();
  state.maxConcurrent = (settings?.maxConcurrent as number) || 3;

  const papers = await storage.listPapers();
  const staleThresholdMs = ((settings?.staleThresholdMinutes as number) || 10) * 60 * 1000;

  for (const paper of papers) {
    const meta = await storage.getMetadata(paper.id);
    if (meta?.status === 'parsing' || meta?.status === 'analyzing') {
      const updatedAt = new Date(meta.analysisProgress?.updatedAt || 0).getTime();
      const ageMs = Date.now() - updatedAt;

      if (ageMs > staleThresholdMs) {
        await storage.updateMetadata(paper.id, { status: 'pending' });
      } else {
        state.activePaperIds.add(paper.id);
        state.activeCount++;
      }
    }
  }
}