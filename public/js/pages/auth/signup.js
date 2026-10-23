// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Create an account with email + password. (Phone and Google accounts are created on first sign-in.)
import { h, icon } from '../../ui/dom.js';
import { btn, field, inputBox, setBusy } from '../../ui/components.js';
import { authService } from '../../api/auth.service.js';
import { authHero, googleBlock, ownerFooter } from './login.js';
import { roleChooser } from './setup.js';
import { haptic } from '../../ui/fx.js';

export default function signup() {
  const name = inputBox({ iconName: 'user', autocomplete: 'name', placeholder: 'Full name', maxlength: 60 });
  const email = inputBox({ iconName: 'mail', type: 'email', autocomplete: 'email', placeholder: 'you@example.com', inputmode: 'email' });
  const pw = inputBox({ iconName: 'lock', type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters', minlength: 8 });
  const phone = inputBox({ iconName: 'phone', type: 'tel', autocomplete: 'tel', placeholder: 'Optional - so vendors / supervisors can call you', maxlength: 20 });
  const roles = roleChooser();
  const errBox = h('div', { class: 'form-error hide', role: 'alert' });
  const showError = (msg) => {
    errBox.replaceChildren(icon('triangle-alert', { size: 18 }), h('span', msg));
    errBox.classList.remove('hide');
    haptic('error');
  };
  const submit = btn('Create account', { kind: 'primary', size: 'lg', block: true, type: 'submit', iconName: 'sparkles' });

  const form = h('form', { class: 'stack', novalidate: true }, field('Name', name), field('Email', email), field('Password', pw), field('Mobile number', phone), roles.el, errBox, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hide');
    setBusy(submit, true, 'Creating account…');
    try {
      await authService.signUp({ name: name.querySelector('input').value, email: email.querySelector('input').value, password: pw.querySelector('input').value, phone: phone.querySelector('input').value, requestedRole: roles.value(), company: roles.company() });
      haptic('success');
    } catch (err) {
      showError(err.message);
      submit.disabled = false;
      submit.replaceChildren(icon('sparkles', { size: 18 }), h('span', 'Create account'));
    }
  });

  const el = h('div', { class: 'auth' },
    authHero('Join WasteWise', 'One app for supervisors, vendors and the whole community to keep waste moving.'),
    h('div', { class: 'auth-body' }, h('div', { class: 'auth-card' },
      h('h2', { style: { fontSize: '1.35rem', marginBottom: '14px' } }, 'Create your account'),
      form,
      googleBlock(showError),
      h('p', { class: 'small', style: { textAlign: 'center', marginTop: '14px' } }, 'Have an account, or prefer your mobile number? ', h('a', { href: '#/login' }, 'Sign in'))), ownerFooter()));
  return { el, fullscreen: true };
}
