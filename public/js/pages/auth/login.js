// Sign in + one-tap demo roles.
import { h, icon } from '../../ui/dom.js';
import { logo } from '../../ui/art.js';
import { btn, field, inputBox, setBusy, toast } from '../../ui/components.js';
import { authService } from '../../api/auth.service.js';
import { ROLE_META } from '../../core/constants.js';
import { state } from '../../ui/state.js';
import { haptic } from '../../ui/fx.js';
import { APP } from '../../config.js';

export function authHero(title, text) {
  return h('div', { class: 'auth-hero' },
    h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }),
    h('div', { class: 'logo-row' }, logo({ size: 54, light: true }), h('h1', title)),
    h('p', text),
    h('div', { class: 'mode-pill' }, h('span', { class: 'live' }), state.mode === 'firebase' ? 'Live - synced with the cloud' : 'Demo mode - try any role instantly'),
    h('div', { class: 'float-icons', 'aria-hidden': 'true' }, h('span', icon('recycle', { size: 20 })), h('span', icon('truck', { size: 20 })), h('span', icon('leaf', { size: 20 }))));
}

export default function login({ navigate }) {
  const email = inputBox({ iconName: 'mail', type: 'email', autocomplete: 'email', placeholder: 'you@example.com', inputmode: 'email' });
  const pwInput = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Your password' });
  const eye = h('button', { type: 'button', class: 'icon-btn', style: { width: '38px', height: '38px' }, 'aria-label': 'Show password', onclick: () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    eye.replaceChildren(icon(show ? 'eye-off' : 'eye', { size: 18 }));
  } }, icon('eye', { size: 18 }));
  const pw = h('div', { class: 'input-wrap' }, icon('lock', { size: 20, cls: 'lead' }), pwInput, h('div', { class: 'trail' }, eye));
  const errBox = h('div', { class: 'form-error hide', role: 'alert' });
  const submit = btn('Sign in', { kind: 'primary', size: 'lg', block: true, type: 'submit', iconName: 'arrow-right' });

  const form = h('form', { class: 'stack', novalidate: true }, field('Email', email), field('Password', pw), errBox, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hide');
    const em = form.querySelector('input[type=email]').value;
    if (!em || !pwInput.value) {
      errBox.replaceChildren(icon('triangle-alert', { size: 18 }), 'Enter your email and password');
      errBox.classList.remove('hide');
      return;
    }
    setBusy(submit, true, 'Signing in…');
    try {
      await authService.signIn(em, pwInput.value);
      haptic('success');
    } catch (err) {
      errBox.replaceChildren(icon('triangle-alert', { size: 18 }), err.message);
      errBox.classList.remove('hide');
      submit.disabled = false;
      submit.replaceChildren(icon('arrow-right', { size: 18 }), h('span', 'Sign in'));
    }
  });

  const demo = state.mode === 'demo'
    ? h('div', {},
        h('div', { class: 'divider' }, 'or explore instantly as'),
        h('div', { class: 'role-grid' }, Object.entries(ROLE_META).map(([role, m]) =>
          h('button', { type: 'button', class: 'role-card', 'data-role': role, 'aria-label': `Try the demo as ${m.label}`, onclick: async (e) => {
            const card = e.currentTarget;
            card.classList.add('picked');
            haptic();
            try {
              await authService.demoSignIn(role);
              toast(`Signed in as demo ${m.label.toLowerCase()}`, 'success');
            } catch (err) {
              card.classList.remove('picked');
              toast(err.message, 'error');
            }
          } },
          h('span', { class: `ric bg-${m.tone}` }, icon(m.icon, { size: 20 })), h('span', { class: 'rn' }, m.label), h('span', { class: 'rd' }, m.blurb), h('span', { class: 'go' }, icon('arrow-right', { size: 16 }))))),
        h('p', { class: 'hint', style: { marginTop: '10px', textAlign: 'center' } }, 'Demo data lives only on this device. Password for all demo accounts: demo1234'))
    : null;

  const el = h('div', { class: 'auth' },
    authHero('WasteWise', 'Smart waste pickups - raise, collect and track every kilo across your campus or city.'),
    h('div', { class: 'auth-body' },
      h('div', { class: 'auth-card' },
        h('h2', { style: { fontSize: '1.35rem' } }, 'Welcome back'),
        h('p', { class: 'muted small', style: { margin: '4px 0 16px' } }, 'Sign in to continue'),
        form,
        h('p', { class: 'small', style: { textAlign: 'center', marginTop: '14px' } }, 'New here? ', h('a', { href: '#/signup' }, 'Create an account')),
        demo),
      h('footer', { class: 'credit' }, `${APP.name} v${APP.version} · Built by ${APP.author}`)));
  return { el, fullscreen: true };
}
