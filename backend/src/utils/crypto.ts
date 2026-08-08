import crypto from 'crypto';
import { env } from '../config/env';

// AES-256-GCM key: TOKEN_ENCRYPTION_KEY if set, otherwise derived from the
// service role key so tokens are never stored in plaintext even without setup.
const key = crypto
  .createHash('sha256')
  .update(env.tokenEncryptionKey || env.supabaseServiceRoleKey)
  .digest();

const PREFIX = 'enc:v1:';

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  // Legacy/plaintext values pass through so old rows keep working.
  if (!stored.startsWith(PREFIX)) return stored;

  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
