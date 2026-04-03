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

  const baseDir = path.join(os.homedir(), '.easypaper');
  const keyPath = path.join(baseDir, '.key');

  try {
    // Ensure base directory exists with restricted permissions
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
    } else {
      // Fix permissions on existing directory if needed
      try {
        fs.chmodSync(baseDir, 0o700);
      } catch {
        // Ignore chmod errors (e.g., on some filesystems)
      }
    }

    // Try to read existing key file
    try {
      const keyData = fs.readFileSync(keyPath, 'utf-8').trim();
      if (keyData.length === 64 && /^[0-9a-f]+$/i.test(keyData)) {
        cachedKey = Buffer.from(keyData, 'hex');
        return cachedKey;
      }
    } catch {
      // Key file doesn't exist or is unreadable, will create new one
    }

    // Generate new random key
    const newKey = crypto.randomBytes(32);

    // Write to temp file first, then rename for atomic operation
    const tempPath = keyPath + '.tmp';
    fs.writeFileSync(tempPath, newKey.toString('hex'), { mode: 0o600 });
    fs.renameSync(tempPath, keyPath);

    cachedKey = newKey;
    return cachedKey;
  } catch (error) {
    // Log fallback activation for debugging
    console.warn('[crypto] Falling back to hostname-based key due to file access error:', error);
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
