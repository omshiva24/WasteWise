// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Formatting helpers (Indian locale).

import { DAY, HOUR } from './constants.js';

const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export const fmtNum = (n) => (n == null || Number.isNaN(n) ? '—' : nf.format(n));

export function fmtKg(n) {
  if (n == null) return '—';
  if (n >= 1000) return `${nf.format(Math.round(n / 100) / 10)} t`;
  return `${nf.format(n)} kg`;
}

export function fmtDate(t, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!t) return '—';
  return new Date(t).toLocaleDateString('en-IN', opts);
}

export function fmtDateTime(t) {
  if (!t) return '—';
  return new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(t, now = Date.now()) {
  if (!t) return '';
  const d = now - t;
  if (d < 45_000) return 'just now';
  if (d < HOUR) return `${Math.round(d / 60_000)} min ago`;
  if (d < DAY) return `${Math.round(d / HOUR)} h ago`;
  if (d < 30 * DAY) return `${Math.round(d / DAY)} d ago`;
  return fmtDate(t);
}

export function fmtHours(h) {
  if (h == null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} d`;
}

export function initials(name = '') {
  const p = String(name).trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "+919876543210" -> "+91 98765 43210" (other countries: just tidied). */
export function fmtPhone(p) {
  const s = String(p || '').replace(/[^\d+]/g, '');
  const m = s.match(/^\+91(\d{5})(\d{5})$/);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  return String(p || '');
}

/** plural(1, 'pickup') -> "1 pickup", plural(3, 'pickup') -> "3 pickups" */
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
