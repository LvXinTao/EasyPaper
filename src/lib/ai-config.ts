import { storage } from '@/lib/storage';
import { decryptApiKey } from '@/lib/crypto';

export async function getAIConfig() {
  const settings = await storage.getSettings();
  let apiKey = process.env.AI_API_KEY || '';
  const baseUrl = (settings?.baseUrl as string) || process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = (settings?.model as string) || process.env.AI_MODEL || 'gpt-4o';
  if (settings?.apiKeyEncrypted && settings?.apiKeyIV) {
    try {
      apiKey = decryptApiKey(settings.apiKeyEncrypted as string, settings.apiKeyIV as string);
    } catch { /* Fall back to env var */ }
  }
  return { apiKey, baseUrl, model };
}
