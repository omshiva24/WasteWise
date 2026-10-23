// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Firebase backend (Auth + Firestore) loaded from Google's CDN.
// Real accounts (phone OTP, email + password, Google) and live data shared by
// every phone and browser. Firestore security rules (firestore.rules) enforce
// roles and the request lifecycle on the server; everything here also works on
// the free Spark plan (no Cloud Functions needed).

import { newRequest, transition, validateNewRequest, LifecycleError } from '../../core/lifecycle.js';
import { ROLES, STATUS, LIMITS } from '../../core/constants.js';
import { normGeo } from '../../core/geo.js';
import { AuthError } from '../errors.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
const clean = (s, max = 80) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Email or password is incorrect',
  'auth/invalid-login-credentials': 'Email or password is incorrect',
  'auth/wrong-password': 'Email or password is incorrect',
  'auth/user-not-found': 'No account found with that email',
  'auth/email-already-in-use': 'That email already has an account - sign in instead',
  'auth/weak-password': 'Password must be at least 8 characters',
  'auth/invalid-email': 'Enter a valid email address',
  'auth/missing-email': 'Enter your email address',
  'auth/missing-password': 'Enter your password',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again',
  'auth/network-request-failed': 'No internet connection',
  'auth/invalid-phone-number': 'Enter a valid mobile number',
  'auth/missing-phone-number': 'Enter your mobile number',
  'auth/invalid-verification-code': "That code isn't right - check the SMS and try again",
  'auth/missing-verification-code': 'Enter the 6-digit code from the SMS',
  'auth/code-expired': 'That code has expired - tap "Resend code"',
  'auth/quota-exceeded': 'SMS limit reached for now. Please sign in with email or Google',
  'auth/captcha-check-failed': 'Security check failed. Reload the page and try again',
  'auth/billing-not-enabled': 'Phone OTP is not switched on yet (needs the Firebase Blaze plan). Please use email or Google',
  'auth/operation-not-allowed': 'This sign-in method is not switched on yet. Please use another one',
  'auth/admin-restricted-operation': 'This sign-in method is not switched on yet. Please use another one',
  'auth/unauthorized-domain': 'This website is not yet allowed to sign in (Firebase > Authentication > Authorized domains)',
  'auth/popup-blocked': 'Your browser blocked the Google window - allow pop-ups and try again',
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing',
  'auth/cancelled-popup-request': 'Google sign-in was closed before finishing',
  'auth/account-exists-with-different-credential': 'This email already signs in another way - use email or phone instead',
  'auth/requires-recent-login': 'For your security, please sign out and sign in again first',
  'auth/user-disabled': 'This account has been disabled',
  'auth/operation-not-supported-in-this-environment': 'This sign-in method is not available inside the app - please use another one',
};
const authErr = (e) => {
  console.warn('[WasteWise] auth', e?.code, e?.message);
  if (e instanceof AuthError) return e;
  return new AuthError(AUTH_MESSAGES[e?.code] || 'Sign-in failed. Please try again', e?.code || 'auth');
};
const dbErr = (e) => {
  if (e instanceof AuthError || e instanceof LifecycleError) return e;
  console.warn('[WasteWise] database', e?.code, e?.message);
  if (e?.code === 'permission-denied') return new AuthError('Not allowed - your role may have changed. Pull down to refresh or sign in again', 'permission-denied');
  if (e?.code === 'unavailable') return new AuthError('No internet connection - please try again', 'offline');
  return new AuthError(e?.message || 'Something went wrong', e?.code || 'db');
};

export async function createFirebaseBackend(config, { emulator } = {}) {
  const [appMod, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(config);
  const auth = A.getAuth(app);
  try {
    A.useDeviceLanguage(auth);
  } catch {
    /* optional */
  }
  let fs;
  if (emulator) {
    A.connectAuthEmulator(auth, emulator.auth, { disableWarnings: true });
    auth.settings.appVerificationDisabledForTesting = true;
    fs = F.initializeFirestore(app, {});
    F.connectFirestoreEmulator(fs, emulator.firestore[0], emulator.firestore[1]);
  } else {
    try {
      fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    } catch {
      fs = F.getFirestore(app);
    }
  }
  /** onSnapshot that re-subscribes after transient errors (e.g. right after a role change). */
  const listen = (target, next, label) => {
    let unsub = null;
    let stopped = false;
    let tries = 0;
    let timer = null;
    const start = () => {
      unsub = F.onSnapshot(target, (snap) => {
        tries = 0;
        next(snap);
      }, (e) => {
        console.warn(`[WasteWise] ${label} listener`, e?.code, e?.message);
        if (stopped || tries >= 6) return;
        tries += 1;
        timer = setTimeout(() => !stopped && start(), 700 * tries);
      });
    };
    start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsub?.();
    };
  };
  const col = (name) => F.collection(fs, name);
  const ref = (name, id) => F.doc(fs, name, id);
  const withId = (d) => ({ id: d.id, ...d.data() });

  let current = null;
  let signingUp = false;
  let profileUnsub = null;
  let pendingTimer = null;
  const authSubs = new Set();
  const emitAuth = () => authSubs.forEach((fn) => fn(current ? { ...current } : null));
  let ready;
  const readyP = new Promise((r) => (ready = r));
  setTimeout(() => ready(), 8000); // never hang on the splash screen

  const stub = (fb, extra = {}) => ({ uid: fb.uid, needsProfile: true, name: fb.displayName || '', email: fb.email || '', phone: fb.phoneNumber || '', ...extra });

  A.onAuthStateChanged(auth, (fbUser) => {
    profileUnsub?.();
    profileUnsub = null;
    clearTimeout(pendingTimer);
    if (!fbUser) {
      current = null;
      emitAuth();
      ready();
      return;
    }
    profileUnsub = F.onSnapshot(
      ref('users', fbUser.uid),
      { includeMetadataChanges: true },
      (snap) => {
        clearTimeout(pendingTimer);
        // A brand-new profile: wait until the server has saved it, otherwise the first
        // queries can reach the server before the profile exists and be refused.
        if (snap.exists() && snap.metadata.hasPendingWrites && (!current || current.needsProfile)) return;
        if (!snap.exists() && signingUp) return; // email sign-up creates the profile right away
        if (snap.exists()) {
          current = { uid: fbUser.uid, ...snap.data() };
        } else if (snap.metadata.fromCache) {
          // Not in this device's cache yet - wait for the server before deciding it's a new account.
          pendingTimer = setTimeout(() => {
            current = stub(fbUser);
            emitAuth();
            ready();
          }, 6000);
          return;
        } else {
          current = stub(fbUser);
        }
        emitAuth();
        ready();
      },
      (e) => {
        console.warn('[WasteWise] profile listener', e?.code, e?.message);
        current = stub(fbUser, { dbError: e?.code || 'unknown' });
        emitAuth();
        ready();
      },
    );
  });

  const me = () => {
    if (!current) throw new AuthError('Please sign in first', 'signed-out');
    if (current.needsProfile) throw new AuthError('Please finish setting up your profile', 'no-profile');
    if (current.active === false) throw new AuthError('Your account is deactivated', 'inactive');
    return current;
  };
  const requireRole = (...roles) => {
    const u = me();
    if (!roles.includes(u.role)) throw new AuthError('You do not have permission for this', 'forbidden');
    return u;
  };
  const log = (action, target, detail = '') => {
    if (!current || current.needsProfile) return Promise.resolve();
    return F.addDoc(col('logs'), { at: Date.now(), actor: current.uid, actorName: current.name || '', action, target: String(target), detail: clean(detail, 160) }).catch(() => {});
  };
  /** In-app notification for another person (shown in their bell + toast). */
  const notify = (to, title, body, requestId = null, kind = 'info') => {
    if (!to || !current || to === current.uid) return Promise.resolve();
    return F.addDoc(col('notifications'), { to, from: current.uid, title: clean(title, 80), body: clean(body, 160), requestId, kind, at: Date.now(), read: false }).catch((e) => console.warn('[WasteWise] notify', e?.code));
  };
  const setupInfo = async () => {
    const s = await F.getDoc(ref('meta', 'setup'));
    return s.exists() ? s.data() : null;
  };

  let verifier = null;
  function freshVerifier() {
    try {
      verifier?.clear();
    } catch {
      /* already cleared */
    }
    document.getElementById('recaptcha-box')?.remove();
    const box = document.createElement('div');
    box.id = 'recaptcha-box';
    document.body.append(box);
    verifier = new A.RecaptchaVerifier(auth, box, { size: 'invisible' });
    return verifier;
  }

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
          await A.signInWithEmailAndPassword(auth, clean(email, 120), String(password || ''));
        } catch (e) {
          throw authErr(e);
        }
        log('auth.signin', clean(email, 120));
        return api.auth.current();
      },
      async signUp({ name, email, password, requestedRole = 'member', company = '', phone = '' }) {
        const n = clean(name, LIMITS.name);
        if (n.length < 2) throw new AuthError('Please enter your name', 'name');
        if (String(password || '').length < 8) throw new AuthError('Password must be at least 8 characters', 'weak-password');
        signingUp = true;
        try {
          const cred = await A.createUserWithEmailAndPassword(auth, clean(email, 120), password);
          await A.updateProfile(cred.user, { displayName: n }).catch(() => {});
        } catch (e) {
          signingUp = false;
          throw authErr(e);
        }
        try {
          return await api.auth.completeProfile({ name: n, requestedRole, company, phone });
        } finally {
          signingUp = false;
          // If the profile could not be saved, show the profile page so they can try again.
          if (!current && auth.currentUser) {
            current = stub(auth.currentUser);
            emitAuth();
          }
        }
      },
      async resetPassword(email) {
        const e = clean(email, 120);
        if (!e) throw new AuthError('Enter your email address first', 'missing-email');
        try {
          await A.sendPasswordResetEmail(auth, e);
        } catch (err) {
          if (err?.code === 'auth/user-not-found') return; // don't reveal which emails exist
          throw authErr(err);
        }
      },
      async google() {
        const provider = new A.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
          await A.signInWithPopup(auth, provider);
        } catch (e) {
          if (e?.code === 'auth/popup-blocked') {
            await A.signInWithRedirect(auth, provider);
            return;
          }
          throw authErr(e);
        }
      },
      /** Step 1 of phone sign-in: sends the SMS. Returns { confirm(code) } for step 2. */
      async phoneStart(e164) {
        const phone = String(e164 || '').replace(/[^\d+]/g, '');
        if (!/^\+\d{8,15}$/.test(phone)) throw new AuthError('Enter a valid mobile number', 'invalid-phone');
        let confirmation;
        try {
          confirmation = await A.signInWithPhoneNumber(auth, phone, freshVerifier());
        } catch (e) {
          freshVerifier();
          throw authErr(e);
        }
        return {
          phone,
          async confirm(code) {
            const c = String(code || '').replace(/\D/g, '');
            if (c.length !== 6) throw new AuthError('Enter the 6-digit code from the SMS', 'code');
            try {
              await confirmation.confirm(c);
            } catch (e) {
              throw authErr(e);
            }
          },
        };
      },
      /** True when nobody has set up WasteWise yet - the first account becomes the admin. */
      async isFirstAccount() {
        try {
          return !(await setupInfo());
        } catch {
          return false;
        }
      },
      /** Creates the profile for a freshly signed-in account. */
      async completeProfile({ name, requestedRole = 'member', company = '', phone = '' }) {
        const fb = auth.currentUser;
        if (!fb) throw new AuthError('Please sign in first', 'signed-out');
        const n = clean(name, LIMITS.name);
        if (n.length < 2) throw new AuthError('Please enter your name', 'name');
        const wanted = ['supervisor', 'vendor'].includes(requestedRole) ? requestedRole : null;
        const base = {
          name: n,
          email: fb.email || '',
          phone: fb.phoneNumber || clean(phone, 20),
          company: clean(company, LIMITS.name),
          active: true,
          createdAt: Date.now(),
        };
        try {
          const setup = await setupInfo();
          if (!setup) {
            // Very first account: becomes the admin who approves everyone else.
            const batch = F.writeBatch(fs);
            batch.set(ref('users', fb.uid), { ...base, role: 'admin', requestedRole: null });
            batch.set(ref('meta', 'setup'), { adminUid: fb.uid, at: Date.now() });
            await batch.commit();
          } else {
            await F.setDoc(ref('users', fb.uid), { ...base, role: 'member', requestedRole: wanted });
            if (wanted) {
              await F.addDoc(col('notifications'), { to: setup.adminUid, from: fb.uid, title: `New ${wanted} request`, body: `${n} wants ${wanted} access`, requestId: null, kind: 'role', at: Date.now(), read: false }).catch(() => {});
            }
          }
        } catch (e) {
          throw dbErr(e);
        }
        await A.updateProfile(fb, { displayName: n }).catch(() => {});
        await new Promise((r) => {
          let off = null;
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            setTimeout(() => off?.(), 0);
            r();
          };
          off = api.auth.onChange((u) => u && !u.needsProfile && finish());
          if (done) off();
          setTimeout(finish, 5000);
        });
        log('user.signup', fb.email || fb.phoneNumber || fb.uid, wanted ? `Requested ${wanted} access` : 'Joined');
        return api.auth.current();
      },
      async requestRole(role) {
        const u = me();
        if (u.role !== 'member') throw new AuthError('You already have a role');
        const wanted = ['supervisor', 'vendor'].includes(role) ? role : null;
        try {
          await F.updateDoc(ref('users', u.uid), { requestedRole: wanted });
          const setup = await setupInfo();
          if (wanted && setup) await notify(setup.adminUid, `New ${wanted} request`, `${u.name} wants ${wanted} access`, null, 'role');
        } catch (e) {
          throw dbErr(e);
        }
      },
      async signOut() {
        profileUnsub?.();
        profileUnsub = null;
        await A.signOut(auth);
      },
      async updateProfile(patch) {
        const u = me();
        const upd = {};
        if (patch.name != null) upd.name = clean(patch.name, LIMITS.name) || u.name;
        if (patch.phone != null) upd.phone = clean(patch.phone, 20);
        if (patch.company != null && u.role === 'vendor') upd.company = clean(patch.company, LIMITS.name);
        try {
          await F.updateDoc(ref('users', u.uid), upd);
        } catch (e) {
          throw dbErr(e);
        }
        if (upd.name && auth.currentUser) A.updateProfile(auth.currentUser, { displayName: upd.name }).catch(() => {});
        return { ...u, ...upd };
      },
      async savePushToken(token) {
        if (!current || current.needsProfile || !token) return;
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
        await F.updateDoc(ref('users', uid), { role, requestedRole: null }).catch((e) => Promise.reject(dbErr(e)));
        await notify(uid, 'Your access was approved', `You are now a ${role}. Open WasteWise to get started.`, null, 'role');
        log('user.role', uid, `Role set to ${role}`);
      },
      async setActive(uid, active) {
        const admin = requireRole('admin');
        if (uid === admin.uid) throw new AuthError("You can't deactivate yourself");
        await F.updateDoc(ref('users', uid), { active: !!active }).catch((e) => Promise.reject(dbErr(e)));
        log(active ? 'user.activate' : 'user.deactivate', uid);
      },
      async decline(uid) {
        requireRole('admin');
        await F.updateDoc(ref('users', uid), { requestedRole: null }).catch((e) => Promise.reject(dbErr(e)));
        await notify(uid, 'Access request declined', 'An admin declined your request. You can still use WasteWise as a member.', null, 'role');
        log('user.decline', uid, 'Role request declined');
      },
    },

    requests: {
      watch(fn) {
        const u = current;
        if (!u || u.needsProfile) {
          fn([]);
          return () => {};
        }
        const sorted = (xs) => xs.sort((a, b) => b.createdAt - a.createdAt);
        if (u.role === 'vendor') {
          let open = [];
          let mine = [];
          const push = () => {
            const m = new Map([...open, ...mine].map((r) => [r.id, r]));
            fn(sorted([...m.values()]));
          };
          const a = listen(F.query(col('requests'), F.where('status', '==', STATUS.OPEN)), (s) => ((open = s.docs.map(withId)), push()), 'open requests');
          const b = listen(F.query(col('requests'), F.where('vendorId', '==', u.uid)), (s) => ((mine = s.docs.map(withId)), push()), 'my jobs');
          return () => (a(), b());
        }
        // Single-field queries only, so no composite indexes need to be created.
        const q =
          u.role === 'admin'
            ? F.query(col('requests'), F.orderBy('createdAt', 'desc'), F.limit(2000))
            : u.role === 'supervisor'
              ? F.query(col('requests'), F.where('createdBy', '==', u.uid))
              : F.query(col('requests'), F.where('status', '==', STATUS.COMPLETED), F.limit(3000));
        return listen(q, (s) => fn(sorted(s.docs.map(withId))), 'requests');
      },
      watchPublic(fn) {
        const q = F.query(col('requests'), F.where('status', 'in', [STATUS.OPEN, STATUS.ACCEPTED, STATUS.COMPLETED]), F.limit(3000));
        return listen(q, (s) => fn(s.docs.map((d) => {
          const { notes, createdByPhone, vendorPhone, ...r } = withId(d);
          return r;
        })), 'public stats');
      },
      async get(id) {
        me();
        const s = await F.getDoc(ref('requests', id));
        return s.exists() ? withId(s) : null;
      },
      async photo(id) {
        me();
        const s = await F.getDoc(ref('photos', id)).catch(() => null);
        return s?.exists() ? s.data().data : null;
      },
      async create(input) {
        const u = requireRole('supervisor');
        const v = validateNewRequest(input);
        if (!v.ok) throw new LifecycleError(Object.values(v.errors)[0], 'validation');
        const { photo, ...value } = v.value;
        const reqRef = F.doc(col('requests'));
        const counterRef = ref('meta', 'counters');
        let created;
        try {
          created = await F.runTransaction(fs, async (tx) => {
            const c = await tx.get(counterRef);
            const n = c.exists() ? c.data().requests : 1001;
            if (c.exists()) tx.update(counterRef, { requests: n + 1 });
            else tx.set(counterRef, { requests: n + 1 });
            const doc = newRequest({ ...value, geo: normGeo(value.geo) }, u, Date.now(), { code: `WR-${n}`, hasPhoto: !!photo });
            tx.set(reqRef, doc);
            if (photo) tx.set(ref('photos', reqRef.id), { data: photo, by: u.uid, at: Date.now() });
            return { id: reqRef.id, ...doc };
          });
        } catch (e) {
          throw dbErr(e);
        }
        log('request.create', created.code, `${value.wasteType} at ${value.location}`);
        return created;
      },
      async act(id, action, payload = {}) {
        const u = me();
        const r = ref('requests', id);
        let before;
        let next;
        try {
          next = await F.runTransaction(fs, async (tx) => {
            const snap = await tx.get(r);
            if (!snap.exists()) throw new LifecycleError('Request not found', 'not-found');
            before = withId(snap);
            if (action === 'accept' && before.status !== STATUS.OPEN) throw new LifecycleError('Another vendor already accepted this pickup', 'taken');
            const n = transition(before, action, u, payload, Date.now());
            const changed = {};
            for (const k of Object.keys(n)) if (k !== 'id' && JSON.stringify(n[k]) !== JSON.stringify(before[k])) changed[k] = n[k];
            tx.update(r, changed);
            return n;
          });
        } catch (e) {
          throw dbErr(e);
        }
        const code = next.code;
        if (action === 'accept') notify(next.createdBy, 'Pickup accepted', `${next.vendorName} accepted ${code} - ${next.location}`, id, 'accepted');
        if (action === 'release') notify(before.createdBy, 'Pickup released', `${code} is open again for other vendors`, id, 'released');
        if (action === 'complete') notify(before.vendorId, 'Handover confirmed', `${code}: ${next.weightKg} kg handed over${next.rating ? ` - rated ${next.rating}/5` : ''}`, id, 'completed');
        if (action === 'cancel' && before.vendorId) notify(before.vendorId, 'Pickup cancelled', `${code} was cancelled`, id, 'cancelled');
        log(`request.${action}`, code, next.history[next.history.length - 1].note);
        return next;
      },
    },

    bins: {
      watch(fn) {
        if (!current || current.needsProfile) {
          fn([]);
          return () => {};
        }
        return listen(col('bins'), (s) => fn(s.docs.map(withId).sort((a, b) => a.id.localeCompare(b.id))), 'bins');
      },
      async save(bin) {
        requireRole('admin');
        const id = clean(bin.id, LIMITS.binId).toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(id)) throw new LifecycleError('Bin ID: letters, numbers and dashes only (e.g. BIN-A05)');
        const location = clean(bin.location, LIMITS.location);
        if (location.length < 2) throw new LifecycleError('Enter where the bin is');
        const geo = normGeo(bin.geo);
        const data = { location, zone: clean(bin.zone, LIMITS.location), wasteType: bin.wasteType || 'mixed', capacityL: Math.max(10, Math.min(100000, Number(bin.capacityL) || 240)), geo, updatedAt: Date.now() };
        try {
          await F.setDoc(ref('bins', id), data, { merge: true });
        } catch (e) {
          throw dbErr(e);
        }
        log('bin.save', id, location);
        return { id, ...data };
      },
      async remove(id) {
        requireRole('admin');
        await F.deleteDoc(ref('bins', id)).catch((e) => Promise.reject(dbErr(e)));
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
        if (!current || current.needsProfile) {
          fn([]);
          return () => {};
        }
        const q = F.query(col('notifications'), F.where('to', '==', current.uid), F.limit(300));
        return listen(q, (s) => fn(s.docs.map(withId).sort((a, b) => b.at - a.at).slice(0, 80)), 'notifications');
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
  };
  return api;
}
