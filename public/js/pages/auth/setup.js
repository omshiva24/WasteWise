// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// First sign-in: finish the profile (name, contact number, role request).
// The very first account becomes the Admin, who then approves supervisors and vendors.
import { h, icon } from '../../ui/dom.js';
import { btn, field, inputBox, setBusy, banner } from '../../ui/components.js';
import { authService } from '../../api/auth.service.js';
import { ROLE_META } from '../../core/constants.js';
import { state } from '../../ui/state.js';
import { haptic, confetti } from '../../ui/fx.js';
import { authHero, ownerFooter } from './login.js';
import { fmtPhone } from '../../core/format.js';

/** Member / Supervisor / Vendor picker (+ company name for vendors). */
export function roleChooser(initial = 'member') {
  let role = initial;
  const company = inputBox({ iconName: 'building', placeholder: 'Company / agency name', maxlength: 60 });
  const companyField = field('Company (vendors)', company);
  companyField.classList.toggle('hide', role !== 'vendor');
  const cards = ['member', 'supervisor', 'vendor'].map((r) =>
    h('button', { type: 'button', class: `role-card ${r === role ? 'picked' : ''}`, 'aria-pressed': String(r === role), dataset: { role: r }, onclick: (e) => {
      role = r;
      haptic();
      [...e.currentTarget.parentElement.children].forEach((c) => {
        c.classList.toggle('picked', c === e.currentTarget);
        c.setAttribute('aria-pressed', String(c === e.currentTarget));
      });
      companyField.classList.toggle('hide', r !== 'vendor');
    } }, h('span', { class: `ric bg-${ROLE_META[r].tone}` }, icon(ROLE_META[r].icon, { size: 20 })), h('span', { class: 'rn' }, ROLE_META[r].label), h('span', { class: 'rd' }, ROLE_META[r].blurb)));
  const el = h('div', { class: 'stack' },
    h('div', { class: 'field' }, h('label', 'I am joining as'), h('div', { class: 'role-grid three' }, cards), h('div', { class: 'hint' }, 'Supervisor and vendor access is approved by your admin. Until then you can use WasteWise as a member.')),
    companyField);
  return { el, value: () => role, company: () => company.querySelector('input').value };
}

export default function setup() {
  const u = state.user || {};
  const name = inputBox({ iconName: 'user', autocomplete: 'name', placeholder: 'Your full name', maxlength: 60, value: u.name || '' });
  const phone = inputBox({ iconName: 'phone', type: 'tel', autocomplete: 'tel', placeholder: 'Mobile number (optional)', maxlength: 20, value: fmtPhone(u.phone), disabled: !!u.phone });
  const roles = roleChooser();
  const notices = h('div', { class: 'stack-sm' });
  const errBox = h('div', { class: 'form-error hide', role: 'alert' });
  const submit = btn('Finish setup', { kind: 'primary', size: 'lg', block: true, type: 'submit', iconName: 'check' });
  let first = false;

  if (u.dbError) {
    notices.append(banner({ tone: 'red', iconName: 'shield-alert', title: "Can't reach the WasteWise database", text: `(${u.dbError}) If you own this app, publish the Firestore security rules - see SETUP_FIREBASE.md.` }));
  }
  authService.isFirstAccount().then((yes) => {
    first = yes;
    if (yes) {
      roles.el.classList.add('hide');
      notices.prepend(banner({ tone: 'violet', iconName: 'shield-check', title: "You're the first one here - you'll be the Admin", text: 'You approve supervisors and vendors, add bins and see every report.' }));
      submit.querySelector('span').textContent = 'Create admin account';
    }
  });

  const form = h('form', { class: 'stack', novalidate: true },
    notices,
    field('Name', name),
    field('Mobile number', phone, { hint: u.phone ? 'Verified by OTP' : 'Shared with the vendor or supervisor on your pickups so they can call you.' }),
    roles.el, errBox, submit,
    h('button', { type: 'button', class: 'link small', style: { justifySelf: 'center' }, onclick: () => authService.signOut() }, 'Use a different account'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hide');
    setBusy(submit, true, 'Setting up…');
    try {
      await authService.completeProfile({ name: name.querySelector('input').value, phone: phone.querySelector('input').value, requestedRole: first ? 'member' : roles.value(), company: roles.company() });
      haptic('success');
      confetti({ count: 90 });
    } catch (err) {
      errBox.replaceChildren(icon('triangle-alert', { size: 18 }), h('span', err.message));
      errBox.classList.remove('hide');
      submit.disabled = false;
      submit.replaceChildren(icon('check', { size: 18 }), h('span', first ? 'Create admin account' : 'Finish setup'));
    }
  });

  const signedInAs = fmtPhone(u.phone) || u.email || '';
  const el = h('div', { class: 'auth' },
    authHero('Welcome!', "Just a few details and you're in."),
    h('div', { class: 'auth-body' }, h('div', { class: 'auth-card' },
      h('h2', { style: { fontSize: '1.35rem' } }, 'Set up your profile'),
      signedInAs ? h('p', { class: 'muted small', style: { margin: '4px 0 16px' } }, 'Signed in as ', h('b', signedInAs)) : null,
      form), ownerFooter()));
  return { el, fullscreen: true };
}
