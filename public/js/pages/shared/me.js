// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Profile & settings: edit details, theme, haptics, install app, data mode, about, sign out.
import { h, icon } from '../../ui/dom.js';
import { avatar, btn, chip, banner, field, inputBox, sheet, toggle, toast, confirmSheet, setBusy } from '../../ui/components.js';
import { authService } from '../../api/auth.service.js';
import { ROLE_META } from '../../core/constants.js';
import { state, getPrefs, setPrefs, applyTheme } from '../../ui/state.js';
import { setStatusBar, isNative, platform } from '../../ui/native.js';
import { logo } from '../../ui/art.js';
import { APP } from '../../config.js';
import { fmtPhone } from '../../core/format.js';
import { pageRoot } from '../common.js';

function editSheet(u) {
  const name = inputBox({ iconName: 'user', value: u.name, maxlength: 60 });
  const phone = inputBox({ iconName: 'phone', value: u.phone || '', type: 'tel', maxlength: 20, placeholder: 'So vendors / supervisors can call you' });
  const company = inputBox({ iconName: 'building', value: u.company || '', maxlength: 60 });
  const save = btn('Save', { kind: 'primary', size: 'lg', block: true, iconName: 'check' });
  sheet({
    title: 'Edit profile',
    content: (close) => {
      save.addEventListener('click', async () => {
        setBusy(save, true, 'Saving…');
        try {
          await authService.updateProfile({ name: name.querySelector('input').value, phone: phone.querySelector('input').value, company: company.querySelector('input').value });
          toast('Profile updated', 'success');
          close();
        } catch (e) {
          toast(e.message, 'error');
          save.disabled = false;
        }
      });
      return h('div', { class: 'stack' }, field('Name', name), field('Phone', phone), u.role === 'vendor' ? field('Company', company) : '', save);
    },
  });
}

const srow = (ic, tone, title, desc, right, onClick) => h('div', { class: 'srow', role: onClick ? 'button' : null, tabindex: onClick ? '0' : null, onclick: onClick, style: onClick ? { cursor: 'pointer' } : null }, h('div', { class: `sic bg-${tone}` }, icon(ic, { size: 19 })), h('div', { class: 'grow' }, h('div', { class: 'st' }, title), desc ? h('div', { class: 'sd' }, desc) : null), right || (onClick ? icon('chevron-right', { size: 18 }) : null));

export default function me({ navigate }) {
  const u = state.user;
  const m = ROLE_META[u.role] || ROLE_META.member;
  const prefs = getPrefs();

  const contact = [u.company, fmtPhone(u.phone), u.email].filter(Boolean).join(' · ');
  const head = h('section', { class: 'card pad-lg profile-head' }, avatar(u.name, 'lg'), h('h2', { style: { fontSize: '1.35rem' } }, u.name), h('div', { class: 'muted small' }, contact),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, chip(m.label, m.tone, m.icon), u.zone ? chip(u.zone, 'slate', 'map-pin') : null),
    btn('Edit profile', { kind: 'ghost', size: 'sm', iconName: 'user-cog', onClick: () => editSheet(u) }));

  const notices = [];
  if (u.requestedRole) notices.push(banner({ tone: 'sky', iconName: 'hourglass', title: `Your ${u.requestedRole} access is waiting for approval`, text: 'An admin will review it soon. Meanwhile you can explore community stats.' }));
  else if (u.role === 'member') {
    const apply = (role) => async () => {
      if (await confirmSheet({ title: `Apply for ${role} access?`, text: role === 'vendor' ? 'Vendors see open pickups near them and collect the waste. Your admin will review it.' : 'Supervisors raise pickup requests for their bins and confirm handovers. Your admin will review it.', confirmLabel: 'Send request', iconName: 'send' })) {
        authService.requestRole(role).then(() => toast('Request sent to your admin', 'success')).catch((e) => toast(e.message, 'error'));
      }
    };
    notices.push(h('section', { class: 'card stack-sm' }, h('h3', { style: { fontSize: '1rem' } }, 'Work with WasteWise'), h('p', { class: 'muted small' }, 'Collect waste as a vendor, or raise pickups for your area as a supervisor.'),
      h('div', { class: 'row' }, btn('I am a vendor', { kind: 'soft', block: true, iconName: 'truck', onClick: apply('vendor') }), btn('I am a supervisor', { kind: 'soft', block: true, iconName: 'clipboard-list', onClick: apply('supervisor') }))));
  }
  if (u.active === false) notices.push(banner({ tone: 'red', iconName: 'ban', title: 'Your account is deactivated', text: 'Contact your admin to get access again.' }));

  const themeSeg = h('div', { class: 'row', style: { gap: '6px' } }, ['light', 'dark', 'system'].map((t) => h('button', { type: 'button', class: `filter-chip ${prefs.theme === t ? 'on' : ''}`, style: { height: '34px' }, onclick: (e) => {
    setPrefs({ theme: t });
    setStatusBar(applyTheme());
    [...e.currentTarget.parentElement.children].forEach((c) => c.classList.toggle('on', c === e.currentTarget));
  } }, icon(t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'smartphone', { size: 15 }), t[0].toUpperCase() + t.slice(1))));

  const install = globalThis.__installPrompt && !isNative()
    ? srow('download', 'emerald', 'Install WasteWise', 'Add it to your home screen like a normal app', null, async () => {
        globalThis.__installPrompt.prompt();
        await globalThis.__installPrompt.userChoice.catch(() => {});
        globalThis.__installPrompt = null;
      })
    : !isNative() && /iphone|ipad/i.test(navigator.userAgent)
      ? srow('smartphone', 'emerald', 'Install on iPhone', 'Tap Share, then "Add to Home Screen"')
      : null;

  const settings = h('section', { class: 'card settings' },
    srow('sun', 'amber', 'Appearance', null, themeSeg),
    srow('smartphone', 'sky', 'Haptic feedback', 'Gentle vibration on taps and success', toggle(prefs.haptics !== false, (on) => setPrefs({ haptics: on }), 'Haptic feedback')),
    srow('bell', 'violet', 'Notifications', `${state.unread} unread`, null, () => navigate('/notifications')),
    u.role === 'admin' || u.role === 'supervisor' ? srow('file-text', 'emerald', 'Reports', 'PDF report and CSV export', null, () => navigate('/reports')) : null,
    u.role === 'admin' ? srow('activity', 'slate', 'Audit log', 'Every action, with time and person', null, () => navigate('/admin/logs')) : null,
    u.role !== 'member' ? srow('chart-pie', 'emerald', 'Community impact', 'Live recycling stats', null, () => navigate('/member')) : null,
    install,
    !isNative() ? h('a', { class: 'srow', href: APP.apkUrl, target: '_blank', rel: 'noopener', style: { color: 'inherit' } }, h('div', { class: 'sic bg-emerald' }, icon('smartphone', { size: 19 })), h('div', { class: 'grow' }, h('div', { class: 'st' }, 'Android app'), h('div', { class: 'sd' }, 'Download the APK and install it on your phone')), icon('download', { size: 18 })) : null);

  const modeCard = h('section', { class: 'card settings' },
    srow('shield-check', 'emerald', 'Live & secure', 'Your data syncs instantly across every phone and browser you sign in on'),
    srow('map-pinned', 'sky', 'Location', 'Used only when you pin a pickup or open the map', null, () => navigate('/map')));

  const about = h('section', { class: 'card', style: { textAlign: 'center' } },
    h('div', { style: { width: '64px', margin: '0 auto 6px' } }, logo({ size: 64 })),
    h('h3', { style: { fontSize: '1.1rem' } }, `${APP.name} v${APP.version}`),
    h('p', { class: 'small', style: { margin: '6px 0 2px', fontWeight: '700' } }, `Created by ${APP.author}`),
    h('p', { class: 'muted small', style: { margin: '0 0 4px' } }, `${APP.authorTitle} · ${APP.authorPlace}`),
    h('p', { class: 'muted small', style: { margin: '0 0 12px' } }, `© ${APP.year} ${APP.author}. All rights reserved. · ${isNative() ? `${platform()} app` : 'web app'}`),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, btn('Why I built WasteWise', { kind: 'soft', size: 'sm', iconName: 'info', onClick: () => navigate('/about') })));

  const out = btn('Sign out', { kind: 'danger', size: 'lg', block: true, iconName: 'log-out', cls: 'signout', onClick: async () => {
    if (!(await confirmSheet({ title: 'Sign out?', text: 'You can sign back in any time.', confirmLabel: 'Sign out', kind: 'danger', iconName: 'log-out' }))) return;
    setBusy(out, true, 'Signing out…');
    try {
      await authService.signOut();
      toast('Signed out', 'info', 1800);
    } catch (e) {
      out.disabled = false;
      out.replaceChildren(icon('log-out', { size: 18 }), h('span', 'Sign out'));
      toast(e.message || 'Could not sign out - try again', 'error');
    }
  } });

  return { title: 'Profile', el: pageRoot(head, ...notices, settings, modeCard, about, out) };
}
