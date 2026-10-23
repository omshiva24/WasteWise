// Vendor: live feed of open pickups with filters and swipe-to-accept.
import { h, svgMarkup } from '../../ui/dom.js';
import { ART } from '../../ui/art.js';
import { requestCard, swipeToAccept, empty, skeletonList, toast, segmented } from '../../ui/components.js';
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
  let sort = 'oldest';
  let data = null;
  const countEl = h('span', '0');
  const kgEl = h('span', '0');
  const hero = h('section', { class: 'hero sky' },
    h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }),
    svgMarkup(ART.heroTruck, 'hero-art art'),
    h('div', { class: 'eyebrow' }, `Hi ${firstName(user.name)} · ${user.company || 'Vendor'}`),
    h('h2', {}, countEl, ' pickups waiting'),
    h('p', {}, 'You have collected ', kgEl, ' so far. Swipe a card to accept.'));

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
  const sortSeg = segmented([{ value: 'oldest', label: 'Oldest first' }, { value: 'urgent', label: 'Urgent first' }, { value: 'newest', label: 'Newest' }], sort, (v) => ((sort = v), draw(true)));
  const listHost = h('div', {}, skeletonList(3, 170));

  function sorted(items) {
    const now = Date.now();
    const score = (r) => (r.priority === 'urgent' ? 2 : 0) + (isOverdue(r, now) ? 1 : 0);
    if (sort === 'newest') return [...items].sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'urgent') return [...items].sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt);
    return [...items].sort((a, b) => a.createdAt - b.createdAt);
  }

  function draw(animate) {
    if (!data) return;
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
    kgEl.textContent = fmtKg(Math.round(kg));
    draw(first);
    first = false;
  }));

  return { title: 'Open pickups', sub: user.company || 'Vendor', el: pageRoot(hero, chips, sortSeg, listHost), destroy: life.destroy };
}
