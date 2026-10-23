import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../public/js/core/report.js';
import { buildSeed } from '../public/js/api/backend/seed.js';
import { pdfSafe, textWidth, fitText } from '../public/js/core/pdf.js';

test('pdfSafe maps unicode to printable ASCII', () => {
  assert.equal(pdfSafe('Library Block – Entrance ₹5 → done'), 'Library Block - Entrance Rs 5 -> done');
  assert.equal(pdfSafe('Café'), 'Cafe');
});

test('text measuring and fitting', () => {
  assert.ok(textWidth('WasteWise', 10) > 40);
  const t = fitText('A very long location name that will not fit', 9, 60);
  assert.ok(t.endsWith('...'));
  assert.ok(textWidth(t, 9) <= 60);
});

test('report builds a valid multi-page PDF with a correct xref table', () => {
  const now = Date.UTC(2026, 9, 23);
  const seed = buildSeed(now);
  const doc = buildReport({ requests: Object.values(seed.requests), periodLabel: 'Last 90 days', generatedBy: 'Kavya Raman', now });
  const s = doc.build();
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  assert.ok(doc.pages.length >= 2, 'request table spills onto more pages');
  // every xref offset must point at "N 0 obj"
  const xrefAt = Number(s.match(/startxref\n(\d+)/)[1]);
  const lines = s.slice(xrefAt).split('\n');
  const count = Number(lines[1].split(' ')[1]);
  for (let i = 1; i < count; i++) {
    const off = Number(lines[2 + i].slice(0, 10));
    assert.ok(s.startsWith(`${i} 0 obj`, off), `object ${i} offset`);
  }
});
