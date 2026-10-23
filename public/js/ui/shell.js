// App shell: top bar, role-based bottom tabs (phones) / side navigation (desktop).

import { h, icon, replace } from './dom.js';
import { logo } from './art.js';
import { avatar } from './components.js';
import { state, onState } from './state.js';
import { navigate, back, currentPath } from './router.js';
import { haptic } from './fx.js';
import { APP } from '../config.js';

export const TABS = {
  supervisor: [
    { path: '/supervisor', label: 'Home', icon: 'house' },
    { path: '/supervisor/requests', label: 'Requests', icon: 'list' },
    { path: '/supervisor/new', label: 'Raise', icon: 'plus', fab: true },
    { path: '/map', label: 'Map', icon: 'map' },
    { path: '/me', label: 'Me', icon: 'user' },
  ],
  vendor: [
    { path: '/vendor', label: 'Pickups', icon: 'truck' },
    { path: '/map', label: 'Map', icon: 'map' },
    { path: '/vendor/jobs', label: 'My jobs', icon: 'clipboard-list' },
    { path: '/me', label: 'Me', icon: 'user' },
  ],
  admin: [
    { path: '/admin', label: 'Dashboard', icon: 'layout-dashboard' },
    { path: '/admin/requests', label: 'Requests', icon: 'list' },
    { path: '/admin/users', label: 'Users', icon: 'users' },
    { path: '/admin/bins', label: 'Bins', icon: 'qr-code' },
    { path: '/me', label: 'Me', icon: 'user' },
  ],
  member: [
    { path: '/member', label: 'Impact', icon: 'chart-pie' },
    { path: '/map', label: 'Map', icon: 'map' },
    { path: '/notifications', label: 'Alerts', icon: 'bell' },
    { path: '/me', label: 'Me', icon: 'user' },
  ],
};

const EXTRA_SIDE = {
  admin: [{ path: '/map', label: 'Live map', icon: 'map' }, { path: '/admin/logs', label: 'Audit log', icon: 'activity' }, { path: '/reports', label: 'Reports', icon: 'file-text' }, { path: '/member', label: 'Impact', icon: 'chart-pie' }],
  supervisor: [{ path: '/reports', label: 'Reports', icon: 'file-text' }, { path: '/member', label: 'Impact', icon: 'chart-pie' }],
  vendor: [{ path: '/member', label: 'Impact', icon: 'chart-pie' }],
  member: [],
};

let shellRole = null;
let refs = null;

function activeFor(tabs, path) {
  let best = null;
  for (const t of tabs) if ((path === t.path || path.startsWith(t.path + '/')) && (!best || t.path.length > best.path.length)) best = t;
  return best?.path;
}

function buildShell(role) {
  const tabs = TABS[role] || TABS.member;
  const side = [...tabs.filter((t) => !t.fab), ...(EXTRA_SIDE[role] || [])];
  const titleH = h('h1', '');
  const sub = h('div', { class: 'sub' });
  const backBtn = h('button', { class: 'icon-btn hide', type: 'button', 'aria-label': 'Back', onclick: () => back() }, icon('chevron-left', { size: 22 }));
  const badge = h('span', { class: 'badge hide' });
  const bell = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Notifications', onclick: () => navigate('/notifications') }, icon('bell', { size: 20 }), badge);
  const me = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'My profile', style: { padding: '0', border: '0', background: 'none' }, onclick: () => navigate('/me') });
  const brand = h('div', { class: 'brand-mini hide' }, logo({ size: 30 }), 'WasteWise');
  const topbar = h('header', { class: 'topbar' }, backBtn, brand, h('div', { class: 'title' }, titleH, sub), bell, me);
  const view = h('main', { class: 'view', id: 'main', tabindex: '-1' });
  const pill = h('span', { class: 'tab-pill', 'aria-hidden': 'true' });
  const tabBtns = tabs.map((t) =>
    h('button', { type: 'button', class: `tab ${t.fab ? 'fab' : ''}`, 'aria-label': t.label, dataset: { path: t.path }, onclick: () => (haptic(), navigate(t.path)) }, icon(t.icon, { size: 22 }), t.fab ? null : h('span', t.label)),
  );
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Main' }, pill, tabBtns);
  const sideBtns = side.map((t) => h('button', { type: 'button', class: 'side-link', dataset: { path: t.path }, onclick: () => navigate(t.path) }, icon(t.icon, { size: 20 }), t.label));
  const raise = role === 'supervisor' ? h('button', { type: 'button', class: 'btn primary', style: { margin: '6px 0 12px' }, onclick: () => navigate('/supervisor/new') }, icon('plus', { size: 18 }), 'Raise pickup') : null;
  const sidenav = h('aside', { class: 'sidenav', 'aria-label': 'Sections' }, h('div', { class: 'brand-mini' }, logo({ size: 34 }), 'WasteWise'), raise, sideBtns, h('div', { class: 'side-foot' }, `v${APP.version} · Built by ${APP.author}`));
  const shell = h('div', { class: 'shell has-nav' }, sidenav, h('div', { class: 'col' }, topbar, view), tabbar);
  return { shell, titleH, sub, backBtn, brand, badge, bell, me, view, tabBtns, sideBtns, pill, tabs };
}

function placePill() {
  if (!refs) return;
  const path = currentPath();
  const act = activeFor(refs.tabs, path);
  let shown = false;
  refs.tabBtns.forEach((b) => {
    const on = b.dataset.path === act;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
    if (on && !b.classList.contains('fab')) {
      refs.pill.style.width = `${b.offsetWidth}px`;
      refs.pill.style.transform = `translateX(${b.offsetLeft}px)`;
      refs.pill.style.opacity = '1';
      shown = true;
    }
  });
  if (!shown) refs.pill.style.opacity = '0';
  refs.sideBtns.forEach((b) => b.classList.toggle('active', b.dataset.path === activeFor([...refs.tabs, ...(EXTRA_SIDE[shellRole] || [])], path)));
}
addEventListener('resize', placePill);

function updateBadge() {
  if (!refs) return;
  const n = state.unread;
  const was = Number(refs.badge.dataset.n || 0);
  refs.badge.textContent = n > 99 ? '99+' : String(n);
  refs.badge.dataset.n = String(n);
  refs.badge.classList.toggle('hide', !n);
  if (n > was) {
    refs.bell.classList.remove('ring-anim');
    void refs.bell.offsetWidth;
    refs.bell.classList.add('ring-anim');
  }
}
onState(updateBadge);

/** Mounts a page. Public pages (login, signup, welcome) render full-screen without the shell. */
export function mountPage(page, ctx) {
  const app = document.getElementById('app');
  if (ctx.isPublic || page.fullscreen) {
    shellRole = null;
    refs = null;
    replace(app, page.el);
    window.scrollTo(0, 0);
    return;
  }
  const role = state.user?.role || 'member';
  if (!refs || shellRole !== role) {
    shellRole = role;
    refs = buildShell(role);
    replace(app, refs.shell);
  }
  refs.me.replaceChildren(avatar(state.user?.name || '?', 'sm'));
  refs.titleH.textContent = page.title || '';
  refs.sub.textContent = page.sub || '';
  refs.sub.classList.toggle('hide', !page.sub);
  refs.backBtn.classList.toggle('hide', !page.back);
  refs.brand.classList.toggle('hide', !!page.back || !!page.title);
  document.title = page.title ? `${page.title} · WasteWise` : 'WasteWise';
  replace(refs.view, page.el);
  window.scrollTo({ top: 0 });
  updateBadge();
  requestAnimationFrame(placePill);
}

/** Lets a page update its own heading after data loads. */
export function setTitle(title, sub) {
  if (!refs) return;
  if (title != null) refs.titleH.textContent = title;
  if (sub != null) {
    refs.sub.textContent = sub;
    refs.sub.classList.toggle('hide', !sub);
  }
}
