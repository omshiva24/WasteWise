// Layer 1 - Waste requests (raise, accept, hand over, cancel), bins, logs, notifications.
import { getBackend } from './index.js';

export const requestService = {
  watch: (fn) => getBackend().requests.watch(fn),
  watchPublic: (fn) => getBackend().requests.watchPublic(fn),
  get: (id) => getBackend().requests.get(id),
  create: (input) => getBackend().requests.create(input),
  accept: (id) => getBackend().requests.act(id, 'accept'),
  release: (id, note) => getBackend().requests.act(id, 'release', { note }),
  complete: (id, { weightKg, rating, note }) => getBackend().requests.act(id, 'complete', { weightKg, rating, note }),
  cancel: (id, note) => getBackend().requests.act(id, 'cancel', { note }),
};

export const binService = {
  watch: (fn) => getBackend().bins.watch(fn),
  save: (bin) => getBackend().bins.save(bin),
  remove: (id) => getBackend().bins.remove(id),
};

export const logService = {
  list: (limit) => getBackend().logs.list(limit),
};

export const notificationService = {
  watch: (fn) => getBackend().notifications.watch(fn),
  markRead: (id) => getBackend().notifications.markRead(id),
  markAllRead: () => getBackend().notifications.markAllRead(),
};
