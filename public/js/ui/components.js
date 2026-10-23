// Reusable UI components.

import { h, icon, indexChildren, svgMarkup } from './dom.js';
import { STATUS_META, WASTE_BY_ID } from '../core/constants.js';
import { isOverdue, overdueDays } from '../core/lifecycle.js';
import { timeAgo, initials, fmtKg } from '../core/format.js';
import { countUp, haptic, onVisible, reducedMotion } from './fx.js';
import { ART, TRUCK } from './art.js';

export const STATUS_COLOR = { OPEN: '#f59e0b', ACCEPTED: '#0ea5e9', COMPLETED: '#10b981', CANCELLED: '#94a3b8' };

export function btn(label, { kind = 'primary', iconName, size, block, onClick, type = 'button', disabled, cls = '', ariaLabel } = {}) {
  const b = h('button', { type, class: ['btn', kind, size, block && 'block', cls], disabled, 'aria-label': ariaLabel, onclick: onClick }, iconName ? icon(iconName, { size: 18 }) : null, label ? h('span', label) : null);
  return b;
}

export function setBusy(b, busy, label) {
  if (busy) {
    b.dataset.label = b.textContent;
    b.disabled = true;
    b.replaceChildren(h('span', { class: 'spinner' }), h('span', label || 'Please wait'));
  } else {
    b.disabled = false;
  }
}

export function chip(text, tone = 'slate', iconName, cls = '') {
  return h('span', { class: `chip bg-${tone} ${cls}` }, iconName ? icon(iconName, { size: 14 }) : null, text);
}

export const statusChip = (status) => {
  const m = STATUS_META[status] || STATUS_META.OPEN;
  return chip(m.label, m.tone, m.icon);
};

export function wasteBubble(type, cls = 'wbub', size = 24) {
  const w = WASTE_BY_ID[type] || WASTE_BY_ID.mixed;
  return h('div', { class: cls, style: { background: `linear-gradient(135deg, ${w.color}, color-mix(in srgb, ${w.color} 70%, #000))`, color: w.color }, title: w.label }, icon(w.icon, { size }));
}

const AV = [['#34d399', '#059669'], ['#38bdf8', '#0369a1'], ['#a78bfa', '#6d28d9'], ['#fbbf24', '#d97706'], ['#f472b6', '#be185d'], ['#a3e635', '#4d7c0f']];
export function avatar(name, size = '') {
  let hsh = 0;
  for (const c of String(name)) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  const [a1, a2] = AV[hsh % AV.length];
  return h('div', { class: `avatar ${size}`, style: { '--a1': a1, '--a2': a2 }, 'aria-hidden': 'true' }, initials(name));
}

export function kpi({ iconName, label, value, tone = 'emerald', decimals = 0, suffix = '', format }) {
  const v = h('div', { class: 'val' }, '0');
  const el = h('div', { class: 'kpi' }, h('div', { class: `ic bg-${tone}` }, icon(iconName, { size: 20 })), v, h('div', { class: 'lbl' }, label));
  onVisible(el, () => countUp(v, value, { decimals, suffix, format }));
  return el;
}

export function sectionTitle(title, action) {
  return h('div', { class: 'section-title' }, h('h2', title), action ? h('button', { class: 'link', type: 'button', onclick: action.onClick }, action.label, icon('chevron-right', { size: 16 })) : null);
}

export function empty({ artName = 'emptyBox', title, text, action }) {
  return h('div', { class: 'empty pop-in' }, svgMarkup(ART[artName]), h('h3', title), text ? h('p', text) : null, action || null);
}

export function skeletonList(n = 4, height = 104) {
  return h('div', { class: 'list' }, Array.from({ length: n }, () => h('div', { class: 'skel', style: { height: `${height}px` } })));
}

// ---------------------------------------------------------------- toasts
let toastBox = null;
export function toast(message, kind = 'success', ms = 2800) {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastBox);
  }
  const ic = { success: 'check', error: 'triangle-alert', info: 'info' }[kind] || 'info';
  const t = h('div', { class: `toast ${kind}` }, h('span', { class: 'ti' }, icon(ic, { size: 17 })), h('span', message));
  toastBox.append(t);
  if (kind === 'error') haptic('error');
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  }, ms);
}

// ---------------------------------------------------------------- sheets
export function sheet({ title, subtitle, content, onClose, label, focus = true }) {
  const prevFocus = document.activeElement;
  const back = h('div', { class: 'backdrop' });
  let closed = false;
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': label || title || 'Dialog' });
  const close = (value) => {
    if (closed) return;
    closed = true;
    back.classList.add('closing');
    box.classList.add('closing');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      back.remove();
      box.remove();
      prevFocus?.focus?.();
    }, 280);
    onClose?.(value);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  back.addEventListener('click', () => close());
  document.addEventListener('keydown', onKey);
  const body = typeof content === 'function' ? content(close) : content;
  box.append(h('div', { class: 'grab' }), title ? h('h3', title) : null, subtitle ? h('p', { class: 'muted small', style: { marginBottom: '12px' } }, subtitle) : null, body);
  document.body.append(back, box);
  if (focus) setTimeout(() => box.querySelector('input, select, textarea, button:not(.grab)')?.focus?.({ preventScroll: true }), 60);
  return { close, el: box };
}

export function confirmSheet({ title, text, confirmLabel = 'Confirm', kind = 'primary', iconName = 'check' }) {
  return new Promise((resolve) => {
    let answered = false;
    sheet({
      title,
      onClose: () => !answered && resolve(false),
      content: (close) =>
        h('div', { class: 'stack' }, h('p', { class: 'muted' }, text), h('div', { class: 'row' },
          btn('Not now', { kind: 'ghost', block: true, onClick: () => close() }),
          btn(confirmLabel, { kind, block: true, iconName, onClick: () => { answered = true; resolve(true); close(); } }))),
    });
  });
}

// ---------------------------------------------------------------- segmented control
export function segmented(options, value, onChange) {
  const thumb = h('span', { class: 'thumb' });
  const el = h('div', { class: 'seg', role: 'tablist' }, thumb);
  const buttons = options.map((o) =>
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(o.value === value), class: o.value === value ? 'on' : '', onclick: () => select(o.value) }, o.label, h('span', { class: 'count' }, o.count != null ? String(o.count) : '')),
  );
  el.append(...buttons);
  const place = () => {
    const i = options.findIndex((o) => o.value === value);
    const b = buttons[i];
    if (!b) return;
    thumb.style.width = `${b.offsetWidth}px`;
    thumb.style.transform = `translateX(${b.offsetLeft - 4}px)`;
  };
  function select(v) {
    if (v === value) return;
    value = v;
    buttons.forEach((b, i) => {
      b.classList.toggle('on', options[i].value === v);
      b.setAttribute('aria-selected', String(options[i].value === v));
    });
    place();
    haptic();
    onChange(v);
  }
  requestAnimationFrame(() => requestAnimationFrame(place));
  addEventListener('resize', place);
  /** Change the selection from code (does not call onChange). */
  el.select = (v) => {
    if (v === value || !options.some((o) => o.value === v)) return;
    value = v;
    buttons.forEach((b, i) => {
      b.classList.toggle('on', options[i].value === v);
      b.setAttribute('aria-selected', String(options[i].value === v));
    });
    place();
  };
  el.setCounts = (counts) => buttons.forEach((b, i) => (b.querySelector('.count').textContent = counts[options[i].value] != null ? String(counts[options[i].value]) : ''));
  return el;
}

// ---------------------------------------------------------------- form bits
export function field(labelText, control, { hint, id } = {}) {
  const fid = id || `f-${Math.random().toString(36).slice(2, 8)}`;
  const target = control.matches?.('input, select, textarea') ? control : control.querySelector?.('input, select, textarea');
  if (target && !target.id) target.id = fid;
  const err = h('div', { class: 'err', role: 'alert' });
  const wrap = h('div', { class: 'field' }, h('label', { for: target?.id || fid }, labelText), control, hint ? h('div', { class: 'hint' }, hint) : null, err);
  wrap.setError = (msg) => {
    err.textContent = msg || '';
    if (msg) {
      err.style.animation = 'none';
      void err.offsetWidth;
      err.style.animation = '';
    }
  };
  return wrap;
}

export function inputBox({ iconName, trail, ...props }) {
  const inp = h('input', { class: 'input', ...props });
  if (!iconName && !trail) return inp;
  return h('div', { class: 'input-wrap' }, iconName ? icon(iconName, { size: 20, cls: 'lead' }) : null, inp, trail ? h('div', { class: 'trail' }, trail) : null);
}

export function selectBox(options, value, props = {}) {
  return h('select', { class: 'select', ...props }, options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
}

export function toggle(on, onChange, label) {
  const b = h('button', { type: 'button', class: `toggle ${on ? 'on' : ''}`, role: 'switch', 'aria-checked': String(!!on), 'aria-label': label });
  b.addEventListener('click', () => {
    on = !on;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
    haptic();
    onChange(on);
  });
  return b;
}

export function stars(value, onChange, { mini = false, readonly = false } = {}) {
  const el = h('div', { class: `stars ${mini ? 'mini' : ''}`, role: readonly ? 'img' : 'radiogroup', 'aria-label': `${value || 0} out of 5 stars` });
  const btns = [1, 2, 3, 4, 5].map((n) =>
    h('button', { type: 'button', class: n <= value ? 'on' : '', 'aria-label': `${n} star${n > 1 ? 's' : ''}`, disabled: readonly, tabindex: readonly ? '-1' : null, onclick: () => set(n) }, icon('star', { size: mini ? 15 : 34 })),
  );
  el.append(...btns);
  function set(n) {
    value = n;
    btns.forEach((b, i) => {
      b.classList.toggle('on', i < n);
      if (i < n && !reducedMotion()) b.animate([{ transform: 'scale(0.6)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1.12)' }], { duration: 380, delay: i * 50, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    });
    haptic();
    onChange?.(n);
  }
  return el;
}

export function banner({ tone = 'amber', iconName = 'info', title, text, action }) {
  return h('div', { class: `banner ${tone}` }, h('div', { class: 'bic' }, icon(iconName, { size: 20 })), h('div', { class: 'grow' }, h('b', title), text ? h('span', { class: 'small' }, text) : null), action || null);
}

// ---------------------------------------------------------------- request card
export function requestCard(r, { onOpen, now = Date.now(), footer, showCreator = false, showVendor = true, distance = '' } = {}) {
  const w = WASTE_BY_ID[r.wasteType] || WASTE_BY_ID.mixed;
  const late = isOverdue(r, now);
  const step = STATUS_META[r.status]?.step ?? 0;
  const bar = late ? '#ef4444' : STATUS_COLOR[r.status];
  const el = h(
    'article',
    { class: `rcard ${late ? 'is-overdue' : ''}`, style: { '--bar': bar }, tabindex: '0', role: 'button', 'aria-label': `${r.code}, ${w.label} at ${r.location}, ${STATUS_META[r.status]?.label}`, dataset: { id: r.id } },
    wasteBubble(r.wasteType),
    h('div', { class: 'grow' },
      h('div', { class: 'top' }, h('span', { class: 'code' }, r.code), statusChip(r.status)),
      h('div', { class: 'loc ellipsis' }, r.location),
      h('div', { class: 'meta' },
        h('span', { class: 'row', style: { gap: '4px' } }, icon(w.icon, { size: 14 }), w.label),
        r.binId ? h('span', { class: 'row', style: { gap: '4px' } }, icon('qr-code', { size: 14 }), r.binId) : null,
        distance ? h('span', { class: 'row dist', style: { gap: '4px' } }, icon('navigation', { size: 14 }), distance) : r.geo ? h('span', { class: 'row', style: { gap: '4px' } }, icon('map-pinned', { size: 14 }), 'Pinned') : null,
        h('span', { class: 'row', style: { gap: '4px' } }, icon('clock', { size: 14 }), timeAgo(r.createdAt, now)),
        showCreator && r.createdByName ? h('span', { class: 'row', style: { gap: '4px' } }, icon('user', { size: 14 }), r.createdByName) : null,
        showVendor && r.vendorName ? h('span', { class: 'row', style: { gap: '4px' } }, icon('truck', { size: 14 }), r.vendorName) : null,
        r.weightKg ? h('span', { class: 'row', style: { gap: '4px' } }, icon('weight', { size: 14 }), fmtKg(r.weightKg)) : null,
      ),
      r.priority === 'urgent' || late ? h('div', { class: 'row', style: { marginTop: '8px', gap: '6px' } },
        r.priority === 'urgent' ? chip('Urgent', 'red', 'flame', 'urgent') : null,
        late ? chip(`Overdue · ${overdueDays(r, now) + 7}d`, 'red', 'triangle-alert', 'overdue') : null) : null,
      r.status !== 'CANCELLED' ? h('div', { class: 'track', 'aria-hidden': 'true' }, [0, 1, 2].map((i) => h('span', { class: i <= step ? 'on' : '' }))) : null,
    ),
    footer ? h('div', { class: 'actions', onclick: (e) => e.stopPropagation() }, footer) : null,
  );
  const open = () => onOpen?.(r);
  el.addEventListener('click', open);
  el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && e.target === el && (e.preventDefault(), open()));
  return el;
}

export function requestList(requests, opts = {}) {
  const list = h('div', { class: 'list stagger' }, requests.map((r) => requestCard(r, opts)));
  return indexChildren(list);
}

// ---------------------------------------------------------------- swipe to accept
export function swipeToAccept({ label = 'Swipe to accept pickup', onConfirm }) {
  const fill = h('div', { class: 'fill' });
  const knob = h('button', { type: 'button', class: 'knob', 'aria-label': `${label} (or press Enter)` }, icon('truck', { size: 22 }));
  const lab = h('div', { class: 'label' }, h('span', label), h('span', { class: 'chev', 'aria-hidden': 'true' }, icon('chevron-right', { size: 16 }), icon('chevron-right', { size: 16 }), icon('chevron-right', { size: 16 })));
  const el = h('div', { class: 'swipe' }, fill, lab, knob);
  let startX = 0;
  let x = 0;
  let dragging = false;
  let busy = false;
  const max = () => el.clientWidth - knob.offsetWidth - 10;
  const set = (v, anim) => {
    x = Math.max(0, Math.min(max(), v));
    knob.style.transition = anim ? 'transform .45s cubic-bezier(.34,1.56,.64,1)' : 'none';
    fill.style.transition = anim ? 'width .45s cubic-bezier(.34,1.56,.64,1)' : 'none';
    knob.style.transform = `translateX(${x}px)`;
    fill.style.width = `${x + knob.offsetWidth / 2 + 5}px`;
    lab.style.opacity = String(1 - (x / max()) * 0.8);
  };
  const confirm = async () => {
    if (busy) return;
    busy = true;
    set(max(), true);
    el.classList.add('done');
    lab.firstChild.textContent = 'Accepting…';
    haptic('success');
    try {
      await onConfirm();
      lab.firstChild.textContent = 'Accepted!';
      knob.replaceChildren(icon('check', { size: 22 }));
    } catch (e) {
      el.classList.remove('done');
      lab.firstChild.textContent = label;
      busy = false;
      set(0, true);
      throw e;
    }
  };
  knob.addEventListener('pointerdown', (e) => {
    if (busy) return;
    dragging = true;
    el.classList.add('dragging');
    startX = e.clientX - x;
    knob.setPointerCapture(e.pointerId);
    haptic();
  });
  knob.addEventListener('pointermove', (e) => dragging && set(e.clientX - startX));
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    el.dispatchEvent(new CustomEvent('swipeend', { bubbles: true }));
    if (x > max() * 0.8) confirm().catch(() => {});
    else set(0, true);
  };
  knob.addEventListener('pointerup', end);
  knob.addEventListener('pointercancel', end);
  knob.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), confirm().catch(() => {})));
  return el;
}

// ---------------------------------------------------------------- success overlay with driving truck
export function successOverlay({ title = 'Done!', text = '', ms = 1900, mode = 'truck' } = {}) {
  return new Promise((resolve) => {
    const scene = mode === 'truck'
      ? h('div', { class: 'scene' }, h('div', { class: 'road' }), svgMarkup(TRUCK.replace('<svg', '<svg class="truck"')))
      : h('div', { class: 'check' }, icon('check', { size: 38, stroke: 3 }));
    const ov = h('div', { class: 'success-overlay', role: 'status' }, h('div', {}, scene, h('h2', title), text ? h('p', text) : null));
    document.body.append(ov);
    haptic('success');
    setTimeout(() => {
      ov.classList.add('out');
      setTimeout(() => (ov.remove(), resolve()), 380);
    }, reducedMotion() ? 700 : ms);
  });
}
