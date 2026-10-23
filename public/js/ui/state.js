// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Small global app state + saved preferences.

const PREFS = 'wastewise.prefs';

export const state = {
  user: null,
  mode: 'firebase',
  notifications: [],
  unread: 0,
};

const subs = new Set();
export function setState(patch) {
  Object.assign(state, patch);
  subs.forEach((fn) => fn(state));
}
export function onState(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function getPrefs() {
  try {
    return { theme: 'system', haptics: true, ...JSON.parse(localStorage.getItem(PREFS) || '{}') };
  } catch {
    return { theme: 'system', haptics: true };
  }
}
export function setPrefs(patch) {
  const p = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* private mode */
  }
  return p;
}

export function resolvedTheme() {
  const t = getPrefs().theme;
  if (t === 'dark' || t === 'light') return t;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme() {
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#06110c' : '#059669');
  return t;
}
