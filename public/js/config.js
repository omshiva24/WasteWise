// WasteWise configuration.
//
// DEMO MODE (default): leave FIREBASE_CONFIG as null. Everything runs on this
// device with sample data, and tabs on the same browser stay in sync.
//
// LIVE MODE: paste your Firebase web app config below (Firebase console ->
// Project settings -> Your apps -> Web app -> Config). This config is not a
// secret - security comes from firestore.rules. See SETUP_FIREBASE.md.

export const FIREBASE_CONFIG = null;
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
  version: '1.0.0',
  author: 'P Om Shiva',
  authorUrl: 'https://github.com/omshiva24',
  repoUrl: 'https://github.com/omshiva24/WasteWise',
};
