// Tiny in-browser stand-in for the Firebase JS SDK (Auth + Firestore), used only by
// the local end-to-end test when Google's servers can't be reached. CI runs the same
// test against the real Firebase emulators, which also enforce firestore.rules.
// Phone sign-in accepts the code 123456.

const DB_KEY = 'fakefs.db';
const AUTH_KEY = 'fakefs.auth';
const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || d;
  } catch {
    return d;
  }
};
const db = load(DB_KEY, {});
const accounts = load(AUTH_KEY, { users: {}, session: null });
const saveDb = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
const saveAuth = () => localStorage.setItem(AUTH_KEY, JSON.stringify(accounts));
const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
const err = (code, message = code) => Object.assign(new Error(message), { code });
const later = (fn) => setTimeout(fn, 5);

// ---------------------------------------------------------------- app
export function initializeApp(config) {
  return { options: config };
}

// ---------------------------------------------------------------- auth
const authListeners = new Set();
const authObj = { currentUser: null, settings: {}, languageCode: 'en' };
const asUser = (a) => (a ? { uid: a.uid, email: a.email || null, phoneNumber: a.phone || null, displayName: a.displayName || null } : null);
authObj.currentUser = asUser(accounts.session && accounts.users[accounts.session]);
const emitAuth = () => {
  authObj.currentUser = asUser(accounts.session && accounts.users[accounts.session]);
  authListeners.forEach((cb) => later(() => cb(authObj.currentUser)));
};
const startSession = (a) => {
  accounts.session = a.uid;
  saveAuth();
  emitAuth();
  return { user: asUser(a) };
};

export const getAuth = () => authObj;
export const useDeviceLanguage = () => {};
export const connectAuthEmulator = () => {};
export function onAuthStateChanged(_auth, cb) {
  authListeners.add(cb);
  later(() => cb(authObj.currentUser));
  return () => authListeners.delete(cb);
}
export async function signInWithEmailAndPassword(_a, email, password) {
  const a = Object.values(accounts.users).find((u) => u.email === String(email).toLowerCase());
  if (!a || a.password !== password) throw err('auth/invalid-credential');
  return startSession(a);
}
export async function createUserWithEmailAndPassword(_a, email, password) {
  const e = String(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw err('auth/invalid-email');
  if (Object.values(accounts.users).some((u) => u.email === e)) throw err('auth/email-already-in-use');
  if (String(password).length < 6) throw err('auth/weak-password');
  const a = { uid: rid(), email: e, password };
  accounts.users[a.uid] = a;
  return startSession(a);
}
export async function updateProfile(user, { displayName }) {
  const a = accounts.users[user.uid];
  if (a) {
    a.displayName = displayName;
    saveAuth();
    authObj.currentUser = asUser(a);
  }
}
export async function sendPasswordResetEmail() {}
export class GoogleAuthProvider {
  setCustomParameters() {}
}
export async function signInWithPopup() {
  let a = Object.values(accounts.users).find((u) => u.email === 'google.user@gmail.com');
  if (!a) {
    a = { uid: rid(), email: 'google.user@gmail.com', displayName: 'Gita Google' };
    accounts.users[a.uid] = a;
  }
  return startSession(a);
}
export const signInWithRedirect = signInWithPopup;
export class RecaptchaVerifier {
  clear() {}
}
export async function signInWithPhoneNumber(_a, phone) {
  if (!/^\+\d{8,15}$/.test(phone)) throw err('auth/invalid-phone-number');
  return {
    async confirm(code) {
      if (code !== '123456') throw err('auth/invalid-verification-code');
      let a = Object.values(accounts.users).find((u) => u.phone === phone);
      if (!a) {
        a = { uid: rid(), phone };
        accounts.users[a.uid] = a;
      }
      return startSession(a);
    },
  };
}
export async function signOut() {
  accounts.session = null;
  saveAuth();
  emitAuth();
}

// ---------------------------------------------------------------- firestore
const subs = new Set();
const notify = () => {
  saveDb();
  for (const s of [...subs]) later(s);
};
const table = (name) => (db[name] ||= {});
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export const initializeFirestore = () => ({});
export const getFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const connectFirestoreEmulator = () => {};

export const collection = (_db, name) => ({ kind: 'col', name });
export function doc(a, name, id) {
  if (a?.kind === 'col') return { kind: 'doc', col: a.name, id: name || rid() };
  return { kind: 'doc', col: name, id };
}
export const where = (field, op, value) => ({ t: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ t: 'order', field, dir });
export const limit = (n) => ({ t: 'limit', n });
export const query = (col, ...cs) => ({ kind: 'query', col: col.name, cs });

const snapDoc = (ref) => {
  const d = table(ref.col)[ref.id];
  return { id: ref.id, ref, exists: () => d !== undefined, data: () => clone(d), metadata: { fromCache: false } };
};
function runQuery(q) {
  let rows = Object.entries(table(q.col)).map(([id, d]) => ({ id, d }));
  for (const c of q.cs || []) {
    if (c.t === 'where') rows = rows.filter(({ d }) => (c.op === 'in' ? c.value.includes(d[c.field]) : d[c.field] === c.value));
  }
  const o = (q.cs || []).find((c) => c.t === 'order');
  if (o) rows.sort((a, b) => (a.d[o.field] > b.d[o.field] ? 1 : -1) * (o.dir === 'desc' ? -1 : 1));
  const l = (q.cs || []).find((c) => c.t === 'limit');
  if (l) rows = rows.slice(0, l.n);
  return { docs: rows.map(({ id }) => snapDoc({ kind: 'doc', col: q.col, id })), size: rows.length };
}
export function onSnapshot(target, a, b) {
  const next = typeof a === 'function' ? a : b;
  const fire = () => next(target.kind === 'doc' ? snapDoc(target) : runQuery(target.kind === 'col' ? { col: target.name, cs: [] } : target));
  subs.add(fire);
  later(fire);
  return () => subs.delete(fire);
}
export const getDoc = async (ref) => snapDoc(ref);
export const getDocs = async (q) => runQuery(q.kind === 'col' ? { col: q.name, cs: [] } : q);

const ARRAY_UNION = '__arrayUnion__';
export const arrayUnion = (...values) => ({ [ARRAY_UNION]: values });
const applyPatch = (cur, patch) => {
  const out = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && ARRAY_UNION in v) out[k] = [...new Set([...(out[k] || []), ...v[ARRAY_UNION]])];
    else out[k] = clone(v);
  }
  return out;
};
const write = {
  set: (ref, data, opts) => {
    const t = table(ref.col);
    t[ref.id] = opts?.merge ? applyPatch(t[ref.id] || {}, data) : applyPatch({}, data);
  },
  update: (ref, patch) => {
    const t = table(ref.col);
    if (!t[ref.id]) throw err('not-found', 'No document to update');
    t[ref.id] = applyPatch(t[ref.id], patch);
  },
  delete: (ref) => delete table(ref.col)[ref.id],
};
export async function setDoc(ref, data, opts) {
  write.set(ref, data, opts);
  notify();
}
export async function updateDoc(ref, patch) {
  write.update(ref, patch);
  notify();
}
export async function addDoc(col, data) {
  const ref = doc(col);
  write.set(ref, data);
  notify();
  return ref;
}
export async function deleteDoc(ref) {
  write.delete(ref);
  notify();
}
export function writeBatch() {
  const ops = [];
  const b = {
    set: (r, d, o) => (ops.push(() => write.set(r, d, o)), b),
    update: (r, p) => (ops.push(() => write.update(r, p)), b),
    delete: (r) => (ops.push(() => write.delete(r)), b),
    commit: async () => {
      ops.forEach((f) => f());
      notify();
    },
  };
  return b;
}
export async function runTransaction(_db, fn) {
  const before = JSON.stringify(db);
  const ops = [];
  const tx = {
    get: async (r) => snapDoc(r),
    set: (r, d, o) => (ops.push(() => write.set(r, d, o)), tx),
    update: (r, p) => (ops.push(() => write.update(r, p)), tx),
    delete: (r) => (ops.push(() => write.delete(r)), tx),
  };
  try {
    const out = await fn(tx);
    ops.forEach((f) => f());
    notify();
    return out;
  } catch (e) {
    Object.assign(db, JSON.parse(before));
    throw e;
  }
}
