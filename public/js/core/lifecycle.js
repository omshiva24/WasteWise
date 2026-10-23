// Request lifecycle: OPEN -> ACCEPTED -> COMPLETED (or OPEN -> CANCELLED).
// Pure functions, shared by every backend and by the tests. The Firestore
// rules (firestore.rules) enforce the same transitions on the server.

import { STATUS, OVERDUE_DAYS, DAY, WASTE_BY_ID, PRIORITIES, LIMITS } from './constants.js';

export class LifecycleError extends Error {
  constructor(message, code = 'invalid') {
    super(message);
    this.name = 'LifecycleError';
    this.code = code;
  }
}

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/** Validate + normalise the supervisor's "raise request" form. */
export function validateNewRequest(input = {}) {
  const errors = {};
  const wasteType = String(input.wasteType || '');
  if (!WASTE_BY_ID[wasteType]) errors.wasteType = 'Pick a waste type';
  const binId = clean(input.binId, LIMITS.binId).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(binId)) errors.binId = 'Enter or scan a valid bin ID (e.g. BIN-A01)';
  const location = clean(input.location, LIMITS.location);
  if (location.length < 2) errors.location = 'Where is the bin?';
  const zone = clean(input.zone, LIMITS.location);
  const notes = clean(input.notes, LIMITS.notes);
  const priority = PRIORITIES.includes(input.priority) ? input.priority : 'normal';
  const estKg = input.estKg === '' || input.estKg == null ? null : Number(input.estKg);
  if (estKg != null && (!Number.isFinite(estKg) || estKg < 0 || estKg > LIMITS.maxWeightKg)) errors.estKg = 'Estimate must be 0–50,000 kg';
  const photo = typeof input.photo === 'string' && input.photo.startsWith('data:image/') ? input.photo : null;
  if (photo && photo.length > LIMITS.photoBytes * 1.4) errors.photo = 'Photo is too large';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { wasteType, binId, location, zone, notes, priority, estKg, photo },
  };
}

/** Build a brand-new OPEN request document. */
export function newRequest(value, user, now = Date.now(), extra = {}) {
  if (!user || user.role !== 'supervisor') throw new LifecycleError('Only supervisors can raise requests', 'forbidden');
  return {
    ...value,
    status: STATUS.OPEN,
    createdBy: user.uid,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now,
    acceptedAt: null,
    vendorId: null,
    vendorName: null,
    completedAt: null,
    weightKg: null,
    rating: null,
    overdue: false,
    history: [{ status: STATUS.OPEN, at: now, by: user.uid, byName: user.name, note: 'Request raised' }],
    ...extra,
  };
}

/** Which actions can this user take on this request right now? */
export function allowedActions(req, user) {
  if (!req || !user || user.active === false) return [];
  const out = [];
  const own = req.createdBy === user.uid;
  if (req.status === STATUS.OPEN) {
    if (user.role === 'vendor') out.push('accept');
    if ((user.role === 'supervisor' && own) || user.role === 'admin') out.push('cancel');
  }
  if (req.status === STATUS.ACCEPTED) {
    if (user.role === 'supervisor' && own) out.push('complete');
    if (user.role === 'admin') out.push('complete');
    if (user.role === 'vendor' && req.vendorId === user.uid) out.push('release');
    if (user.role === 'admin') out.push('release');
  }
  return out;
}

/**
 * Apply an action and return the NEW request object (input is not mutated).
 * Throws LifecycleError when the move is not allowed.
 */
export function transition(req, action, user, payload = {}, now = Date.now()) {
  if (!allowedActions(req, user).includes(action)) {
    throw new LifecycleError(`You can't ${action} a ${String(req?.status || 'unknown').toLowerCase()} request`, 'forbidden');
  }
  const next = { ...req, history: [...(req.history || [])], updatedAt: now };
  const note = clean(payload.note, LIMITS.notes);
  switch (action) {
    case 'accept':
      next.status = STATUS.ACCEPTED;
      next.vendorId = user.uid;
      next.vendorName = user.company || user.name;
      next.acceptedAt = now;
      next.history.push({ status: STATUS.ACCEPTED, at: now, by: user.uid, byName: next.vendorName, note: note || 'Pickup accepted' });
      break;
    case 'release':
      next.status = STATUS.OPEN;
      next.vendorId = null;
      next.vendorName = null;
      next.acceptedAt = null;
      next.history.push({ status: STATUS.OPEN, at: now, by: user.uid, byName: user.company || user.name, note: note || 'Pickup released back to the pool' });
      break;
    case 'complete': {
      const w = Number(payload.weightKg);
      if (!Number.isFinite(w) || w <= 0 || w > LIMITS.maxWeightKg) throw new LifecycleError('Enter the weight handed over (kg)', 'weight');
      const rating = payload.rating == null || payload.rating === '' ? null : Math.round(Number(payload.rating));
      if (rating != null && (rating < 1 || rating > 5)) throw new LifecycleError('Rating must be 1–5 stars', 'rating');
      next.status = STATUS.COMPLETED;
      next.weightKg = Math.round(w * 10) / 10;
      next.rating = rating;
      next.completedAt = now;
      next.overdue = false;
      next.history.push({ status: STATUS.COMPLETED, at: now, by: user.uid, byName: user.name, note: note || `Handed over ${next.weightKg} kg` });
      break;
    }
    case 'cancel':
      next.status = STATUS.CANCELLED;
      next.overdue = false;
      next.history.push({ status: STATUS.CANCELLED, at: now, by: user.uid, byName: user.name, note: note || 'Request cancelled' });
      break;
    default:
      throw new LifecycleError(`Unknown action: ${action}`);
  }
  return next;
}

/** A request is overdue when it is still OPEN or ACCEPTED more than 7 days after it was raised. */
export function isOverdue(req, now = Date.now()) {
  if (!req || (req.status !== STATUS.OPEN && req.status !== STATUS.ACCEPTED)) return false;
  return now - Number(req.createdAt) > OVERDUE_DAYS * DAY;
}

export function overdueDays(req, now = Date.now()) {
  if (!isOverdue(req, now)) return 0;
  return Math.floor((now - Number(req.createdAt)) / DAY) - OVERDUE_DAYS;
}

/** Hours from raised to accepted / completed (null when not reached). */
export function turnaround(req) {
  const h = (a, b) => (a && b ? Math.max(0, (b - a) / 3_600_000) : null);
  return { acceptHours: h(req.createdAt, req.acceptedAt), completeHours: h(req.createdAt, req.completedAt) };
}

/** Progress 0..1 for the animated timeline. */
export function progressOf(req) {
  if (req.status === STATUS.COMPLETED) return 1;
  if (req.status === STATUS.ACCEPTED) return 0.5;
  return 0;
}
