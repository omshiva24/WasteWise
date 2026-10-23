// Admin dashboard: KPIs, charts, overdue list, vendor leaderboard, pending approvals.
import { h, svgMarkup } from '../../ui/dom.js';
import { ART } from '../../ui/art.js';
import { kpi, sectionTitle, requestCard, btn, banner, skeletonList } from '../../ui/components.js';
import { donut, hbars, area, leaderboard, columns } from '../../ui/charts.js';
import { requestService } from '../../api/request.service.js';
import { userService } from '../../api/user.service.js';
import { summarize, byWasteType, weeklySeries, vendorBoard, zoneBoard, overdueList, monthlySeries } from '../../core/stats.js';
import { STATUS_META } from '../../core/constants.js';
import { STATUS_COLOR } from '../../ui/components.js';
import { fmtKg, fmtHours, greeting } from '../../core/format.js';
import { pageRoot, lifetime, firstName } from '../common.js';

export default function adminHome({ user, navigate }) {
  const life = lifetime();
  const host = h('div', {}, skeletonList(4, 120));
  const pendingHost = h('div');

  userService.list().then((users) => {
    const pending = users.filter((u) => u.requestedRole);
    if (pending.length) pendingHost.replaceChildren(banner({ tone: 'sky', iconName: 'user-check', title: `${pending.length} access request${pending.length > 1 ? 's' : ''} waiting`, text: pending.map((u) => `${u.name} (${u.requestedRole})`).join(', '), action: btn('Review', { kind: 'sky', size: 'sm', onClick: () => navigate('/admin/users') }) }));
  }).catch(() => {});

  let drawn = false;
  life.add(requestService.watch((reqs) => {
    if (drawn) return; // charts are a snapshot; reopen the page to refresh
    drawn = true;
    const now = Date.now();
    const s = summarize(reqs, now);
    const weeks = weeklySeries(reqs, 12, now);
    const late = overdueList(reqs, now);
    const hero = h('section', { class: 'hero violet' },
      h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }),
      svgMarkup(ART.heroChart, 'hero-art art'),
      h('div', { class: 'eyebrow' }, `${greeting()}, ${firstName(user.name)}`),
      h('h2', `${fmtKg(s.kg)} collected`),
      h('p', `${s.byStatus.COMPLETED} pickups completed · ${s.completionRate}% completion · avg. ${fmtHours(s.avgCompleteHours)} to handover`),
      h('div', { class: 'actions' }, btn('Export report', { kind: 'white', iconName: 'file-down', onClick: () => navigate('/reports') }), btn('Audit log', { kind: 'glass', iconName: 'activity', onClick: () => navigate('/admin/logs') })));

    const kpis = h('div', { class: 'kpis six' },
      kpi({ iconName: 'clipboard-list', label: 'Total requests', value: s.total, tone: 'violet' }),
      kpi({ iconName: 'clock', label: 'Open', value: s.byStatus.OPEN, tone: 'amber' }),
      kpi({ iconName: 'truck', label: 'Accepted', value: s.byStatus.ACCEPTED, tone: 'sky' }),
      kpi({ iconName: 'circle-check', label: 'Completed', value: s.byStatus.COMPLETED, tone: 'emerald' }),
      kpi({ iconName: 'triangle-alert', label: 'Overdue', value: s.overdue, tone: 'red' }),
      kpi({ iconName: 'weight', label: 'Kg collected', value: s.kg, tone: 'emerald' }));

    const statusCard = h('section', { class: 'card chart-card' }, h('h3', 'Requests by status'), h('div', { class: 'sub' }, 'All time'),
      donut(['OPEN', 'ACCEPTED', 'COMPLETED', 'CANCELLED'].map((k) => ({ label: STATUS_META[k].label, value: s.byStatus[k], color: STATUS_COLOR[k] })), { centerValue: String(s.total), centerLabel: 'requests' }));
    const trendCard = h('section', { class: 'card chart-card' }, h('h3', 'Last 12 weeks'), h('div', { class: 'sub' }, 'Requests raised vs completed per week'),
      area([{ label: 'Raised', color: '#f59e0b', values: weeks.map((d) => d.raised) }, { label: 'Completed', color: '#10b981', values: weeks.map((d) => d.completed) }], weeks.map((d) => d.label)));
    const types = byWasteType(reqs).filter((t) => t.count);
    const typeCard = h('section', { class: 'card chart-card' }, h('h3', 'Kg collected by waste type'), hbars(types.map((t) => ({ label: t.label, value: t.kg, color: t.color, display: `${fmtKg(t.kg)} · ${t.count}` }))));
    const monthCard = h('section', { class: 'card chart-card' }, h('h3', 'Monthly collection'), h('div', { class: 'sub' }, 'Kg handed over'), columns(monthlySeries(reqs, 6, now).map((m) => ({ label: m.label, value: m.kg }))));
    const vendors = h('section', { class: 'card chart-card' }, h('h3', 'Vendor leaderboard'), leaderboard(vendorBoard(reqs).slice(0, 5).map((v) => ({ name: v.name, sub: `${v.jobs} jobs · ${v.rating ? `${v.rating}★` : 'no rating'} · ${fmtHours(v.avgHours)} avg`, value: fmtKg(v.kg) }))));
    const zones = h('section', { class: 'card chart-card' }, h('h3', 'Zones'), leaderboard(zoneBoard(reqs).slice(0, 5).map((z) => ({ name: z.zone, sub: `${z.jobs} pickups · ${z.open} open`, value: fmtKg(z.kg) }))));
    const lateSec = late.length
      ? h('div', {}, sectionTitle(`Overdue (${late.length})`, { label: 'All requests', onClick: () => navigate('/admin/requests?f=overdue') }), h('div', { class: 'list stagger' }, late.slice(0, 4).map((r, i) => {
          const c = requestCard(r, { onOpen: (x) => navigate(`/request/${x.id}`), now, showCreator: true });
          c.style.setProperty('--i', String(i));
          return c;
        })))
      : '';

    host.replaceChildren(pageRoot(hero, kpis, pendingHost, h('div', { class: 'grid-2' }, statusCard, trendCard), h('div', { class: 'grid-2' }, typeCard, monthCard), lateSec, h('div', { class: 'grid-2' }, vendors, zones)));
  }));

  return { title: 'Dashboard', sub: 'Admin overview', el: host, destroy: life.destroy };
}
