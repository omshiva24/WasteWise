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
  if (!state.user) return setState({ notifications: [], unread: 0 });
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
    document.getElementById('app').textContent = 'WasteWise could not start. Please reload.';
    return;
  }
  setState({ mode: backend.mode });

  authService.onChange((user) => {
    const key = user ? `${user.uid}:${user.role}:${user.active}` : 'anon';
    setState({ user });
    if (key === lastKey) return;
    const wasSignedIn = lastKey && lastKey !== 'anon';
    lastKey = key;
    watchNotifications();
    if (!started) return;
    if (!user) navigate('/login', { replace: true });
    else if (!wasSignedIn || ['/login', '/signup', '/welcome', '/'].includes(currentPath())) navigate(homeFor(user), { replace: true });
    else render();
    if (user && backend.mode === 'firebase') registerPush((token) => authService.savePushToken(token));
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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  globalThis.__installPrompt = e;
});
addEventListener('offline', () => toast(state.mode === 'firebase' ? "You're offline - changes will sync when you're back" : "You're offline - WasteWise keeps working", 'info'));

boot();
