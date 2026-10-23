// Layer 1 - Authentication: phone OTP, email + password, Google, profile, sign out.
import { getBackend } from './index.js';

export const authService = {
  current: () => getBackend().auth.current(),
  onChange: (fn) => getBackend().auth.onChange(fn),
  signIn: (email, password) => getBackend().auth.signIn(email, password),
  signUp: (data) => getBackend().auth.signUp(data),
  resetPassword: (email) => getBackend().auth.resetPassword(email),
  google: () => getBackend().auth.google(),
  phoneStart: (e164) => getBackend().auth.phoneStart(e164),
  isFirstAccount: () => getBackend().auth.isFirstAccount(),
  completeProfile: (data) => getBackend().auth.completeProfile(data),
  requestRole: (role) => getBackend().auth.requestRole(role),
  signOut: () => getBackend().auth.signOut(),
  updateProfile: (patch) => getBackend().auth.updateProfile(patch),
  savePushToken: (token) => getBackend().auth.savePushToken?.(token),
  get mode() {
    return getBackend().mode;
  },
};
