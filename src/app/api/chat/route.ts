import { storage } from '@/lib/storage';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { CHAT_PROMPT } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';

export async function POST(request: Request) {
  try {
    const { paperId, message } = await request.json();
    if (!paperId) return createErrorResponse('VALIDATION_ERROR', 'paperId is required');
    if (!message) return createErrorResponse('VALIDATION_ERROR', 'message is required');
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    const { apiKey, baseUrl, model } = await getAIConfig();
    if (!apiKey) return createErrorResponse('API_KEY_MISSING', 'API key is not configured');

    const parsedContent = await storage.getParsedContent(paperId);
    const chatHistory = await storage.getChatHistory(paperId);
    const historyStr = chatHistory.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const prompt = CHAT_PROMPT.replace('{content}', parsedContent || '').replace('{history}', historyStr).replace('{question}', message);
    const client = createAIClient({ baseUrl, apiKey, model });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
        try {
          let fullResponse = '';
          for await (const chunk of client.streamComplete([{ role: 'user', content: prompt }])) {
            fullResponse += chunk;
            send({ content: chunk });
          }
          chatHistory.messages.push({ role: 'user', content: message }, { role: 'assistant', content: fullResponse });
          await storage.saveChatHistory(paperId, chatHistory);
          send({ done: true });
        } catch (error) { send({ error: error instanceof Error ? error.message : 'Chat failed' }); }
        finally { controller.close(); }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  } catch (error) {
    return createErrorResponse('API_CALL_FAILED', `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
