// Role-based access control: what each role may do and which screens it may open.

import { ROLE_META } from './constants.js';

export const PERMISSIONS = {
  admin: ['users.manage', 'bins.manage', 'logs.view', 'reports.export', 'requests.view.all', 'requests.cancel', 'requests.complete', 'stats.view', 'bins.view'],
  supervisor: ['requests.create', 'requests.complete', 'requests.cancel.own', 'requests.view.own', 'reports.export', 'stats.view', 'bins.view'],
  vendor: ['requests.accept', 'requests.view.open', 'requests.view.assigned', 'stats.view'],
  member: ['stats.view'],
};

/** Route prefix -> roles allowed. Shared routes (/me, /notifications, /request) are open to any signed-in user. */
export const ROUTE_ROLES = {
  '/supervisor': ['supervisor'],
  '/vendor': ['vendor'],
  '/admin': ['admin'],
  '/member': ['member', 'admin', 'supervisor', 'vendor'],
  '/reports': ['admin', 'supervisor'],
  '/request': ['admin', 'supervisor', 'vendor'],
  '/notifications': ['admin', 'supervisor', 'vendor', 'member'],
  '/me': ['admin', 'supervisor', 'vendor', 'member'],
  '/map': ['admin', 'supervisor', 'vendor', 'member'],
};

export const PUBLIC_ROUTES = ['/welcome', '/login', '/signup'];

export function can(user, permission) {
  if (!user || user.active === false) return false;
  return (PERMISSIONS[user.role] || []).includes(permission);
}

export function homeFor(user) {
  if (!user) return '/login';
  if (user.needsProfile) return '/setup';
  return ROLE_META[user.role]?.home || '/member';
}

/** Returns null when allowed, otherwise the path to redirect to. */
export function guard(user, path) {
  const isPublic = PUBLIC_ROUTES.some((p) => path === p || path.startsWith(p + '/'));
  if (!user) return isPublic ? null : '/login';
  // Signed in for the first time: finish the profile before anything else.
  if (user.needsProfile) return path === '/setup' ? null : '/setup';
  if (isPublic || path === '/setup') return homeFor(user);
  if (user.active === false) return path === '/me' ? null : '/me';
  const prefix = Object.keys(ROUTE_ROLES).find((p) => path === p || path.startsWith(p + '/'));
  if (!prefix) return homeFor(user);
  return ROUTE_ROLES[prefix].includes(user.role) ? null : homeFor(user);
}

/** Which requests can a user see in lists? (Firestore rules mirror this for writes.) */
export function visibleRequests(user, requests) {
  if (!user) return [];
  switch (user.role) {
    case 'admin':
      return requests;
    case 'supervisor':
      return requests.filter((r) => r.createdBy === user.uid);
    case 'vendor':
      return requests.filter((r) => r.status === 'OPEN' || r.vendorId === user.uid);
    default:
      return requests.filter((r) => r.status === 'COMPLETED');
  }
}
