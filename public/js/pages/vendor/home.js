// Vendor: live feed of open pickups - nearest first (GPS), filters, map and swipe-to-accept.
import { h, svgMarkup } from '../../ui/dom.js';
import { ART } from '../../ui/art.js';
import { requestCard, swipeToAccept, empty, skeletonList, toast, segmented, banner, btn } from '../../ui/components.js';
import { lastKnown, watchPosition, permissionState, getPosition } from '../../ui/geo.js';
import { geoToast } from '../../ui/map.js';
import { distanceKm, fmtDistance } from '../../core/geo.js';
import { isNative } from '../../ui/native.js';
import { requestService } from '../../api/request.service.js';
import { WASTE_TYPES } from '../../core/constants.js';
import { isOverdue } from '../../core/lifecycle.js';
import { fmtKg } from '../../core/format.js';
import { countUp, haptic } from '../../ui/fx.js';
import { pageRoot, lifetime, firstName } from '../common.js';
import { icon } from '../../ui/dom.js';

export default function vendorHome({ user, navigate }) {
  const life = lifetime();
  let types = new Set();
  let me = lastKnown();
  let sort = me ? 'nearest' : 'oldest';
  let stopWatch = null;
  let data = null;
  const countEl = h('span', '0');
  const waitWord = h('span', ' pickups waiting');
  const kgEl = h('span', '0');
  const hero = h('section', { class: 'hero sky' },
    h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }),
    svgMarkup(ART.heroTruck, 'hero-art art'),
    h('div', { class: 'eyebrow' }, `Hi ${firstName(user.name)} · ${user.company || 'Vendor'}`),
    h('h2', {}, countEl, waitWord),
    h('p', {}, 'You have collected ', kgEl, ' so far. Swipe a card to accept.'),
    h('div', { class: 'row', style: { marginTop: '14px', position: 'relative' } }, btn('Open map', { kind: 'white', size: 'sm', iconName: 'map', onClick: () => navigate('/map') })));

  const locBanner = h('div');
  function startTracking() {
    stopWatch?.();
    stopWatch = watchPosition((g) => {
      const firstFix = !me;
      me = g;
      locBanner.replaceChildren();
      if (firstFix && sort === 'oldest') {
        sort = 'nearest';
        sortSeg.select?.('nearest');
      }
      if (firstFix) draw(false);
      else updateDistances();
    });
  }
  (isNative() ? Promise.resolve('granted') : permissionState()).then((st) => {
    if (st === 'granted') return startTracking();
    if (me) return;
    locBanner.replaceChildren(banner({ tone: 'sky', iconName: 'locate-fixed', title: 'See the nearest pickups first', text: 'Turn on location to sort pickups by distance from you.', action: btn('Turn on', { kind: 'sky', size: 'sm', onClick: async () => {
      try {
        me = await getPosition();
        locBanner.replaceChildren();
        sort = 'nearest';
        sortSeg.select?.('nearest');
        draw(true);
        startTracking();
      } catch (e) {
        geoToast(e);
      }
    } }) }));
  });

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by waste type' },
    h('button', { type: 'button', class: 'filter-chip on', dataset: { t: '' }, onclick: () => toggleType('') }, 'All types'),
    WASTE_TYPES.map((w) => h('button', { type: 'button', class: 'filter-chip', dataset: { t: w.id }, onclick: () => toggleType(w.id) }, icon(w.icon, { size: 16 }), w.label)));
  function toggleType(t) {
    if (!t) types = new Set();
    else types.has(t) ? types.delete(t) : types.add(t);
    [...chips.children].forEach((c) => c.classList.toggle('on', c.dataset.t ? types.has(c.dataset.t) : types.size === 0));
    haptic();
    draw(true);
  }
  const sortSeg = segmented([{ value: 'nearest', label: 'Nearest' }, { value: 'oldest', label: 'Oldest' }, { value: 'urgent', label: 'Urgent' }], sort, (v) => {
    if (v === 'nearest' && !me) toast('Turn on location to sort by distance', 'info');
    sort = v;
    draw(true);
  });
  const listHost = h('div', {}, skeletonList(3, 170));

  function sorted(items) {
    const now = Date.now();
    const score = (r) => (r.priority === 'urgent' ? 2 : 0) + (isOverdue(r, now) ? 1 : 0);
    if (sort === 'nearest' && me) {
      const d = (r) => (r.geo ? distanceKm(me, r.geo) : 1e9);
      return [...items].sort((a, b) => d(a) - d(b) || a.createdAt - b.createdAt);
    }
    if (sort === 'urgent') return [...items].sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt);
    return [...items].sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Live GPS updates only refresh the "x m away" labels, so cards never jump while you swipe. */
  function updateDistances() {
    if (!data || !me) return;
    for (const el of listHost.querySelectorAll('.rcard[data-id]')) {
      const r = data.find((x) => x.id === el.dataset.id);
      const d = el.querySelector('.dist');
      if (r?.geo && d) d.lastChild.textContent = `${fmtDistance(distanceKm(me, r.geo))} away`;
    }
  }
  let pendingDraw = null;
  listHost.addEventListener('swipeend', () => pendingDraw != null && setTimeout(() => {
    const a = pendingDraw;
    pendingDraw = null;
    draw(a);
  }, 600));

  function draw(animate) {
    if (!data) return;
    if (listHost.querySelector('.swipe.dragging, .swipe.done')) {
      pendingDraw = !!animate;
      if (listHost.querySelector('.swipe.done')) setTimeout(() => pendingDraw != null && ((pendingDraw = null), draw(false)), 900);
      return;
    }
    const open = data.filter((r) => r.status === 'OPEN' && (!types.size || types.has(r.wasteType)));
    const now = Date.now();
    if (!open.length) {
      listHost.replaceChildren(empty({ artName: 'caughtUp', title: 'All caught up!', text: types.size ? 'No open pickups of this type right now.' : 'No open pickups right now. New ones appear here instantly.' }));
      return;
    }
    listHost.replaceChildren(h('div', { class: `list ${animate ? 'stagger' : ''}` }, sorted(open).map((r, i) => {
      const card = requestCard(r, {
        now,
        showVendor: false,
        showCreator: true,
        distance: me && r.geo ? `${fmtDistance(distanceKm(me, r.geo))} away` : '',
        onOpen: (x) => navigate(`/request/${x.id}`),
        footer: swipeToAccept({ onConfirm: async () => {
          await requestService.accept(r.id).catch((e) => (toast(e.message, 'error'), Promise.reject(e)));
          toast(`Accepted ${r.code} - it's in My jobs`, 'success');
        } }),
      });
      card.style.setProperty('--i', String(Math.min(i, 12)));
      return card;
    })));
  }

  let first = true;
  life.add(requestService.watch((reqs) => {
    data = reqs;
    const openCount = reqs.filter((r) => r.status === 'OPEN').length;
    const kg = reqs.filter((r) => r.vendorId === user.uid && r.status === 'COMPLETED').reduce((a, r) => a + (r.weightKg || 0), 0);
    countUp(countEl, openCount, { duration: first ? 900 : 400 });
    waitWord.textContent = openCount === 1 ? ' pickup waiting' : ' pickups waiting';
    kgEl.textContent = fmtKg(Math.round(kg));
    draw(first);
    first = false;
  }));

  return { title: 'Open pickups', sub: user.company || 'Vendor', el: pageRoot(hero, locBanner, chips, sortSeg, listHost), destroy: () => (life.destroy(), stopWatch?.()) };
}
