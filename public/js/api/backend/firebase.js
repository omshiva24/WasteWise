// Firebase backend (Auth + Firestore), loaded from Google's CDN only when a
// Firebase config is set in js/config.js. Same API surface as the demo backend.
// Server-side rules (firestore.rules) and Cloud Functions (functions/) enforce
// roles, the request lifecycle, notifications and the 7-day overdue check.

import { newRequest, transition, validateNewRequest, LifecycleError } from '../../core/lifecycle.js';
import { ROLES, STATUS, LIMITS } from '../../core/constants.js';
import { AuthError } from './demo.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
const clean = (s, max = 80) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Email or password is incorrect',
  'auth/wrong-password': 'Email or password is incorrect',
  'auth/user-not-found': 'No account found with that email',
  'auth/email-already-in-use': 'That email already has an account',
  'auth/weak-password': 'Password must be at least 8 characters',
  'auth/invalid-email': 'Enter a valid email address',
  'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again',
  'auth/network-request-failed': 'No internet connection',
};
const authErr = (e) => new AuthError(AUTH_MESSAGES[e?.code] || e?.message || 'Sign-in failed', e?.code || 'auth');

export async function createFirebaseBackend(config) {
  const [appMod, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(config);
  const auth = A.getAuth(app);
  let fs;
  try {
    fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch {
    fs = F.getFirestore(app);
  }
  const col = (name) => F.collection(fs, name);
  const ref = (name, id) => F.doc(fs, name, id);
  const withId = (d) => ({ id: d.id, ...d.data() });

  let current = null;
  let profileUnsub = null;
  const authSubs = new Set();
  const emitAuth = () => authSubs.forEach((fn) => fn(current ? { ...current } : null));
  let ready;
  const readyP = new Promise((r) => (ready = r));

  A.onAuthStateChanged(auth, (fbUser) => {
    profileUnsub?.();
    profileUnsub = null;
    if (!fbUser) {
      current = null;
      emitAuth();
      ready();
      return;
    }
    profileUnsub = F.onSnapshot(
      ref('users', fbUser.uid),
      (snap) => {
        current = snap.exists() ? { uid: fbUser.uid, ...snap.data() } : null;
        emitAuth();
        ready();
      },
      () => {
        current = null;
        emitAuth();
        ready();
      },
    );
  });

  const me = () => {
    if (!current) throw new AuthError('Please sign in first', 'signed-out');
    if (current.active === false) throw new AuthError('Your account is deactivated', 'inactive');
    return current;
  };
  const requireRole = (...roles) => {
    const u = me();
    if (!roles.includes(u.role)) throw new AuthError('You do not have permission for this', 'forbidden');
    return u;
  };
  const log = (action, target, detail = '') =>
    F.addDoc(col('logs'), { at: Date.now(), actor: current?.uid || 'unknown', actorName: current?.name || '', action, target: String(target), detail: clean(detail, 160) }).catch(() => {});

  const api = {
    mode: 'firebase',
    async init() {
      await readyP;
      return api;
    },
    destroy() {
      profileUnsub?.();
    },

    auth: {
      current: () => (current ? { ...current } : null),
      onChange(fn) {
        authSubs.add(fn);
        fn(current ? { ...current } : null);
        return () => authSubs.delete(fn);
      },
      async signIn(email, password) {
        try {
          await A.signInWithEmailAndPassword(auth, clean(email, 120), password);
        } catch (e) {
          throw authErr(e);
        }
        await new Promise((r) => {
          const off = api.auth.onChange((u) => u && (off(), r()));
          setTimeout(r, 4000);
        });
        log('auth.signin', email);
        return api.auth.current();
      },
      async demoSignIn() {
        throw new AuthError('Demo accounts are only available in demo mode');
      },
      async signUp({ name, email, password, requestedRole = 'member', company = '' }) {
        const n = clean(name, LIMITS.name);
        if (n.length < 2) throw new AuthError('Please enter your name', 'name');
        if (String(password || '').length < 8) throw new AuthError('Password must be at least 8 characters', 'weak-password');
        let cred;
        try {
          cred = await A.createUserWithEmailAndPassword(auth, clean(email, 120), password);
        } catch (e) {
          throw authErr(e);
        }
        const role = ['supervisor', 'vendor'].includes(requestedRole) ? requestedRole : null;
        await F.setDoc(ref('users', cred.user.uid), {
          name: n,
          email: cred.user.email,
          role: 'member', // admins promote people; nobody can give themselves a role
          requestedRole: role,
          company: clean(company, LIMITS.name),
          active: true,
          createdAt: Date.now(),
        });
        await A.updateProfile(cred.user, { displayName: n }).catch(() => {});
        log('user.signup', cred.user.email, role ? `Requested ${role} access` : 'Member');
        return api.auth.current();
      },
      async signOut() {
        await A.signOut(auth);
      },
      async updateProfile(patch) {
        const u = me();
        const upd = {};
        if (patch.name != null) upd.name = clean(patch.name, LIMITS.name) || u.name;
        if (patch.phone != null) upd.phone = clean(patch.phone, 20);
        if (patch.company != null && u.role === 'vendor') upd.company = clean(patch.company, LIMITS.name);
        await F.updateDoc(ref('users', u.uid), upd);
        return { ...u, ...upd };
      },
      async savePushToken(token) {
        if (!current || !token) return;
        await F.updateDoc(ref('users', current.uid), { fcmTokens: F.arrayUnion(String(token).slice(0, 400)) }).catch(() => {});
      },
    },

    users: {
      async list() {
        requireRole('admin');
        const snap = await F.getDocs(col('users'));
        return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      },
      async setRole(uid, role) {
        const admin = requireRole('admin');
        if (!ROLES.includes(role)) throw new AuthError('Unknown role');
        if (uid === admin.uid && role !== 'admin') throw new AuthError("You can't remove your own admin role");
        await F.updateDoc(ref('users', uid), { role, requestedRole: null });
        await F.addDoc(col('notifications'), { to: uid, title: 'Your role was updated', body: `You are now a ${role}.`, kind: 'role', requestId: null, at: Date.now(), read: false });
        log('user.role', uid, `Role set to ${role}`);
      },
      async setActive(uid, active) {
        const admin = requireRole('admin');
        if (uid === admin.uid) throw new AuthError("You can't deactivate yourself");
        await F.updateDoc(ref('users', uid), { active: !!active });
        log(active ? 'user.activate' : 'user.deactivate', uid);
      },
      async decline(uid) {
        requireRole('admin');
        await F.updateDoc(ref('users', uid), { requestedRole: null });
        log('user.decline', uid, 'Role request declined');
      },
    },

    requests: {
      watch(fn) {
        const u = current;
        if (!u) {
          fn([]);
          return () => {};
        }
        const sorted = (xs) => xs.sort((a, b) => b.createdAt - a.createdAt);
        const err = (e) => console.warn('[WasteWise] requests listener', e);
        if (u.role === 'vendor') {
          let open = [];
          let mine = [];
          const push = () => {
            const m = new Map([...open, ...mine].map((r) => [r.id, r]));
            fn(sorted([...m.values()]));
          };
          const a = F.onSnapshot(F.query(col('requests'), F.where('status', '==', STATUS.OPEN)), (s) => ((open = s.docs.map(withId)), push()), err);
          const b = F.onSnapshot(F.query(col('requests'), F.where('vendorId', '==', u.uid)), (s) => ((mine = s.docs.map(withId)), push()), err);
          return () => (a(), b());
        }
        const q =
          u.role === 'admin'
            ? F.query(col('requests'), F.orderBy('createdAt', 'desc'), F.limit(1500))
            : u.role === 'supervisor'
              ? F.query(col('requests'), F.where('createdBy', '==', u.uid), F.orderBy('createdAt', 'desc'))
              : F.query(col('requests'), F.where('status', '==', STATUS.COMPLETED), F.orderBy('createdAt', 'desc'), F.limit(1500));
        return F.onSnapshot(q, (s) => fn(sorted(s.docs.map(withId))), err);
      },
      watchPublic(fn) {
        const q = F.query(col('requests'), F.where('status', 'in', [STATUS.OPEN, STATUS.ACCEPTED, STATUS.COMPLETED]), F.limit(2000));
        return F.onSnapshot(q, (s) => fn(s.docs.map((d) => {
          const { photo, notes, ...r } = withId(d);
          return r;
        })), (e) => console.warn(e));
      },
      async get(id) {
        me();
        const s = await F.getDoc(ref('requests', id));
        return s.exists() ? withId(s) : null;
      },
      async create(input) {
        const u = requireRole('supervisor');
        const v = validateNewRequest(input);
        if (!v.ok) throw new LifecycleError(Object.values(v.errors)[0], 'validation');
        const reqRef = F.doc(col('requests'));
        const counterRef = ref('meta', 'counters');
        const created = await F.runTransaction(fs, async (tx) => {
          const c = await tx.get(counterRef);
          const n = c.exists() ? c.data().requests : 1001;
          if (c.exists()) tx.update(counterRef, { requests: n + 1 });
          else tx.set(counterRef, { requests: n + 1 });
          const doc = newRequest(v.value, u, Date.now(), { code: `WR-${n}` });
          tx.set(reqRef, doc);
          return { id: reqRef.id, ...doc };
        });
        log('request.create', created.code, `${v.value.wasteType} at ${v.value.location}`);
        return created;
      },
      async act(id, action, payload = {}) {
        const u = me();
        const r = ref('requests', id);
        const next = await F.runTransaction(fs, async (tx) => {
          const snap = await tx.get(r);
          if (!snap.exists()) throw new LifecycleError('Request not found', 'not-found');
          const cur = withId(snap);
          const n = transition(cur, action, u, payload, Date.now());
          const changed = {};
          for (const k of Object.keys(n)) if (k !== 'id' && JSON.stringify(n[k]) !== JSON.stringify(cur[k])) changed[k] = n[k];
          tx.update(r, changed);
          return n;
        });
        log(`request.${action}`, next.code, next.history[next.history.length - 1].note);
        return next;
      },
    },

    bins: {
      watch(fn) {
        return F.onSnapshot(col('bins'), (s) => fn(s.docs.map(withId).sort((a, b) => a.id.localeCompare(b.id))), (e) => console.warn(e));
      },
      async save(bin) {
        requireRole('admin');
        const id = clean(bin.id, LIMITS.binId).toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(id)) throw new LifecycleError('Bin ID: letters, numbers and dashes only (e.g. BIN-A05)');
        const location = clean(bin.location, LIMITS.location);
        if (location.length < 2) throw new LifecycleError('Enter where the bin is');
        const data = { location, zone: clean(bin.zone, LIMITS.location), wasteType: bin.wasteType || 'mixed', capacityL: Number(bin.capacityL) || 240, createdAt: Date.now() };
        await F.setDoc(ref('bins', id), data, { merge: true });
        log('bin.save', id, location);
        return { id, ...data };
      },
      async remove(id) {
        requireRole('admin');
        await F.deleteDoc(ref('bins', id));
        log('bin.delete', id);
      },
    },

    logs: {
      async list(limit = 200) {
        requireRole('admin');
        const s = await F.getDocs(F.query(col('logs'), F.orderBy('at', 'desc'), F.limit(limit)));
        return s.docs.map(withId);
      },
    },

    notifications: {
      watch(fn) {
        if (!current) {
          fn([]);
          return () => {};
        }
        const q = F.query(col('notifications'), F.where('to', '==', current.uid), F.orderBy('at', 'desc'), F.limit(60));
        return F.onSnapshot(q, (s) => fn(s.docs.map(withId)), (e) => console.warn(e));
      },
      async markRead(id) {
        await F.updateDoc(ref('notifications', id), { read: true }).catch(() => {});
      },
      async markAllRead() {
        if (!current) return;
        const s = await F.getDocs(F.query(col('notifications'), F.where('to', '==', current.uid), F.where('read', '==', false)));
        const batch = F.writeBatch(fs);
        s.docs.forEach((d) => batch.update(d.ref, { read: true }));
        await batch.commit();
      },
    },

    async reset() {
      throw new Error('Reset is only available in demo mode');
    },
  };
  return api;
}
