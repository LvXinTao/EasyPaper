import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { encryptApiKey } from '@/lib/crypto';

export async function GET() {
  const settings = await storage.getSettings();
  if (!settings) {
    return NextResponse.json({
      baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.AI_MODEL || 'gpt-4o',
      visionModel: process.env.AI_VISION_MODEL || 'gpt-4o',
      hasApiKey: !!process.env.AI_API_KEY,
      embeddingModel: process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small',
      useSameApiForEmbedding: true,
      embeddingBaseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      hasEmbeddingApiKey: false,
      theme: { preset: 'dark-minimal', customAccent: null },
      maxConcurrent: 3
    });
  }
  return NextResponse.json({
    baseUrl: settings.baseUrl,
    model: settings.model,
    visionModel: settings.visionModel,
    hasApiKey: !!(settings.apiKeyEncrypted || process.env.AI_API_KEY),
    embeddingModel: settings.embeddingModel || 'text-embedding-3-small',
    useSameApiForEmbedding: settings.useSameApiForEmbedding !== undefined ? settings.useSameApiForEmbedding : true,
    embeddingBaseUrl: settings.embeddingBaseUrl || settings.baseUrl || 'https://api.openai.com/v1',
    hasEmbeddingApiKey: !!(settings.embeddingApiKeyEncrypted || (settings.useSameApiForEmbedding ? settings.apiKeyEncrypted : false)),
    theme: settings.theme || { preset: 'dark-minimal', customAccent: null },
    maxConcurrent: settings.maxConcurrent || 3
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const existing = (await storage.getSettings()) || {};

  // Start from existing settings to preserve all fields
  const merged: Record<string, unknown> = { ...existing };

  // Only update API fields if explicitly provided
  if (body.baseUrl !== undefined) merged.baseUrl = body.baseUrl || 'https://api.openai.com/v1';
  if (body.model !== undefined) merged.model = body.model || 'gpt-4o';
  if (body.visionModel !== undefined) merged.visionModel = body.visionModel || 'gpt-4o';

  // Embedding settings
  if (body.embeddingModel !== undefined) merged.embeddingModel = body.embeddingModel || 'text-embedding-3-small';
  if (body.useSameApiForEmbedding !== undefined) merged.useSameApiForEmbedding = body.useSameApiForEmbedding;
  if (body.embeddingBaseUrl !== undefined) merged.embeddingBaseUrl = body.embeddingBaseUrl || 'https://api.openai.com/v1';

  // Only update encrypted key if a new plaintext key is provided
  if (body.apiKey) {
    const { encrypted, iv } = encryptApiKey(body.apiKey);
    merged.apiKeyEncrypted = encrypted;
    merged.apiKeyIV = iv;
  }
  // Otherwise, existing apiKeyEncrypted/apiKeyIV are preserved from spread

  // Only update embedding API key if a new plaintext key is provided
  if (body.embeddingApiKey) {
    const { encrypted, iv } = encryptApiKey(body.embeddingApiKey);
    merged.embeddingApiKeyEncrypted = encrypted;
    merged.embeddingApiKeyIV = iv;
  }
  // Otherwise, existing embeddingApiKeyEncrypted/embeddingApiKeyIV are preserved from spread

  // Update theme if provided
  if (body.theme !== undefined) merged.theme = body.theme;

  // Update maxConcurrent if provided (1-10, default 3)
  if (body.maxConcurrent !== undefined) {
    const val = parseInt(body.maxConcurrent);
    merged.maxConcurrent = (val >= 1 && val <= 10) ? val : 3;
  }

  await storage.saveSettings(merged);
  return NextResponse.json({ success: true });
}
