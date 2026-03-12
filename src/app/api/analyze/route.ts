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
          send({ step: 'parsing' });
          await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'parsing' });
          const pdfPath = storage.getPdfPath(paperId);
          const paperDir = pdfPath.replace('/original.pdf', '');
          const markdown = await parsePdfWithMarker(pdfPath, paperDir);
          await storage.saveParsedContent(paperId, markdown);

          send({ step: 'analyzing' });
          await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'analyzing' });
          const client = createAIClient({ baseUrl, apiKey, model });
          const prompt = ANALYSIS_PROMPT.replace('{content}', markdown);
          const result = await client.complete([{ role: 'user', content: prompt }]);
          const analysis: PaperAnalysis = { ...JSON.parse(result), generatedAt: new Date().toISOString() };
          await storage.saveAnalysis(paperId, analysis);

          for (const section of ['summary', 'contributions', 'methodology', 'conclusions'] as const) {
            const sectionData = analysis[section];
            send({ section, content: 'content' in sectionData ? sectionData.content : JSON.stringify(sectionData.items) });
          }
          await storage.saveMetadata(paperId, { ...(await storage.getMetadata(paperId)), status: 'analyzed' });
          send({ done: true });
        } catch (error) {
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
