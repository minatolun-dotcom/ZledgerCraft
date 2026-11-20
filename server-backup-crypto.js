// ZledgerCraft - encryption for server-created SQLite/Postgres backup files.
// The live database stays readable; only the backup copy is encrypted. A
// server-held ZL_BACKUP_PASSPHRASE derives the key with scrypt, and AES-GCM
// authenticates the whole file.
import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const MAGIC = Buffer.from('ZLCBK1\n', 'ascii');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1 };
export const MIN_BACKUP_PASSPHRASE = 12;

export function backupPassphrase(value = '') {
  return String(value ?? '').trim();
}

export function isEncryptedBackupBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= MAGIC.length && buffer.subarray(0, MAGIC.length).equals(MAGIC);
}

function assertPassphrase(passphrase) {
  if (!passphrase || passphrase.length < MIN_BACKUP_PASSPHRASE) {
    throw new Error(`Set ZL_BACKUP_PASSPHRASE to at least ${MIN_BACKUP_PASSPHRASE} characters.`);
  }
}

async function deriveKey(passphrase, salt) {
  return scrypt(passphrase, salt, KEY_BYTES, SCRYPT_OPTIONS);
}

/**
 * Encrypts backup bytes and returns the complete file body:
 * magic | salt | iv | ciphertext | auth tag.
 */
export async function encryptBackupBuffer(plaintext, passphrase) {
  assertPassphrase(passphrase);
  if (!Buffer.isBuffer(plaintext) || plaintext.length === 0) {
    throw new Error('There is no backup data to encrypt.');
  }
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, ciphertext, cipher.getAuthTag()]);
}

/** Decrypts a complete encrypted backup body. */
export async function decryptBackupBuffer(encrypted, passphrase) {
  assertPassphrase(passphrase);
  if (!isEncryptedBackupBuffer(encrypted) || encrypted.length <= MAGIC.length + SALT_BYTES + IV_BYTES + TAG_BYTES) {
    throw new Error('That file is not a readable ZledgerCraft encrypted backup.');
  }
  const saltStart = MAGIC.length;
  const ivStart = saltStart + SALT_BYTES;
  const dataStart = ivStart + IV_BYTES;
  const tagStart = encrypted.length - TAG_BYTES;
  const salt = encrypted.subarray(saltStart, ivStart);
  const iv = encrypted.subarray(ivStart, dataStart);
  const ciphertext = encrypted.subarray(dataStart, tagStart);
  const tag = encrypted.subarray(tagStart);
  try {
    const key = await deriveKey(passphrase, salt);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Could not decrypt this backup. Check ZL_BACKUP_PASSPHRASE.');
  }
}
