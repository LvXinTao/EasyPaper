import { storage } from '@/lib/storage';
import { parsePdfWithVision } from '@/lib/pdf-parser';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { ANALYSIS_PROMPT } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';
import type { PaperAnalysis } from '@/types';

type AIConfig = Awaited<ReturnType<typeof getAIConfig>>;
type SendFn = (data: Record<string, unknown>) => void;

async function runAnalysis(paperId: string, config: AIConfig, send: SendFn): Promise<void> {
  const { apiKey, baseUrl, model, visionModel } = config;

  try {
    // Load prompt settings once for both vision and analysis
    const promptSettings = await storage.getPromptSettings();

    // Step 1: Parse PDF with Marker (skip if cached)
    let markdown = await storage.getParsedContent(paperId);
    if (markdown) {
      console.log(`[analyze] Paper ${paperId}: Using cached parsed content (${markdown.length} chars)`);
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
        onVisionChunk: (content) => send({ type: 'vision_stream', content }),
        onVisionProgress: (info) => send({ type: 'vision_progress', ...info }),
        customVisionPrompt,
      });
      await storage.saveParsedContent(paperId, markdown);
      console.log(`[analyze] Paper ${paperId}: PDF parsed successfully (${markdown.length} chars)`);
    }

    // Step 2: Send to AI for analysis
    const analysisPromptTemplate = promptSettings?.analysis?.custom || ANALYSIS_PROMPT;
    const prompt = analysisPromptTemplate.replaceAll('{content}', markdown);
    const promptLength = prompt.length;
    const estimatedTokens = Math.ceil(promptLength / 4);
    console.log(`[analyze] Paper ${paperId}: Sending to AI for analysis`);
    console.log(`[analyze]   URL: ${baseUrl}/chat/completions`);
    console.log(`[analyze]   Model: ${model}`);
    console.log(`[analyze]   Prompt length: ${promptLength} chars (~${estimatedTokens} tokens)`);
    const analyzingMessage = `Analyzing with AI (${model}, ~${estimatedTokens} tokens)...`;
    send({ step: 'analyzing', message: analyzingMessage });
    await storage.updateMetadata(paperId, {
      status: 'analyzing',
      analysisProgress: { step: 'analyzing', message: analyzingMessage, updatedAt: new Date().toISOString() },
    });

    const client = createAIClient({ baseUrl, apiKey, model });

    // 60s heartbeat to keep analysisProgress.updatedAt fresh during AI call
    const heartbeat = setInterval(async () => {
      try {
        const current = await storage.getMetadata(paperId);
        if (current?.analysisProgress) {
          await storage.updateMetadata(paperId, {
            analysisProgress: { ...current.analysisProgress, updatedAt: new Date().toISOString() },
          });
        }
      } catch {
        // ignore heartbeat errors
      }
    }, 60_000);

    let result: string;
    try {
      result = await client.complete([{ role: 'user', content: prompt }]);
    } finally {
      clearInterval(heartbeat);
    }
    console.log(`[analyze] Paper ${paperId}: AI analysis complete (${result.length} chars returned)`);

    // Step 3: Save and stream results
    console.log(`[analyze] Paper ${paperId}: Saving analysis results...`);
    send({ step: 'saving', message: 'Saving results...' });
    await storage.updateMetadata(paperId, {
      analysisProgress: { step: 'saving', message: 'Saving results...', updatedAt: new Date().toISOString() },
    });

    const analysis: PaperAnalysis = { ...JSON.parse(result), generatedAt: new Date().toISOString() };
    await storage.saveAnalysis(paperId, analysis);

    for (const section of ['summary', 'contributions', 'methodology', 'experiments', 'conclusions'] as const) {
      const sectionData = analysis[section];
      send({ section, content: 'content' in sectionData ? sectionData.content : JSON.stringify(sectionData.items) });
    }

    // Completion: remove analysisProgress, set status to 'analyzed'
    const finalMeta = await storage.getMetadata(paperId);
    if (finalMeta) {
      delete finalMeta.analysisProgress;
      finalMeta.status = 'analyzed';
      await storage.saveMetadata(paperId, finalMeta);
    }
    console.log(`[analyze] Paper ${paperId}: Analysis complete!`);
    send({ done: true });
  } catch (error) {
    console.error(`[analyze] Paper ${paperId}: Error -`, error instanceof Error ? error.message : error);
    // Error: remove analysisProgress, set status to 'error'
    const errMeta = await storage.getMetadata(paperId);
    if (errMeta) {
      delete errMeta.analysisProgress;
      errMeta.status = 'error';
      await storage.saveMetadata(paperId, errMeta);
    }
    send({ error: error instanceof Error ? error.message : 'Analysis failed' });
  }
}

export async function POST(request: Request) {
  try {
    const { paperId, force } = await request.json();
    if (!paperId) return createErrorResponse('PAPER_NOT_FOUND', 'paperId is required');
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    const config = await getAIConfig();
    if (!config.apiKey) return createErrorResponse('API_KEY_MISSING', 'API key is not configured');

    // Check for already_running
    const metadata = await storage.getMetadata(paperId);
    if (metadata && (metadata.status === 'parsing' || metadata.status === 'analyzing') && metadata.analysisProgress) {
      const updatedAt = new Date(metadata.analysisProgress.updatedAt).getTime();
      const ageMs = Date.now() - updatedAt;
      const tenMinMs = 10 * 60 * 1000;

      if (ageMs < tenMinMs && !force) {
        return new Response(JSON.stringify({ status: 'already_running' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Stale or force: reset to pending
      const resetMeta = await storage.getMetadata(paperId);
      if (resetMeta) {
        delete resetMeta.analysisProgress;
        resetMeta.status = 'pending';
        await storage.saveMetadata(paperId, resetMeta);
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send: SendFn = (data) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Client disconnected — analysis continues
          }
        };
        await runAnalysis(paperId, config, send);
        try { controller.close(); } catch { /* already closed */ }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (error) {
    return createErrorResponse('ANALYSIS_FAILED', `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
