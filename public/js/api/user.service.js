// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Layer 1 - User management (admin only).
import { getBackend } from './index.js';

export const userService = {
  list: () => getBackend().users.list(),
  setRole: (uid, role) => getBackend().users.setRole(uid, role),
  setActive: (uid, active) => getBackend().users.setActive(uid, active),
  decline: (uid) => getBackend().users.decline(uid),
};
