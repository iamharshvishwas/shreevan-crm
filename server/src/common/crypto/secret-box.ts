import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Symmetric encryption for secrets stored at rest (e.g. TOTP secrets).
 * AES-256-GCM. The key is derived from JWT_ACCESS_SECRET so no extra env is
 * required; set TOTP_ENC_KEY (64 hex chars) to use a dedicated key instead.
 *
 * Note: if the underlying key changes, previously-encrypted values can no
 * longer be decrypted (users would need to re-enrol 2FA).
 */
function key(): Buffer {
  const dedicated = process.env.TOTP_ENC_KEY;
  if (dedicated && /^[0-9a-fA-F]{64}$/.test(dedicated)) return Buffer.from(dedicated, 'hex');
  const base = process.env.JWT_ACCESS_SECRET ?? 'shreevan-dev-secret';
  return createHash('sha256').update(base).digest(); // 32 bytes
}

/** Encrypt → "ivHex:tagHex:cipherHex". */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/** Decrypt a value produced by encryptSecret. Throws if tampered/invalid. */
export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Malformed ciphertext.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
