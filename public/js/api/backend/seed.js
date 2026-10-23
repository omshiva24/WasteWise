// Realistic, deterministic demo data: a university campus with five zones,
// 14 bins, 3 vendors, 2 supervisors and ~50 requests across the last 75 days.

import { DAY, HOUR, STATUS } from '../../core/constants.js';

export const DEMO_PASSWORD = 'demo1234';

export const ZONES = ['Academic Zone', 'Hostel Zone', 'Commercial Zone', 'Sports Zone', 'Admin Zone'];

export const SEED_USERS = [
  { uid: 'u-admin', name: 'Kavya Raman', email: 'admin@wastewise.app', role: 'admin', phone: '' },
  { uid: 'u-sup-1', name: 'Arjun Mehta', email: 'arjun@wastewise.app', role: 'supervisor', zone: 'Hostel Zone' },
  { uid: 'u-sup-2', name: 'Divya Iyer', email: 'divya@wastewise.app', role: 'supervisor', zone: 'Academic Zone' },
  { uid: 'u-ven-1', name: 'Suresh Kumar', company: 'GreenCycle Recyclers', email: 'greencycle@wastewise.app', role: 'vendor' },
  { uid: 'u-ven-2', name: 'Meena Pillai', company: 'EcoHaul Services', email: 'ecohaul@wastewise.app', role: 'vendor' },
  { uid: 'u-ven-3', name: 'Rahul Verma', company: 'CleanCity Waste Co.', email: 'cleancity@wastewise.app', role: 'vendor' },
  { uid: 'u-mem-1', name: 'Ananya Das', email: 'ananya@wastewise.app', role: 'member' },
  { uid: 'u-mem-2', name: 'Vikram Singh', email: 'vikram@wastewise.app', role: 'member', requestedRole: 'vendor', company: 'Swachh Movers' },
];

/** The account each "Try as ..." demo card signs into. */
export const DEMO_LOGINS = { admin: 'admin@wastewise.app', supervisor: 'arjun@wastewise.app', vendor: 'greencycle@wastewise.app', member: 'ananya@wastewise.app' };

export const SEED_BINS = [
  { id: 'BIN-A01', location: 'Library Block - Entrance', zone: 'Academic Zone', wasteType: 'paper', capacityL: 240 },
  { id: 'BIN-A02', location: 'Library Block - Reading Hall', zone: 'Academic Zone', wasteType: 'paper', capacityL: 120 },
  { id: 'BIN-A03', location: 'Science Complex - Lab Wing', zone: 'Academic Zone', wasteType: 'hazardous', capacityL: 120 },
  { id: 'BIN-A04', location: 'Computer Centre', zone: 'Academic Zone', wasteType: 'ewaste', capacityL: 240 },
  { id: 'BIN-H01', location: 'Hostel Block A', zone: 'Hostel Zone', wasteType: 'mixed', capacityL: 660 },
  { id: 'BIN-H02', location: 'Hostel Block B', zone: 'Hostel Zone', wasteType: 'plastic', capacityL: 360 },
  { id: 'BIN-H03', location: 'Hostel Mess', zone: 'Hostel Zone', wasteType: 'organic', capacityL: 660 },
  { id: 'BIN-C01', location: 'Central Canteen', zone: 'Commercial Zone', wasteType: 'organic', capacityL: 660 },
  { id: 'BIN-C02', location: 'Food Court', zone: 'Commercial Zone', wasteType: 'plastic', capacityL: 360 },
  { id: 'BIN-C03', location: 'Shopping Complex', zone: 'Commercial Zone', wasteType: 'glass', capacityL: 240 },
  { id: 'BIN-S01', location: 'Sports Complex', zone: 'Sports Zone', wasteType: 'plastic', capacityL: 360 },
  { id: 'BIN-S02', location: 'Swimming Pool', zone: 'Sports Zone', wasteType: 'mixed', capacityL: 240 },
  { id: 'BIN-M01', location: 'Admin Building', zone: 'Admin Zone', wasteType: 'paper', capacityL: 240 },
  { id: 'BIN-M02', location: 'Workshop & Garage', zone: 'Admin Zone', wasteType: 'metal', capacityL: 360 },
];

const KG = { organic: [40, 160], plastic: [15, 60], paper: [20, 90], glass: [10, 45], metal: [20, 120], ewaste: [5, 40], hazardous: [2, 20], mixed: [30, 120] };
const VENDOR_FOR = { plastic: ['u-ven-1', 'u-ven-2'], paper: ['u-ven-1'], glass: ['u-ven-1'], metal: ['u-ven-1', 'u-ven-3'], organic: ['u-ven-2'], mixed: ['u-ven-2', 'u-ven-3'], ewaste: ['u-ven-3'], hazardous: ['u-ven-3'] };
const NOTES = ['', '', 'Bin is overflowing', 'Please collect before 10 AM', 'Gate code 2045', '', 'Smell near the bin, needs quick pickup', 'Two extra bags next to the bin', '', 'Use the side entrance'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeed(now = Date.now()) {
  const r = rng(20261023);
  const pick = (xs) => xs[Math.floor(r() * xs.length)];
  const between = (a, b) => a + r() * (b - a);
  const users = Object.fromEntries(SEED_USERS.map((u) => [u.uid, { active: true, createdAt: now - 90 * DAY, ...u }]));
  const vendorName = (id) => users[id].company || users[id].name;
  const supFor = (zone) => (['Academic Zone', 'Admin Zone'].includes(zone) ? 'u-sup-2' : 'u-sup-1');

  // Ages (days ago) for each request; recent ones stay open/accepted, a few are overdue.
  const ages = [];
  for (let i = 0; i < 62; i++) ages.push(between(1.2, 150));
  ages.push(0.08, 0.3, 0.6, 1.1, 2.4, 3.6); // fresh
  ages.push(8.6, 10.3, 12.8); // overdue candidates
  ages.sort((a, b) => b - a);

  const requests = [];
  ages.forEach((ageDays, i) => {
    const bin = pick(SEED_BINS);
    const wasteType = r() < 0.75 ? bin.wasteType : pick(Object.keys(KG));
    const createdAt = Math.round(now - ageDays * DAY - between(0, 6) * HOUR);
    const sup = users[supFor(bin.zone)];
    const req = {
      id: `req-${1001 + i}`,
      code: `WR-${1001 + i}`,
      wasteType,
      binId: bin.id,
      location: bin.location,
      zone: bin.zone,
      notes: pick(NOTES),
      priority: r() < 0.18 ? 'urgent' : 'normal',
      estKg: null,
      photo: null,
      status: STATUS.OPEN,
      createdBy: sup.uid,
      createdByName: sup.name,
      createdAt,
      updatedAt: createdAt,
      acceptedAt: null,
      vendorId: null,
      vendorName: null,
      completedAt: null,
      weightKg: null,
      rating: null,
      overdue: false,
      history: [{ status: STATUS.OPEN, at: createdAt, by: sup.uid, byName: sup.name, note: 'Request raised' }],
    };
    const overdueCandidate = ageDays > 8 && ageDays < 13;
    const fresh = ageDays < 4;
    let fate;
    if (overdueCandidate) fate = i % 2 ? 'OPEN' : 'ACCEPTED';
    else if (fresh) fate = ageDays < 0.5 ? 'OPEN' : ageDays < 2 ? pick(['OPEN', 'ACCEPTED']) : pick(['ACCEPTED', 'COMPLETED']);
    else fate = r() < 0.07 ? 'CANCELLED' : 'COMPLETED';

    if (fate === 'CANCELLED') {
      const at = createdAt + between(1, 20) * HOUR;
      Object.assign(req, { status: STATUS.CANCELLED, updatedAt: at });
      req.history.push({ status: STATUS.CANCELLED, at, by: sup.uid, byName: sup.name, note: 'Raised by mistake' });
    }
    if (fate === 'ACCEPTED' || fate === 'COMPLETED') {
      const vid = pick(VENDOR_FOR[wasteType]);
      const acceptedAt = Math.min(now - 0.05 * DAY, createdAt + between(0.5, req.priority === 'urgent' ? 4 : 20) * HOUR);
      Object.assign(req, { status: STATUS.ACCEPTED, vendorId: vid, vendorName: vendorName(vid), acceptedAt, updatedAt: acceptedAt });
      req.history.push({ status: STATUS.ACCEPTED, at: acceptedAt, by: vid, byName: vendorName(vid), note: 'Pickup accepted' });
      if (fate === 'COMPLETED') {
        const completedAt = Math.min(now - 0.02 * DAY, acceptedAt + between(1.5, 40) * HOUR);
        const [lo, hi] = KG[wasteType];
        const weightKg = Math.round(between(lo, hi) * 10) / 10;
        const rating = r() < 0.12 ? 3 : r() < 0.55 ? 5 : 4;
        Object.assign(req, { status: STATUS.COMPLETED, completedAt, weightKg, rating, updatedAt: completedAt });
        req.history.push({ status: STATUS.COMPLETED, at: completedAt, by: sup.uid, byName: sup.name, note: `Handed over ${weightKg} kg` });
      }
    }
    requests.push(req);
  });

  const logs = [];
  for (const q of requests) {
    for (const h of q.history) {
      const action = { OPEN: 'request.create', ACCEPTED: 'request.accept', COMPLETED: 'request.complete', CANCELLED: 'request.cancel' }[h.status];
      logs.push({ id: `log-${logs.length + 1}`, at: h.at, actor: h.by, actorName: h.byName, action, target: q.code, detail: h.note });
    }
  }
  logs.push({ id: `log-${logs.length + 1}`, at: now - 2 * DAY, actor: 'u-mem-2', actorName: 'Vikram Singh', action: 'user.signup', target: 'vikram@wastewise.app', detail: 'Requested vendor access' });
  logs.sort((a, b) => b.at - a.at);

  const notifications = [];
  const note = (to, title, body, requestId, kind, at, read = true) => notifications.push({ id: `n-${notifications.length + 1}`, to, title, body, requestId, kind, at, read });
  const recent = [...requests].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  for (const q of recent) {
    if (q.status === STATUS.OPEN) for (const v of ['u-ven-1', 'u-ven-2', 'u-ven-3']) note(v, 'New pickup nearby', `${q.code} - ${q.location}`, q.id, 'new', q.createdAt, false);
    if (q.acceptedAt) note(q.createdBy, 'Pickup accepted', `${q.vendorName} accepted ${q.code}`, q.id, 'accepted', q.acceptedAt, false);
    if (q.completedAt && q.vendorId) note(q.vendorId, 'Handover confirmed', `${q.code}: ${q.weightKg} kg handed over`, q.id, 'completed', q.completedAt, false);
  }
  note('u-admin', 'New vendor request', 'Vikram Singh (Swachh Movers) wants vendor access', null, 'role', now - 2 * DAY, false);
  notifications.sort((a, b) => b.at - a.at);

  return {
    version: 1,
    seededAt: now,
    nextCode: 1001 + requests.length,
    users,
    bins: Object.fromEntries(SEED_BINS.map((b) => [b.id, { ...b, createdAt: now - 90 * DAY }])),
    requests: Object.fromEntries(requests.map((q) => [q.id, q])),
    logs,
    notifications,
    passwords: {},
  };
}
