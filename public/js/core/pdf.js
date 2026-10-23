// Tiny dependency-free PDF writer (A4, Helvetica / Helvetica-Bold, text, rectangles,
// lines, circles). Enough for clean, multi-page reports with tables and bar charts.

const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const SUBS = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '…': '...', '₹': 'Rs ', '→': '->', ' ': ' ', '✕': 'x', '✓': 'v', '·': '-' };

/** Map to printable ASCII so the standard Helvetica font can show it. */
export function pdfSafe(s) {
  return String(s ?? '')
    .replace(/[–—‘’“”•…₹→ ✕✓·]/g, (c) => SUBS[c])
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '');
}

export function textWidth(s, size, bold = false) {
  const t = bold ? W_BOLD : W_REG;
  let w = 0;
  for (const ch of pdfSafe(s)) w += t[ch.charCodeAt(0) - 32] ?? 556;
  return (w * size) / 1000;
}

export function fitText(s, size, maxW, bold = false) {
  let t = pdfSafe(s);
  if (textWidth(t, size, bold) <= maxW) return t;
  while (t.length > 1 && textWidth(t + '...', size, bold) > maxW) t = t.slice(0, -1);
  return t + '...';
}

const esc = (s) => pdfSafe(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const n = (v) => (Math.round(v * 100) / 100).toString();
const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => n(v)).join(' ');
};

export class PdfDoc {
  constructor({ title = 'Report', author = '' } = {}) {
    this.W = 595.28;
    this.H = 841.89;
    this.title = title;
    this.author = author;
    this.pages = [];
    this.addPage();
  }
  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
    return this;
  }
  // Coordinates are top-left based (y grows downwards) for convenience.
  text(x, y, str, { size = 10, bold = false, color = '#111827', align = 'left', maxW } = {}) {
    let s = maxW ? fitText(str, size, maxW, bold) : pdfSafe(str);
    const w = textWidth(s, size, bold);
    const px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${n(size)} Tf ${rgb(color)} rg ${n(px)} ${n(this.H - y - size * 0.8)} Td (${esc(s)}) Tj ET`);
    return w;
  }
  rect(x, y, w, h, { fill, stroke, lw = 1 } = {}) {
    const parts = [];
    if (fill) parts.push(`${rgb(fill)} rg`);
    if (stroke) parts.push(`${rgb(stroke)} RG ${n(lw)} w`);
    parts.push(`${n(x)} ${n(this.H - y - h)} ${n(w)} ${n(h)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
    this.ops.push(parts.join(' '));
  }
  line(x1, y1, x2, y2, { color = '#e5e7eb', lw = 1 } = {}) {
    this.ops.push(`${rgb(color)} RG ${n(lw)} w ${n(x1)} ${n(this.H - y1)} m ${n(x2)} ${n(this.H - y2)} l S`);
  }
  circle(cx, cy, r, { fill = '#10b981' } = {}) {
    const k = 0.5523 * r;
    const y = this.H - cy;
    this.ops.push(`${rgb(fill)} rg ${n(cx + r)} ${n(y)} m ${n(cx + r)} ${n(y + k)} ${n(cx + k)} ${n(y + r)} ${n(cx)} ${n(y + r)} c ${n(cx - k)} ${n(y + r)} ${n(cx - r)} ${n(y + k)} ${n(cx - r)} ${n(y)} c ${n(cx - r)} ${n(y - k)} ${n(cx - k)} ${n(y - r)} ${n(cx)} ${n(y - r)} c ${n(cx + k)} ${n(y - r)} ${n(cx + r)} ${n(y - k)} ${n(cx + r)} ${n(y)} c f`);
  }
  /** Serialise to a latin-1 string; use toBytes() for a Uint8Array. */
  build() {
    const objs = [];
    const add = (s) => objs.push(s) && objs.length;
    const catalog = add('');
    const pagesId = add('');
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    for (const ops of this.pages) {
      const content = ops.join('\n');
      const cId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(this.W)} ${n(this.H)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cId} 0 R >>`));
    }
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
    const info = add(`<< /Title (${esc(this.title)}) /Author (${esc(this.author)}) /Producer (WasteWise) >>`);
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets = [];
    objs.forEach((o, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return out;
  }
  toBytes() {
    const s = this.build();
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
    return b;
  }
}
