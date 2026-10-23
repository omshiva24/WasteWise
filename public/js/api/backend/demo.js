// Demo backend: the full app on one device, stored in localStorage, with live
// sync between tabs (open Supervisor in one tab and Vendor in another).
// It simulates what the Firebase Cloud Functions do (notifications, 7-day overdue sweep).

import { newRequest, transition, validateNewRequest, isOverdue, LifecycleError } from '../../core/lifecycle.js';
import { visibleRequests } from '../../core/rbac.js';
import { ROLES, STATUS, LIMITS } from '../../core/constants.js';
import { buildSeed, DEMO_PASSWORD, DEMO_LOGINS } from './seed.js';

const KEY = 'wastewise.demo.v1';
const SESSION = 'wastewise.session';
const CHANNEL = 'wastewise-demo';

export class AuthError extends Error {
  constructor(message, code = 'auth') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

async function hash(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const uid = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const clean = (s, max = 80) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const publicUser = (u) => (u ? { ...u } : null);

export function createDemoBackend({ storage = globalThis.localStorage, now = () => Date.now(), broadcast = true } = {}) {
  let db = null;
  let current = null;
  const subs = new Set();
  const authSubs = new Set();
  let bc = null;
  let sweepTimer = null;

  const save = () => {
    storage.setItem(KEY, JSON.stringify(db));
    bc?.postMessage({ type: 'changed', at: now() });
  };
  const load = () => {
    try {
      const raw = storage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const emit = () => subs.forEach((fn) => fn());
  const emitAuth = () => authSubs.forEach((fn) => fn(publicUser(current)));
  const me = () => {
    if (!current) throw new AuthError('Please sign in first', 'signed-out');
    return current;
  };
  const requireRole = (...roles) => {
    const u = me();
    if (u.active === false) throw new AuthError('Your account is deactivated', 'inactive');
    if (!roles.includes(u.role)) throw new AuthError('You do not have permission for this', 'forbidden');
    return u;
  };
  const log = (action, target, detail = '') => {
    db.logs.unshift({ id: uid(), at: now(), actor: current?.uid || 'system', actorName: current?.name || 'System', action, target, detail: clean(detail, 160) });
    db.logs = db.logs.slice(0, 800);
  };
  const notify = (to, title, body, requestId = null, kind = 'info') => {
    db.notifications.unshift({ id: uid(), to, title: clean(title, 80), body: clean(body, 160), requestId, kind, at: now(), read: false });
    db.notifications = db.notifications.slice(0, 600);
  };
  const usersBy = (fn) => Object.values(db.users).filter((u) => u.active !== false && fn(u));

  /** Mirrors the Cloud Function `flagOverdueRequests`. */
  const sweepOverdue = () => {
    let changed = false;
    for (const r of Object.values(db.requests)) {
      if (isOverdue(r, now()) && !r.overdueNotified) {
        r.overdue = true;
        r.overdueNotified = true;
        changed = true;
        const body = `${r.code} at ${r.location} has waited more than 7 days`;
        for (const a of usersBy((u) => u.role === 'admin')) notify(a.uid, 'Request overdue', body, r.id, 'overdue');
        notify(r.createdBy, 'Request overdue', body, r.id, 'overdue');
        if (r.vendorId) notify(r.vendorId, 'Pickup overdue', body, r.id, 'overdue');
        db.logs.unshift({ id: uid(), at: now(), actor: 'system', actorName: 'Overdue check', action: 'request.overdue', target: r.code, detail: 'Flagged after 7 days' });
      }
    }
    if (changed) save();
    return changed;
  };

  const api = {
    mode: 'demo',

    async init() {
      db = load();
      if (!db || db.version !== 1) {
        db = buildSeed(now());
        save();
      }
      if (!db.passwords || !Object.keys(db.passwords).length) {
        db.passwords = {};
        for (const u of Object.values(db.users)) {
          const salt = uid();
          db.passwords[u.uid] = { salt, hash: await hash(DEMO_PASSWORD, salt) };
        }
        save();
      }
      const sid = storage.getItem(SESSION);
      current = sid && db.users[sid] ? db.users[sid] : null;
      if (broadcast && typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(CHANNEL);
        bc.onmessage = () => {
          db = load() || db;
          if (current) current = db.users[current.uid] || null;
          emit();
          emitAuth();
        };
      }
      sweepOverdue();
      if (typeof setInterval !== 'undefined' && broadcast) sweepTimer = setInterval(() => sweepOverdue() && emit(), 60_000);
      return api;
    },

    destroy() {
      bc?.close();
      if (sweepTimer) clearInterval(sweepTimer);
    },

    // ------------------------------------------------------------- auth
    auth: {
      current: () => publicUser(current),
      onChange(fn) {
        authSubs.add(fn);
        fn(publicUser(current));
        return () => authSubs.delete(fn);
      },
      async signIn(email, password) {
        const e = clean(email, 120).toLowerCase();
        const u = Object.values(db.users).find((x) => x.email === e);
        if (!u || !db.passwords[u.uid]) throw new AuthError('No account found with that email', 'not-found');
        const p = db.passwords[u.uid];
        if ((await hash(password, p.salt)) !== p.hash) throw new AuthError('Wrong password. Demo accounts use demo1234', 'wrong-password');
        current = u;
        storage.setItem(SESSION, u.uid);
        log('auth.signin', u.email);
        save();
        emitAuth();
        return publicUser(u);
      },
      async demoSignIn(role) {
        return api.auth.signIn(DEMO_LOGINS[role], DEMO_PASSWORD);
      },
      async signUp({ name, email, password, requestedRole = 'member', company = '' }) {
        const n = clean(name, LIMITS.name);
        const e = clean(email, 120).toLowerCase();
        if (n.length < 2) throw new AuthError('Please enter your name', 'name');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new AuthError('Enter a valid email address', 'email');
        if (String(password || '').length < 8) throw new AuthError('Password must be at least 8 characters', 'weak-password');
        if (Object.values(db.users).some((x) => x.email === e)) throw new AuthError('That email already has an account', 'exists');
        const role = ['supervisor', 'vendor', 'member'].includes(requestedRole) ? requestedRole : 'member';
        const u = { uid: uid(), name: n, email: e, role: 'member', requestedRole: role === 'member' ? null : role, company: clean(company, LIMITS.name), active: true, createdAt: now() };
        const salt = uid();
        db.passwords[u.uid] = { salt, hash: await hash(password, salt) };
        db.users[u.uid] = u;
        current = u;
        storage.setItem(SESSION, u.uid);
        log('user.signup', e, u.requestedRole ? `Requested ${u.requestedRole} access` : 'Member');
        if (u.requestedRole) for (const a of usersBy((x) => x.role === 'admin')) notify(a.uid, `New ${u.requestedRole} request`, `${n} wants ${u.requestedRole} access`, null, 'role');
        save();
        emitAuth();
        return publicUser(u);
      },
      async signOut() {
        if (current) log('auth.signout', current.email);
        current = null;
        storage.removeItem(SESSION);
        save();
        emitAuth();
      },
      async updateProfile(patch) {
        const u = me();
        const next = { ...db.users[u.uid] };
        if (patch.name != null) next.name = clean(patch.name, LIMITS.name) || next.name;
        if (patch.phone != null) next.phone = clean(patch.phone, 20);
        if (patch.company != null && u.role === 'vendor') next.company = clean(patch.company, LIMITS.name);
        db.users[u.uid] = next;
        current = next;
        save();
        emitAuth();
        emit();
        return publicUser(next);
      },
    },

    // ------------------------------------------------------------- users (admin)
    users: {
      async list() {
        requireRole('admin');
        return Object.values(db.users).sort((a, b) => a.name.localeCompare(b.name));
      },
      async setRole(targetUid, role) {
        const admin = requireRole('admin');
        if (!ROLES.includes(role)) throw new AuthError('Unknown role');
        const u = db.users[targetUid];
        if (!u) throw new AuthError('User not found');
        if (u.uid === admin.uid && role !== 'admin') throw new AuthError("You can't remove your own admin role");
        db.users[targetUid] = { ...u, role, requestedRole: null };
        log('user.role', u.email, `Role set to ${role}`);
        notify(u.uid, 'Your role was updated', `You are now a ${role}. Sign in again to see your new screens.`, null, 'role');
        save();
        emit();
        if (current?.uid === targetUid) {
          current = db.users[targetUid];
          emitAuth();
        }
        return db.users[targetUid];
      },
      async setActive(targetUid, active) {
        const admin = requireRole('admin');
        const u = db.users[targetUid];
        if (!u) throw new AuthError('User not found');
        if (u.uid === admin.uid) throw new AuthError("You can't deactivate yourself");
        db.users[targetUid] = { ...u, active: !!active };
        log(active ? 'user.activate' : 'user.deactivate', u.email);
        save();
        emit();
        return db.users[targetUid];
      },
      async decline(targetUid) {
        requireRole('admin');
        const u = db.users[targetUid];
        if (!u) throw new AuthError('User not found');
        db.users[targetUid] = { ...u, requestedRole: null };
        log('user.decline', u.email, 'Role request declined');
        notify(u.uid, 'Role request declined', 'You can keep using WasteWise as a member.', null, 'role');
        save();
        emit();
      },
    },

    // ------------------------------------------------------------- requests
    requests: {
      /** Live list of the requests this user may see (newest first). */
      watch(fn) {
        const push = () => fn(current ? visibleRequests(current, Object.values(db.requests)).sort((a, b) => b.createdAt - a.createdAt) : []);
        subs.add(push);
        push();
        return () => subs.delete(push);
      },
      /** Open, accepted and completed requests without notes/photos (community stats for every role). */
      watchPublic(fn) {
        const push = () => fn(Object.values(db.requests).filter((r) => r.status === STATUS.COMPLETED || r.status === STATUS.OPEN || r.status === STATUS.ACCEPTED).map(({ photo, notes, ...r }) => r));
        subs.add(push);
        push();
        return () => subs.delete(push);
      },
      async get(id) {
        me();
        const r = db.requests[id];
        if (!r || !visibleRequests(current, [r]).length) return null;
        return r;
      },
      async create(input) {
        const u = requireRole('supervisor');
        const v = validateNewRequest(input);
        if (!v.ok) throw new LifecycleError(Object.values(v.errors)[0], 'validation');
        const id = uid();
        const code = `WR-${db.nextCode++}`;
        const req = newRequest(v.value, u, now(), { id, code });
        db.requests[id] = req;
        log('request.create', code, `${v.value.wasteType} at ${v.value.location}`);
        for (const vend of usersBy((x) => x.role === 'vendor')) notify(vend.uid, req.priority === 'urgent' ? 'Urgent pickup nearby' : 'New pickup nearby', `${code} - ${req.location}`, id, 'new');
        save();
        emit();
        return req;
      },
      async act(id, action, payload = {}) {
        const u = me();
        if (u.active === false) throw new AuthError('Your account is deactivated', 'inactive');
        const r = db.requests[id];
        if (!r) throw new LifecycleError('Request not found', 'not-found');
        const next = transition(r, action, u, payload, now());
        db.requests[id] = next;
        log(`request.${action}`, next.code, next.history[next.history.length - 1].note);
        if (action === 'accept') notify(next.createdBy, 'Pickup accepted', `${next.vendorName} accepted ${next.code}`, id, 'accepted');
        if (action === 'complete' && next.vendorId) notify(next.vendorId, 'Handover confirmed', `${next.code}: ${next.weightKg} kg handed over${next.rating ? ` - rated ${next.rating}/5` : ''}`, id, 'completed');
        if (action === 'release') {
          notify(next.createdBy, 'Pickup released', `${next.code} is open again`, id, 'released');
          for (const vend of usersBy((x) => x.role === 'vendor' && x.uid !== u.uid)) notify(vend.uid, 'Pickup available again', `${next.code} - ${next.location}`, id, 'new');
        }
        if (action === 'cancel' && r.vendorId) notify(r.vendorId, 'Request cancelled', `${next.code} was cancelled`, id, 'cancelled');
        save();
        emit();
        return next;
      },
    },

    // ------------------------------------------------------------- bins
    bins: {
      watch(fn) {
        const push = () => fn(Object.values(db.bins).sort((a, b) => a.id.localeCompare(b.id)));
        subs.add(push);
        push();
        return () => subs.delete(push);
      },
      async save(bin) {
        requireRole('admin');
        const id = clean(bin.id, LIMITS.binId).toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(id)) throw new LifecycleError('Bin ID: letters, numbers and dashes only (e.g. BIN-A05)');
        const location = clean(bin.location, LIMITS.location);
        if (location.length < 2) throw new LifecycleError('Enter where the bin is');
        db.bins[id] = { id, location, zone: clean(bin.zone, LIMITS.location), wasteType: bin.wasteType || 'mixed', capacityL: Number(bin.capacityL) || 240, createdAt: db.bins[id]?.createdAt || now() };
        log('bin.save', id, location);
        save();
        emit();
        return db.bins[id];
      },
      async remove(id) {
        requireRole('admin');
        delete db.bins[id];
        log('bin.delete', id);
        save();
        emit();
      },
    },

    // ------------------------------------------------------------- logs & notifications
    logs: {
      async list(limit = 200) {
        requireRole('admin');
        return db.logs.slice(0, limit);
      },
    },

    notifications: {
      watch(fn) {
        const push = () => fn(current ? db.notifications.filter((n) => n.to === current.uid) : []);
        subs.add(push);
        push();
        return () => subs.delete(push);
      },
      async markRead(id) {
        const n = db.notifications.find((x) => x.id === id && x.to === current?.uid);
        if (n && !n.read) {
          n.read = true;
          save();
          emit();
        }
      },
      async markAllRead() {
        let changed = false;
        for (const n of db.notifications) if (n.to === current?.uid && !n.read) (n.read = true), (changed = true);
        if (changed) {
          save();
          emit();
        }
      },
    },

    /** Demo only: wipe and re-seed. */
    async reset() {
      api.destroy();
      storage.removeItem(KEY);
      storage.removeItem(SESSION);
      db = null;
      current = null;
      await api.init();
      emit();
      emitAuth();
    },

    // test hooks
    _db: () => db,
    _sweep: () => sweepOverdue(),
  };
  return api;
}
