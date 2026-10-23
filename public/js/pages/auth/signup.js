// Create an account. Everyone starts as a member; supervisor / vendor access is approved by an admin.
import { h, icon } from '../../ui/dom.js';
import { btn, field, inputBox, setBusy } from '../../ui/components.js';
import { authService } from '../../api/auth.service.js';
import { ROLE_META } from '../../core/constants.js';
import { authHero } from './login.js';
import { haptic } from '../../ui/fx.js';

export default function signup() {
  let role = 'member';
  const name = inputBox({ iconName: 'user', autocomplete: 'name', placeholder: 'Full name', maxlength: 60 });
  const email = inputBox({ iconName: 'mail', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const pw = inputBox({ iconName: 'lock', type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters', minlength: 8 });
  const company = inputBox({ iconName: 'building', placeholder: 'Company / agency name', maxlength: 60 });
  const companyField = field('Company (vendors)', company);
  companyField.classList.add('hide');
  const errBox = h('div', { class: 'form-error hide', role: 'alert' });
  const submit = btn('Create account', { kind: 'primary', size: 'lg', block: true, type: 'submit', iconName: 'sparkles' });

  const roles = ['member', 'supervisor', 'vendor'].map((r) =>
    h('button', { type: 'button', class: `role-card ${r === role ? 'picked' : ''}`, 'aria-pressed': String(r === role), onclick: (e) => {
      role = r;
      haptic();
      [...e.currentTarget.parentElement.children].forEach((c) => {
        c.classList.toggle('picked', c === e.currentTarget);
        c.setAttribute('aria-pressed', String(c === e.currentTarget));
      });
      companyField.classList.toggle('hide', r !== 'vendor');
    } }, h('span', { class: `ric bg-${ROLE_META[r].tone}` }, icon(ROLE_META[r].icon, { size: 20 })), h('span', { class: 'rn' }, ROLE_META[r].label), h('span', { class: 'rd' }, ROLE_META[r].blurb)));

  const form = h('form', { class: 'stack', novalidate: true },
    field('Name', name), field('Email', email), field('Password', pw),
    h('div', { class: 'field' }, h('label', 'I am joining as'), h('div', { class: 'role-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } }, roles), h('div', { class: 'hint' }, 'Supervisor and vendor access is approved by an admin. Until then you can use WasteWise as a member.')),
    companyField, errBox, submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hide');
    setBusy(submit, true, 'Creating account…');
    try {
      await authService.signUp({ name: form.querySelector('[autocomplete=name]').value, email: form.querySelector('[type=email]').value, password: form.querySelector('[autocomplete=new-password]').value, requestedRole: role, company: company.querySelector('input').value });
      haptic('success');
    } catch (err) {
      errBox.replaceChildren(icon('triangle-alert', { size: 18 }), err.message);
      errBox.classList.remove('hide');
      submit.disabled = false;
      submit.replaceChildren(icon('sparkles', { size: 18 }), h('span', 'Create account'));
    }
  });

  const el = h('div', { class: 'auth' },
    authHero('Join WasteWise', 'One app for supervisors, vendors and the whole community to keep waste moving.'),
    h('div', { class: 'auth-body' }, h('div', { class: 'auth-card' }, h('h2', { style: { fontSize: '1.35rem', marginBottom: '14px' } }, 'Create your account'), form, h('p', { class: 'small', style: { textAlign: 'center', marginTop: '14px' } }, 'Already have an account? ', h('a', { href: '#/login' }, 'Sign in')))));
  return { el, fullscreen: true };
}
