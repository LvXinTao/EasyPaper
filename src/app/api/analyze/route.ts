import { storage } from '@/lib/storage';
import { parsePdfWithMarker } from '@/lib/marker';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { ANALYSIS_PROMPT } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';
import type { PaperAnalysis } from '@/types';

export async function POST(request: Request) {
  try {
    const { paperId } = await request.json();
    if (!paperId) return createErrorResponse('PAPER_NOT_FOUND', 'paperId is required');
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    const { apiKey, baseUrl, model } = await getAIConfig();
    if (!apiKey) return createErrorResponse('API_KEY_MISSING', 'API key is not configured');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
        try {
          // Step 1: Parse PDF with Marker (skip if cached)
          let markdown = await storage.getParsedContent(paperId);
          if (markdown) {
            console.log(`[analyze] Paper ${paperId}: Using cached parsed content (${markdown.length} chars)`);
            send({ step: 'parsing', message: 'Using cached parsed content...' });
          } else {
            console.log(`[analyze] Paper ${paperId}: Starting PDF parsing...`);
            send({ step: 'parsing', message: 'Parsing PDF with Marker...' });
            await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'parsing' });
            const pdfPath = storage.getPdfPath(paperId);
            const paperDir = pdfPath.replace('/original.pdf', '');
            markdown = await parsePdfWithMarker(pdfPath, paperDir);
            await storage.saveParsedContent(paperId, markdown);
            console.log(`[analyze] Paper ${paperId}: PDF parsed successfully (${markdown.length} chars)`);
          }

          // Step 2: Send to AI for analysis
          const prompt = ANALYSIS_PROMPT.replace('{content}', markdown);
          const promptLength = prompt.length;
          const estimatedTokens = Math.ceil(promptLength / 4);
          console.log(`[analyze] Paper ${paperId}: Sending to AI for analysis`);
          console.log(`[analyze]   URL: ${baseUrl}/chat/completions`);
          console.log(`[analyze]   Model: ${model}`);
          console.log(`[analyze]   Prompt length: ${promptLength} chars (~${estimatedTokens} tokens)`);
          send({ step: 'analyzing', message: `Analyzing with AI (${model}, ~${estimatedTokens} tokens)...` });
          await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'analyzing' });
          const client = createAIClient({ baseUrl, apiKey, model });
          const result = await client.complete([{ role: 'user', content: prompt }]);
          console.log(`[analyze] Paper ${paperId}: AI analysis complete (${result.length} chars returned)`);

          // Step 3: Save and stream results
          console.log(`[analyze] Paper ${paperId}: Saving analysis results...`);
          send({ step: 'saving', message: 'Saving results...' });
          const analysis: PaperAnalysis = { ...JSON.parse(result), generatedAt: new Date().toISOString() };
          await storage.saveAnalysis(paperId, analysis);

          for (const section of ['summary', 'contributions', 'methodology', 'conclusions'] as const) {
            const sectionData = analysis[section];
            send({ section, content: 'content' in sectionData ? sectionData.content : JSON.stringify(sectionData.items) });
          }
          await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'analyzed' });
          console.log(`[analyze] Paper ${paperId}: Analysis complete!`);
          send({ done: true });
        } catch (error) {
          console.error(`[analyze] Paper ${paperId}: Error -`, error instanceof Error ? error.message : error);
          await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'error' });
          send({ error: error instanceof Error ? error.message : 'Analysis failed' });
        } finally { controller.close(); }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  } catch (error) {
    return createErrorResponse('ANALYSIS_FAILED', `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
