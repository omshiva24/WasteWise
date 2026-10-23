// Profile & settings: edit details, theme, haptics, install app, data mode, about, sign out.
import { h, icon } from '../../ui/dom.js';
import { avatar, btn, chip, banner, field, inputBox, sheet, toggle, toast, confirmSheet, setBusy } from '../../ui/components.js';
import { authService } from '../../api/auth.service.js';
import { userService } from '../../api/user.service.js';
import { ROLE_META } from '../../core/constants.js';
import { state, getPrefs, setPrefs, applyTheme } from '../../ui/state.js';
import { setStatusBar, isNative, platform } from '../../ui/native.js';
import { logo } from '../../ui/art.js';
import { APP } from '../../config.js';
import { pageRoot } from '../common.js';

function editSheet(u) {
  const name = inputBox({ iconName: 'user', value: u.name, maxlength: 60 });
  const phone = inputBox({ iconName: 'phone', value: u.phone || '', type: 'tel', maxlength: 20, placeholder: 'Optional' });
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

  const head = h('section', { class: 'card pad-lg profile-head' }, avatar(u.name, 'lg'), h('h2', { style: { fontSize: '1.35rem' } }, u.name), h('div', { class: 'muted small' }, u.company ? `${u.company} · ${u.email}` : u.email),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, chip(m.label, m.tone, m.icon), u.zone ? chip(u.zone, 'slate', 'map-pin') : null),
    btn('Edit profile', { kind: 'ghost', size: 'sm', iconName: 'user-cog', onClick: () => editSheet(u) }));

  const notices = [];
  if (u.requestedRole) notices.push(banner({ tone: 'sky', iconName: 'hourglass', title: `Your ${u.requestedRole} access is waiting for approval`, text: 'An admin will review it soon. Meanwhile you can explore community stats.' }));
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
    install);

  const modeCard = state.mode === 'demo'
    ? h('section', { class: 'card settings' }, srow('wifi-off', 'amber', 'Demo mode', 'Sample data stored only on this device. Open another tab to act as a second role - it syncs live.'),
        srow('refresh-cw', 'red', 'Reset demo data', 'Restore the original sample requests', null, async () => {
          if (await confirmSheet({ title: 'Reset demo data?', text: 'All demo changes on this device will be replaced with fresh sample data.', confirmLabel: 'Reset', kind: 'danger', iconName: 'refresh-cw' })) {
            await userService.resetDemo();
            toast('Demo data reset', 'success');
          }
        }))
    : h('section', { class: 'card settings' }, srow('shield-check', 'emerald', 'Live mode', 'Connected to Firebase - data syncs across all devices'));

  const about = h('section', { class: 'card', style: { textAlign: 'center' } },
    h('div', { style: { width: '64px', margin: '0 auto 6px' } }, logo({ size: 64 })),
    h('h3', { style: { fontSize: '1.1rem' } }, `${APP.name} v${APP.version}`),
    h('p', { class: 'muted small', style: { margin: '4px 0 10px' } }, `Designed & built by ${APP.author} · ${isNative() ? `${platform()} app` : 'web app'}`),
    h('div', { class: 'row', style: { justifyContent: 'center' } }, h('a', { href: APP.repoUrl, target: '_blank', rel: 'noopener', class: 'btn ghost sm' }, icon('route', { size: 16 }), 'Source on GitHub')));

  const out = btn('Sign out', { kind: 'danger', size: 'lg', block: true, iconName: 'log-out', onClick: async () => {
    if (await confirmSheet({ title: 'Sign out?', text: 'You can sign back in any time.', confirmLabel: 'Sign out', kind: 'danger', iconName: 'log-out' })) authService.signOut();
  } });

  return { title: 'Profile', el: pageRoot(head, ...notices, settings, modeCard, about, out) };
}
