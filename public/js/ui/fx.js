// Motion helpers: counters, ripples, confetti, haptics, view transitions.

import { isNative, nativeCall } from './native.js';

export const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const prefs = () => {
  try {
    return JSON.parse(localStorage.getItem('wastewise.prefs') || '{}');
  } catch {
    return {};
  }
};

/** Animated number (ease-out). */
export function countUp(el, to, { duration = 1100, decimals = 0, prefix = '', suffix = '', format } = {}) {
  const fmt = format || ((v) => prefix + new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v) + suffix);
  const target = Number(to) || 0;
  if (reducedMotion() || target === 0) {
    el.textContent = fmt(target);
    return;
  }
  const from = Number(el.dataset.v || 0);
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt(from + (target - from) * e);
    if (p < 1) requestAnimationFrame(tick);
    else el.dataset.v = String(target);
  };
  requestAnimationFrame(tick);
}

/** Material-style ripple on every .btn / .tab / .role-card. */
export function installRipples(root = document) {
  root.addEventListener('pointerdown', (e) => {
    const t = e.target.closest?.('.btn, .role-card, .filter-chip, .type-tile');
    if (!t || reducedMotion()) return;
    const r = t.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const sp = document.createElement('span');
    sp.className = 'ripple';
    sp.style.width = sp.style.height = `${d}px`;
    sp.style.left = `${e.clientX - r.left - d / 2}px`;
    sp.style.top = `${e.clientY - r.top - d / 2}px`;
    t.append(sp);
    setTimeout(() => sp.remove(), 650);
  });
}

export function haptic(kind = 'light') {
  if (prefs().haptics === false) return;
  if (isNative()) {
    const call = kind === 'success' ? nativeCall('Haptics', 'notification', { type: 'SUCCESS' }) : kind === 'error' ? nativeCall('Haptics', 'notification', { type: 'ERROR' }) : nativeCall('Haptics', 'impact', { style: kind === 'heavy' ? 'HEAVY' : 'LIGHT' });
    call.catch(() => {});
    return;
  }
  navigator.vibrate?.(kind === 'success' ? [12, 40, 18] : kind === 'error' ? [30, 40, 30] : 8);
}

/** Run a DOM update inside a View Transition when supported. */
export function withTransition(update) {
  if (document.startViewTransition && !reducedMotion()) {
    try {
      return document.startViewTransition(update).finished.catch(() => {});
    } catch {
      /* fall back */
    }
  }
  update();
  return Promise.resolve();
}

/** Confetti burst on a full-screen canvas. */
export function confetti({ count = 140, duration = 2600 } = {}) {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.append(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#10b981', '#a3e635', '#0ea5e9', '#f59e0b', '#8b5cf6', '#f43f5e', '#ffffff'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.38,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 15 - 5,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    c: colors[(Math.random() * colors.length) | 0],
    shape: Math.random() < 0.3 ? 'circle' : 'rect',
  }));
  const t0 = performance.now();
  const frame = (t) => {
    const el = t - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.36;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - el / duration);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (el < duration) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

/** Animate bars/donuts once their element is on screen. */
export function onVisible(el, fn) {
  if (!('IntersectionObserver' in globalThis)) return fn();
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      requestAnimationFrame(() => requestAnimationFrame(fn));
    }
  }, { threshold: 0.15 });
  io.observe(el);
}
