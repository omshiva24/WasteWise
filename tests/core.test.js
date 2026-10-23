import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNewRequest, newRequest, transition, allowedActions, isOverdue, overdueDays, LifecycleError } from '../public/js/core/lifecycle.js';
import { can, guard, homeFor, visibleRequests } from '../public/js/core/rbac.js';
import { summarize, byWasteType, dailySeries, vendorBoard, zoneBoard } from '../public/js/core/stats.js';
import { requestsToCsv } from '../public/js/core/csv.js';
import { DAY } from '../public/js/core/constants.js';

const sup = { uid: 's1', name: 'Arjun', role: 'supervisor', active: true };
const sup2 = { uid: 's2', name: 'Divya', role: 'supervisor', active: true };
const ven = { uid: 'v1', name: 'Suresh', company: 'GreenCycle', role: 'vendor', active: true };
const ven2 = { uid: 'v2', name: 'Meena', role: 'vendor', active: true };
const admin = { uid: 'a1', name: 'Kavya', role: 'admin', active: true };
const member = { uid: 'm1', name: 'Ananya', role: 'member', active: true };
const T0 = Date.UTC(2026, 9, 1);
const valid = { wasteType: 'plastic', binId: 'bin-h02', location: 'Hostel Block B', zone: 'Hostel Zone', notes: 'Full', priority: 'urgent' };

test('validateNewRequest normalises and rejects bad input', () => {
  const ok = validateNewRequest(valid);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.binId, 'BIN-H02');
  const bad = validateNewRequest({ wasteType: 'gold', binId: '!', location: '' , estKg: -4});
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['binId', 'estKg', 'location', 'wasteType']);
});

test('only supervisors can raise requests', () => {
  const v = validateNewRequest(valid).value;
  assert.throws(() => newRequest(v, ven, T0), LifecycleError);
  const r = newRequest(v, sup, T0);
  assert.equal(r.status, 'OPEN');
  assert.equal(r.createdBy, 's1');
  assert.equal(r.history.length, 1);
});

test('full lifecycle OPEN -> ACCEPTED -> COMPLETED with role checks', () => {
  const r0 = newRequest(validateNewRequest(valid).value, sup, T0);
  assert.deepEqual(allowedActions(r0, ven), ['accept']);
  assert.deepEqual(allowedActions(r0, sup), ['cancel']);
  assert.deepEqual(allowedActions(r0, sup2), []);
  assert.deepEqual(allowedActions(r0, member), []);
  assert.throws(() => transition(r0, 'complete', sup, { weightKg: 4 }, T0), /can't complete/);

  const r1 = transition(r0, 'accept', ven, {}, T0 + 3600e3);
  assert.equal(r1.status, 'ACCEPTED');
  assert.equal(r1.vendorName, 'GreenCycle');
  assert.equal(r0.status, 'OPEN', 'input is not mutated');
  assert.throws(() => transition(r1, 'accept', ven2), LifecycleError, 'cannot accept twice');
  assert.deepEqual(allowedActions(r1, ven2), []);
  assert.deepEqual(allowedActions(r1, ven), ['release']);

  assert.throws(() => transition(r1, 'complete', sup, { weightKg: 0 }), /weight/);
  assert.throws(() => transition(r1, 'complete', sup, { weightKg: 5, rating: 9 }), /Rating/);
  assert.throws(() => transition(r1, 'complete', sup2, { weightKg: 5 }), LifecycleError, 'other supervisor cannot complete');
  const r2 = transition(r1, 'complete', sup, { weightKg: 42.26, rating: 5 }, T0 + 7200e3);
  assert.equal(r2.status, 'COMPLETED');
  assert.equal(r2.weightKg, 42.3);
  assert.equal(r2.history.length, 3);
  assert.deepEqual(allowedActions(r2, admin), []);
});

test('release puts an accepted request back in the pool', () => {
  const r1 = transition(newRequest(validateNewRequest(valid).value, sup, T0), 'accept', ven, {}, T0);
  const r2 = transition(r1, 'release', ven, {}, T0 + 1000);
  assert.equal(r2.status, 'OPEN');
  assert.equal(r2.vendorId, null);
});

test('overdue after 7 days while OPEN or ACCEPTED', () => {
  const r = newRequest(validateNewRequest(valid).value, sup, T0);
  assert.equal(isOverdue(r, T0 + 7 * DAY - 1), false);
  assert.equal(isOverdue(r, T0 + 7 * DAY + 1), true);
  assert.equal(overdueDays(r, T0 + 10 * DAY + 5), 3);
  const done = transition(transition(r, 'accept', ven, {}, T0 + 1), 'complete', sup, { weightKg: 3 }, T0 + 2);
  assert.equal(isOverdue(done, T0 + 30 * DAY), false);
});

test('RBAC permissions and route guards', () => {
  assert.equal(can(sup, 'requests.create'), true);
  assert.equal(can(ven, 'requests.create'), false);
  assert.equal(can({ ...admin, active: false }, 'users.manage'), false);
  assert.equal(guard(null, '/supervisor'), '/login');
  assert.equal(guard(null, '/login'), null);
  assert.equal(guard(sup, '/login'), '/supervisor');
  assert.equal(guard(ven, '/admin/users'), '/vendor');
  assert.equal(guard(admin, '/admin/users'), null);
  assert.equal(guard(member, '/reports'), '/member');
  assert.equal(guard(sup, '/reports'), null);
  assert.equal(homeFor(member), '/member');
});

test('visibleRequests filters by role', () => {
  const a = { id: 1, status: 'OPEN', createdBy: 's1' };
  const b = { id: 2, status: 'ACCEPTED', createdBy: 's2', vendorId: 'v1' };
  const c = { id: 3, status: 'COMPLETED', createdBy: 's1', vendorId: 'v2' };
  assert.deepEqual(visibleRequests(sup, [a, b, c]).map((x) => x.id), [1, 3]);
  assert.deepEqual(visibleRequests(ven, [a, b, c]).map((x) => x.id), [1, 2]);
  assert.deepEqual(visibleRequests(member, [a, b, c]).map((x) => x.id), [3]);
  assert.equal(visibleRequests(admin, [a, b, c]).length, 3);
});

test('stats summarise status, kg, vendors and zones', () => {
  const now = T0 + 20 * DAY;
  const reqs = [
    { status: 'COMPLETED', wasteType: 'plastic', weightKg: 10, createdAt: now - 2 * DAY, acceptedAt: now - 2 * DAY + 3600e3, completedAt: now - DAY, vendorId: 'v1', vendorName: 'A', rating: 5, zone: 'Z1' },
    { status: 'COMPLETED', wasteType: 'organic', weightKg: 30, createdAt: now - 3 * DAY, acceptedAt: now - 3 * DAY, completedAt: now - 3 * DAY + 7200e3, vendorId: 'v2', vendorName: 'B', rating: 4, zone: 'Z2' },
    { status: 'OPEN', wasteType: 'plastic', createdAt: now - 9 * DAY, zone: 'Z1' },
    { status: 'CANCELLED', wasteType: 'glass', createdAt: now - DAY, zone: 'Z2' },
  ];
  const s = summarize(reqs, now);
  assert.equal(s.kg, 40);
  assert.equal(s.overdue, 1);
  assert.equal(s.completionRate, 67);
  assert.equal(byWasteType(reqs).find((t) => t.id === 'plastic').kg, 10);
  assert.equal(dailySeries(reqs, 30, now).reduce((a, d) => a + d.completed, 0), 2);
  assert.equal(vendorBoard(reqs)[0].name, 'B');
  assert.equal(zoneBoard(reqs)[0].zone, 'Z2');
});

test('CSV export escapes quotes and blocks formula injection', () => {
  const csv = requestsToCsv([{ code: 'WR-1', status: 'OPEN', wasteType: 'plastic', notes: '=HYPERLINK("x")', location: 'Block, "A"' }]);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"Block, ""A"""/);
});
