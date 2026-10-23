// Shared helpers for pages.

import { h, indexChildren } from '../ui/dom.js';
import { toast } from '../ui/components.js';

/** Page root whose sections slide in one after another. */
export function pageRoot(...children) {
  const el = h('div', { class: 'stack enter' }, ...children);
  return indexChildren(el);
}

/** Run an async action and show any error as a toast. */
export async function attempt(fn, okMessage) {
  try {
    const out = await fn();
    if (okMessage) toast(okMessage, 'success');
    return out;
  } catch (e) {
    console.warn(e);
    toast(e?.message || 'Something went wrong', 'error');
    throw e;
  }
}

/** Keeps watcher unsubscribe functions and cleans them up when the page closes. */
export function lifetime() {
  const offs = [];
  return {
    add: (off) => (offs.push(off), off),
    destroy: () => offs.splice(0).forEach((f) => {
      try {
        f?.();
      } catch {
        /* ignore */
      }
    }),
  };
}

export const firstName = (name = '') => String(name).trim().split(/\s+/)[0] || '';
