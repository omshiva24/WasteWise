// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Sign in with a mobile number (OTP), email + password, or Google.
import { h, icon, s } from '../../ui/dom.js';
import { logo } from '../../ui/art.js';
import { btn, field, inputBox, setBusy, segmented, toast, sheet } from '../../ui/components.js';
import { authService } from '../../api/auth.service.js';
import { haptic } from '../../ui/fx.js';
import { isNative, platform } from '../../ui/native.js';
import { APP } from '../../config.js';
import { fmtPhone } from '../../core/format.js';

/** Ownership line shown under every sign-in screen. */
export function ownerFooter() {
  return h('footer', { class: 'credit owner' },
    h('div', h('b', `© ${APP.year} ${APP.author}`), ' · All rights reserved'),
    h('div', `${APP.authorTitle}, ${APP.authorPlace}`),
    h('a', { href: '#/get' }, icon('download', { size: 14 }), 'Get the app - Android & iPhone'),
    h('a', { href: '#/about' }, icon('info', { size: 14 }), 'Why I built WasteWise · Copyright'));
}

export function authHero(title, text) {
  return h('div', { class: 'auth-hero' },
    h('span', { class: 'blob b1' }), h('span', { class: 'blob b2' }),
    h('div', { class: 'logo-row' }, logo({ size: 54, light: true }), h('h1', title)),
    h('p', text),
    h('div', { class: 'mode-pill' }, h('span', { class: 'live' }), 'Live · synced across every device'),
    h('div', { class: 'float-icons', 'aria-hidden': 'true' }, h('span', icon('recycle', { size: 20 })), h('span', icon('truck', { size: 20 })), h('span', icon('leaf', { size: 20 }))));
}

/** Which sign-in methods work where: Google's pop-up and reCAPTCHA need a real browser. */
export const canUsePhone = () => !(isNative() && platform() === 'ios');
// Google's pop-up can't hand the sign-in back to an iPhone Home Screen app, so it is hidden there.
const iosHomeScreenApp = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !!(navigator.standalone || globalThis.matchMedia?.('(display-mode: standalone)').matches);
export const canUseGoogle = () => !isNative() && !iosHomeScreenApp();

const GOOGLE_G = () => s('svg', { viewBox: '0 0 48 48', width: '20', height: '20', 'aria-hidden': 'true' },
  s('path', { fill: '#FFC107', d: 'M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z' }),
  s('path', { fill: '#FF3D00', d: 'M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z' }),
  s('path', { fill: '#4CAF50', d: 'M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z' }),
  s('path', { fill: '#1976D2', d: 'M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z' }));

export function googleBlock(onError) {
  if (!canUseGoogle()) return null;
  const g = h('button', { type: 'button', class: 'btn ghost lg block google-btn' }, GOOGLE_G(), h('span', 'Continue with Google'));
  g.addEventListener('click', async () => {
    setBusy(g, true, 'Opening Google…');
    try {
      await authService.google();
      haptic('success');
    } catch (e) {
      onError(e.message);
    } finally {
      g.disabled = false;
      g.replaceChildren(GOOGLE_G(), h('span', 'Continue with Google'));
    }
  });
  return h('div', {}, h('div', { class: 'divider' }, 'or'), g);
}

const COUNTRIES = [
  ['+91', 'IN'], ['+1', 'US'], ['+44', 'GB'], ['+971', 'AE'], ['+65', 'SG'], ['+61', 'AU'],
  ['+94', 'LK'], ['+977', 'NP'], ['+880', 'BD'], ['+966', 'SA'], ['+974', 'QA'], ['+60', 'MY'],
];
const flag = (cc) => String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0)));

function restore(b, iconName, label) {
  b.disabled = false;
  b.replaceChildren(icon(iconName, { size: 18 }), h('span', label));
}

function phonePanel(showError, clearError) {
  let confirmation = null;
  let timer = null;
  const cc = h('select', { class: 'select cc', 'aria-label': 'Country code' }, COUNTRIES.map(([c, n]) => h('option', { value: c }, `${flag(n)} ${c}`)));
  const num = h('input', { class: 'input', type: 'tel', inputmode: 'numeric', autocomplete: 'tel-national', placeholder: '98765 43210', maxlength: 14, 'aria-label': 'Mobile number' });
  const send = btn('Send OTP', { kind: 'primary', size: 'lg', block: true, type: 'submit', iconName: 'message-square-text' });
  const step1 = h('form', { class: 'stack', novalidate: true },
    field('Mobile number', h('div', { class: 'phone-row' }, cc, num), { hint: "We'll text you a 6-digit code. Standard SMS rates may apply." }),
    send,
    h('p', { class: 'recaptcha-note' }, 'Protected by reCAPTCHA - Google ', h('a', { href: 'https://policies.google.com/privacy', target: '_blank', rel: 'noopener' }, 'Privacy'), ' & ', h('a', { href: 'https://policies.google.com/terms', target: '_blank', rel: 'noopener' }, 'Terms'), ' apply.'));

  const otp = h('input', { class: 'input otp', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '••••••', 'aria-label': '6-digit code' });
  const sentTo = h('b');
  const verify = btn('Verify & continue', { kind: 'primary', size: 'lg', block: true, type: 'submit', iconName: 'shield-check' });
  const resend = h('button', { type: 'button', class: 'link small', disabled: true });
  const change = h('button', { type: 'button', class: 'link small' }, 'Change number');
  const step2 = h('form', { class: 'stack hide', novalidate: true },
    h('p', { class: 'muted small' }, 'Enter the code we sent to ', sentTo),
    otp,
    verify,
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, change, resend));

  const full = () => `${cc.value}${num.value.replace(/\D/g, '').replace(/^0+/, '')}`;
  const countdown = () => {
    let left = 30;
    clearInterval(timer);
    resend.disabled = true;
    resend.textContent = `Resend code in ${left}s`;
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        resend.disabled = false;
        resend.textContent = 'Resend code';
      } else resend.textContent = `Resend code in ${left}s`;
    }, 1000);
  };

  async function sendCode() {
    clearError();
    const digits = num.value.replace(/\D/g, '');
    if (digits.length < 6) {
      showError('Enter your mobile number');
      num.focus();
      return;
    }
    setBusy(send, true, 'Sending code…');
    try {
      confirmation = await authService.phoneStart(full());
      sentTo.textContent = fmtPhone(confirmation.phone);
      step1.classList.add('hide');
      step2.classList.remove('hide');
      step2.classList.add('fade-up');
      otp.value = '';
      setTimeout(() => otp.focus(), 50);
      countdown();
      toast('Code sent - check your SMS', 'success');
      haptic();
    } catch (e) {
      showError(e.message);
    } finally {
      restore(send, 'message-square-text', 'Send OTP');
    }
  }
  async function confirmCode() {
    clearError();
    if (!confirmation) return;
    setBusy(verify, true, 'Verifying…');
    try {
      await confirmation.confirm(otp.value);
      haptic('success');
    } catch (e) {
      showError(e.message);
      otp.select();
      restore(verify, 'shield-check', 'Verify & continue');
    }
  }
  step1.addEventListener('submit', (e) => (e.preventDefault(), sendCode()));
  step2.addEventListener('submit', (e) => (e.preventDefault(), confirmCode()));
  otp.addEventListener('input', () => {
    otp.value = otp.value.replace(/\D/g, '').slice(0, 6);
    if (otp.value.length === 6) confirmCode();
  });
  resend.addEventListener('click', () => sendCode());
  change.addEventListener('click', () => {
    clearInterval(timer);
    confirmation = null;
    step2.classList.add('hide');
    step1.classList.remove('hide');
    clearError();
    num.focus();
  });
  const el = h('div', { class: 'stack' }, step1, step2);
  el.destroy = () => clearInterval(timer);
  return el;
}

function forgotSheet(prefill) {
  const email = inputBox({ iconName: 'mail', type: 'email', autocomplete: 'email', placeholder: 'you@example.com', value: prefill || '' });
  const go = btn('Send reset link', { kind: 'primary', size: 'lg', block: true, iconName: 'mail' });
  sheet({
    title: 'Reset your password',
    subtitle: "We'll email you a link to choose a new password.",
    content: (close) => {
      go.addEventListener('click', async () => {
        setBusy(go, true, 'Sending…');
        try {
          await authService.resetPassword(email.querySelector('input').value);
          toast('If that email has an account, a reset link is on its way', 'success', 4200);
          close();
        } catch (e) {
          toast(e.message, 'error');
          restore(go, 'mail', 'Send reset link');
        }
      });
      return h('div', { class: 'stack' }, field('Email', email), go);
    },
  });
}

function emailPanel(showError, clearError) {
  const email = inputBox({ iconName: 'mail', type: 'email', autocomplete: 'email', placeholder: 'you@example.com', inputmode: 'email' });
  const pwInput = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Your password' });
  const eye = h('button', { type: 'button', class: 'icon-btn', style: { width: '38px', height: '38px' }, 'aria-label': 'Show password', onclick: () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    eye.replaceChildren(icon(show ? 'eye-off' : 'eye', { size: 18 }));
  } }, icon('eye', { size: 18 }));
  const pw = h('div', { class: 'input-wrap' }, icon('lock', { size: 20, cls: 'lead' }), pwInput, h('div', { class: 'trail' }, eye));
  const submit = btn('Sign in', { kind: 'primary', size: 'lg', block: true, type: 'submit', iconName: 'log-in' });
  const forgot = h('button', { type: 'button', class: 'link small', onclick: () => forgotSheet(email.querySelector('input').value) }, 'Forgot password?');
  const form = h('form', { class: 'stack', novalidate: true },
    field('Email', email),
    field('Password', pw),
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '-6px' } }, forgot),
    submit,
    h('p', { class: 'small', style: { textAlign: 'center' } }, 'New here? ', h('a', { href: '#/signup' }, 'Create an account with email')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const em = email.querySelector('input').value;
    if (!em || !pwInput.value) return showError('Enter your email and password');
    setBusy(submit, true, 'Signing in…');
    try {
      await authService.signIn(em, pwInput.value);
      haptic('success');
    } catch (err) {
      showError(err.message);
      restore(submit, 'log-in', 'Sign in');
    }
  });
  return form;
}

export default function login() {
  const errBox = h('div', { class: 'form-error hide', role: 'alert' });
  const showError = (msg) => {
    errBox.replaceChildren(icon('triangle-alert', { size: 18 }), h('span', msg));
    errBox.classList.remove('hide');
    errBox.style.animation = 'none';
    void errBox.offsetWidth;
    errBox.style.animation = '';
    haptic('error');
  };
  const clearError = () => errBox.classList.add('hide');

  const phone = canUsePhone() ? phonePanel(showError, clearError) : null;
  const email = emailPanel(showError, clearError);
  const host = h('div', { class: 'auth-panel' });
  const show = (m) => {
    clearError();
    host.replaceChildren(m === 'phone' && phone ? phone : email);
    host.firstChild.classList.add('fade-up');
    try {
      localStorage.setItem('wastewise.signin', m);
    } catch {
      /* ignore */
    }
  };
  let method = 'phone';
  try {
    method = localStorage.getItem('wastewise.signin') || 'phone';
  } catch {
    /* ignore */
  }
  if (!phone) method = 'email';
  const tabs = phone ? segmented([{ value: 'phone', label: 'Mobile OTP' }, { value: 'email', label: 'Email' }], method, show) : null;
  show(method);

  const el = h('div', { class: 'auth' },
    authHero('WasteWise', 'Smart waste pickups - raise, collect and track every kilo across your campus or city.'),
    h('div', { class: 'auth-body' },
      h('div', { class: 'auth-card' },
        h('h2', { style: { fontSize: '1.35rem' } }, 'Sign in or create an account'),
        h('p', { class: 'muted small', style: { margin: '4px 0 16px' } }, 'New numbers and Google accounts are set up automatically.'),
        tabs ? h('div', { style: { marginBottom: '14px' } }, tabs) : null,
        host,
        h('div', { style: { marginTop: '12px' } }, errBox),
        googleBlock(showError)),
      ownerFooter()));
  return { el, fullscreen: true, destroy: () => phone?.destroy?.() };
}
