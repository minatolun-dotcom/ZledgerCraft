import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeUser,
  addUser,
  addCompany,
  createCompany,
  deleteUser,
  emptyState,
  exportState,
  importState,
  recordAudit,
  setCurrentUser,
} from '../src/store.js';

test('a new state starts with one active local owner', () => {
  const state = emptyState();
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0].role, 'owner');
  assert.equal(state.currentUserId, state.users[0].id);
  assert.equal(activeUser(state).name, 'Local owner');
});

test('profiles validate names and roles, and owners can switch profiles', () => {
  const state = emptyState();
  const accountant = addUser(state, { name: 'Priya', role: 'accountant' });
  assert.equal(accountant.ok, true, accountant.error);
  assert.equal(accountant.user.role, 'accountant');

  const duplicate = addUser(state, { name: ' priya ', role: 'viewer' });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /already exists/i);
  assert.equal(addUser(state, { name: 'No role', role: 'admin' }).ok, false);
  assert.equal(addUser(state, { name: '   ', role: 'viewer' }).ok, false);

  assert.equal(setCurrentUser(state, accountant.user.id).ok, true);
  assert.equal(activeUser(state).name, 'Priya');
  assert.equal(setCurrentUser(state, 'missing').ok, false);
});

test('the last owner cannot be removed, and removing the active profile falls back', () => {
  const state = emptyState();
  const owner = state.users[0];
  assert.equal(deleteUser(state, owner.id).ok, false, 'last owner is protected');

  const secondOwner = addUser(state, { name: 'Second owner', role: 'owner' }).user;
  const accountant = addUser(state, { name: 'Asha', role: 'accountant' }).user;
  setCurrentUser(state, accountant.id);
  assert.equal(deleteUser(state, accountant.id).ok, true);
  assert.notEqual(state.currentUserId, accountant.id, 'active profile fell back');
  assert.equal(deleteUser(state, secondOwner.id).ok, true);
  assert.equal(state.users.filter((user) => user.role === 'owner').length, 1);
});

test('profiles and audit actor identity survive a backup round trip', () => {
  const state = emptyState();
  addCompany(state, 'Profile Co', '2026-04-01');
  const accountant = addUser(state, { name: 'Ravi', role: 'accountant' }).user;
  setCurrentUser(state, accountant.id);
  recordAudit(state, {
    action: 'voucher.create',
    summary: 'Created Sales 1.',
    companyId: state.activeCompanyId,
    companyName: state.companies[0].name,
    actorId: accountant.id,
    actorName: accountant.name,
    actorRole: accountant.role,
  });

  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.users.length, 2);
  assert.equal(activeUser(restored.state).name, 'Ravi');
  assert.equal(restored.state.audit[0].actorName, 'Ravi');
  assert.equal(restored.state.audit[0].actorRole, 'accountant');
});

test('older backups without profiles are seeded with an owner', () => {
  const { company } = createCompany('Legacy profiles Co', '2026-04-01');
  const restored = importState(
    JSON.stringify({ version: 1, activeCompanyId: company.id, companies: [company] }),
  );
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.users.length, 1);
  assert.equal(restored.state.users[0].role, 'owner');
  assert.equal(restored.state.currentUserId, restored.state.users[0].id);
});
