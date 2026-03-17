import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { encryptApiKey } from '@/lib/crypto';

export async function GET() {
  const settings = await storage.getSettings();
  if (!settings) {
    return NextResponse.json({ baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1', model: process.env.AI_MODEL || 'gpt-4o', visionModel: process.env.AI_VISION_MODEL || 'gpt-4o', hasApiKey: !!process.env.AI_API_KEY, theme: { preset: 'dark-minimal', customAccent: null } });
  }
  return NextResponse.json({ baseUrl: settings.baseUrl, model: settings.model, visionModel: settings.visionModel, hasApiKey: !!(settings.apiKeyEncrypted || process.env.AI_API_KEY), theme: settings.theme || { preset: 'dark-minimal', customAccent: null } });
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

  // Only update encrypted key if a new plaintext key is provided
  if (body.apiKey) {
    const { encrypted, iv } = encryptApiKey(body.apiKey);
    merged.apiKeyEncrypted = encrypted;
    merged.apiKeyIV = iv;
  }
  // Otherwise, existing apiKeyEncrypted/apiKeyIV are preserved from spread

  // Update theme if provided
  if (body.theme !== undefined) merged.theme = body.theme;

  await storage.saveSettings(merged);
  return NextResponse.json({ success: true });
}
