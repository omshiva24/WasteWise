// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Hash router with role guards and animated page changes.
// Hash URLs work everywhere: static hosting, Firebase Hosting and inside the native app.

import { guard, homeFor, PUBLIC_ROUTES } from '../core/rbac.js';
import { state } from './state.js';
import { withTransition } from './fx.js';

const ROUTES = [
  ['/welcome', () => import('../pages/auth/welcome.js')],
  ['/login', () => import('../pages/auth/login.js')],
  ['/signup', () => import('../pages/auth/signup.js')],
  ['/setup', () => import('../pages/auth/setup.js')],
  ['/about', () => import('../pages/auth/about.js')],
  ['/map', () => import('../pages/shared/map.js')],
  ['/supervisor', () => import('../pages/supervisor/home.js')],
  ['/supervisor/requests', () => import('../pages/supervisor/requests.js')],
  ['/supervisor/new', () => import('../pages/supervisor/new.js')],
  ['/vendor', () => import('../pages/vendor/home.js')],
  ['/vendor/jobs', () => import('../pages/vendor/jobs.js')],
  ['/admin', () => import('../pages/admin/home.js')],
  ['/admin/requests', () => import('../pages/admin/requests.js')],
  ['/admin/users', () => import('../pages/admin/users.js')],
  ['/admin/bins', () => import('../pages/admin/bins.js')],
  ['/admin/logs', () => import('../pages/admin/logs.js')],
  ['/member', () => import('../pages/member/home.js')],
  ['/reports', () => import('../pages/shared/reports.js')],
  ['/notifications', () => import('../pages/shared/notifications.js')],
  ['/me', () => import('../pages/shared/me.js')],
  ['/request/:id', () => import('../pages/shared/request.js')],
];

function match(path) {
  for (const [pattern, load] of ROUTES) {
    const pp = pattern.split('/');
    const xp = path.split('/');
    if (pp.length !== xp.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(xp[i]);
      else if (pp[i] !== xp[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { pattern, load, params };
  }
  return null;
}

export const currentPath = () => (location.hash.replace(/^#/, '').split('?')[0] || '/');

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (location.hash === target) return render();
  if (replace) location.replace(target);
  else location.hash = target;
}

let mountFn = null;
let current = null;
let renderId = 0;

export function onMount(fn) {
  mountFn = fn;
}

export async function render() {
  const id = ++renderId;
  let path = currentPath();
  if (path === '/') {
    let onboarded = false;
    try {
      onboarded = localStorage.getItem('wastewise.onboarded') === '1';
    } catch {
      /* ignore */
    }
    return navigate(state.user ? homeFor(state.user) : onboarded ? '/login' : '/welcome', { replace: true });
  }
  const redirect = guard(state.user, path);
  if (redirect && redirect !== path) {
    if (!(path === '/welcome' && !state.user)) return navigate(redirect, { replace: true });
  }
  const m = match(path);
  if (!m) return navigate(state.user ? homeFor(state.user) : '/login', { replace: true });
  let mod;
  try {
    mod = await m.load();
  } catch (e) {
    console.error(e);
    return;
  }
  if (id !== renderId) return; // a newer navigation won
  const ctx = { params: m.params, path, user: state.user, navigate, isPublic: PUBLIC_ROUTES.includes(path) };
  const page = mod.default(ctx);
  const prev = current;
  current = page;
  pagesShown += 1;
  await withTransition(() => {
    prev?.destroy?.();
    mountFn?.(page, ctx);
  });
}

export function start() {
  addEventListener('hashchange', () => render());
  return render();
}

let pagesShown = 0;
export function back(fallback) {
  if (pagesShown > 1) history.back();
  else navigate(fallback || homeFor(state.user), { replace: true });
}
