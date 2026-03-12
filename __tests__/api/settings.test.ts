import { GET, POST } from '@/app/api/settings/route';
import { storage } from '@/lib/storage';
jest.mock('@/lib/storage', () => ({ storage: { getSettings: jest.fn(), saveSettings: jest.fn() } }));
jest.mock('@/lib/crypto', () => ({ encryptApiKey: jest.fn().mockReturnValue({ encrypted: 'enc-data', iv: 'enc-iv' }), decryptApiKey: jest.fn().mockReturnValue('sk-decrypted') }));

describe('GET /api/settings', () => {
  it('returns settings without exposing API key', async () => {
    (storage.getSettings as jest.Mock).mockResolvedValue({ baseUrl: 'https://api.test.com/v1', apiKeyEncrypted: 'encrypted', apiKeyIV: 'iv', model: 'gpt-4o', visionModel: 'gpt-4o' });
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.baseUrl).toBe('https://api.test.com/v1');
    expect(data.hasApiKey).toBe(true);
    expect(data.apiKeyEncrypted).toBeUndefined();
  });
});
describe('POST /api/settings', () => {
  it('saves settings with encrypted API key', async () => {
    const request = new Request('http://localhost/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://api.test.com/v1', apiKey: 'sk-new-key', model: 'gpt-4o', visionModel: 'gpt-4o' }) });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(storage.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://api.test.com/v1', apiKeyEncrypted: 'enc-data', apiKeyIV: 'enc-iv' }));
  });
});
