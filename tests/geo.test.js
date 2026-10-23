import test from 'node:test';
import assert from 'node:assert/strict';
import { normGeo, distanceKm, fmtDistance, directionsUrl, shortAddress } from '../public/js/core/geo.js';
import { validateNewRequest, newRequest, transition } from '../public/js/core/lifecycle.js';
import { guard, homeFor } from '../public/js/core/rbac.js';
import { fmtPhone, plural } from '../public/js/core/format.js';

test('normGeo keeps valid positions and rejects junk', () => {
  assert.deepEqual(normGeo({ lat: 12.02361234567, lng: 79.8566, acc: 12.6 }), { lat: 12.023612, lng: 79.8566, acc: 13 });
  assert.equal(normGeo({ lat: 120, lng: 10 }), null);
  assert.equal(normGeo({ lat: 0, lng: 0 }), null);
  assert.equal(normGeo(null), null);
  assert.equal(normGeo({ lat: '12.5', lng: '79.1' }).lat, 12.5);
});

test('distance and formatting', () => {
  const a = { lat: 12.0236, lng: 79.8566 };
  const b = { lat: 12.0276, lng: 79.8596 };
  const d = distanceKm(a, b);
  assert.ok(d > 0.5 && d < 0.6, `got ${d}`);
  assert.equal(fmtDistance(d), '550 m');
  assert.equal(fmtDistance(3.456), '3.5 km');
  assert.equal(fmtDistance(42.4), '42 km');
  assert.match(directionsUrl(a), /destination=12.0236,79.8566/);
});

test('shortAddress builds a readable place name', () => {
  assert.equal(shortAddress({ name: 'Central Library', address: { road: 'Library Road', suburb: 'Kalapet', city: 'Puducherry' } }), 'Central Library, Library Road, Kalapet');
  assert.equal(shortAddress({ address: { road: 'MG Road', city: 'Puducherry' } }), 'MG Road, Puducherry');
  assert.equal(shortAddress(null), '');
});

test('a pickup can be raised for a pinned spot without a registered bin', () => {
  const v = validateNewRequest({ wasteType: 'paper', binId: '', location: 'Back gate', geo: { lat: 12.02, lng: 79.85, acc: 9 } });
  assert.equal(v.ok, true);
  assert.equal(v.value.binId, '');
  assert.deepEqual(v.value.geo, { lat: 12.02, lng: 79.85, acc: 9 });
  const noWhere = validateNewRequest({ wasteType: 'paper', location: '' });
  assert.equal(noWhere.ok, false);
  assert.ok(noWhere.errors.location);
});

test('contact numbers travel with the request', () => {
  const sup = { uid: 's1', role: 'supervisor', name: 'Sam', phone: '+919000000009' };
  const ven = { uid: 'v1', role: 'vendor', name: 'Vik', company: 'GreenCycle', phone: '+919000000002' };
  const r = { id: 'x', ...newRequest({ wasteType: 'paper', binId: '', location: 'Gate', zone: '', notes: '', priority: 'normal', estKg: null, geo: null }, sup, 1000) };
  assert.equal(r.createdByPhone, '+919000000009');
  const acc = transition(r, 'accept', ven, {}, 2000);
  assert.equal(acc.vendorPhone, '+919000000002');
  const rel = transition(acc, 'release', ven, {}, 3000);
  assert.equal(rel.vendorPhone, null);
});

test('new accounts must finish their profile first', () => {
  const fresh = { uid: 'n', needsProfile: true };
  assert.equal(homeFor(fresh), '/setup');
  assert.equal(guard(fresh, '/vendor'), '/setup');
  assert.equal(guard(fresh, '/setup'), null);
  assert.equal(guard({ uid: 'm', role: 'member', active: true }, '/setup'), '/member');
  assert.equal(guard({ uid: 'm', role: 'member', active: true }, '/map'), null);
  assert.equal(guard(null, '/setup'), '/login');
});

test('phone and plural formatting', () => {
  assert.equal(fmtPhone('+919876543210'), '+91 98765 43210');
  assert.equal(fmtPhone('+14155550123'), '+14155550123');
  assert.equal(fmtPhone(''), '');
  assert.equal(plural(1, 'pickup'), '1 pickup');
  assert.equal(plural(3, 'pickup'), '3 pickups');
});
