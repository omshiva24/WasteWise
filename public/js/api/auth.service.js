// Layer 1 - Authentication: sign in / sign up / sign out / profile.
import { getBackend } from './index.js';

export const authService = {
  current: () => getBackend().auth.current(),
  onChange: (fn) => getBackend().auth.onChange(fn),
  signIn: (email, password) => getBackend().auth.signIn(email, password),
  demoSignIn: (role) => getBackend().auth.demoSignIn(role),
  signUp: (data) => getBackend().auth.signUp(data),
  signOut: () => getBackend().auth.signOut(),
  updateProfile: (patch) => getBackend().auth.updateProfile(patch),
  savePushToken: (token) => getBackend().auth.savePushToken?.(token),
  get mode() {
    return getBackend().mode;
  },
};
