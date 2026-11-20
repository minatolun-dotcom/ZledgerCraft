// ZledgerCraft - passphrase encryption for downloaded JSON backups.
// The live workspace stays in its existing store; only the exported copy is
// protected. AES-256-GCM provides confidentiality and tamper detection, and
// PBKDF2-SHA-256 derives the key from a user passphrase.

export const ENCRYPTED_BACKUP_FORMAT = 'zledgercraft.encrypted-backup';
export const ENCRYPTED_BACKUP_VERSION = 1;
export const MIN_BACKUP_PASSPHRASE = 8;

const KDF_ITERATIONS = 310_000;
const MAX_KDF_ITERATIONS = 1_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AAD = new TextEncoder().encode(`${ENCRYPTED_BACKUP_FORMAT}:v${ENCRYPTED_BACKUP_VERSION}`);

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value, label) {
  if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`That encrypted backup has an invalid ${label}.`);
  }
  let binary;
  try {
    binary = atob(value);
  } catch {
    throw new Error(`That encrypted backup has an invalid ${label}.`);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function backupEncryptionAvailable() {
  return Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
}

function cryptoApi() {
  if (!backupEncryptionAvailable()) {
    throw new Error('Encrypted backups require HTTPS or localhost because this browser blocks Web Crypto.');
  }
  return globalThis.crypto;
}

async function deriveKey(passphrase, salt, iterations) {
  const { subtle } = cryptoApi();
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts a plaintext backup payload with a passphrase.
 * Returns a JSON-safe envelope; the passphrase is never stored in it.
 */
export async function encryptBackup(plaintext, passphrase) {
  if (typeof plaintext !== 'string' || plaintext.trim() === '') {
    throw new Error('There is no backup data to encrypt.');
  }
  if (typeof passphrase !== 'string' || passphrase.length < MIN_BACKUP_PASSPHRASE) {
    throw new Error(`Use a passphrase of at least ${MIN_BACKUP_PASSPHRASE} characters.`);
  }
  const crypto = cryptoApi();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: ENCRYPTED_BACKUP_VERSION,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
    },
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/** True when the pasted text is an encrypted-backup envelope. */
export function isEncryptedBackup(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text.startsWith('{')) return false;
  try {
    return JSON.parse(text)?.format === ENCRYPTED_BACKUP_FORMAT;
  } catch {
    return false;
  }
}

/**
 * Decrypts an encrypted-backup envelope. Throws a generic error for a wrong
 * passphrase or a modified file so callers do not reveal which one failed.
 */
export async function decryptBackup(envelope, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('Enter the passphrase used for this encrypted backup.');
  }
  let parsed;
  try {
    parsed = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
  } catch {
    throw new Error('That encrypted backup is not valid JSON.');
  }
  if (!parsed || parsed.format !== ENCRYPTED_BACKUP_FORMAT) {
    throw new Error('That file is not a ZledgerCraft encrypted backup.');
  }
  if (parsed.version !== ENCRYPTED_BACKUP_VERSION) {
    throw new Error('This encrypted backup version is not supported.');
  }
  const iterations = Number(parsed.kdf?.iterations);
  if (
    parsed.kdf?.name !== 'PBKDF2'
    || parsed.kdf?.hash !== 'SHA-256'
    || !Number.isInteger(iterations)
    || iterations < 100_000
    || iterations > MAX_KDF_ITERATIONS
  ) {
    throw new Error('That encrypted backup has unsupported key-derivation settings.');
  }
  if (parsed.cipher?.name !== 'AES-GCM') {
    throw new Error('That encrypted backup has an unsupported cipher.');
  }
  const salt = base64ToBytes(parsed.kdf.salt, 'salt');
  const iv = base64ToBytes(parsed.cipher.iv, 'initialization vector');
  const data = base64ToBytes(parsed.data, 'payload');
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) {
    throw new Error('That encrypted backup has invalid encryption parameters.');
  }
  const crypto = cryptoApi();
  try {
    const key = await deriveKey(passphrase, salt, iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: AAD },
      key,
      data,
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch {
    throw new Error('Could not decrypt this backup. Check the passphrase and file.');
  }
}
