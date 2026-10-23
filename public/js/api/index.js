// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Data-access entry point. WasteWise runs on Firebase (Auth + Firestore):
// real accounts and live data shared by every phone and browser.
// Pages only talk to the services in this folder, never to Firebase directly.

import { FIREBASE_CONFIG } from '../config.js';

let backend = null;

/** Tests can point the app at the Firebase emulators (set before the app loads). */
const testOverride = () => globalThis.__WW_TEST__ || null;

export function isConfigured() {
  const cfg = testOverride()?.config || FIREBASE_CONFIG;
  return !!(cfg && cfg.apiKey && cfg.projectId);
}

export async function initBackend() {
  if (backend) return backend;
  const t = testOverride();
  const config = t?.config || FIREBASE_CONFIG;
  if (!isConfigured()) {
    const e = new Error('Firebase is not configured yet - add your web config to public/js/config.js');
    e.code = 'not-configured';
    throw e;
  }
  const { createFirebaseBackend } = await import('./backend/firebase.js');
  backend = await (await createFirebaseBackend(config, { emulator: t?.emulator })).init();
  return backend;
}

export function getBackend() {
  if (!backend) throw new Error('Backend not initialised');
  return backend;
}
