// Request detail: animated timeline, info, photo, history and role-based actions.
import { h, icon } from '../../ui/dom.js';
import { btn, chip, statusChip, wasteBubble, swipeToAccept, confirmSheet, stars, toast, empty, skeletonList, banner } from '../../ui/components.js';
import { requestService } from '../../api/request.service.js';
import { allowedActions, isOverdue, overdueDays, turnaround } from '../../core/lifecycle.js';
import { WASTE_BY_ID, STATUS_META } from '../../core/constants.js';
import { fmtDateTime, fmtKg, fmtHours, timeAgo } from '../../core/format.js';
import { qrSvg } from '../../ui/qr.js';
import { state } from '../../ui/state.js';
import { setTitle } from '../../ui/shell.js';
import { haptic } from '../../ui/fx.js';
import { pageRoot, lifetime } from '../common.js';
import { openHandover } from './handover.js';
import { miniMap } from '../../ui/map.js';
import { lastKnown } from '../../ui/geo.js';
import { distanceKm, fmtDistance } from '../../core/geo.js';

const STEPS = [
  { key: 'OPEN', label: 'Raised', icon: 'clipboard-list', color: '#f59e0b', at: (r) => r.createdAt },
  { key: 'ACCEPTED', label: 'Accepted', icon: 'truck', color: '#0ea5e9', at: (r) => r.acceptedAt },
  { key: 'COMPLETED', label: 'Handed over', icon: 'circle-check', color: '#10b981', at: (r) => r.completedAt },
];

function timeline(r) {
  const step = STATUS_META[r.status]?.step ?? 0;
  const rail = h('i');
  const el = h('div', { class: 'timeline', role: 'list', 'aria-label': 'Progress' }, h('div', { class: 'rail' }, rail), STEPS.map((s, i) =>
    h('div', { class: `step ${i <= step && r.status !== 'CANCELLED' ? 'on' : ''} ${i === step && r.status !== 'COMPLETED' && r.status !== 'CANCELLED' ? 'now' : ''}`, style: { '--c': s.color, '--d': `${i * 0.25}s` }, role: 'listitem' },
      h('div', { class: 'dot' }, icon(s.icon, { size: 20 })), h('div', { class: 's-label' }, s.label), h('div', { class: 's-time' }, s.at(r) ? timeAgo(s.at(r)) : '—'))));
  requestAnimationFrame(() => requestAnimationFrame(() => (rail.style.transform = `scaleX(${r.status === 'CANCELLED' ? 0 : step / 2})`)));
  return el;
}

const info = (k, ic, v) => h('div', { class: 'info' }, h('div', { class: 'k' }, icon(ic, { size: 13 }), k), h('div', { class: 'v' }, v ?? '—'));

export default function requestDetail({ params, navigate }) {
  const life = lifetime();
  const host = h('div', {}, skeletonList(3, 140));
  const page = { title: 'Request', back: true, el: host, destroy: life.destroy };
  let lastStatus = null;
  let mapEl = null;
  let mapKey = '';
  let photo = null;
  let photoLoading = false;
  const photoHost = h('div');
  const cleanup = () => (life.destroy(), mapEl?.destroy?.());
  page.destroy = cleanup;

  function locationCard(r, w) {
    const key = r.geo ? `${r.geo.lat},${r.geo.lng}` : '';
    if (key !== mapKey) {
      mapEl?.destroy?.();
      mapEl = r.geo ? miniMap(r.geo, { color: w.color, iconName: w.icon, height: 210, label: r.location }) : null;
      mapKey = key;
    }
    const me = lastKnown();
    const d = r.geo && me ? distanceKm(me, r.geo) : null;
    return h('section', { class: 'card stack-sm' },
      h('div', { class: 'card-title' }, icon('map-pinned', { size: 18 }), 'Location', d != null ? h('span', { class: 'chip bg-sky', style: { marginLeft: 'auto' } }, icon('navigation', { size: 13 }), `${fmtDistance(d)} away`) : null),
      h('div', { style: { fontWeight: '700' } }, r.location),
      mapEl || h('p', { class: 'muted small' }, 'No map pin was added for this request.'));
  }

  function contactRow(r, u) {
    const out = [];
    const tel = (n) => `tel:${String(n).replace(/[^\d+]/g, '')}`;
    if (r.createdByPhone && ((u.role === 'vendor' && r.vendorId === u.uid) || u.role === 'admin')) out.push(h('a', { class: 'btn ghost block', href: tel(r.createdByPhone) }, icon('phone-call', { size: 18 }), h('span', `Call ${r.createdByName?.split(' ')[0] || 'supervisor'}`)));
    if (r.vendorPhone && ((u.role === 'supervisor' && r.createdBy === u.uid) || u.role === 'admin')) out.push(h('a', { class: 'btn ghost block', href: tel(r.vendorPhone) }, icon('phone-call', { size: 18 }), h('span', `Call ${r.vendorName || 'vendor'}`)));
    return out.length ? h('div', { class: 'row' }, out) : null;
  }

  function loadPhoto(r) {
    if (r.photo) photo = r.photo;
    if (photo) {
      photoHost.replaceChildren(h('img', { src: photo, alt: `Photo of the waste for ${r.code}`, class: 'req-photo' }));
      return;
    }
    if (!r.hasPhoto || photoLoading) return;
    photoLoading = true;
    photoHost.replaceChildren(h('div', { class: 'skel', style: { height: '220px' } }));
    requestService.photo(r.id).then((p) => {
      photo = p;
      photoHost.replaceChildren(p ? h('img', { src: p, alt: `Photo of the waste for ${r.code}`, class: 'req-photo' }) : '');
    }).catch(() => photoHost.replaceChildren());
  }

  function draw(r) {
    const u = state.user;
    if (!r) {
      host.replaceChildren(empty({ title: 'Request not found', text: 'It may have been removed, or you no longer have access.', action: btn('Go back', { kind: 'soft', onClick: () => history.back() }) }));
      return;
    }
    const w = WASTE_BY_ID[r.wasteType] || WASTE_BY_ID.mixed;
    const now = Date.now();
    const late = isOverdue(r, now);
    const t = turnaround(r);
    const acts = allowedActions(r, u);
    page.title = r.code;
    page.sub = `${w.label} · ${r.location}`;
    setTitle(page.title, page.sub);

    const actions = h('div', { class: 'stack' });
    if (acts.includes('accept')) {
      actions.append(swipeToAccept({ onConfirm: async () => {
        await requestService.accept(r.id).catch((e) => (toast(e.message, 'error'), Promise.reject(e)));
        toast(`You accepted ${r.code} - tap Directions to navigate`, 'success');
      } }));
    }
    if (acts.includes('complete')) actions.append(btn('Confirm handover', { kind: 'primary', size: 'lg', block: true, iconName: 'scale', onClick: () => openHandover(r) }));
    if (acts.includes('release')) actions.append(btn("Can't make it - release pickup", { kind: 'ghost', block: true, iconName: 'undo-2', onClick: async () => {
      if (await confirmSheet({ title: 'Release this pickup?', text: 'It goes back to the open pool so another vendor can take it.', confirmLabel: 'Release', kind: 'danger', iconName: 'undo-2' })) requestService.release(r.id).then(() => toast('Pickup released', 'info')).catch((e) => toast(e.message, 'error'));
    } }));
    if (acts.includes('cancel')) actions.append(btn('Cancel request', { kind: 'danger', block: true, iconName: 'ban', onClick: async () => {
      if (await confirmSheet({ title: 'Cancel this request?', text: 'Vendors will no longer see it. This cannot be undone.', confirmLabel: 'Cancel request', kind: 'danger', iconName: 'ban' })) requestService.cancel(r.id).then(() => toast('Request cancelled', 'info')).catch((e) => toast(e.message, 'error'));
    } }));
    if (r.status === 'ACCEPTED' && u.role === 'vendor' && r.vendorId === u.uid) actions.prepend(banner({ tone: 'sky', iconName: 'truck', title: 'You accepted this pickup', text: 'Collect the waste - the supervisor will confirm the weight at handover.' }));
    if (r.status === 'ACCEPTED' && u.role === 'supervisor') actions.prepend(banner({ tone: 'sky', iconName: 'truck', title: `${r.vendorName} is on the way`, text: 'When they collect, confirm the handover with the weight.' }));

    const header = h('section', { class: 'card pad-lg stack' },
      h('div', { class: 'detail-head' }, wasteBubble(r.wasteType, 'wbig', 32), h('div', {},
        h('div', { class: 'row wrap', style: { gap: '6px' } }, statusChip(r.status), r.priority === 'urgent' ? chip('Urgent', 'red', 'flame', 'urgent') : null, late ? chip(`Overdue by ${overdueDays(r, now) || 1}d`, 'red', 'triangle-alert', 'overdue') : null),
        h('h2', { style: { fontSize: '1.3rem', marginTop: '6px' } }, r.location),
        h('div', { class: 'muted small' }, [w.label, r.binId ? `Bin ${r.binId}` : '', r.zone].filter(Boolean).join(' · ')))),
      r.status === 'CANCELLED' ? banner({ tone: 'amber', iconName: 'ban', title: 'This request was cancelled' }) : timeline(r));

    const grid = h('div', { class: 'info-grid' },
      info('Raised by', 'user', r.createdByName),
      info('Raised', 'calendar', fmtDateTime(r.createdAt)),
      info('Vendor', 'truck', r.vendorName),
      info('Accepted', 'clock', r.acceptedAt ? `${fmtDateTime(r.acceptedAt)} (${fmtHours(t.acceptHours)})` : null),
      info('Weight', 'weight', r.weightKg ? fmtKg(r.weightKg) : r.estKg ? `~${fmtKg(Number(r.estKg))} est.` : null),
      info('Completed', 'circle-check', r.completedAt ? `${fmtDateTime(r.completedAt)} (${fmtHours(t.completeHours)})` : null));
    const extras = h('section', { class: 'card stack' }, grid,
      r.rating ? h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'Rating'), stars(r.rating, null, { mini: true, readonly: true })) : null,
      r.notes ? h('div', { class: 'info' }, h('div', { class: 'k' }, icon('paperclip', { size: 13 }), 'Notes'), h('div', { class: 'v', style: { fontWeight: '500' } }, r.notes)) : null,
      photoHost);
    loadPhoto(r);

    const history = h('section', { class: 'card' }, h('h3', { style: { fontSize: '1rem', marginBottom: '12px' } }, 'Activity'), h('div', { class: 'history' }, [...(r.history || [])].reverse().map((ev) => {
      const m = STATUS_META[ev.status] || STATUS_META.OPEN;
      return h('div', { class: 'h' }, h('div', { class: `hd bg-${m.tone}` }, icon(m.icon, { size: 14 })), h('div', {}, h('div', { style: { fontWeight: '700', fontSize: '0.9rem' } }, ev.note), h('div', { class: 'muted small' }, `${ev.byName || ''} · ${fmtDateTime(ev.at)}`)));
    })));

    const bin = r.binId ? h('section', { class: 'card row', style: { gap: '14px' } }, h('div', { style: { width: '84px', height: '84px', background: '#fff', borderRadius: '12px', padding: '4px', flex: 'none' } }, qrSvg(r.binId)), h('div', {}, h('div', { style: { fontWeight: '700' } }, `Bin ${r.binId}`), h('div', { class: 'muted small' }, 'Scan this code on site to confirm you are at the right bin.'))) : null;
    const contact = contactRow(r, u);
    if (contact) actions.append(contact);

    host.replaceChildren(pageRoot(header, actions.childElementCount ? actions : '', locationCard(r, w), extras, bin, history));
    if (lastStatus && lastStatus !== r.status) haptic('success');
    lastStatus = r.status;
  }

  let found = false;
  life.add(requestService.watch((reqs) => {
    const r = reqs.find((x) => x.id === params.id);
    if (r) {
      found = true;
      draw(r);
    } else if (!found) {
      requestService.get(params.id).then((x) => draw(x)).catch(() => draw(null));
    } else {
      host.replaceChildren(empty({ artName: 'caughtUp', title: 'No longer available', text: 'Another vendor picked this up first.', action: btn('Back to pickups', { kind: 'soft', onClick: () => navigate('/vendor') }) }));
    }
  }));

  return page;
}
