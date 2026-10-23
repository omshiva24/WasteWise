// WasteWise - boot sequence.  (c) P Om Shiva

import { initBackend } from './api/index.js';
import { authService } from './api/auth.service.js';
import { notificationService } from './api/request.service.js';
import { state, setState, applyTheme, resolvedTheme } from './ui/state.js';
import { start, render, onMount, navigate, currentPath } from './ui/router.js';
import { mountPage } from './ui/shell.js';
import { installRipples } from './ui/fx.js';
import { initNative, registerPush, exitApp, isNative } from './ui/native.js';
import { logo } from './ui/art.js';
import { toast } from './ui/components.js';
import { homeFor } from './core/rbac.js';
import { PUSH_ENABLED } from './config.js';
import { h, icon } from './ui/dom.js';

const splash = document.getElementById('splash');
splash?.querySelector('.splash-logo-slot')?.replaceWith(logo({ size: 112, light: true }));
const t0 = performance.now();

applyTheme();
matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
installRipples();
onMount(mountPage);

let notifOff = null;
let lastKey = null;
let started = false;

function watchNotifications() {
  notifOff?.();
  notifOff = null;
  if (!state.user || state.user.needsProfile) return setState({ notifications: [], unread: 0 });
  let first = true;
  notifOff = notificationService.watch((list) => {
    const unread = list.filter((n) => !n.read).length;
    if (!first && unread > state.unread) {
      const newest = list.find((n) => !n.read);
      if (newest) toast(`${newest.title}: ${newest.body}`, 'info', 3600);
    }
    first = false;
    setState({ notifications: list, unread });
  });
}

async function boot() {
  let backend;
  try {
    backend = await initBackend();
  } catch (e) {
    console.error(e);
    splash?.remove();
    const notConfigured = e.code === 'not-configured';
    document.getElementById('app').replaceChildren(h('div', { class: 'boot-error' },
      h('div', { class: 'be-icon' }, icon(notConfigured ? 'wrench' : 'wifi-off', { size: 34 })),
      h('h1', notConfigured ? 'Almost ready' : "Can't connect right now"),
      h('p', notConfigured ? 'WasteWise is not connected to its database yet. The owner needs to add the Firebase config (see SETUP_FIREBASE.md).' : 'Check your internet connection and try again.'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, icon('refresh-cw', { size: 18 }), 'Try again')));
    return;
  }
  setState({ mode: backend.mode });

  authService.onChange((user) => {
    const key = user ? `${user.uid}:${user.needsProfile ? 'new' : user.role}:${user.active}` : 'anon';
    setState({ user });
    if (key === lastKey) return;
    const wasReady = lastKey && lastKey !== 'anon' && !lastKey.includes(':new:');
    lastKey = key;
    watchNotifications();
    if (!started) return;
    if (!user) navigate('/login', { replace: true });
    else if (user.needsProfile) navigate('/setup', { replace: true });
    else if (!wasReady || ['/login', '/signup', '/welcome', '/setup', '/'].includes(currentPath())) navigate(homeFor(user), { replace: true });
    else render();
    if (user && !user.needsProfile && PUSH_ENABLED) registerPush((token) => authService.savePushToken(token));
  });

  initNative({
    theme: resolvedTheme(),
    onBack: () => {
      const p = currentPath();
      if (document.querySelector('.sheet')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      else if (!state.user || p === homeFor(state.user) || p === '/login') exitApp();
      else history.back();
    },
  });

  started = true;
  await start();
  const wait = Math.max(0, 900 - (performance.now() - t0));
  setTimeout(() => {
    splash?.classList.add('out');
    setTimeout(() => splash?.remove(), 600);
  }, wait);

  if ('serviceWorker' in navigator && !isNative() && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    // When a new version takes over, reload once so every file comes from the same version.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  globalThis.__installPrompt = e;
});
addEventListener('offline', () => toast("You're offline - changes will sync when you're back", 'info'));
addEventListener('online', () => toast('Back online', 'success', 1800));

boot();
