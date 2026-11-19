import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { AuthStore, generateTotpSecret, totpCode, verifyTotp } from '../server-auth.js';

function store() {
  return new AuthStore(new DatabaseSync(':memory:'));
}

test('server auth verifies standard TOTP codes and account enrollment', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(totpCode(rfcSecret, 59_000), '287082');
  assert.equal(verifyTotp(rfcSecret, '287082', 0, 59_000), true);
  assert.equal(verifyTotp(rfcSecret, '000000', 0, 59_000), false);
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(verifyTotp(secret, totpCode(secret)), true);

  const auth = store();
  const account = auth.createUser({
    username: 'books',
    name: 'Books',
    role: 'accountant',
    password: 'ledger pass',
  }).user;
  assert.equal(account.mfaEnabled, false);
  assert.equal(auth.enableMfa(account.id, secret).user.mfaEnabled, true);
  assert.equal(auth.mfaSecret(account.id), secret);
  assert.equal(auth.enableMfa(account.id, secret).ok, false);
  const at = 1_700_000_000_000;
  const code = totpCode(secret, at);
  assert.equal(auth.verifyMfaCode(account.id, code, at), true);
  assert.equal(auth.verifyMfaCode(account.id, code, at), false);
  assert.equal(auth.disableMfa(account.id).user.mfaEnabled, false);
  assert.equal(auth.enableMfa(account.id, secret, 'ABCD1234EFGH5678').ok, true);
  assert.equal(auth.consumeMfaRecovery(account.id, 'WRONG'), false);
  assert.equal(auth.consumeMfaRecovery(account.id, 'abcd1234efgh5678'), true);
  assert.equal(auth.getUser(account.id).mfaEnabled, false);
  assert.equal(auth.consumeMfaRecovery(account.id, 'ABCD1234EFGH5678'), false);
});

test('server auth creates an owner and verifies passwords', () => {
  const auth = store();
  assert.equal(auth.hasUsers(), false);

  const created = auth.ensureOwner({
    username: 'Owner',
    name: 'Owner',
    password: 'correct horse',
  });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.created, true);
  assert.equal(created.user.companyIds, null);
  assert.equal(auth.hasUsers(), true);

  assert.equal(auth.authenticate('owner', 'wrong'), null);
  assert.equal(auth.authenticate('nobody', 'correct horse'), null);
  const user = auth.authenticate('OWNER', 'correct horse');
  assert.equal(user.username, 'owner');
  assert.equal(user.role, 'owner');
  assert.equal(user.password_hash, undefined);

  const second = auth.ensureOwner({ username: 'other', password: 'another password' });
  assert.equal(second.ok, true);
  assert.equal(second.created, false);
  assert.equal(auth.listUsers().length, 1);
});

test('server auth sessions are hashed, revocable and password changes revoke them', () => {
  const auth = store();
  const owner = auth.ensureOwner({ username: 'owner', password: 'correct horse' }).user;
  const accountant = auth.createUser({
    username: 'books',
    name: 'Books',
    role: 'accountant',
    password: 'ledger pass',
    companyIds: ['company_1'],
  }).user;
  assert.deepEqual(accountant.companyIds, ['company_1']);
  assert.equal(auth.listUsers().find((user) => user.username === 'books').companyIds[0], 'company_1');

  const session = auth.createSession(accountant.id, 'test browser');
  assert.match(session.token, /^[a-f0-9]{64}$/);
  assert.match(session.id, /^[a-f0-9]{24}$/);
  assert.equal(auth.sessionUser('wrong'), null);
  assert.equal(auth.sessionUser(session.token).id, accountant.id);
  assert.equal(auth.listSessions()[0].id, session.id);
  assert.equal(auth.listSessions()[0].username, 'books');

  const changed = auth.updateUser(accountant.id, { password: 'new ledger pass' });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(auth.sessionUser(session.token), null);
  assert.equal(auth.authenticate('books', 'new ledger pass').id, accountant.id);

  const fresh = auth.createSession(accountant.id);
  assert.equal(auth.deleteSessionById(fresh.id).removed, 1);
  assert.equal(auth.sessionUser(fresh.token), null);
  assert.equal(auth.listUsers().length, 2);
  assert.ok(owner.id);

  const scoped = auth.updateUser(accountant.id, { companyIds: ['company_2', 'company_2'] });
  assert.equal(scoped.ok, true, scoped.error);
  assert.deepEqual(auth.listUsers().find((user) => user.username === 'books').companyIds, ['company_2']);
  assert.equal(auth.updateUser(accountant.id, { companyIds: 'company_1' }).ok, false);
  assert.equal(auth.updateUser(accountant.id, { role: 'owner' }).user.companyIds, null);
});

test('server auth records sign-in history and can revoke account sessions', () => {
  const auth = store();
  auth.ensureOwner({ username: 'owner', password: 'correct horse' });
  const account = auth.createUser({
    username: 'books',
    name: 'Books',
    role: 'accountant',
    password: 'ledger pass',
  }).user;
  auth.recordLogin({ username: 'books', userId: account.id, ok: true, ip: '192.168.1.20', userAgent: 'test' });
  auth.recordLogin({ username: 'books', userId: null, ok: false, ip: '192.168.1.21', userAgent: 'test' });
  const events = auth.listLoginEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].ok, false);
  assert.equal(events[0].username, 'books');
  assert.equal(events[1].userId, account.id);

  const session = auth.createSession(account.id);
  assert.equal(auth.sessionUser(session.token).id, account.id);
  assert.equal(auth.deleteUserSessions(account.id).removed, 1);
  assert.equal(auth.sessionUser(session.token), null);
});

test('server auth locks repeated failed sign-ins per account and source', () => {
  const auth = store();
  const key = 'books|192.168.1.20';
  for (let attempt = 1; attempt < 10; attempt += 1) {
    const result = auth.recordFailure(key);
    assert.equal(result.blocked, false);
    assert.equal(result.count, attempt);
  }
  assert.equal(auth.recordFailure(key).blocked, true);
  assert.equal(auth.loginLimit(key).blocked, true);
  assert.equal(auth.loginLimit('books|192.168.1.21').blocked, false);
  auth.clearLoginFailures(key);
  assert.equal(auth.loginLimit(key).blocked, false);
});

test('server auth protects the last owner and the signed-in account', () => {
  const auth = store();
  const owner = auth.ensureOwner({ username: 'owner', password: 'correct horse' }).user;
  const other = auth.createUser({
    username: 'second',
    name: 'Second owner',
    role: 'owner',
    password: 'second password',
  }).user;

  assert.equal(auth.deleteUser(owner.id, owner.id).ok, false);
  assert.match(auth.deleteUser(owner.id, owner.id).error, /signed in/i);
  assert.equal(auth.updateUser(owner.id, { role: 'viewer' }).ok, true);

  const lastOwner = auth.deleteUser(other.id, owner.id);
  assert.equal(lastOwner.ok, false);
  assert.match(lastOwner.error, /at least one owner/i);
  assert.equal(auth.updateUser(other.id, { role: 'accountant' }).ok, false);
  assert.equal(auth.listUsers().length, 2);
});

test('server auth creates hashed, single-use password-reset tokens', () => {
  const auth = store();
  const owner = auth.ensureOwner({
    username: 'owner',
    password: 'correct horse',
    email: 'OWNER@Example.com',
  }).user;
  assert.equal(owner.email, 'owner@example.com');
  const account = auth.createUser({
    username: 'books',
    name: 'Books',
    role: 'accountant',
    password: 'ledger pass',
    email: 'books@example.com',
  }).user;
  assert.equal(account.email, 'books@example.com');
  assert.equal(
    auth.createUser({
      username: 'duplicate',
      name: 'Duplicate',
      role: 'viewer',
      password: 'viewer password',
      email: 'BOOKS@example.com',
    }).ok,
    false,
  );
  assert.equal(auth.createPasswordReset('nobody@example.com'), null);
  auth.createUser({
    username: 'noemail',
    name: 'No Email',
    role: 'viewer',
    password: 'viewer password',
  });
  assert.equal(auth.createPasswordReset('noemail'), null);

  const reset = auth.createPasswordReset('books@example.com', new Date('2026-11-19T10:00:00Z'));
  assert.equal(reset.user.id, account.id);
  assert.match(reset.token, /^[a-f0-9]{64}$/);
  assert.equal(reset.expiresAt, '2026-11-19T10:30:00.000Z');
  assert.equal(auth.consumePasswordReset(reset.token, 'new ledger pass', new Date('2026-11-19T10:05:00Z')).ok, true);
  assert.equal(auth.authenticate('books', 'ledger pass'), null);
  assert.equal(auth.authenticate('books', 'new ledger pass').id, account.id);
  assert.equal(auth.consumePasswordReset(reset.token, 'another password', new Date('2026-11-19T10:06:00Z')).ok, false);

  const expired = auth.createPasswordReset('books', new Date('2026-11-19T10:00:00Z'));
  assert.equal(auth.consumePasswordReset(expired.token, 'third password', new Date('2026-11-19T10:31:00Z')).ok, false);
  const updated = auth.updateUser(account.id, { email: 'new-books@example.com' });
  assert.equal(updated.user.email, 'new-books@example.com');
  assert.equal(auth.createPasswordReset('books@example.com'), null);
  assert.equal(auth.createPasswordReset('new-books@example.com').user.id, account.id);
});

test('server auth migrates existing accounts to unrestricted company access', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE auth_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.prepare('INSERT INTO auth_users VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    'usr_old',
    'books',
    'Old Books',
    'accountant',
    'unused-hash',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
  );
  const auth = new AuthStore(db);
  const user = auth.getUser('usr_old');
  assert.equal(user.companyIds, null);
  assert.equal(auth.updateUser('usr_old', { companyIds: ['company_1'] }).user.companyIds[0], 'company_1');
});

test('server auth validates account input without exposing hashes', () => {
  const auth = store();
  auth.ensureOwner({ username: 'owner', password: 'correct horse' });

  const duplicate = auth.createUser({
    username: 'owner',
    name: 'Another',
    role: 'viewer',
    password: 'viewer password',
  });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /already exists/);

  assert.equal(
    auth.createUser({ username: 'x', name: 'X', role: 'viewer', password: 'viewer password' }).ok,
    false,
  );
  assert.equal(
    auth.createUser({ username: 'valid', name: 'Valid', role: 'admin', password: 'viewer password' }).ok,
    false,
  );
  assert.equal(
    auth.createUser({ username: 'valid', name: 'Valid', role: 'viewer', password: 'short' }).ok,
    false,
  );

  for (const user of auth.listUsers()) {
    assert.equal(user.password_hash, undefined);
    assert.equal(user.passwordHash, undefined);
  }
});
