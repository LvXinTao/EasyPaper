import { getAIConfig } from '@/lib/ai-config';

jest.mock('@/lib/storage', () => ({
  storage: { getSettings: jest.fn().mockResolvedValue(null) },
}));
jest.mock('@/lib/crypto', () => ({
  decryptApiKey: jest.fn(),
}));

describe('getAIConfig', () => {
  beforeEach(() => {
    delete process.env.AI_VISION_MODEL;
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_BASE_URL = 'https://api.test.com/v1';
    process.env.AI_MODEL = 'gpt-4o';
  });

  it('returns visionModel from env var', async () => {
    process.env.AI_VISION_MODEL = 'gpt-4o-vision';
    const config = await getAIConfig();
    expect(config.visionModel).toBe('gpt-4o-vision');
  });

  it('falls back to model when visionModel is not set', async () => {
    const config = await getAIConfig();
    expect(config.visionModel).toBe('gpt-4o');
  });

  it('prefers settings visionModel over env var', async () => {
    const { storage } = require('@/lib/storage');
    (storage.getSettings as jest.Mock).mockResolvedValue({
      visionModel: 'from-settings',
      baseUrl: 'https://api.test.com/v1',
      model: 'test-model',
    });
    process.env.AI_VISION_MODEL = 'from-env';
    const config = await getAIConfig();
    expect(config.visionModel).toBe('from-settings');
  });
});
