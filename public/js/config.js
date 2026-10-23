// WasteWise configuration.
//
// FIREBASE_CONFIG: your Firebase web app config (Firebase console -> Project
// settings -> Your apps -> Web app -> Config). It is not a secret - security
// comes from firestore.rules. See SETUP_FIREBASE.md.

export const FIREBASE_CONFIG = null;

// Push notifications to the Android app need google-services.json in the
// Android build and the optional Cloud Functions (Blaze plan). Keep false until then.
export const PUSH_ENABLED = false;

// Map tiles: OpenStreetMap (free, no key; attribution required - see
// https://operations.osmfoundation.org/policies/tiles/). Dark mode recolours them.
export const MAP = {
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  // Where the map opens before we know anyone's location (Puducherry).
  fallback: { lat: 11.9416, lng: 79.8083, zoom: 12 },
};
/* Example:
export const FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123',
};
*/

export const APP = {
  name: 'WasteWise',
  version: '2.0.0',
  author: 'P Om Shiva',
  authorUrl: 'https://github.com/omshiva24',
  repoUrl: 'https://github.com/omshiva24/WasteWise',
  liveUrl: 'https://wastewise-six-indol.vercel.app',
  apkUrl: 'https://github.com/omshiva24/WasteWise/releases/download/android-latest/WasteWise.apk',
};
