// Printable PDF of bin QR stickers (3 x 4 per A4 page).

import qrcodegen from '../vendor/qrcodegen.js';
import { PdfDoc, fitText } from './pdf.js';
import { WASTE_BY_ID } from './constants.js';

export function qrMatrix(text) {
  const qr = qrcodegen.QrCode.encodeText(String(text), qrcodegen.QrCode.Ecc.MEDIUM);
  return Array.from({ length: qr.size }, (_, y) => Array.from({ length: qr.size }, (_, x) => qr.getModule(x, y)));
}

export function buildBinLabels(bins) {
  const doc = new PdfDoc({ title: 'WasteWise bin QR labels', author: 'WasteWise' });
  const cols = 3;
  const rows = 4;
  const M = 30;
  const gap = 12;
  const lw = (doc.W - 2 * M - gap * (cols - 1)) / cols;
  const lh = (doc.H - 2 * M - gap * (rows - 1)) / rows;
  bins.forEach((b, i) => {
    if (i && i % (cols * rows) === 0) doc.addPage();
    const k = i % (cols * rows);
    const x = M + (k % cols) * (lw + gap);
    const y = M + Math.floor(k / cols) * (lh + gap);
    const color = WASTE_BY_ID[b.wasteType]?.color || '#10b981';
    doc.rect(x, y, lw, lh, { fill: '#ffffff', stroke: '#cbd5e1', lw: 1 });
    doc.rect(x, y, lw, 26, { fill: '#064e3b' });
    doc.rect(x, y + 26, lw, 4, { fill: color });
    doc.text(x + 10, y + 8, 'WasteWise', { size: 10, bold: true, color: '#ffffff' });
    doc.text(x + lw - 10, y + 8, (WASTE_BY_ID[b.wasteType]?.label || 'Mixed').toUpperCase(), { size: 8, bold: true, color: '#a7f3d0', align: 'right' });
    const m = qrMatrix(b.id);
    const size = Math.min(lw - 40, lh - 100);
    const cell = size / (m.length + 2);
    const qx = x + (lw - size) / 2;
    const qy = y + 38;
    m.forEach((row, ry) => row.forEach((on, rx) => on && doc.rect(qx + (rx + 1) * cell, qy + (ry + 1) * cell, cell + 0.15, cell + 0.15, { fill: '#062e22' })));
    doc.text(x + lw / 2, qy + size + 4, b.id, { size: 15, bold: true, align: 'center', color: '#0f172a' });
    doc.text(x + lw / 2, qy + size + 22, fitText(b.location, 9, lw - 16), { size: 9, align: 'center', color: '#334155' });
    doc.text(x + lw / 2, qy + size + 35, fitText(b.zone || '', 8, lw - 16), { size: 8, align: 'center', color: '#64748b' });
  });
  return doc;
}
