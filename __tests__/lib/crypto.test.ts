import { encryptApiKey, decryptApiKey } from '@/lib/crypto';

describe('crypto', () => {
  it('encrypts and decrypts an API key', () => {
    const apiKey = 'sk-test-1234567890abcdef';
    const { encrypted, iv } = encryptApiKey(apiKey);
    expect(encrypted).not.toBe(apiKey);
    expect(iv).toBeTruthy();
    const decrypted = decryptApiKey(encrypted, iv);
    expect(decrypted).toBe(apiKey);
  });
  it('produces different ciphertexts for the same key (random IV)', () => {
    const apiKey = 'sk-test-key';
    const result1 = encryptApiKey(apiKey);
    const result2 = encryptApiKey(apiKey);
    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });
  it('throws on tampered ciphertext', () => {
    const { encrypted, iv } = encryptApiKey('sk-test');
    expect(() => decryptApiKey(encrypted + 'tampered', iv)).toThrow();
  });
});
