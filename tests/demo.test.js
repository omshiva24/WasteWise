import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoBackend } from '../public/js/api/backend/demo.js';
import { MemoryStorage, clock } from './helpers.js';
import { DAY } from '../public/js/core/constants.js';

async function fresh() {
  const now = clock();
  const storage = new MemoryStorage();
  const api = await createDemoBackend({ storage, now, broadcast: false }).init();
  return { api, now, storage };
}

test('seed data is realistic and consistent', async () => {
  const { api } = await fresh();
  const db = api._db();
  const reqs = Object.values(db.requests);
  assert.ok(reqs.length >= 50);
  assert.ok(Object.keys(db.bins).length >= 14);
  for (const r of reqs) {
    if (r.status === 'COMPLETED') assert.ok(r.weightKg > 0 && r.completedAt >= r.acceptedAt && r.acceptedAt >= r.createdAt, r.code);
    if (r.status === 'ACCEPTED') assert.ok(r.vendorId && !r.completedAt, r.code);
  }
  assert.ok(reqs.some((r) => r.overdue), 'overdue sweep flagged old requests');
  assert.ok(db.notifications.some((n) => n.kind === 'overdue'));
});

test('demo accounts sign in; wrong passwords are rejected', async () => {
  const { api } = await fresh();
  await assert.rejects(api.auth.signIn('admin@wastewise.app', 'nope'), /Wrong password/);
  const u = await api.auth.demoSignIn('supervisor');
  assert.equal(u.role, 'supervisor');
  await api.auth.signOut();
  assert.equal(api.auth.current(), null);
});

test('supervisor raises -> vendor accepts -> supervisor completes, with notifications', async () => {
  const { api, now } = await fresh();
  await api.auth.demoSignIn('supervisor');
  const sup = api.auth.current();
  const req = await api.requests.create({ wasteType: 'organic', binId: 'BIN-H03', location: 'Hostel Mess', zone: 'Hostel Zone', priority: 'urgent' });
  assert.match(req.code, /^WR-\d+$/);
  await assert.rejects(api.requests.act(req.id, 'complete', { weightKg: 4 }), /can't complete/);

  await api.auth.signOut();
  await api.auth.demoSignIn('vendor');
  const ven = api.auth.current();
  let feed = [];
  const off = api.requests.watch((xs) => (feed = xs));
  assert.ok(feed.some((r) => r.id === req.id), 'vendor sees the new open request');
  assert.ok(api._db().notifications.some((n) => n.to === ven.uid && n.requestId === req.id && n.title.startsWith('Urgent')));
  now.advance(3600e3);
  await api.requests.act(req.id, 'accept');
  off();

  await api.auth.signOut();
  await api.auth.signIn('arjun@wastewise.app', 'demo1234');
  assert.ok(api._db().notifications.some((n) => n.to === sup.uid && n.kind === 'accepted' && n.requestId === req.id));
  const done = await api.requests.act(req.id, 'complete', { weightKg: 88.4, rating: 5 });
  assert.equal(done.status, 'COMPLETED');
  assert.ok(api._db().notifications.some((n) => n.to === ven.uid && n.kind === 'completed'));
  assert.ok(api._db().logs.some((l) => l.action === 'request.complete' && l.target === req.code));
});

test('members and vendors cannot do admin or supervisor things', async () => {
  const { api } = await fresh();
  await api.auth.demoSignIn('member');
  await assert.rejects(api.requests.create({ wasteType: 'paper', binId: 'BIN-A01', location: 'Library' }), /permission/);
  await assert.rejects(api.users.list(), /permission/);
  await api.auth.signOut();
  await api.auth.demoSignIn('vendor');
  await assert.rejects(api.bins.save({ id: 'BIN-X1', location: 'X' }), /permission/);
});

test('signup requests a role; admin approves it', async () => {
  const { api } = await fresh();
  await assert.rejects(api.auth.signUp({ name: 'Short', email: 'a@b.co', password: '123' }), /8 characters/);
  const u = await api.auth.signUp({ name: 'Ravi Shankar', email: 'ravi@college.edu', password: 'longpassword', requestedRole: 'supervisor' });
  assert.equal(u.role, 'member', 'nobody can give themselves a role');
  assert.equal(u.requestedRole, 'supervisor');
  await api.auth.signOut();
  await api.auth.demoSignIn('admin');
  await api.users.setRole(u.uid, 'supervisor');
  assert.equal(api._db().users[u.uid].role, 'supervisor');
  await assert.rejects(api.users.setRole(api.auth.current().uid, 'member'), /own admin/);
});

test('requests become overdue after 7 days and notify admins once', async () => {
  const { api, now } = await fresh();
  await api.auth.demoSignIn('supervisor');
  const req = await api.requests.create({ wasteType: 'paper', binId: 'BIN-A01', location: 'Library Block' });
  now.advance(7 * DAY + 60_000);
  assert.equal(api._sweep(), true);
  assert.equal(api._sweep(), false, 'only once');
  const n = api._db().notifications.filter((x) => x.requestId === req.id && x.kind === 'overdue');
  assert.ok(n.length >= 2);
});
