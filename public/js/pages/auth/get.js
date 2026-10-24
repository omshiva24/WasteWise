// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// "Get the app": Android APK download and iPhone / iPad Home Screen install, with a QR code for computers.
import { h, icon } from '../../ui/dom.js';
import { logo } from '../../ui/art.js';
import { btn, toast } from '../../ui/components.js';
import { qrSvg } from '../../ui/qr.js';
import { state } from '../../ui/state.js';
import { homeFor } from '../../core/rbac.js';
import { haptic } from '../../ui/fx.js';
import { APP } from '../../config.js';
import { ownerFooter } from './login.js';

export const device = () => {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const standalone = !!(globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  const safari = ios && /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua);
  const ipad = /ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { ios, android, standalone, safari, ipad, desktop: !ios && !android };
};

export const GET_URL = `${APP.liveUrl}/get`;

const step = (n, iconName, title, text) => h('li', { class: 'get-step', style: { '--i': String(n) } },
  h('span', { class: 'get-n' }, String(n)),
  h('span', { class: 'get-ic' }, icon(iconName, { size: 20 })),
  h('div', { class: 'grow' }, h('b', title), text ? h('div', { class: 'muted small' }, text) : null));

export default function getApp({ navigate }) {
  const d = device();
  const back = () => (history.length > 1 ? history.back() : navigate(state.user && !state.user.needsProfile ? homeFor(state.user) : '/login'));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(GET_URL);
      toast('Link copied - paste it in Safari', 'success');
    } catch {
      toast(GET_URL, 'info', 6000);
    }
  };
  const share = async () => {
    const text = `Get the WasteWise app (Android & iPhone): ${GET_URL}`;
    try {
      if (navigator.share) await navigator.share({ title: 'WasteWise', text, url: GET_URL });
      else {
        await navigator.clipboard.writeText(text);
        toast('Link copied - share it on WhatsApp', 'success');
      }
    } catch {
      /* cancelled */
    }
  };

  // ---- Android
  const installPwa = globalThis.__installPrompt && d.android && !d.standalone
    ? btn('Or install the web app (no download)', { kind: 'ghost', block: true, iconName: 'smartphone', onClick: async () => {
        globalThis.__installPrompt.prompt();
        await globalThis.__installPrompt.userChoice.catch(() => {});
        globalThis.__installPrompt = null;
      } })
    : null;
  const android = h('section', { class: `get-card ${d.android ? 'mine' : ''}` },
    d.android ? h('span', { class: 'get-tag' }, 'Your phone') : null,
    h('div', { class: 'get-head' }, h('span', { class: 'get-os android' }, icon('smartphone', { size: 24 })), h('div', {}, h('h2', 'Android'), h('div', { class: 'muted small' }, 'Full app · about 19 MB · free'))),
    h('a', { class: 'btn primary lg block', href: APP.apkUrl, rel: 'noopener', onclick: () => haptic('success') }, icon('download', { size: 20 }), h('span', 'Download for Android')),
    installPwa,
    h('ol', { class: 'get-steps' },
      step(1, 'download', 'Download the app', 'Tap the green button and wait for WasteWise.apk.'),
      step(2, 'smartphone', 'Open the file', 'From the notification or your Downloads folder.'),
      step(3, 'shield-check', 'Allow and install', 'If asked, allow "Install unknown apps" for your browser, then tap Install.')),
    h('p', { class: 'hint' }, 'Had an older WasteWise installed? Uninstall it first, then install this one.'));

  // ---- iPhone / iPad
  let iosBody;
  if (d.ios && d.standalone) {
    iosBody = h('div', { class: 'geo-info' }, icon('circle-check', { size: 18 }), h('span', 'WasteWise is installed on this device.'));
  } else {
    iosBody = h('div', { class: 'stack-sm' },
      d.ios && !d.safari ? h('div', { class: 'get-note' }, icon('info', { size: 18 }), h('div', {}, h('b', 'Open this page in Safari first.'), h('div', { class: 'small' }, 'Copy the link, open Safari and paste it in the address bar.')), btn('Copy link', { kind: 'sky', size: 'sm', onClick: copyLink })) : null,
      h('ol', { class: 'get-steps' },
        step(1, 'compass', 'Open in Safari', d.ios ? (d.safari ? "You're in Safari - great." : 'Use the Copy link button above.') : `Go to ${GET_URL.replace('https://', '')}`),
        step(2, 'share', 'Tap the Share button', d.ipad ? 'At the top-right of Safari (square with an arrow).' : 'At the bottom of Safari (square with an arrow pointing up).'),
        step(3, 'square-plus', 'Tap "Add to Home Screen"', 'Scroll down the list if you don\'t see it.'),
        step(4, 'circle-check', 'Tap "Add"', 'WasteWise appears on your Home Screen and opens full-screen like any app.')));
  }
  const iphone = h('section', { class: `get-card ${d.ios ? 'mine' : ''}` },
    d.ios ? h('span', { class: 'get-tag' }, 'Your phone') : null,
    h('div', { class: 'get-head' }, h('span', { class: 'get-os ios' }, icon('smartphone', { size: 24 })), h('div', {}, h('h2', 'iPhone & iPad'), h('div', { class: 'muted small' }, 'Install from Safari in 10 seconds · free'))),
    iosBody,
    h('p', { class: 'hint' }, 'Works with GPS, the camera, the live map and sign-in, just like the Android app.'));

  // ---- computer
  const qr = d.desktop ? h('section', { class: 'get-card qr-card' },
    h('div', { class: 'get-head' }, h('span', { class: 'get-os pc' }, icon('monitor-smartphone', { size: 24 })), h('div', {}, h('h2', 'On a computer?'), h('div', { class: 'muted small' }, 'Scan this with your phone camera to get the app'))),
    h('div', { class: 'get-qr' }, qrSvg(GET_URL, { border: 2 })),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, h('a', { class: 'btn ghost sm', href: '#/login' }, icon('arrow-right', { size: 16 }), 'Or use it right here in the browser'))) : null;

  const hint = d.ios && d.safari && !d.standalone && !d.ipad ? h('div', { class: 'share-hint', 'aria-hidden': 'true' }, h('span', 'Tap Share below'), icon('chevron-down', { size: 22 })) : null;

  const cards = d.ios ? [iphone, android] : d.desktop ? [qr, android, iphone] : [android, iphone];
  const el = h('div', { class: 'auth get' },
    h('div', { class: 'auth-hero about-hero' },
      h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }),
      h('button', { type: 'button', class: 'about-back', 'aria-label': 'Back', onclick: back }, icon('chevron-left', { size: 22 })),
      h('div', { class: 'logo-row' }, logo({ size: 54, light: true }), h('h1', 'Get WasteWise')),
      h('p', 'Free on Android and iPhone. Same account, same live data on every device.')),
    h('div', { class: 'auth-body stack' }, ...cards,
      btn('Share this page', { kind: 'ghost', size: 'lg', block: true, iconName: 'send', onClick: share }),
      ownerFooter()),
    hint);
  return { el, fullscreen: true };
}
