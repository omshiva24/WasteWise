// Data-access entry point: picks the Firebase backend when configured,
// otherwise the on-device demo backend. Pages only talk to the services below.

import { FIREBASE_CONFIG } from '../config.js';
import { createDemoBackend } from './backend/demo.js';

let backend = null;

export async function initBackend() {
  if (backend) return backend;
  if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) {
    try {
      const { createFirebaseBackend } = await import('./backend/firebase.js');
      backend = await (await createFirebaseBackend(FIREBASE_CONFIG)).init();
      return backend;
    } catch (e) {
      console.error('[WasteWise] Firebase failed to start, falling back to demo mode', e);
    }
  }
  backend = await createDemoBackend().init();
  return backend;
}

export function getBackend() {
  if (!backend) throw new Error('Backend not initialised');
  return backend;
}
