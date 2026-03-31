import { storage } from '@/lib/storage';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { CHAT_PROMPT, buildQuoteContext } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';
import { search, buildRAGContext, ensureQuoteIncluded, LOW_CONFIDENCE_THRESHOLD } from '@/lib/retrieval';
import { getEmbeddingConfig, triggerEmbeddingGeneration } from '@/lib/embedding';
import type { ChatSession, TextSelection } from '@/types';

export async function POST(request: Request) {
  try {
    const { paperId, sessionId, message, quote, expandContext } = await request.json() as {
      paperId: string;
      sessionId?: string;
      message: string;
      quote?: TextSelection;
      expandContext?: boolean;
    };
    if (!paperId) return createErrorResponse('VALIDATION_ERROR', 'paperId is required');
    if (!message) return createErrorResponse('VALIDATION_ERROR', 'message is required');
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

    // Resolve or create session
    let session: ChatSession;
    if (sessionId) {
      const existing = await storage.getChatSession(paperId, sessionId);
      if (!existing) return createErrorResponse('SESSION_NOT_FOUND', 'Session not found');
      session = existing;
    } else {
      session = await storage.createChatSession(paperId);
    }

    const { apiKey, baseUrl, model } = await getAIConfig();
    if (!apiKey) return createErrorResponse('API_KEY_MISSING', 'API key is not configured');

    const analysis = await storage.getAnalysis(paperId);
    const embeddings = await storage.getEmbeddings(paperId);
    const historyStr = session.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const quoteContext = buildQuoteContext(quote);
    const promptSettings = await storage.getPromptSettings();
    let chatPromptTemplate = promptSettings?.chat?.custom || CHAT_PROMPT;

    // Inject quoteContext placeholder if not present in custom prompt
    // Insert BEFORE "User question:" or "{question}" to ensure AI sees the context
    if (!chatPromptTemplate.includes('{quoteContext}')) {
      if (chatPromptTemplate.includes('User question:')) {
        chatPromptTemplate = chatPromptTemplate.replace('User question:', '{quoteContext}\n\nUser question:');
      } else if (chatPromptTemplate.includes('{question}')) {
        chatPromptTemplate = chatPromptTemplate.replace('{question}', '{quoteContext}\n\n{question}');
      }
    }

    // Determine context content: use RAG if embeddings exist, otherwise fallback to full text
    let contextContent: string;
    let lowConfidence = false;
    console.log(`[chat] Paper ${paperId}: embeddings status =`, embeddings ? 'exists' : 'missing');
    if (!embeddings) {
      // Fallback: trigger async generation, use full text for this query
      console.log(`[chat] Paper ${paperId}: Triggering embedding generation, using full text fallback`);
      triggerEmbeddingGeneration(paperId);
      const parsedContent = await storage.getParsedContent(paperId);
      contextContent = parsedContent || '';
    } else {
      // Use RAG context
      console.log(`[chat] Paper ${paperId}: Using RAG with ${embeddings.chunks.length} chunks`);
      const topK = expandContext ? 8 : 3;
      const config = await getEmbeddingConfig();
      let relevantChunks = await search(message, embeddings, topK, {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.embeddingModel
      });

      if (quote) {
        relevantChunks = ensureQuoteIncluded(relevantChunks, quote, embeddings.chunks);
      }

      lowConfidence = relevantChunks.length > 0 &&
        (relevantChunks[0].similarity || 0) < LOW_CONFIDENCE_THRESHOLD;

      contextContent = buildRAGContext(analysis, relevantChunks);
    }

    const prompt = chatPromptTemplate
      .replaceAll('{content}', contextContent)
      .replaceAll('{history}', historyStr)
      .replaceAll('{quoteContext}', quoteContext)
      .replaceAll('{question}', message);
    const client = createAIClient({ baseUrl, apiKey, model });
    const encoder = new TextEncoder();

    // Persist user message immediately so it survives stream aborts (e.g. session switching)
    session.messages.push({ role: 'user', content: message, quote });
    if (session.title === 'New Chat') {
      session.title = message.slice(0, 30);
    }
    await storage.saveChatSession(paperId, session);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); }
          catch { /* client disconnected — continue processing so response is saved */ }
        };
        try {
          let fullResponse = '';
          for await (const chunk of client.streamComplete([{ role: 'user', content: prompt }])) {
            fullResponse += chunk;
            send({ content: chunk });
          }
          session.messages.push({ role: 'assistant', content: fullResponse });
          await storage.saveChatSession(paperId, session);
          if (lowConfidence) {
            send({ done: true, sessionId: session.id, lowConfidence: true });
          } else {
            send({ done: true, sessionId: session.id });
          }
        } catch (error) { send({ error: error instanceof Error ? error.message : 'Chat failed' }); }
        finally { try { controller.close(); } catch { /* already closed */ } }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  } catch (error) {
    return createErrorResponse('API_CALL_FAILED', `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
