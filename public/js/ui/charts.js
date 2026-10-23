// Animated SVG / CSS charts: donut, horizontal bars, columns, area lines, leaderboard.

import { h, s } from './dom.js';
import { onVisible } from './fx.js';

const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export function donut(segments, { size = 150, thickness = 20, centerValue = '', centerLabel = '', legendFmt = (v) => nf.format(v) } = {}) {
  const total = segments.reduce((a, x) => a + x.value, 0) || 1;
  const r = 50 - thickness / 2;
  const C = 2 * Math.PI * r;
  const svg = s('svg', { viewBox: '0 0 100 100', class: 'donut', width: size, height: size, role: 'img', 'aria-label': segments.map((x) => `${x.label} ${legendFmt(x.value)}`).join(', ') });
  svg.append(s('circle', { cx: 50, cy: 50, r, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.08, 'stroke-width': thickness }));
  const arcs = [];
  let acc = 0;
  for (const seg of segments) {
    const len = (seg.value / total) * C;
    const gap = segments.length > 1 && len > 2 ? 1.2 : 0;
    const c = s('circle', { cx: 50, cy: 50, r, fill: 'none', stroke: seg.color, 'stroke-width': thickness, 'stroke-dasharray': `0 ${C}`, 'stroke-dashoffset': String(-acc), transform: 'rotate(-90 50 50)', 'stroke-linecap': 'butt' });
    c.style.transition = 'stroke-dasharray 1.3s cubic-bezier(.22,1,.36,1)';
    arcs.push([c, `${Math.max(0, len - gap)} ${C}`]);
    svg.append(c);
    acc += len;
  }
  svg.append(s('text', { x: 50, y: 50, 'text-anchor': 'middle', class: 'center-v' }, centerValue), s('text', { x: 50, y: 62, 'text-anchor': 'middle', class: 'center-l' }, centerLabel.toUpperCase()));
  const legend = h('div', { class: 'legend' }, segments.map((x) => h('div', { class: 'li' }, h('span', { class: 'sw', style: { background: x.color } }), h('span', x.label), h('span', { class: 'lv' }, legendFmt(x.value)))));
  const el = h('div', { class: 'donut-wrap' }, svg, legend);
  onVisible(el, () => arcs.forEach(([c, d], i) => setTimeout(() => c.setAttribute('stroke-dasharray', d), i * 90)));
  return el;
}

export function hbars(rows, { fmt = (v) => nf.format(v) } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const bars = [];
  const el = h('div', { class: 'hbars' }, rows.map((r) => {
    const i = h('i', { style: { background: r.color || 'linear-gradient(90deg,#34d399,#059669)' } });
    bars.push([i, (r.value / max) * 100]);
    return h('div', { class: 'hbar' }, h('div', { class: 'lab' }, h('span', r.label), h('span', { class: 'v' }, r.display ?? fmt(r.value))), h('div', { class: 'bar' }, i));
  }));
  onVisible(el, () => bars.forEach(([i, pct], k) => setTimeout(() => (i.style.width = `${Math.max(pct, pct > 0 ? 2 : 0)}%`), k * 70)));
  return el;
}

export function columns(rows, { fmt = (v) => nf.format(v) } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const bs = [];
  const el = h('div', { class: 'cols' }, rows.map((r, idx) => {
    const b = h('div', { class: 'b', style: { height: `${Math.max(4, (r.value / max) * 100)}%` } }, h('span', fmt(r.value)));
    bs.push(b);
    return h('div', { class: `col ${idx === rows.length - 1 ? 'last' : ''}` }, b, h('div', { class: 'm' }, r.label));
  }));
  onVisible(el, () => bs.forEach((b, k) => setTimeout(() => (b.style.transform = 'scaleY(1)'), k * 80)));
  return el;
}

/** Two-series smoothed area chart (e.g. raised vs completed per week). Drawn at the real width so text never stretches. */
export function area(series, labels, { height = 180 } = {}) {
  const legend = h('div', { class: 'area-legend' }, series.map((x) => h('span', h('i', { style: { background: x.color } }), x.label)));
  const el = h('div', { class: 'area' }, legend);
  const build = () => {
    const W = Math.max(260, Math.round(el.clientWidth || 320));
    const H = height;
    const pad = { l: 28, r: 10, t: 12, b: 24 };
    const n = labels.length;
    const max = Math.max(1, ...series.flatMap((x) => x.values));
    const X = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
    const Y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
    const smooth = (vals) => {
      let d = `M${X(0)} ${Y(vals[0])}`;
      for (let i = 1; i < vals.length; i++) {
        const xm = (X(i - 1) + X(i)) / 2;
        d += ` C${xm} ${Y(vals[i - 1])} ${xm} ${Y(vals[i])} ${X(i)} ${Y(vals[i])}`;
      }
      return d;
    };
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': series.map((x) => `${x.label}: ${x.values.reduce((a, b) => a + b, 0)} total`).join(', ') });
    const defs = s('defs');
    svg.append(defs);
    for (const t of [0, 0.5, 1]) {
      const y = Y(max * t);
      svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'grid' }), s('text', { x: 2, y: y + 3, class: 'axis' }, String(Math.round(max * t))));
    }
    const step = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(W / 70))));
    labels.forEach((l, i) => i % step === 0 && svg.append(s('text', { x: X(i), y: H - 6, class: 'axis', 'text-anchor': 'middle' }, l)));
    const lines = [];
    series.forEach((ser, k) => {
      const gid = `ag${k}${Math.random().toString(36).slice(2, 6)}`;
      defs.append(s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': ser.color, 'stop-opacity': 0.32 }), s('stop', { offset: 1, 'stop-color': ser.color, 'stop-opacity': 0 })));
      const d = smooth(ser.values);
      if (ser.fill !== false) svg.append(s('path', { d: `${d} L${X(n - 1)} ${H - pad.b} L${X(0)} ${H - pad.b} Z`, fill: `url(#${gid})`, class: 'fill' }));
      const line = s('path', { d, stroke: ser.color, class: 'line' });
      svg.append(line);
      lines.push(line);
      ser.values.forEach((v, i) => svg.append(s('circle', { cx: X(i), cy: Y(v), r: 3, fill: ser.color, class: 'fill' })));
    });
    el.prepend(svg);
    for (const ln of lines) {
      const L = ln.getTotalLength?.() || 600;
      ln.style.strokeDasharray = `${L}`;
      ln.style.strokeDashoffset = `${L}`;
      ln.getBoundingClientRect();
      requestAnimationFrame(() => (ln.style.strokeDashoffset = '0'));
    }
    el.classList.add('drawn');
  };
  onVisible(el, build);
  return el;
}

export function leaderboard(items) {
  return h('div', { class: 'board stagger' }, items.map((it, i) => h('div', { class: 'bi', style: { '--i': String(i) } }, h('div', { class: 'rank' }, String(i + 1)), h('div', {}, h('div', { class: 'bn' }, it.name), it.sub ? h('div', { class: 'bs' }, it.sub) : null), h('div', { class: 'bv' }, it.value))));
}
