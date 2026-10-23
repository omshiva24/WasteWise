// Hand-made, animated SVG illustrations (logo, truck, bins, onboarding, empty states).

import { svgMarkup } from './dom.js';

export function logoMarkup({ size = 120, light = false } = {}) {
  const cx = 60;
  const r = 42;
  const segs = [];
  for (let i = 0; i < 3; i++) {
    const a0 = (-90 + i * 120 + 8) * (Math.PI / 180);
    const a1 = a0 + (96 * Math.PI) / 180;
    const p = (a) => [cx + r * Math.cos(a), cx + r * Math.sin(a)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    segs.push(`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="url(#wwg)" stroke-width="11" stroke-linecap="round"/>`);
    const tip = p(a1 + 0.2);
    const out = [cx + (r + 9) * Math.cos(a1 - 0.02), cx + (r + 9) * Math.sin(a1 - 0.02)];
    const inn = [cx + (r - 9) * Math.cos(a1 - 0.02), cx + (r - 9) * Math.sin(a1 - 0.02)];
    segs.push(`<path d="M${out[0].toFixed(1)} ${out[1].toFixed(1)} L${tip[0].toFixed(1)} ${tip[1].toFixed(1)} L${inn[0].toFixed(1)} ${inn[1].toFixed(1)} Z" fill="url(#wwg)" stroke="url(#wwg)" stroke-width="2" stroke-linejoin="round"/>`);
  }
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
    <defs><linearGradient id="wwg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bef264"/><stop offset="1" stop-color="${light ? '#34d399' : '#10b981'}"/></linearGradient>
    <linearGradient id="wwl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9f99d"/><stop offset="1" stop-color="#4ade80"/></linearGradient></defs>
    <circle cx="60" cy="60" r="57" fill="${light ? 'rgba(255,255,255,0.10)' : '#064e3b'}"/>
    <g class="ring">${segs.join('')}</g>
    <g class="leaf"><path d="M58 31c20 7 26 30 6 52-19-10-25-34-6-52z" fill="url(#wwl)"/><path d="M60 40c2 12 3 26 4 40" stroke="#166534" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M61 56l8-6M62 66l-8-5" stroke="#166534" stroke-width="2" fill="none" stroke-linecap="round"/></g>
  </svg>`;
}
export const logo = (opts) => svgMarkup(logoMarkup(opts));

export const TRUCK = `<svg viewBox="0 0 150 84" aria-hidden="true">
  <rect x="6" y="14" width="86" height="46" rx="8" fill="#ecfdf5" stroke="#064e3b" stroke-width="3.5"/>
  <path d="M30 28l7-8 7 8M44 28l-3 9M30 28l3 9" stroke="#10b981" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M49 46h-12l-4-7M60 30l4 9h-8" stroke="#10b981" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M92 28h26l20 18v16H92z" fill="#a3e635" stroke="#064e3b" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M99 34h17l12 11H99z" fill="#e0f2fe" stroke="#064e3b" stroke-width="3" stroke-linejoin="round"/>
  <rect x="2" y="56" width="140" height="8" rx="4" fill="#064e3b"/>
  <g class="wheel"><circle cx="32" cy="66" r="12" fill="#0f172a"/><circle cx="32" cy="66" r="5" fill="#cbd5e1"/><path d="M32 57v18M23 66h18" stroke="#475569" stroke-width="2"/></g>
  <g class="wheel"><circle cx="116" cy="66" r="12" fill="#0f172a"/><circle cx="116" cy="66" r="5" fill="#cbd5e1"/><path d="M116 57v18M107 66h18" stroke="#475569" stroke-width="2"/></g>
</svg>`;

const BIN = (x, y, color, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path class="lid" d="M2 10h44l-2-8H4z" fill="${color}" stroke="#064e3b" stroke-width="3" stroke-linejoin="round"/>
  <path d="M5 12h38l-4 48H9z" fill="${color}" stroke="#064e3b" stroke-width="3" stroke-linejoin="round"/>
  <path d="M16 22v28M24 22v28M32 22v28" stroke="#064e3b" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
  <circle cx="13" cy="62" r="5" fill="#0f172a"/><circle cx="35" cy="62" r="5" fill="#0f172a"/></g>`;

export const ART = {
  onboard1: `<svg viewBox="0 0 300 240" class="art" aria-hidden="true">
    <ellipse cx="150" cy="218" rx="120" ry="12" fill="#10b981" opacity=".15"/>
    <rect x="70" y="20" width="110" height="196" rx="20" fill="#064e3b"/><rect x="78" y="34" width="94" height="168" rx="12" fill="#f0fdf4"/>
    <rect x="88" y="48" width="74" height="10" rx="5" fill="#bbf7d0"/>
    <g class="float-a"><rect x="88" y="68" width="34" height="30" rx="8" fill="#3b82f6"/><rect x="128" y="68" width="34" height="30" rx="8" fill="#22c55e"/></g>
    <g class="float-b"><rect x="88" y="104" width="34" height="30" rx="8" fill="#f59e0b"/><rect x="128" y="104" width="34" height="30" rx="8" fill="#8b5cf6"/></g>
    <rect x="88" y="146" width="74" height="12" rx="6" fill="#d1fae5"/><rect x="88" y="172" width="74" height="20" rx="10" fill="#10b981"/>
    ${BIN(196, 120, '#34d399', 1.35)}
    <g class="float-a"><rect x="214" y="70" width="44" height="44" rx="8" fill="#fff" stroke="#064e3b" stroke-width="3"/><path d="M222 78h10v10h-10zM240 78h10v10h-10zM222 96h10v10h-10zM241 97h4v4h-4zM247 103h3v3h-3z" fill="#064e3b"/></g>
    <circle class="float-b" cx="46" cy="70" r="8" fill="#a3e635"/><circle class="float-a" cx="270" cy="40" r="6" fill="#0ea5e9"/>
  </svg>`,
  onboard2: `<svg viewBox="0 0 300 240" class="art" aria-hidden="true">
    <rect x="0" y="182" width="300" height="34" fill="#334155"/><path d="M10 199h30M70 199h30M130 199h30M190 199h30M250 199h30" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>
    ${BIN(26, 116, '#60a5fa', 1.1)}${BIN(244, 116, '#fbbf24', 1.1)}
    <g class="truck-move"><g transform="translate(78 100)">${TRUCK.replace('<svg viewBox="0 0 150 84" aria-hidden="true">', '<svg viewBox="0 0 150 84" width="150" height="84">')}</g></g>
    <g class="float-a"><circle cx="150" cy="56" r="26" fill="#10b981"/><path d="M139 56l8 8 15-16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    <circle class="float-b" cx="60" cy="50" r="7" fill="#a3e635"/><circle class="float-a" cx="244" cy="58" r="9" fill="#0ea5e9" opacity=".8"/>
  </svg>`,
  onboard3: `<svg viewBox="0 0 300 240" class="art" aria-hidden="true">
    <rect x="34" y="34" width="232" height="176" rx="22" fill="#fff" stroke="#d1fae5" stroke-width="3"/>
    <rect x="54" y="54" width="90" height="10" rx="5" fill="#d1fae5"/>
    <rect class="grow-bar" x="60" y="128" width="26" height="62" rx="6" fill="#6ee7b7"/>
    <rect class="grow-bar" x="96" y="104" width="26" height="86" rx="6" fill="#34d399"/>
    <rect class="grow-bar" x="132" y="86" width="26" height="104" rx="6" fill="#10b981"/>
    <rect class="grow-bar" x="168" y="66" width="26" height="124" rx="6" fill="#a3e635"/>
    <g class="float-a"><circle cx="232" cy="96" r="30" fill="none" stroke="#e2e8f0" stroke-width="12"/><circle cx="232" cy="96" r="30" fill="none" stroke="#0ea5e9" stroke-width="12" stroke-dasharray="120 189" transform="rotate(-90 232 96)" stroke-linecap="round"/></g>
    <g class="float-b"><path d="M246 160c14 5 17 22 4 38-13-7-16-24-4-38z" fill="#4ade80"/></g>
  </svg>`,
  caughtUp: `<svg viewBox="0 0 180 130" class="art" aria-hidden="true">
    <ellipse cx="90" cy="118" rx="70" ry="7" fill="#10b981" opacity=".15"/>
    <g transform="translate(20 34) scale(.95)" class="truck-move">${TRUCK.replace('<svg viewBox="0 0 150 84" aria-hidden="true">', '<svg viewBox="0 0 150 84" width="150" height="84">')}</g>
    <g class="float-a"><circle cx="146" cy="26" r="18" fill="#10b981"/><path d="M138 26l6 6 10-11" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
  </svg>`,
  emptyBox: `<svg viewBox="0 0 180 130" class="art" aria-hidden="true">
    <ellipse cx="90" cy="118" rx="64" ry="7" fill="#94a3b8" opacity=".2"/>
    ${BIN(64, 34, '#a7f3d0', 1.1)}
    <circle class="float-a" cx="40" cy="40" r="6" fill="#a3e635"/><circle class="float-b" cx="140" cy="30" r="8" fill="#7dd3fc"/>
    <path class="float-b" d="M130 70l6-6M136 70l-6-6" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
  bell: `<svg viewBox="0 0 180 130" class="art" aria-hidden="true">
    <ellipse cx="90" cy="118" rx="54" ry="6" fill="#94a3b8" opacity=".2"/>
    <g class="float-a"><path d="M62 88c6-6 6-14 6-30a22 22 0 0 1 44 0c0 16 0 24 6 30z" fill="#fde68a" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M82 96a8 8 0 0 0 16 0" stroke="#b45309" stroke-width="3" fill="none"/></g>
    <text x="122" y="44" font-family="Poppins, sans-serif" font-size="16" font-weight="700" fill="#94a3b8" class="float-b">z z</text>
  </svg>`,
  heroBins: `<svg viewBox="0 0 120 96" aria-hidden="true">${BIN(8, 30, '#bbf7d0', 0.9)}${BIN(62, 22, '#a3e635', 1.05)}</svg>`,
  heroTruck: `<svg viewBox="0 0 150 90" aria-hidden="true"><g class="truck-move">${TRUCK.replace('<svg viewBox="0 0 150 84" aria-hidden="true">', '<svg viewBox="0 0 150 84" width="150" height="84">')}</g></svg>`,
  heroChart: `<svg viewBox="0 0 120 96" aria-hidden="true"><rect class="grow-bar" x="10" y="56" width="18" height="34" rx="5" fill="#bbf7d0"/><rect class="grow-bar" x="36" y="40" width="18" height="50" rx="5" fill="#86efac"/><rect class="grow-bar" x="62" y="26" width="18" height="64" rx="5" fill="#d9f99d"/><rect class="grow-bar" x="88" y="12" width="18" height="78" rx="5" fill="#ffffff"/></svg>`,
};

export const art = (name, cls = '') => svgMarkup(ART[name], cls);
export const truck = (cls = '') => svgMarkup(TRUCK, cls);
