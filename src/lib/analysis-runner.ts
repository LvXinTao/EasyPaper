import { storage } from '@/lib/storage';
import { parsePdfWithVision } from '@/lib/pdf-parser';
import { createAIClient } from '@/lib/ai-client';
import { ANALYSIS_PROMPT } from '@/lib/prompts';
import type { PaperAnalysis } from '@/types';

type AIConfig = Awaited<ReturnType<typeof import('@/lib/ai-config').getAIConfig>>;
type SendFn = (data: Record<string, unknown>) => void;

export async function runAnalysisCore(
  paperId: string,
  config: AIConfig,
  onProgress?: SendFn,
  onComplete?: () => Promise<void>
): Promise<void> {
  const send: SendFn = onProgress || (() => {});
  const { apiKey, baseUrl, model, visionModel } = config;

  try {
    const promptSettings = await storage.getPromptSettings();

    // Step 1: Parse PDF
    let markdown = await storage.getParsedContent(paperId);
    if (markdown) {
      console.log(`[analyze] Paper ${paperId}: Using cached parsed content`);
      send({ step: 'parsing', message: 'Using cached parsed content...' });
    } else {
      console.log(`[analyze] Paper ${paperId}: Starting PDF parsing...`);
      await storage.updateMetadata(paperId, {
        status: 'parsing',
        analysisProgress: { step: 'parsing', message: 'Starting PDF parsing...', updatedAt: new Date().toISOString() },
      });
      const pdfPath = storage.getPdfPath(paperId);
      const customVisionPrompt = promptSettings?.vision?.custom;
      markdown = await parsePdfWithVision(pdfPath, { baseUrl, apiKey, visionModel }, {
        onProgress: (message) => {
          send({ step: 'parsing', message });
          storage.updateMetadata(paperId, {
            analysisProgress: { step: 'parsing', message, updatedAt: new Date().toISOString() },
          }).catch(() => {});
        },
        onBatchDone: (batchIndex, totalBatches, content) => {
          send({ type: 'parse_batch_done', batchIndex, totalBatches, content });
          storage.updateMetadata(paperId, {
            analysisProgress: {
              step: 'parsing',
              message: `Parsed batch ${batchIndex + 1}/${totalBatches}`,
              updatedAt: new Date().toISOString(),
              batchesDone: batchIndex + 1,
              totalBatches,
            },
          }).catch(() => {});
        },
        onChunk: (batchIndex, chunk) => {
          send({ type: 'parse_chunk', batchIndex, chunk });
        },
        customVisionPrompt,
      });
      await storage.saveParsedContent(paperId, markdown);
    }

    // Step 2: AI Analysis
    const analysisPromptTemplate = promptSettings?.analysis?.custom || ANALYSIS_PROMPT;
    const prompt = analysisPromptTemplate.replaceAll('{content}', markdown);
    const promptLength = prompt.length;
    const estimatedTokens = Math.ceil(promptLength / 4);
    console.log(`[analyze] Paper ${paperId}: Sending to AI for analysis`);
    const analyzingMessage = `Analyzing with AI (${model}, ~${estimatedTokens} tokens)...`;
    send({ step: 'analyzing', message: analyzingMessage });
    await storage.updateMetadata(paperId, {
      status: 'analyzing',
      analysisProgress: { step: 'analyzing', message: analyzingMessage, updatedAt: new Date().toISOString() },
    });

    const client = createAIClient({ baseUrl, apiKey, model });
    const heartbeat = setInterval(async () => {
      try {
        const current = await storage.getMetadata(paperId);
        if (current?.analysisProgress) {
          await storage.updateMetadata(paperId, {
            analysisProgress: { ...current.analysisProgress, updatedAt: new Date().toISOString() },
          });
        }
      } catch {}
    }, 60_000);

    let result: string;
    try {
      result = await client.complete([{ role: 'user', content: prompt }]);
    } finally {
      clearInterval(heartbeat);
    }

    // Step 3: Save results and mark as analyzed
    send({ step: 'saving', message: 'Saving results...' });
    await storage.updateMetadata(paperId, {
      analysisProgress: { step: 'saving', message: 'Saving results...', updatedAt: new Date().toISOString() },
    });

    const analysis: PaperAnalysis = { ...JSON.parse(result), generatedAt: new Date().toISOString() };
    await storage.saveAnalysis(paperId, analysis);

    // Mark as analyzed IMMEDIATELY after successful save
    // This prevents subsequent failures (like SSE send errors) from corrupting the status
    const savedMeta = await storage.getMetadata(paperId);
    if (savedMeta) {
      savedMeta.status = 'analyzed';
      delete savedMeta.analysisProgress;
      await storage.saveMetadata(paperId, savedMeta);
    }

    // Send sections to client (status is already 'analyzed', so failures here won't affect it)
    for (const section of ['summary', 'contributions', 'methodology', 'experiments', 'conclusions'] as const) {
      const sectionData = analysis[section];
      let content: string;
      if (typeof sectionData === 'string') {
        content = sectionData;
      } else if (sectionData && typeof sectionData === 'object') {
        content = 'content' in sectionData ? String(sectionData.content) : JSON.stringify(sectionData);
      } else {
        content = String(sectionData || '');
      }
      send({ section, content });
    }

    send({ done: true });
  } catch (error) {
    console.error(`[analyze] Paper ${paperId}: Error -`, error instanceof Error ? error.message : error);
    // Only set error status if analysis wasn't already saved successfully
    const currentMeta = await storage.getMetadata(paperId);
    if (currentMeta && currentMeta.status !== 'analyzed') {
      delete currentMeta.analysisProgress;
      currentMeta.status = 'error';
      await storage.saveMetadata(paperId, currentMeta);
    }
    send({ error: error instanceof Error ? error.message : 'Analysis failed' });
  } finally {
    // Always call onComplete to release the slot
    if (onComplete) {
      await onComplete();
    }
  }
}