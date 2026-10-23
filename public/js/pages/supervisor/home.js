// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Supervisor home: hero, live KPIs, overdue alert, handovers waiting, recent requests.
import { h, icon, svgMarkup } from '../../ui/dom.js';
import { ART } from '../../ui/art.js';
import { btn, kpi, sectionTitle, requestCard, empty, skeletonList, banner } from '../../ui/components.js';
import { requestService } from '../../api/request.service.js';
import { summarize } from '../../core/stats.js';
import { isOverdue } from '../../core/lifecycle.js';
import { greeting } from '../../core/format.js';
import { pageRoot, lifetime, firstName } from '../common.js';
import { openHandover } from '../shared/handover.js';

export default function supervisorHome({ user, navigate }) {
  const life = lifetime();
  const open = (r) => navigate(`/request/${r.id}`);
  const kpiHost = h('div', { class: 'kpis' });
  const alertHost = h('div');
  const waitHost = h('div');
  const recentHost = h('div', {}, skeletonList(3));

  const hero = h('section', { class: 'hero' },
    h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }), h('span', { class: 'blob b3' }),
    svgMarkup(ART.heroBins, 'hero-art art'),
    h('div', { class: 'eyebrow' }, `${greeting()}, ${firstName(user.name)}`),
    h('h2', 'Bins full? Raise a pickup.'),
    h('p', user.zone ? `You look after the ${user.zone}.` : 'Vendors nearby get notified instantly.'),
    h('div', { class: 'actions' },
      btn('Raise pickup', { kind: 'white', iconName: 'plus', onClick: () => navigate('/supervisor/new') }),
      btn('Impact', { kind: 'glass', iconName: 'chart-pie', onClick: () => navigate('/member') })));

  let firstLoad = true;
  life.add(requestService.watch((reqs) => {
    const now = Date.now();
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
    const s = summarize(reqs, now);
    const thisMonth = summarize(reqs.filter((r) => (r.completedAt || r.createdAt) >= monthStart), now);
    if (firstLoad) {
      kpiHost.replaceChildren(
        kpi({ iconName: 'clock', label: 'Open', value: s.byStatus.OPEN, tone: 'amber' }),
        kpi({ iconName: 'truck', label: 'Vendor on the way', value: s.byStatus.ACCEPTED, tone: 'sky' }),
        kpi({ iconName: 'circle-check', label: 'Completed this month', value: thisMonth.byStatus.COMPLETED, tone: 'emerald' }),
        kpi({ iconName: 'weight', label: 'Kg collected this month', value: thisMonth.kg, tone: 'violet', decimals: 0 }));
    } else {
      [s.byStatus.OPEN, s.byStatus.ACCEPTED, thisMonth.byStatus.COMPLETED, Math.round(thisMonth.kg)].forEach((v, i) => {
        const el = kpiHost.children[i]?.querySelector('.val');
        if (el) (el.textContent = new Intl.NumberFormat('en-IN').format(v)), (el.dataset.v = String(v));
      });
    }
    const late = reqs.filter((r) => isOverdue(r, now));
    alertHost.replaceChildren(late.length ? banner({ tone: 'red', iconName: 'triangle-alert', title: `${late.length} request${late.length > 1 ? 's are' : ' is'} overdue`, text: 'Waiting more than 7 days - the admin has been alerted.', action: btn('View', { kind: 'danger', size: 'sm', onClick: () => navigate('/supervisor/requests?f=overdue') }) }) : '');

    const waiting = reqs.filter((r) => r.status === 'ACCEPTED');
    waitHost.replaceChildren(...(waiting.length ? [
      sectionTitle(`Confirm handover (${waiting.length})`),
      h('div', { class: `list ${firstLoad ? 'stagger' : ''}` }, waiting.slice(0, 4).map((r, i) => {
        const c = requestCard(r, { onOpen: open, now, footer: btn('Confirm handover', { kind: 'primary', block: true, iconName: 'scale', onClick: () => openHandover(r) }) });
        c.style.setProperty('--i', String(i));
        return c;
      })),
    ] : []));

    const recent = reqs.filter((r) => r.status !== 'ACCEPTED').slice(0, 5);
    recentHost.replaceChildren(sectionTitle('Recent requests', { label: 'See all', onClick: () => navigate('/supervisor/requests') }),
      recent.length ? h('div', { class: `list ${firstLoad ? 'stagger' : ''}` }, recent.map((r, i) => {
        const c = requestCard(r, { onOpen: open, now });
        c.style.setProperty('--i', String(i));
        return c;
      })) : empty({ title: 'No requests yet', text: 'Raise your first pickup - it takes about 10 seconds.', action: btn('Raise pickup', { iconName: 'plus', onClick: () => navigate('/supervisor/new') }) }));
    firstLoad = false;
  }));

  return { title: 'Home', sub: user.zone || 'Supervisor', el: pageRoot(hero, kpiHost, alertHost, waitHost, recentHost), destroy: life.destroy };
}
