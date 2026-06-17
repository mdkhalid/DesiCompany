import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // hex
  authTag: string;    // hex
}

const KEY_ENV_VAR = 'PAYMENT_GATEWAY_ENCRYPTION_KEY';

function getKeyBuffer(): Buffer {
  const envValue = process.env[KEY_ENV_VAR];
  if (!envValue) {
    throw new Error('PAYMENT_GATEWAY_ENCRYPTION_KEY environment variable is required');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(envValue)) {
    throw new Error(
      'PAYMENT_GATEWAY_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
    );
  }
  const key = Buffer.from(envValue, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'PAYMENT_GATEWAY_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
    );
  }
  return key;
}

// Cache the parsed key Buffer so we don't re-parse on every call.
// If cachedKey is null, re-validate unconditionally.
// If env string changed, re-validate to pick up the new key.
let cachedKeyEnv: string | null = null;
let cachedKey: Buffer | null = null;

function getCachedKey(): Buffer {
  const envValue = process.env[KEY_ENV_VAR] ?? null;
  if (cachedKey === null || envValue !== cachedKeyEnv) {
    cachedKey = getKeyBuffer();
    cachedKeyEnv = envValue;
  }
  return cachedKey as Buffer;
}

export function encryptCredentials(plaintext: string): EncryptedPayload {
  const key = getCachedKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decryptCredentials(payload: EncryptedPayload): string {
  const key = getCachedKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

// Exposed for testing only — resets the cache so the module re-reads
// the env var on the next call (used to simulate env var changes in tests).
export function __resetCache(): void {
  cachedKeyEnv = null;
  cachedKey = null;
}