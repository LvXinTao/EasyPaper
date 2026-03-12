import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { encryptApiKey } from '@/lib/crypto';

export async function GET() {
  const settings = await storage.getSettings();
  if (!settings) {
    return NextResponse.json({ baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1', model: process.env.AI_MODEL || 'gpt-4o', visionModel: process.env.AI_VISION_MODEL || 'gpt-4o', hasApiKey: !!process.env.AI_API_KEY });
  }
  return NextResponse.json({ baseUrl: settings.baseUrl, model: settings.model, visionModel: settings.visionModel, hasApiKey: !!(settings.apiKeyEncrypted || process.env.AI_API_KEY) });
}

export async function POST(request: Request) {
  const { baseUrl, apiKey, model, visionModel } = await request.json();
  const settingsToSave: Record<string, unknown> = { baseUrl: baseUrl || 'https://api.openai.com/v1', model: model || 'gpt-4o', visionModel: visionModel || 'gpt-4o' };
  if (apiKey) {
    const { encrypted, iv } = encryptApiKey(apiKey);
    settingsToSave.apiKeyEncrypted = encrypted;
    settingsToSave.apiKeyIV = iv;
  }
  await storage.saveSettings(settingsToSave);
  return NextResponse.json({ success: true });
}
