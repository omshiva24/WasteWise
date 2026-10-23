// Vendor: my accepted jobs (awaiting handover) and completed history.
import { h } from '../../ui/dom.js';
import { kpi, segmented, requestList, empty, skeletonList, btn } from '../../ui/components.js';
import { requestService } from '../../api/request.service.js';
import { vendorBoard } from '../../core/stats.js';
import { pageRoot, lifetime } from '../common.js';

export default function vendorJobs({ user, navigate }) {
  const life = lifetime();
  let tab = 'ACCEPTED';
  let data = null;
  const kpis = h('div', { class: 'kpis' });
  const listHost = h('div', {}, skeletonList(3));
  const seg = segmented([{ value: 'ACCEPTED', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }], tab, (v) => ((tab = v), draw(true)));

  function draw(animate) {
    if (!data) return;
    const mine = data.filter((r) => r.vendorId === user.uid && r.status === tab);
    seg.setCounts({ ACCEPTED: data.filter((r) => r.vendorId === user.uid && r.status === 'ACCEPTED').length, COMPLETED: data.filter((r) => r.vendorId === user.uid && r.status === 'COMPLETED').length });
    listHost.replaceChildren(mine.length
      ? requestList(mine, { onOpen: (r) => navigate(`/request/${r.id}`), showVendor: false, showCreator: true })
      : empty({ artName: tab === 'ACCEPTED' ? 'caughtUp' : 'emptyBox', title: tab === 'ACCEPTED' ? 'No pickups in progress' : 'No completed pickups yet', text: 'Accept open pickups from the feed.', action: btn('Find pickups', { kind: 'soft', iconName: 'truck', onClick: () => navigate('/vendor') }) }));
    if (!animate) listHost.firstChild?.classList?.remove('stagger');
  }

  let first = true;
  life.add(requestService.watch((reqs) => {
    data = reqs;
    if (first) {
      const me = vendorBoard(reqs).find((v) => v.vendorId === user.uid) || { jobs: 0, kg: 0, rating: null, avgHours: null };
      kpis.replaceChildren(
        kpi({ iconName: 'circle-check', label: 'Pickups completed', value: me.jobs, tone: 'emerald' }),
        kpi({ iconName: 'weight', label: 'Kg collected', value: me.kg, tone: 'sky' }),
        kpi({ iconName: 'star', label: 'Average rating', value: me.rating || 0, tone: 'amber', decimals: 1, suffix: ' / 5' }),
        kpi({ iconName: 'timer', label: 'Avg. hours to handover', value: me.avgHours || 0, tone: 'violet', decimals: 1 }));
    }
    draw(first);
    first = false;
  }));

  return { title: 'My jobs', sub: user.company || '', el: pageRoot(kpis, seg, listHost), destroy: life.destroy };
}
