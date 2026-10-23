// Shared domain constants: roles, statuses, waste types.

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const OVERDUE_DAYS = 7;

export const ROLES = ['admin', 'supervisor', 'vendor', 'member'];

export const ROLE_META = {
  admin: { label: 'Admin', icon: 'shield-check', tone: 'violet', home: '/admin', blurb: 'Manage users, bins, logs & reports' },
  supervisor: { label: 'Supervisor', icon: 'clipboard-list', tone: 'emerald', home: '/supervisor', blurb: 'Raise pickups & confirm handovers' },
  vendor: { label: 'Vendor', icon: 'truck', tone: 'sky', home: '/vendor', blurb: 'Accept & complete waste pickups' },
  member: { label: 'Member', icon: 'users', tone: 'amber', home: '/member', blurb: 'See live recycling stats' },
};

export const STATUS = Object.freeze({
  OPEN: 'OPEN',
  ACCEPTED: 'ACCEPTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const STATUS_META = {
  OPEN: { label: 'Open', tone: 'amber', icon: 'clock', step: 0 },
  ACCEPTED: { label: 'Accepted', tone: 'sky', icon: 'truck', step: 1 },
  COMPLETED: { label: 'Completed', tone: 'emerald', icon: 'circle-check', step: 2 },
  CANCELLED: { label: 'Cancelled', tone: 'slate', icon: 'ban', step: -1 },
};

export const WASTE_TYPES = [
  { id: 'plastic', label: 'Plastic', icon: 'milk', color: '#3b82f6' },
  { id: 'organic', label: 'Organic', icon: 'apple', color: '#22c55e' },
  { id: 'paper', label: 'Paper', icon: 'newspaper', color: '#f59e0b' },
  { id: 'glass', label: 'Glass', icon: 'wine', color: '#06b6d4' },
  { id: 'metal', label: 'Metal', icon: 'nut', color: '#64748b' },
  { id: 'ewaste', label: 'E-waste', icon: 'cpu', color: '#8b5cf6' },
  { id: 'hazardous', label: 'Hazardous', icon: 'biohazard', color: '#ef4444' },
  { id: 'mixed', label: 'Mixed', icon: 'package', color: '#a16207' },
];

export const WASTE_BY_ID = Object.fromEntries(WASTE_TYPES.map((w) => [w.id, w]));

export const PRIORITIES = ['normal', 'urgent'];

export const LIMITS = {
  notes: 280,
  name: 60,
  location: 80,
  binId: 24,
  maxWeightKg: 50_000,
  photoBytes: 350_000,
};
