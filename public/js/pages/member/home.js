// Community impact dashboard (every role can open it): totals, mix, trend, zones, recent pickups, tips.
import { h, icon, svgMarkup } from '../../ui/dom.js';
import { ART } from '../../ui/art.js';
import { kpi, sectionTitle, skeletonList, btn } from '../../ui/components.js';
import { donut, columns, leaderboard } from '../../ui/charts.js';
import { requestService } from '../../api/request.service.js';
import { summarize, byWasteType, monthlySeries, zoneBoard, vendorBoard } from '../../core/stats.js';
import { WASTE_BY_ID } from '../../core/constants.js';
import { fmtKg, fmtHours, timeAgo } from '../../core/format.js';
import { countUp } from '../../ui/fx.js';
import { pageRoot, lifetime } from '../common.js';

const TIPS = [
  ['leaf', 'emerald', 'Keep wet and dry waste apart', 'Food scraps in the organic bin make composting possible and keep paper and plastic clean enough to recycle.'],
  ['milk', 'sky', 'Rinse and flatten', 'Quickly rinse bottles and food boxes, then flatten them - they take less space and recyclers can actually use them.'],
  ['cpu', 'violet', 'E-waste never goes in general bins', 'Old phones, chargers and batteries contain metals that should go to an authorised e-waste recycler.'],
  ['biohazard', 'red', 'Hazardous waste needs its own bin', 'Lab chemicals, paint and medicines must be collected separately - raise an urgent pickup if a bin is full.'],
];

export default function memberHome({ user, navigate }) {
  const life = lifetime();
  const host = h('div', {}, skeletonList(3, 150));
  let tipIndex = 0;

  life.add(requestService.watchPublic((reqs) => {
    const now = Date.now();
    const done = reqs.filter((r) => r.status === 'COMPLETED');
    const s = summarize(reqs, now);
    const bigKg = h('span', '0');
    const hero = h('section', { class: 'hero' },
      h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }), h('span', { class: 'blob b3' }),
      svgMarkup(ART.heroChart, 'hero-art art'),
      h('div', { class: 'eyebrow' }, 'Community impact'),
      h('h2', {}, 'Together we moved ', bigKg),
      h('p', `${done.length} pickups handed to recyclers · ${s.byStatus.OPEN + s.byStatus.ACCEPTED} in progress right now`),
      user.role === 'supervisor' ? h('div', { class: 'actions' }, btn('Raise pickup', { kind: 'white', iconName: 'plus', onClick: () => navigate('/supervisor/new') })) : null);
    requestAnimationFrame(() => countUp(bigKg, s.kg, { format: (v) => fmtKg(Math.round(v)) }));

    const kpis = h('div', { class: 'kpis' },
      kpi({ iconName: 'circle-check', label: 'Pickups completed', value: done.length, tone: 'emerald' }),
      kpi({ iconName: 'truck', label: 'Active right now', value: s.byStatus.OPEN + s.byStatus.ACCEPTED, tone: 'sky' }),
      kpi({ iconName: 'timer', label: 'Avg. hours to collect', value: s.avgCompleteHours || 0, tone: 'amber', decimals: 1 }),
      kpi({ iconName: 'building', label: 'Zones served', value: new Set(done.map((r) => r.zone)).size, tone: 'violet' }));

    const types = byWasteType(done).filter((t) => t.kg > 0);
    const mix = h('section', { class: 'card chart-card' }, h('h3', 'Recycling mix'), h('div', { class: 'sub' }, 'Kg collected by waste type'),
      donut(types.map((t) => ({ label: t.label, value: t.kg, color: t.color })), { centerValue: fmtKg(Math.round(s.kg)), centerLabel: 'collected', legendFmt: (v) => fmtKg(v) }));
    const trend = h('section', { class: 'card chart-card' }, h('h3', 'Month by month'), h('div', { class: 'sub' }, 'Kg handed to recyclers'), columns(monthlySeries(done, 6, now).map((m) => ({ label: m.label, value: m.kg }))));
    const zones = h('section', { class: 'card chart-card' }, h('h3', 'Cleanest zones'), h('div', { class: 'sub' }, 'Most waste sent for recycling'),
      leaderboard(zoneBoard(done).slice(0, 5).map((z) => ({ name: z.zone, sub: `${z.jobs} pickups`, value: fmtKg(z.kg) }))));
    const recyclers = h('section', { class: 'card chart-card' }, h('h3', 'Top recyclers'), h('div', { class: 'sub' }, 'Vendors who collected the most'),
      leaderboard(vendorBoard(done).slice(0, 5).map((v) => ({ name: v.name, sub: `${v.jobs} pickups · ${fmtHours(v.avgHours)} avg`, value: fmtKg(v.kg) }))));

    const feed = h('section', { class: 'card' }, h('h3', { style: { fontSize: '1rem', marginBottom: '6px' } }, 'Recently collected'),
      h('div', { class: 'stack-sm stagger' }, [...done].sort((a, b) => b.completedAt - a.completedAt).slice(0, 6).map((r, i) => {
        const w = WASTE_BY_ID[r.wasteType];
        return h('div', { class: 'row', style: { '--i': String(i), padding: '8px 0', borderBottom: '1px dashed var(--line)' } },
          h('div', { class: 'avatar sm', style: { '--a1': w.color, '--a2': w.color } }, icon(w.icon, { size: 16 })),
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: '700', fontSize: '0.9rem' } }, `${fmtKg(r.weightKg)} of ${w.label.toLowerCase()}`), h('div', { class: 'muted small ellipsis' }, `${r.location} · ${r.vendorName}`)),
          h('span', { class: 'muted small nowrap' }, timeAgo(r.completedAt, now)));
      })));

    const tipBox = h('section', { class: 'card' });
    const showTip = () => {
      const [ic, tone, title, text] = TIPS[tipIndex % TIPS.length];
      tipBox.replaceChildren(h('div', { class: 'section-title', style: { margin: '0 0 10px' } }, h('h2', 'Did you know?'), h('button', { class: 'link', type: 'button', onclick: () => ((tipIndex += 1), showTip()) }, 'Next tip', icon('chevron-right', { size: 16 }))),
        h('div', { class: 'tip pop-in' }, h('div', { class: `tic bg-${tone}` }, icon(ic, { size: 20 })), h('div', {}, h('div', { style: { fontWeight: '700' } }, title), h('p', { class: 'muted small', style: { marginTop: '2px' } }, text))));
    };
    showTip();

    host.replaceChildren(pageRoot(hero, kpis, h('div', { class: 'grid-2' }, mix, trend), h('div', { class: 'grid-2' }, zones, recyclers), feed, tipBox));
  }));

  return { title: 'Impact', sub: 'Live community stats', el: host, destroy: life.destroy };
}
