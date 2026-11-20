import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptBackupBuffer,
  encryptBackupBuffer,
  isEncryptedBackupBuffer,
} from '../server-backup-crypto.js';

const passphrase = 'correct horse battery staple';
const plaintext = Buffer.from(JSON.stringify({ state: { companies: [{ name: 'Acme' }] } }));

test('server backup files encrypt and decrypt as bytes', async () => {
  const encrypted = await encryptBackupBuffer(plaintext, passphrase);
  assert.equal(isEncryptedBackupBuffer(encrypted), true);
  assert.equal(encrypted.subarray(0, 7).toString(), 'ZLCBK1\n');
  assert.equal(encrypted.includes(Buffer.from('Acme')), false);
  assert.deepEqual(await decryptBackupBuffer(encrypted, passphrase), plaintext);
});

test('each server backup uses a fresh salt and iv', async () => {
  const first = await encryptBackupBuffer(plaintext, passphrase);
  const second = await encryptBackupBuffer(plaintext, passphrase);
  assert.notDeepEqual(first.subarray(7, 23), second.subarray(7, 23));
  assert.notDeepEqual(first.subarray(23, 35), second.subarray(23, 35));
  assert.notDeepEqual(first, second);
});

test('a wrong backup passphrase and modified file are rejected', async () => {
  const encrypted = await encryptBackupBuffer(plaintext, passphrase);
  await assert.rejects(
    decryptBackupBuffer(encrypted, 'wrong horse battery staple'),
    /Could not decrypt this backup/,
  );
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 20] ^= 0xff;
  await assert.rejects(decryptBackupBuffer(tampered, passphrase), /Could not decrypt this backup/);
});

test('short passphrases and unencrypted bodies are rejected', async () => {
  await assert.rejects(encryptBackupBuffer(plaintext, 'short'), /at least 12 characters/);
  await assert.rejects(decryptBackupBuffer(plaintext, passphrase), /not a readable/);
  assert.equal(isEncryptedBackupBuffer(Buffer.from('SQLite format 3')), false);
});
