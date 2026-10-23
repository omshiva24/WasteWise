// Reports (admin: everything, supervisor: own requests) - PDF report and CSV export.
import { h, icon } from '../../ui/dom.js';
import { btn, segmented, toast, setBusy } from '../../ui/components.js';
import { requestService } from '../../api/request.service.js';
import { buildReport } from '../../core/report.js';
import { requestsToCsv } from '../../core/csv.js';
import { summarize } from '../../core/stats.js';
import { DAY } from '../../core/constants.js';
import { fmtKg, fmtHours } from '../../core/format.js';
import { saveFile } from '../../ui/native.js';
import { confetti } from '../../ui/fx.js';
import { pageRoot, lifetime } from '../common.js';

const PERIODS = [
  { value: '7', label: '7 days', days: 7 },
  { value: '30', label: '30 days', days: 30 },
  { value: '90', label: '90 days', days: 90 },
  { value: 'all', label: 'All time', days: null },
];

export default function reports({ user }) {
  const life = lifetime();
  let period = '30';
  let all = [];
  const preview = h('div', { class: 'kpis' });
  const scope = user.role === 'admin' ? 'All zones' : `${user.name}'s requests`;
  const pick = () => {
    const p = PERIODS.find((x) => x.value === period);
    const from = p.days ? Date.now() - p.days * DAY : 0;
    return { items: all.filter((r) => r.createdAt >= from), label: p.days ? `Last ${p.days} days` : 'All time' };
  };
  const tile = (ic, tone, label, value) => h('div', { class: 'kpi pop-in' }, h('div', { class: `ic bg-${tone}` }, icon(ic, { size: 20 })), h('div', { class: 'val' }, value), h('div', { class: 'lbl' }, label));
  function draw() {
    const { items } = pick();
    const s = summarize(items);
    preview.replaceChildren(
      tile('clipboard-list', 'violet', 'Requests', String(s.total)),
      tile('circle-check', 'emerald', 'Completed', String(s.byStatus.COMPLETED)),
      tile('weight', 'sky', 'Collected', fmtKg(s.kg)),
      tile('timer', 'amber', 'Avg. handover', fmtHours(s.avgCompleteHours)));
  }
  const seg = segmented(PERIODS.map(({ value, label }) => ({ value, label })), period, (v) => ((period = v), draw()));
  life.add(requestService.watch((reqs) => ((all = reqs), draw())));

  const pdfBtn = btn('Download PDF report', { kind: 'primary', size: 'lg', block: true, iconName: 'file-down' });
  pdfBtn.addEventListener('click', async () => {
    const { items, label } = pick();
    setBusy(pdfBtn, true, 'Building report…');
    try {
      await new Promise((r) => setTimeout(r, 50));
      const doc = buildReport({ requests: items, periodLabel: label, generatedBy: user.name, scopeLabel: scope });
      await saveFile(`wastewise-report-${new Date().toISOString().slice(0, 10)}.pdf`, 'application/pdf', doc.toBytes());
      confetti({ count: 80 });
      toast(`Report ready - ${doc.pages.length} pages`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.replaceChildren(icon('file-down', { size: 18 }), h('span', 'Download PDF report'));
    }
  });
  const csvBtn = btn('Export CSV (Excel)', { kind: 'ghost', size: 'lg', block: true, iconName: 'download', onClick: async () => {
    const { items } = pick();
    await saveFile(`wastewise-requests-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', requestsToCsv(items));
    toast(`${items.length} requests exported`, 'success');
  } });

  const what = h('div', { class: 'card stack-sm' }, h('h3', { style: { fontSize: '1rem' } }, "What's in the PDF"),
    ...[['gauge', 'Key numbers: requests, completion rate, kg collected, overdue'], ['chart-column', 'Waste by type and a 6-month trend chart'], ['trophy', 'Vendor performance: jobs, kg, speed and ratings'], ['triangle-alert', 'Every overdue request (7+ days)'], ['list', 'A full table of requests for the period']].map(([ic, t]) => h('div', { class: 'row small' }, h('span', { class: 'tone-emerald' }, icon(ic, { size: 18 })), t)));

  return { title: 'Reports', sub: scope, back: user.role === 'admin', el: pageRoot(seg, preview, pdfBtn, csvBtn, what), destroy: life.destroy };
}
