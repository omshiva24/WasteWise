// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Live map: pickups and bins on a real map, with the person's own GPS position.
import { h, icon } from '../../ui/dom.js';
import { statusChip, toast, btn } from '../../ui/components.js';
import { requestService, binService } from '../../api/request.service.js';
import { WASTE_BY_ID } from '../../core/constants.js';
import { isOverdue } from '../../core/lifecycle.js';
import { distanceKm, fmtDistance, normGeo } from '../../core/geo.js';
import { createMap, geoToast, openDirections } from '../../ui/map.js';
import { getPosition, lastKnown, watchPosition, permissionState } from '../../ui/geo.js';
import { isNative } from '../../ui/native.js';
import { haptic } from '../../ui/fx.js';
import { lifetime } from '../common.js';

export default function mapPage({ user, navigate }) {
  const life = lifetime();
  let reqs = [];
  let bins = [];
  let me = lastKnown();
  let m = null;
  let fitted = false;
  let stopWatch = null;
  const canSeeRequests = user.role !== 'member';
  const layers = { open: canSeeRequests, active: canSeeRequests, bins: user.role !== 'vendor' || !canSeeRequests };

  const mapBox = h('div', { class: 'map-full', role: 'application', 'aria-label': 'Map of pickups and bins' });
  const note = h('div', { class: 'map-note hide' });
  const counts = { open: h('b', '0'), active: h('b', '0'), bins: h('b', '0') };
  const chip = (key, label, tone, ic) => {
    const b = h('button', { type: 'button', class: `map-chip ${layers[key] ? 'on' : ''} t-${tone}`, 'aria-pressed': String(layers[key]), onclick: () => {
      layers[key] = !layers[key];
      b.classList.toggle('on', layers[key]);
      b.setAttribute('aria-pressed', String(layers[key]));
      haptic();
      draw();
    } }, icon(ic, { size: 15 }), label, counts[key]);
    return b;
  };
  const chips = h('div', { class: 'map-chips' },
    canSeeRequests ? chip('open', 'Open', 'amber', 'clock') : null,
    canSeeRequests ? chip('active', user.role === 'vendor' ? 'My jobs' : 'In progress', 'sky', 'truck') : null,
    chip('bins', 'Bins', 'emerald', 'trash'));
  const locate = h('button', { type: 'button', class: 'map-fab', 'aria-label': 'Show my location' }, icon('locate-fixed', { size: 22 }));
  locate.addEventListener('click', async () => {
    locate.classList.add('busy');
    try {
      me = await getPosition();
      m?.showMe(me);
      m?.flyTo(me, 16);
      startTracking();
      draw();
    } catch (e) {
      geoToast(e);
    } finally {
      locate.classList.remove('busy');
    }
  });

  function requestPopup(r) {
    const w = WASTE_BY_ID[r.wasteType] || WASTE_BY_ID.mixed;
    const d = me && r.geo ? distanceKm(me, r.geo) : null;
    return h('div', { class: 'pop' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', r.code), statusChip(r.status)),
      h('div', { class: 'pop-loc' }, r.location),
      h('div', { class: 'muted small' }, [w.label, r.priority === 'urgent' ? 'Urgent' : '', d != null ? `${fmtDistance(d)} away` : ''].filter(Boolean).join(' · ')),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        btn('Details', { kind: 'ghost', size: 'sm', block: true, onClick: () => navigate(`/request/${r.id}`) }),
        btn('Go', { kind: 'primary', size: 'sm', block: true, iconName: 'navigation', onClick: () => openDirections(r.geo) })));
  }
  function binPopup(b) {
    const w = WASTE_BY_ID[b.wasteType] || WASTE_BY_ID.mixed;
    const d = me && b.geo ? distanceKm(me, b.geo) : null;
    return h('div', { class: 'pop' },
      h('b', b.id),
      h('div', { class: 'pop-loc' }, b.location),
      h('div', { class: 'muted small' }, [w.label, b.zone, d != null ? `${fmtDistance(d)} away` : ''].filter(Boolean).join(' · ')),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        user.role === 'supervisor' ? btn('Raise pickup', { kind: 'primary', size: 'sm', block: true, iconName: 'plus', onClick: () => navigate(`/supervisor/new?bin=${encodeURIComponent(b.id)}`) }) : null,
        btn('Go', { kind: 'ghost', size: 'sm', block: true, iconName: 'navigation', onClick: () => openDirections(b.geo) })));
  }

  function draw() {
    const now = Date.now();
    const open = reqs.filter((r) => r.status === 'OPEN');
    const active = reqs.filter((r) => r.status === 'ACCEPTED' && (user.role !== 'vendor' || r.vendorId === user.uid));
    counts.open.textContent = String(open.length);
    counts.active.textContent = String(active.length);
    counts.bins.textContent = String(bins.length);
    const shown = [...(layers.open ? open : []), ...(layers.active ? active : [])];
    const noPin = shown.filter((r) => !normGeo(r.geo)).length;
    note.classList.toggle('hide', !noPin);
    note.replaceChildren(icon('info', { size: 15 }), `${noPin} pickup${noPin === 1 ? '' : 's'} without a map pin - see the list`);
    if (!m) return;
    const pins = [
      ...(layers.bins ? bins.map((b) => ({ geo: b.geo, color: '#475569', iconName: 'trash', title: b.id, popup: () => binPopup(b) })) : []),
      ...shown.map((r) => {
        const late = isOverdue(r, now);
        const w = WASTE_BY_ID[r.wasteType] || WASTE_BY_ID.mixed;
        return { geo: r.geo, color: late ? '#ef4444' : r.status === 'OPEN' ? '#f59e0b' : '#0ea5e9', iconName: w.icon, pulse: r.priority === 'urgent' || late, title: r.code, popup: () => requestPopup(r) };
      }),
    ];
    m.setPins(pins);
    if (!fitted && (pins.some((p) => normGeo(p.geo)) || me)) {
      fitted = true;
      m.fit([...pins.map((p) => p.geo), me].filter(Boolean), { maxZoom: 16 });
    }
  }

  function startTracking() {
    if (stopWatch) return;
    stopWatch = watchPosition((g) => {
      me = g;
      m?.showMe(g);
    });
  }

  createMap(mapBox, { center: me, zoom: 15 }).then((x) => {
    m = x;
    if (me) m.showMe(me);
    draw();
  }).catch(() => {
    mapBox.classList.add('tiles-failed');
    toast('The map could not load - check your internet connection', 'error');
  });
  (isNative() ? Promise.resolve('granted') : permissionState()).then((st) => st === 'granted' && startTracking());

  if (canSeeRequests) life.add(requestService.watch((list) => ((reqs = list), draw())));
  life.add(binService.watch((list) => ((bins = list), draw())));

  const el = h('div', { class: 'map-page enter' }, h('div', { class: 'map-wrap' }, mapBox, chips, locate, note));
  return { title: 'Live map', sub: user.role === 'vendor' ? 'Pickups near you' : user.role === 'member' ? 'Recycling bins' : 'Pickups and bins', el, destroy: () => (life.destroy(), stopWatch?.(), m?.destroy()) };
}
