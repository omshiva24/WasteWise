// Admin: every request with status / type filters and search.
import { h } from '../../ui/dom.js';
import { segmented, requestList, empty, skeletonList, inputBox, selectBox, btn } from '../../ui/components.js';
import { requestService } from '../../api/request.service.js';
import { WASTE_TYPES } from '../../core/constants.js';
import { filterRequests, countsFor } from '../supervisor/requests.js';
import { pageRoot, lifetime } from '../common.js';

export default function adminRequests({ navigate }) {
  const life = lifetime();
  let filter = new URLSearchParams(location.hash.split('?')[1] || '').get('f') || 'all';
  let q = '';
  let type = '';
  let data = null;
  const listHost = h('div', {}, skeletonList(5));
  const seg = segmented([
    { value: 'all', label: 'All' },
    { value: 'OPEN', label: 'Open' },
    { value: 'ACCEPTED', label: 'Active' },
    { value: 'COMPLETED', label: 'Done' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'overdue', label: 'Late' },
  ], filter, (v) => ((filter = v), draw(true)));
  const search = inputBox({ iconName: 'search', type: 'search', placeholder: 'Search code, bin, location, person…', 'aria-label': 'Search requests' });
  search.querySelector('input').addEventListener('input', (e) => ((q = e.target.value), draw(true)));
  const typeSel = selectBox([{ value: '', label: 'All waste types' }, ...WASTE_TYPES.map((w) => ({ value: w.id, label: w.label }))], '', { 'aria-label': 'Waste type' });
  typeSel.addEventListener('change', () => ((type = typeSel.value), draw(true)));

  function draw(animate) {
    if (!data) return;
    const items = filterRequests(data, filter, q).filter((r) => !type || r.wasteType === type);
    seg.setCounts(countsFor(data));
    listHost.replaceChildren(items.length ? requestList(items.slice(0, 120), { onOpen: (r) => navigate(`/request/${r.id}`), showCreator: true }) : empty({ title: 'No matching requests', text: 'Try a different filter.' }));
    if (!animate) listHost.firstChild?.classList?.remove('stagger');
  }
  let first = true;
  life.add(requestService.watch((reqs) => {
    data = reqs;
    draw(first);
    first = false;
  }));

  return {
    title: 'All requests',
    el: pageRoot(seg, h('div', { class: 'row' }, h('div', { class: 'grow' }, search), h('div', { style: { width: '42%' } }, typeSel)), h('div', { class: 'row' }, btn('Export PDF / CSV', { kind: 'ghost', size: 'sm', iconName: 'file-down', onClick: () => navigate('/reports') })), listHost),
    destroy: life.destroy,
  };
}
