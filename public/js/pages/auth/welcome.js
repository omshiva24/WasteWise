// First-launch onboarding carousel.
import { h, svgMarkup } from '../../ui/dom.js';
import { ART } from '../../ui/art.js';
import { btn } from '../../ui/components.js';
import { haptic } from '../../ui/fx.js';

const SLIDES = [
  { art: 'onboard1', title: 'Raise a pickup in seconds', text: 'Scan the bin QR, pick the waste type, snap a photo - your request goes straight to registered vendors.' },
  { art: 'onboard2', title: 'Vendors swipe to collect', text: 'Vendors see open pickups live, swipe to accept and you confirm the handover with the exact weight.' },
  { art: 'onboard3', title: 'Track every kilo', text: 'Live charts, overdue alerts after 7 days and one-tap PDF reports for your whole campus or city ward.' },
];

export default function welcome({ navigate }) {
  let i = 0;
  const slideHost = h('div', { class: 'slides' });
  const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, SLIDES.map(() => h('i')));
  const next = btn('Next', { kind: 'primary', size: 'lg', block: true, iconName: 'arrow-right' });
  const skip = h('button', { type: 'button', class: 'btn ghost block', onclick: finish }, 'Skip');
  function finish() {
    try {
      localStorage.setItem('wastewise.onboarded', '1');
    } catch {
      /* ignore */
    }
    navigate('/login');
  }
  function show() {
    const s = SLIDES[i];
    slideHost.replaceChildren(h('div', { class: 'slide', role: 'group', 'aria-label': `Slide ${i + 1} of ${SLIDES.length}` }, svgMarkup(ART[s.art]), h('h2', s.title), h('p', s.text)));
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    next.querySelector('span').textContent = i === SLIDES.length - 1 ? 'Get started' : 'Next';
  }
  next.addEventListener('click', () => {
    haptic();
    if (i < SLIDES.length - 1) {
      i += 1;
      show();
    } else finish();
  });
  let sx = null;
  slideHost.addEventListener('pointerdown', (e) => (sx = e.clientX));
  slideHost.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (dx < -50 && i < SLIDES.length - 1) (i += 1), show();
    if (dx > 50 && i > 0) (i -= 1), show();
  });
  show();
  return { fullscreen: true, el: h('div', { class: 'onb' }, slideHost, h('div', { class: 'foot' }, dots, next, skip)) };
}
