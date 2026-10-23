// Aggregate statistics for dashboards, charts and PDF reports. Pure functions.

import { STATUS, WASTE_TYPES, DAY } from './constants.js';
import { isOverdue, turnaround } from './lifecycle.js';

const round1 = (n) => Math.round(n * 10) / 10;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function inRange(requests, from, to = Infinity) {
  return requests.filter((r) => r.createdAt >= from && r.createdAt <= to);
}

export function summarize(requests, now = Date.now()) {
  const by = { OPEN: 0, ACCEPTED: 0, COMPLETED: 0, CANCELLED: 0 };
  let kg = 0;
  let overdue = 0;
  const accept = [];
  const complete = [];
  for (const r of requests) {
    by[r.status] = (by[r.status] || 0) + 1;
    if (r.status === STATUS.COMPLETED) kg += Number(r.weightKg) || 0;
    if (isOverdue(r, now)) overdue += 1;
    const t = turnaround(r);
    if (t.acceptHours != null) accept.push(t.acceptHours);
    if (t.completeHours != null) complete.push(t.completeHours);
  }
  const active = requests.length - by.CANCELLED;
  return {
    total: requests.length,
    byStatus: by,
    kg: round1(kg),
    overdue,
    completionRate: active ? Math.round((by.COMPLETED / active) * 100) : 0,
    avgAcceptHours: accept.length ? round1(avg(accept)) : null,
    avgCompleteHours: complete.length ? round1(avg(complete)) : null,
  };
}

/** kg collected (completed) per waste type, plus request counts. */
export function byWasteType(requests) {
  return WASTE_TYPES.map((w) => {
    const mine = requests.filter((r) => r.wasteType === w.id);
    const kg = mine.filter((r) => r.status === STATUS.COMPLETED).reduce((a, r) => a + (Number(r.weightKg) || 0), 0);
    return { id: w.id, label: w.label, color: w.color, count: mine.length, kg: round1(kg) };
  });
}

/** Daily series for the last `days` days: raised and completed counts + kg. */
export function dailySeries(requests, days = 30, now = Date.now()) {
  const end = startOfDay(now);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = end - i * DAY;
    out.push({ day, raised: 0, completed: 0, kg: 0 });
  }
  const idx = (t) => Math.round((startOfDay(t) - (end - (days - 1) * DAY)) / DAY);
  for (const r of requests) {
    const i = idx(r.createdAt);
    if (i >= 0 && i < days) out[i].raised += 1;
    if (r.status === STATUS.COMPLETED && r.completedAt) {
      const j = idx(r.completedAt);
      if (j >= 0 && j < days) {
        out[j].completed += 1;
        out[j].kg = round1(out[j].kg + (Number(r.weightKg) || 0));
      }
    }
  }
  return out;
}

/** Monthly kg for the last `months` months (for the trend chart and reports). */
export function monthlySeries(requests, months = 6, now = Date.now()) {
  const d = new Date(now);
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: `${m.getFullYear()}-${m.getMonth()}`, label: m.toLocaleString('en-IN', { month: 'short' }), kg: 0, completed: 0 });
  }
  for (const r of requests) {
    if (r.status !== STATUS.COMPLETED || !r.completedAt) continue;
    const c = new Date(r.completedAt);
    const slot = out.find((o) => o.key === `${c.getFullYear()}-${c.getMonth()}`);
    if (slot) {
      slot.kg = round1(slot.kg + (Number(r.weightKg) || 0));
      slot.completed += 1;
    }
  }
  return out;
}

/** Vendor leaderboard: completed jobs, kg, average pickup time, average rating. */
export function vendorBoard(requests) {
  const map = new Map();
  for (const r of requests) {
    if (!r.vendorId) continue;
    const v = map.get(r.vendorId) || { vendorId: r.vendorId, name: r.vendorName || 'Vendor', jobs: 0, active: 0, kg: 0, ratings: [], hours: [] };
    if (r.status === STATUS.COMPLETED) {
      v.jobs += 1;
      v.kg += Number(r.weightKg) || 0;
      if (r.rating) v.ratings.push(r.rating);
      const t = turnaround(r).completeHours;
      if (t != null) v.hours.push(t);
    } else if (r.status === STATUS.ACCEPTED) v.active += 1;
    map.set(r.vendorId, v);
  }
  return [...map.values()]
    .map((v) => ({ vendorId: v.vendorId, name: v.name, jobs: v.jobs, active: v.active, kg: round1(v.kg), rating: v.ratings.length ? round1(avg(v.ratings)) : null, avgHours: v.hours.length ? round1(avg(v.hours)) : null }))
    .sort((a, b) => b.kg - a.kg || b.jobs - a.jobs);
}

/** Zones ranked by kg collected. */
export function zoneBoard(requests) {
  const map = new Map();
  for (const r of requests) {
    const z = r.zone || r.location || 'Other';
    const e = map.get(z) || { zone: z, kg: 0, jobs: 0, open: 0 };
    if (r.status === STATUS.COMPLETED) {
      e.kg += Number(r.weightKg) || 0;
      e.jobs += 1;
    }
    if (r.status === STATUS.OPEN || r.status === STATUS.ACCEPTED) e.open += 1;
    map.set(z, e);
  }
  return [...map.values()].map((e) => ({ ...e, kg: round1(e.kg) })).sort((a, b) => b.kg - a.kg);
}

export function overdueList(requests, now = Date.now()) {
  return requests.filter((r) => isOverdue(r, now)).sort((a, b) => a.createdAt - b.createdAt);
}

/** Weekly buckets for the last `weeks` weeks (smoother than daily for small sites). */
export function weeklySeries(requests, weeks = 12, now = Date.now()) {
  const days = dailySeries(requests, weeks * 7, now);
  const out = [];
  for (let w = 0; w < weeks; w++) {
    const chunk = days.slice(w * 7, w * 7 + 7);
    out.push({
      start: chunk[0].day,
      label: new Date(chunk[0].day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      raised: chunk.reduce((a, d) => a + d.raised, 0),
      completed: chunk.reduce((a, d) => a + d.completed, 0),
      kg: Math.round(chunk.reduce((a, d) => a + d.kg, 0) * 10) / 10,
    });
  }
  return out;
}
