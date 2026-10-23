// Layer 1 - User management (admin only).
import { getBackend } from './index.js';

export const userService = {
  list: () => getBackend().users.list(),
  setRole: (uid, role) => getBackend().users.setRole(uid, role),
  setActive: (uid, active) => getBackend().users.setActive(uid, active),
  decline: (uid) => getBackend().users.decline(uid),
  resetDemo: () => getBackend().reset(),
};
