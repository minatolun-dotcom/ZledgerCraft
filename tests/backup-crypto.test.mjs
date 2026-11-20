import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCRYPTED_BACKUP_FORMAT,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from '../src/backup-crypto.js';

const passphrase = 'correct horse battery staple';
const payload = JSON.stringify({
  version: 1,
  companies: [{ id: 'c1', name: 'Acme Traders', vouchers: [] }],
});

test('encrypted backups round-trip and hide the plaintext', async () => {
  const envelope = await encryptBackup(payload, passphrase);
  const serialized = JSON.stringify(envelope);
  assert.equal(envelope.format, ENCRYPTED_BACKUP_FORMAT);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.kdf.name, 'PBKDF2');
  assert.equal(envelope.kdf.hash, 'SHA-256');
  assert.equal(envelope.cipher.name, 'AES-GCM');
  assert.ok(!serialized.includes('Acme Traders'), 'plaintext leaked into the envelope');
  assert.equal(await decryptBackup(serialized, passphrase), payload);
});

test('each encrypted backup uses a fresh salt and initialization vector', async () => {
  const first = await encryptBackup(payload, passphrase);
  const second = await encryptBackup(payload, passphrase);
  assert.notEqual(first.kdf.salt, second.kdf.salt);
  assert.notEqual(first.cipher.iv, second.cipher.iv);
  assert.notEqual(first.data, second.data);
});

test('a wrong passphrase does not decrypt the backup', async () => {
  const envelope = await encryptBackup(payload, passphrase);
  await assert.rejects(
    decryptBackup(JSON.stringify(envelope), 'wrong horse battery staple'),
    /Could not decrypt this backup/,
  );
});

test('modifying the encrypted payload is detected', async () => {
  const envelope = await encryptBackup(payload, passphrase);
  const tampered = {
    ...envelope,
    data: `${envelope.data[0] === 'A' ? 'B' : 'A'}${envelope.data.slice(1)}`,
  };
  await assert.rejects(
    decryptBackup(JSON.stringify(tampered), passphrase),
    /Could not decrypt this backup/,
  );
});

test('encrypted backup detection is strict', async () => {
  const envelope = await encryptBackup(payload, passphrase);
  assert.equal(isEncryptedBackup(JSON.stringify(envelope)), true);
  assert.equal(isEncryptedBackup(payload), false);
  assert.equal(isEncryptedBackup('{not json'), false);
  assert.equal(isEncryptedBackup('{"format":"something-else"}'), false);
});

test('short passphrases and unsupported parameters are rejected', async () => {
  await assert.rejects(encryptBackup(payload, 'short'), /at least 8 characters/);
  const envelope = await encryptBackup(payload, passphrase);
  await assert.rejects(
    decryptBackup(JSON.stringify({ ...envelope, version: 2 }), passphrase),
    /version is not supported/,
  );
  await assert.rejects(
    decryptBackup(
      JSON.stringify({ ...envelope, kdf: { ...envelope.kdf, iterations: 10 } }),
      passphrase,
    ),
    /unsupported key-derivation settings/,
  );
  await assert.rejects(
    decryptBackup(JSON.stringify({ ...envelope, cipher: { ...envelope.cipher, name: 'AES-CBC' } }), passphrase),
    /unsupported cipher/,
  );
});
