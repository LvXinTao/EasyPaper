import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';

let cachedKey: Buffer | null = null;

/**
 * Get or create a stable encryption key for this machine.
 * Uses a stored random key file for stability across hostname changes.
 * Falls back to hostname-based key only if file access fails.
 */
function getMachineKey(): Buffer {
  if (cachedKey) return cachedKey;

  const keyPath = path.join(os.homedir(), '.easypaper', '.key');

  try {
    // Try to read existing key file
    if (fs.existsSync(keyPath)) {
      const keyData = fs.readFileSync(keyPath, 'utf-8').trim();
      if (keyData.length === 64 && /^[0-9a-f]+$/i.test(keyData)) {
        cachedKey = Buffer.from(keyData, 'hex');
        return cachedKey;
      }
    }

    // Generate new random key
    const newKey = crypto.randomBytes(32);

    // Ensure directory exists
    const dir = path.dirname(keyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write key file with restricted permissions
    fs.writeFileSync(keyPath, newKey.toString('hex'), { mode: 0o600 });
    cachedKey = newKey;
    return cachedKey;
  } catch {
    // Fallback to hostname-based key (less stable but works if file access fails)
    const hostname = os.hostname();
    return crypto.createHash('sha256').update(hostname).digest();
  }
}

export function encryptApiKey(apiKey: string): { encrypted: string; iv: string } {
  const key = getMachineKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted + ':' + authTag.toString('hex'),
    iv: iv.toString('hex'),
  };
}

export function decryptApiKey(encrypted: string, iv: string): string {
  const key = getMachineKey();
  const colonIndex = encrypted.lastIndexOf(':');
  if (colonIndex === -1) throw new Error('Invalid encrypted format');
  const data = encrypted.slice(0, colonIndex);
  const authTagHex = encrypted.slice(colonIndex + 1);
  if (!/^[0-9a-f]+$/i.test(authTagHex) || authTagHex.length !== 32) {
    throw new Error('Invalid auth tag');
  }
  if (!/^[0-9a-f]*$/i.test(data)) {
    throw new Error('Invalid ciphertext');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
