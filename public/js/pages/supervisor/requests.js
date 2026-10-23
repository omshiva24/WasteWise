// Supervisor: all my requests with status filter and search.
import { h } from '../../ui/dom.js';
import { segmented, requestList, empty, skeletonList, inputBox, btn } from '../../ui/components.js';
import { requestService } from '../../api/request.service.js';
import { isOverdue } from '../../core/lifecycle.js';
import { pageRoot, lifetime } from '../common.js';

export function filterRequests(reqs, filter, q, now = Date.now()) {
  const query = q.trim().toLowerCase();
  return reqs.filter((r) => {
    if (filter === 'overdue' && !isOverdue(r, now)) return false;
    if (!['all', 'overdue'].includes(filter) && r.status !== filter) return false;
    if (!query) return true;
    return [r.code, r.location, r.binId, r.zone, r.vendorName, r.createdByName, r.wasteType].some((x) => String(x || '').toLowerCase().includes(query));
  });
}

export function countsFor(reqs, now = Date.now()) {
  const c = { all: reqs.length, OPEN: 0, ACCEPTED: 0, COMPLETED: 0, CANCELLED: 0, overdue: 0 };
  for (const r of reqs) {
    c[r.status] += 1;
    if (isOverdue(r, now)) c.overdue += 1;
  }
  return c;
}

export default function supervisorRequests({ navigate }) {
  const life = lifetime();
  const initial = new URLSearchParams(location.hash.split('?')[1] || '').get('f') || 'all';
  let filter = initial;
  let q = '';
  let data = null;
  const listHost = h('div', {}, skeletonList(4));
  const seg = segmented([
    { value: 'all', label: 'All' },
    { value: 'OPEN', label: 'Open' },
    { value: 'ACCEPTED', label: 'Active' },
    { value: 'COMPLETED', label: 'Done' },
    { value: 'overdue', label: 'Late' },
  ], filter, (v) => ((filter = v), draw(true)));
  const search = inputBox({ iconName: 'search', type: 'search', placeholder: 'Search code, bin, location…', 'aria-label': 'Search requests' });
  search.querySelector('input').addEventListener('input', (e) => ((q = e.target.value), draw(true)));

  function draw(animate) {
    if (!data) return;
    const items = filterRequests(data, filter, q);
    seg.setCounts(countsFor(data));
    listHost.replaceChildren(items.length
      ? requestList(items, { onOpen: (r) => navigate(`/request/${r.id}`), showVendor: true })
      : empty({ title: q ? 'No matches' : 'Nothing here', text: q ? 'Try another search.' : 'Requests in this state will show up here.', action: btn('Raise pickup', { iconName: 'plus', kind: 'soft', onClick: () => navigate('/supervisor/new') }) }));
    if (!animate) listHost.firstChild?.classList?.remove('stagger');
  }
  let first = true;
  life.add(requestService.watch((reqs) => {
    data = reqs;
    draw(first);
    first = false;
  }));

  return { title: 'My requests', el: pageRoot(seg, search, listHost), destroy: life.destroy };
}
