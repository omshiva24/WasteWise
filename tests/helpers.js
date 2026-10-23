// Test helpers: in-memory localStorage and a controllable clock.
export class MemoryStorage {
  constructor() {
    this.m = new Map();
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
}

export function clock(start = Date.UTC(2026, 9, 23, 6, 0, 0)) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
}
