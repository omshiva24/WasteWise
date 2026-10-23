// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// About WasteWise: the creator, why it was built, and the copyright notice. Open to everyone.
import { h, icon } from '../../ui/dom.js';
import { logo } from '../../ui/art.js';
import { btn } from '../../ui/components.js';
import { state } from '../../ui/state.js';
import { homeFor } from '../../core/rbac.js';
import { APP } from '../../config.js';

export const WHY = [
  'Overflowing bins. Pickups that nobody tracks. Waste that disappears without anyone knowing how much was collected, or by whom. I saw this problem around our campuses and cities - and I refused to accept that it has to be this way.',
  'So I built WasteWise: one app where a supervisor raises a pickup at the exact GPS spot in seconds, the nearest vendor sees it live, and every single kilo is weighed, recorded and counted. Cleanliness should not depend on luck. It should be a system that everyone can trust and check.',
  'This is not just a college assignment. It is my answer to a real problem - so that every campus and every city ward can stay clean, and every person who keeps it clean gets the credit they deserve.',
];

export function creatorLine() {
  return `${APP.author} · ${APP.authorTitle}, ${APP.authorPlace}`;
}

export default function about({ navigate }) {
  const back = () => (history.length > 1 ? history.back() : navigate(state.user && !state.user.needsProfile ? homeFor(state.user) : '/login'));
  const initials = APP.author.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const hero = h('div', { class: 'auth-hero about-hero' },
    h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }),
    h('button', { type: 'button', class: 'about-back', 'aria-label': 'Back', onclick: back }, icon('chevron-left', { size: 22 })),
    h('div', { class: 'logo-row' }, logo({ size: 54, light: true }), h('h1', 'About WasteWise')),
    h('p', 'Smart waste pickups for campuses and cities - built to keep every bin moving and every kilo counted.'));

  const creator = h('section', { class: 'about-card creator' },
    h('div', { class: 'creator-badge', 'aria-hidden': 'true' }, initials),
    h('div', { class: 'eyebrow-dark' }, 'Created, designed and owned by'),
    h('h2', APP.author),
    h('div', { class: 'creator-sub' }, icon('badge-check', { size: 16 }), `${APP.authorTitle} · ${APP.authorPlace}`),
    h('a', { class: 'btn ghost sm', href: APP.authorUrl, target: '_blank', rel: 'noopener' }, icon('route', { size: 16 }), 'github.com/omshiva24'));

  const why = h('section', { class: 'about-card why' },
    h('div', { class: 'card-title' }, icon('flame', { size: 18 }), 'Why I built WasteWise'),
    ...WHY.map((p, i) => h('p', { class: i === 0 ? 'lead' : '' }, p)),
    h('div', { class: 'signature' }, `- ${APP.author}`, h('small', `${APP.authorTitle}, ${APP.authorPlace}`)));

  const rights = h('section', { class: 'about-card rights' },
    h('div', { class: 'card-title' }, icon('shield-alert', { size: 18 }), 'Copyright & ownership'),
    h('p', h('b', `© ${APP.year} ${APP.author}. All rights reserved.`)),
    h('p', `WasteWise - its idea, name, design, screens, illustrations and source code - is the original work of ${APP.author}.`),
    h('p', { class: 'warn' }, `Copying it, re-using any part of it, or presenting it as your own work (college project, hackathon or competition entry, app or product) is not allowed without written permission from ${APP.author}.`),
    h('p', { class: 'muted small' }, 'Want to use WasteWise for your campus, college or city ward? Contact the author for permission.'),
    h('div', { class: 'row wrap' },
      h('a', { class: 'btn primary sm', href: APP.authorUrl, target: '_blank', rel: 'noopener' }, icon('mail', { size: 16 }), 'Contact the author'),
      h('a', { class: 'btn ghost sm', href: `${APP.repoUrl}/blob/main/LICENSE`, target: '_blank', rel: 'noopener' }, icon('file-text', { size: 16 }), 'Read the licence')));

  const el = h('div', { class: 'auth about' }, hero,
    h('div', { class: 'auth-body stack' }, creator, why, rights,
      btn(state.user && !state.user.needsProfile ? 'Back to WasteWise' : 'Get started', { kind: 'primary', size: 'lg', block: true, iconName: 'arrow-right', onClick: back }),
      h('footer', { class: 'credit' }, `${APP.name} v${APP.version} · © ${APP.year} ${creatorLine()}`)));
  return { el, fullscreen: true };
}
