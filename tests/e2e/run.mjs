// End-to-end test of WasteWise in a real browser (Playwright + Chromium).
//
//   node tests/e2e/run.mjs                         -> uses a local stand-in for Firebase
//   E2E_BACKEND=emulator firebase emulators:exec --only auth,firestore "node tests/e2e/run.mjs"
//                                                  -> real Firebase Auth + Firestore emulators
//                                                     (also checks firestore.rules)
// Screenshots are written to docs/screenshots/.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import assert from 'node:assert/strict';

const require = createRequire(process.env.PW_PATH || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const MODE = process.env.E2E_BACKEND || 'fake';
const PROJECT = 'demo-wastewise';
const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = new URL('../../docs/screenshots/', import.meta.url).pathname;
const CI = !!process.env.GITHUB_ACTIONS;
const REAL_TILES = CI && MODE === 'emulator';
mkdirSync(SHOTS, { recursive: true });

const TEST = {
  config: { apiKey: 'demo-api-key', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: '1:1:web:1' },
  emulator: MODE === 'emulator' ? { auth: 'http://127.0.0.1:9099', firestore: ['127.0.0.1', 8080] } : null,
};
const FAKE = readFileSync(new URL('./fake-firebase.js', import.meta.url), 'utf8');

// A plain map tile for offline runs (real tiles are used on CI).
function png(w, h, px) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, (x, y) => (x % 64 < 3 || y % 64 < 3 ? [214, 226, 218] : (x + y) % 256 < 10 ? [255, 255, 255] : [236, 243, 238]));

const env = { ...process.env, ...(MODE === 'emulator' ? { WW_EMULATOR: '1' } : {}) };
const server = spawn(process.execPath, ['scripts/dev-server.js', String(PORT)], { stdio: 'ignore', env });
await new Promise((r) => setTimeout(r, 700));

const browser = await chromium.launch();
const errors = [];
let step = 0;
const log = (m) => (console.log(`  ${++step}. ${m}`), CI && console.log(`::notice title=E2E step ${step}::${m}`));
const HOME = { lat: 12.0236, lng: 79.8566 };

async function newPage({ viewport = { width: 390, height: 844 }, theme = 'light', geo = HOME } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme, acceptDownloads: true, hasTouch: viewport.width < 800, geolocation: { latitude: geo.lat, longitude: geo.lng, accuracy: 12 }, permissions: ['geolocation'] });
  await ctx.addInitScript((t) => (window.__WW_TEST__ = t), TEST);
  if (MODE === 'fake') {
    await ctx.route('https://www.gstatic.com/firebasejs/**', (route) => {
      const body = route.request().url().endsWith('/fake-core.js') ? FAKE : "export * from './fake-core.js';";
      route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body });
    });
  }
  if (!REAL_TILES) await ctx.route(/basemaps\.cartocdn\.com/, (route) => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: TILE }));
  await ctx.route(/nominatim\.openstreetmap\.org/, (route) => {
    const u = new URL(route.request().url());
    const place = { name: 'Central Library', display_name: 'Central Library, Library Road, Kalapet, Puducherry, India', address: { road: 'Library Road', suburb: 'Kalapet', city: 'Puducherry' } };
    const body = u.pathname.startsWith('/reverse') ? place : [{ ...place, lat: String(HOME.lat + 0.002), lon: String(HOME.lng - 0.001) }];
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL|ERR_CONNECTION/.test(m.text()) && errors.push(`console: ${m.text()}`));
  return { ctx, page };
}
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png` });

async function otpFor(phone) {
  if (MODE !== 'emulator') return '123456';
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/verificationCodes`);
    const { verificationCodes = [] } = await res.json();
    const hit = verificationCodes.filter((c) => c.phoneNumber === phone).pop();
    if (hit) return hit.code;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no OTP for ${phone}`);
}

async function phoneSignIn(page, digits, { wrongFirst = false } = {}) {
  await page.goto(`${BASE}#/login`);
  await page.waitForSelector('.auth-card');
  const tab = page.locator('.seg button:has-text("Mobile OTP")');
  if (await tab.count()) await tab.click();
  await page.fill('input[aria-label="Mobile number"]', digits);
  await page.click('button:has-text("Send OTP")');
  await page.waitForSelector('input.otp:visible');
  const code = await otpFor(`+91${digits}`);
  if (wrongFirst) {
    await page.fill('input.otp', code === '000000' ? '111111' : '000000');
    await page.waitForSelector('.form-error:not(.hide)');
  }
  await page.fill('input.otp', code);
  await page.waitForSelector('.shell .view > *, .auth-card h2:has-text("Set up your profile")');
  await settle(page, 600);
}
async function emailSignIn(page, email, password) {
  await page.goto(`${BASE}#/login`);
  await page.waitForSelector('.auth-card');
  await page.click('.seg button:has-text("Email")');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('form button[type=submit]:has-text("Sign in")');
  await page.waitForSelector('.shell .view > *');
  await settle(page, 600);
}
async function finishSetup(page, { name, role, company }) {
  await page.waitForSelector('.auth-card h2:has-text("Set up your profile")');
  await page.fill('input[autocomplete=name]', name);
  if (role) await page.click(`.role-card[data-role="${role}"]`);
  if (company) await page.fill('input[placeholder="Company / agency name"]', company);
  await page.click('form button[type=submit]');
  await page.waitForSelector('.shell .view > *');
  await settle(page, 800);
}
async function signOut(page) {
  await page.goto(`${BASE}#/me`);
  await page.locator('.view button.signout').click();
  await page.locator('.sheet').getByRole('button', { name: 'Sign out' }).click();
  await page.waitForSelector('.auth-card');
  assert.equal(await page.evaluate(() => location.hash), '#/login');
}

try {
  // One browser context for the whole story (the offline stand-in keeps its data per context).
  const { ctx, page } = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.onb');
  await settle(page, 1200);
  await shot(page, '01-onboarding');
  for (let i = 0; i < 3; i++) await page.click('.onb .btn.primary');
  await page.waitForSelector('.auth-card');
  await settle(page);
  await shot(page, '02-login-phone');
  log(`onboarding -> sign-in screen (${MODE} backend)`);

  // ---- the first account becomes the admin (phone OTP)
  await phoneSignIn(page, '9000000001', { wrongFirst: true });
  log('wrong OTP rejected, right OTP accepted');
  await page.waitForSelector('text=you\'ll be the Admin');
  await settle(page, 500);
  await shot(page, '03-first-admin-setup');
  await finishSetup(page, { name: 'Asha Admin' });
  await page.waitForSelector('.getting-started');
  await settle(page, 1500);
  await shot(page, '04-admin-getting-started');
  log('first account became the admin');

  // admin adds a bin with a GPS map pin
  await page.goto(`${BASE}#/admin/bins`);
  await page.click('.btn:has-text("Add bin")');
  await page.fill('input[placeholder="BIN-A05"]', 'BIN-L01');
  await page.click('.sheet .btn:has-text("Use my location")');
  await page.waitForSelector('.sheet .geo-info');
  assert.equal(await page.inputValue('input[placeholder="e.g. Library Block - Entrance"]'), 'Central Library, Library Road, Kalapet');
  await settle(page, 300);
  await shot(page, '05-add-bin-gps');
  await page.click('.sheet .btn.primary:has-text("Add bin")');
  await page.waitForSelector('.bin .bid:text-is("BIN-L01")');
  await page.waitForSelector('.bin-geo.on');
  log('admin added a bin pinned with GPS');
  await signOut(page);
  log('sign out works');

  // ---- supervisor signs up with email, vendor and member with phone
  await page.goto(`${BASE}#/signup`);
  await page.fill('input[autocomplete=name]', 'Sam Supervisor');
  await page.fill('input[type=email]', 'sam@wastewise.test');
  await page.fill('input[autocomplete=new-password]', 'supervisor123');
  await page.fill('input[autocomplete=tel]', '+91 90000 00009');
  await page.click('.role-card[data-role="supervisor"]');
  await settle(page, 300);
  await shot(page, '06-signup-email');
  await page.click('form button[type=submit]');
  await page.waitForSelector('text=waiting for approval');
  log('supervisor signed up with email (pending approval)');
  await signOut(page);

  await phoneSignIn(page, '9000000002');
  await page.click('.role-card[data-role="vendor"]');
  await finishSetup(page, { name: 'Vikram Vendor', role: 'vendor', company: 'GreenCycle Recyclers' });
  log('vendor signed up with phone OTP (pending approval)');
  await signOut(page);

  // ---- admin approves both
  await phoneSignIn(page, '9000000001');
  await page.goto(`${BASE}#/admin/users`);
  await page.waitForSelector('text=Waiting for approval');
  await settle(page, 600);
  await shot(page, '07-admin-approvals');
  await page.click('.btn:has-text("Approve as Supervisor")');
  await page.waitForSelector('.toast:has-text("approved")');
  await page.click('.btn:has-text("Approve as Vendor")');
  await page.waitForFunction(() => !document.body.innerText.includes('Waiting for approval'));
  log('admin approved the supervisor and the vendor');
  await signOut(page);

  // ---- supervisor raises a pickup with GPS location
  await emailSignIn(page, 'sam@wastewise.test', 'supervisor123');
  await page.waitForSelector('.notif, .icon-btn[aria-label="Notifications"] .badge');
  await page.click('.tab.fab');
  await page.waitForSelector('.type-grid');
  await page.click('.type-tile[data-id="paper"]');
  await page.click('.gps-btn');
  await page.waitForSelector('.loc-preview .mini-map .ww-pin');
  await page.waitForFunction(() => document.querySelector('input[placeholder="e.g. Hostel Mess back gate"]')?.value.includes('Library'));
  await page.selectOption('select[aria-label="Registered bins"]', 'BIN-L01');
  await page.click('.filter-chip:has-text("Urgent")');
  await page.fill('textarea', 'Old exam papers and boxes near the back gate');
  await page.evaluate(() => document.querySelector('.loc-btns').scrollIntoView({ block: 'start' }));
  await page.evaluate(() => scrollBy(0, -90));
  await settle(page, 700);
  await shot(page, '08-raise-with-gps');
  await page.click('form button[type=submit]');
  await page.waitForSelector('.success-overlay');
  await settle(page, 700);
  await page.waitForSelector('.timeline');
  const code = (await page.locator('.topbar h1').innerText()).trim();
  assert.match(code, /^WR-\d+$/);
  await page.waitForSelector('.mini-map .ww-pin');
  await settle(page, 1200);
  await shot(page, '09-request-detail-map');
  log(`supervisor raised ${code} with a GPS map pin`);
  await signOut(page);

  // ---- vendor sees it nearby, checks the map, accepts
  await ctx.setGeolocation({ latitude: HOME.lat + 0.004, longitude: HOME.lng + 0.003, accuracy: 15 });
  const ven = { page };
  await phoneSignIn(ven.page, '9000000002');
  const card = ven.page.locator(`.rcard:has(.code:text-is("${code}"))`);
  await card.waitFor();
  await ven.page.waitForSelector('.rcard .dist');
  await settle(ven.page, 900);
  await shot(ven.page, '10-vendor-nearest');
  log(`vendor sees ${code} with its distance`);
  await ven.page.click('.tab:has-text("Map")');
  await ven.page.waitForSelector('.map-full .ww-pin');
  await ven.page.waitForSelector('.ww-me-dot');
  await settle(ven.page, REAL_TILES ? 2500 : 900);
  await shot(ven.page, '11-vendor-live-map');
  await ven.page.locator('.map-full .ww-pin').first().click();
  await ven.page.waitForSelector('.ww-popup .pop');
  await settle(ven.page, 400);
  await shot(ven.page, '12-map-popup');
  log('live map shows the pickup, the bin and the vendor');
  await ven.page.click('.tab:has-text("Pickups")');
  await card.waitFor();
  await card.locator('.swipe').scrollIntoViewIfNeeded();
  await settle(ven.page, 300);
  const knob = card.locator('.swipe .knob');
  const box = await knob.boundingBox();
  const track = await card.locator('.swipe').boundingBox();
  await ven.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await ven.page.mouse.down();
  for (let x = 0; x <= track.width; x += 40) await ven.page.mouse.move(box.x + box.width / 2 + x, box.y + box.height / 2);
  await ven.page.mouse.up();
  await ven.page.waitForSelector('.toast:has-text("Accepted")');
  await ven.page.click('.tab:has-text("My jobs")');
  await ven.page.locator(`.rcard:has(.code:text-is("${code}"))`).click();
  await ven.page.waitForSelector('a.btn:has-text("Directions")');
  await ven.page.waitForSelector('a.btn:has-text("Call")');
  await settle(ven.page, 900);
  await shot(ven.page, '13-vendor-job-directions');
  log(`vendor accepted ${code}; directions and call buttons shown`);
  await signOut(ven.page);
  await ctx.setGeolocation({ latitude: HOME.lat, longitude: HOME.lng, accuracy: 12 });

  // ---- supervisor gets the notification and confirms the handover
  await emailSignIn(page, 'sam@wastewise.test', 'supervisor123');
  await page.locator('.icon-btn[aria-label="Notifications"] .badge:not(.hide)').waitFor();
  await page.locator(`.rcard:has(.code:text-is("${code}")) .btn:has-text("Confirm handover")`).click();
  await page.waitForSelector('.sheet .weight');
  await page.fill('.weight input', '86.5');
  await page.click('.sheet .stars button:nth-child(5)');
  await settle(page, 300);
  await shot(page, '14-handover');
  await page.click('.sheet .btn.primary:has-text("Confirm handover")');
  await page.waitForSelector('.toast:has-text("86.5 kg")');
  log('supervisor was notified and confirmed 86.5 kg');
  await signOut(page);

  // ---- member: community stats + RBAC
  await phoneSignIn(page, '9000000003');
  await finishSetup(page, { name: 'Meera Member', role: 'member' });
  await page.waitForSelector('.donut');
  await settle(page, 1500);
  await shot(page, '15-member-impact');
  await page.goto(`${BASE}#/admin/users`);
  await page.waitForFunction(() => location.hash === '#/member');
  log('member sees community stats and is blocked from admin pages');
  await signOut(page);

  // ---- admin dashboard, reports, logs (desktop + dark)
  await page.setViewportSize({ width: 1440, height: 900 });
  const desk = { page };
  await phoneSignIn(desk.page, '9000000001');
  await desk.page.waitForSelector('.donut');
  await settle(desk.page, 2000);
  await shot(desk.page, '16-desktop-admin');
  await desk.page.goto(`${BASE}#/reports`);
  await desk.page.waitForSelector('.kpi');
  const [pdf] = await Promise.all([desk.page.waitForEvent('download'), desk.page.click('.btn:has-text("Download PDF report")')]);
  assert.match(pdf.suggestedFilename(), /\.pdf$/);
  await desk.page.goto(`${BASE}#/admin/logs`);
  await desk.page.waitForSelector('.logi');
  await desk.page.goto(`${BASE}#/map`);
  await desk.page.waitForSelector('.map-full .ww-pin');
  await settle(desk.page, REAL_TILES ? 2500 : 900);
  await shot(desk.page, '17-desktop-map');
  log('admin dashboard, PDF report, audit log and map on desktop');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${BASE}#/vendor`);
  await page.goto(`${BASE}#/admin`);
  await page.waitForSelector('.donut');
  await settle(page, 1500);
  await shot(page, '18-dark-admin');
  await signOut(page);
  await settle(page, 600);
  await shot(page, '19-dark-login');
  log('dark mode');
} catch (e) {
  console.error('E2E FAILED:', e);
  errors.push(String(e.message || e));
  try {
    const pages = browser.contexts().flatMap((c) => c.pages());
    for (const [i, p] of pages.entries()) await p.screenshot({ path: `${SHOTS}zz-failure-${i}.png` });
  } catch {
    /* ignore */
  }
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n - ${[...new Set(errors)].join('\n - ')}`);
  if (CI) [...new Set(errors)].slice(0, 8).forEach((e) => console.log(`::error title=E2E after step ${step}::${String(e).replace(/\s+/g, ' ').slice(0, 900)}`));
  process.exit(1);
}
console.log(`\nE2E passed (${step} checks, ${MODE} backend). Screenshots in docs/screenshots/`);
