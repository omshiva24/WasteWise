// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Builds the WasteWise PDF report (KPIs, charts, vendor table, overdue list, all requests).

import { PdfDoc, fitText } from './pdf.js';
import { summarize, byWasteType, monthlySeries, vendorBoard, overdueList } from './stats.js';
import { WASTE_BY_ID, STATUS_META } from './constants.js';
import { overdueDays } from './lifecycle.js';

const C = { ink: '#0f172a', mute: '#64748b', line: '#e2e8f0', brand: '#059669', brandDark: '#064e3b', soft: '#ecfdf5', amber: '#f59e0b', sky: '#0ea5e9', red: '#ef4444', slate: '#94a3b8' };
const statusColor = { OPEN: C.amber, ACCEPTED: C.sky, COMPLETED: C.brand, CANCELLED: C.slate };
const d = (t) => (t ? new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const num = (v) => (v == null ? '-' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(v));

export function buildReport({ requests, periodLabel, generatedBy, scopeLabel = 'All zones', now = Date.now() }) {
  const doc = new PdfDoc({ title: `WasteWise report - ${periodLabel}`, author: generatedBy });
  const M = 40;
  const W = doc.W - 2 * M;
  let y = 0;
  let page = 1;

  const footer = () => {
    doc.line(M, doc.H - 34, doc.W - M, doc.H - 34, { color: C.line });
    doc.text(M, doc.H - 28, 'WasteWise (c) 2026 P Om Shiva, M.Tech CSE, Pondicherry University - all rights reserved', { size: 8, color: C.mute });
    doc.text(doc.W - M, doc.H - 28, `Page ${page}`, { size: 8, color: C.mute, align: 'right' });
  };
  const newPage = () => {
    footer();
    doc.addPage();
    page += 1;
    doc.rect(0, 0, doc.W, 28, { fill: C.brandDark });
    doc.text(M, 9, 'WasteWise report', { size: 9, bold: true, color: '#ffffff' });
    doc.text(doc.W - M, 9, periodLabel, { size: 9, color: '#a7f3d0', align: 'right' });
    y = 46;
  };
  const need = (h) => {
    if (y + h > doc.H - 50) newPage();
  };
  const heading = (t) => {
    need(40);
    doc.text(M, y, t, { size: 13, bold: true, color: C.ink });
    doc.rect(M, y + 18, 28, 3, { fill: C.brand });
    y += 30;
  };

  // ---- cover band
  doc.rect(0, 0, doc.W, 128, { fill: C.brandDark });
  doc.rect(0, 120, doc.W, 8, { fill: C.brand });
  doc.circle(doc.W - 70, 50, 70, { fill: '#065f46' });
  doc.circle(doc.W - 30, 100, 38, { fill: '#047857' });
  doc.text(M, 30, 'WasteWise', { size: 26, bold: true, color: '#ffffff' });
  doc.text(M, 64, 'Waste Collection Report', { size: 14, color: '#a7f3d0' });
  doc.text(M, 88, `${periodLabel}  -  ${scopeLabel}`, { size: 10, color: '#d1fae5' });
  doc.text(doc.W - M, 88, `Generated ${d(now)} by ${generatedBy}`, { size: 9, color: '#d1fae5', align: 'right', maxW: 240 });
  y = 150;

  // ---- KPI tiles
  const s = summarize(requests, now);
  const kpis = [
    ['Requests raised', num(s.total), C.ink],
    ['Completed', num(s.byStatus.COMPLETED), C.brand],
    ['Waste collected', `${num(s.kg)} kg`, C.brand],
    ['Completion rate', `${s.completionRate}%`, C.sky],
    ['Overdue (>7 days)', num(s.overdue), s.overdue ? C.red : C.mute],
    ['Avg. pickup time', s.avgCompleteHours == null ? '-' : `${num(s.avgCompleteHours)} h`, C.amber],
  ];
  const kw = (W - 2 * 12) / 3;
  kpis.forEach(([label, value, col], i) => {
    const x = M + (i % 3) * (kw + 12);
    const yy = y + Math.floor(i / 3) * 70;
    doc.rect(x, yy, kw, 60, { fill: '#f8fafc', stroke: C.line });
    doc.rect(x, yy, 4, 60, { fill: col });
    doc.text(x + 14, yy + 12, label, { size: 9, color: C.mute });
    doc.text(x + 14, yy + 28, value, { size: 18, bold: true, color: C.ink });
  });
  y += 150;

  // ---- waste by type (horizontal bars)
  heading('Waste collected by type');
  const types = byWasteType(requests).filter((t) => t.count > 0);
  const maxKg = Math.max(1, ...types.map((t) => t.kg));
  for (const t of types) {
    need(22);
    doc.text(M, y + 2, t.label, { size: 10, color: C.ink });
    const bw = ((W - 200) * t.kg) / maxKg;
    doc.rect(M + 90, y, W - 200, 14, { fill: '#f1f5f9' });
    if (bw > 0) doc.rect(M + 90, y, Math.max(2, bw), 14, { fill: t.color });
    doc.text(doc.W - M, y + 2, `${num(t.kg)} kg  (${t.count} req.)`, { size: 9, color: C.mute, align: 'right' });
    y += 22;
  }
  if (!types.length) {
    doc.text(M, y, 'No requests in this period.', { size: 10, color: C.mute });
    y += 20;
  }
  y += 10;

  // ---- monthly trend (vertical bars)
  heading('Monthly trend (kg collected)');
  need(150);
  const months = monthlySeries(requests, 6, now);
  const mMax = Math.max(1, ...months.map((m) => m.kg));
  const chartH = 110;
  const bwid = W / months.length;
  doc.line(M, y + chartH, M + W, y + chartH, { color: C.line });
  months.forEach((m, i) => {
    const h = (chartH - 16) * (m.kg / mMax);
    const x = M + i * bwid + bwid * 0.22;
    doc.rect(x, y + chartH - h, bwid * 0.56, h, { fill: i === months.length - 1 ? C.brand : '#6ee7b7' });
    doc.text(x + bwid * 0.28, y + chartH - h - 13, num(m.kg), { size: 8, color: C.mute, align: 'center' });
    doc.text(x + bwid * 0.28, y + chartH + 5, m.label, { size: 9, color: C.ink, align: 'center' });
  });
  y += chartH + 30;

  // ---- tables
  const table = (cols, rows, empty) => {
    const rowH = 18;
    const headerRow = () => {
      need(rowH * 2);
      doc.rect(M, y, W, rowH, { fill: C.soft });
      let x = M + 6;
      for (const c of cols) {
        doc.text(c.align === 'right' ? x + c.w - 12 : x, y + 5, c.label, { size: 8, bold: true, color: C.brandDark, align: c.align || 'left' });
        x += c.w;
      }
      y += rowH;
    };
    headerRow();
    if (!rows.length) {
      doc.text(M + 6, y + 5, empty, { size: 9, color: C.mute });
      y += rowH + 8;
      return;
    }
    rows.forEach((r, ri) => {
      if (y + rowH > doc.H - 50) {
        newPage();
        headerRow();
      }
      if (ri % 2) doc.rect(M, y, W, rowH, { fill: '#fafafa' });
      let x = M + 6;
      cols.forEach((c, ci) => {
        const v = r[ci];
        const opts = { size: 8.5, color: c.color ? c.color(v, r) : C.ink, align: c.align || 'left', bold: !!c.bold };
        doc.text(c.align === 'right' ? x + c.w - 12 : x, y + 5, fitText(v, 8.5, c.w - 10, !!c.bold), opts);
        x += c.w;
      });
      y += rowH;
    });
    y += 14;
  };

  heading('Vendor performance');
  table(
    [{ label: 'Vendor', w: 170, bold: true }, { label: 'Completed', w: 70, align: 'right' }, { label: 'Active', w: 55, align: 'right' }, { label: 'Kg collected', w: 85, align: 'right' }, { label: 'Avg. time', w: 65, align: 'right' }, { label: 'Rating', w: 70, align: 'right' }],
    vendorBoard(requests).map((v) => [v.name, num(v.jobs), num(v.active), num(v.kg), v.avgHours == null ? '-' : `${num(v.avgHours)} h`, v.rating == null ? '-' : `${v.rating} / 5`]),
    'No vendor activity yet.',
  );

  heading('Overdue requests (open more than 7 days)');
  table(
    [{ label: 'Code', w: 70, bold: true }, { label: 'Raised', w: 80 }, { label: 'Type', w: 70 }, { label: 'Location', w: 150 }, { label: 'Status', w: 70 }, { label: 'Days late', w: 75, align: 'right', color: () => C.red }],
    overdueList(requests, now).map((r) => [r.code, d(r.createdAt), WASTE_BY_ID[r.wasteType]?.label || r.wasteType, r.location, STATUS_META[r.status]?.label, String(overdueDays(r, now))]),
    'Great - nothing is overdue.',
  );

  heading(`All requests (${requests.length})`);
  table(
    [{ label: 'Code', w: 58, bold: true }, { label: 'Raised', w: 66 }, { label: 'Type', w: 56 }, { label: 'Bin', w: 52 }, { label: 'Location', w: 106 }, { label: 'Status', w: 62, color: (v) => statusColor[String(v).toUpperCase()] || C.ink }, { label: 'Vendor', w: 82 }, { label: 'Kg', w: 33, align: 'right' }],
    [...requests].sort((a, b) => b.createdAt - a.createdAt).map((r) => [r.code, d(r.createdAt), WASTE_BY_ID[r.wasteType]?.label || r.wasteType, r.binId, r.location, STATUS_META[r.status]?.label, r.vendorName || '-', r.weightKg == null ? '-' : num(r.weightKg)]),
    'No requests in this period.',
  );

  footer();
  return doc;
}
