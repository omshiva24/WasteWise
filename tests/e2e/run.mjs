// End-to-end test of the main flows in a real browser (Playwright + Chromium).
// Run: node tests/e2e/run.mjs   (set PW_PATH if playwright is installed elsewhere)
// Screenshots are written to docs/screenshots/.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(process.env.PW_PATH || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = new URL('../../docs/screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const server = spawn(process.execPath, ['scripts/dev-server.js', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const browser = await chromium.launch();
const errors = [];
let step = 0;
const log = (m) => console.log(`  ${++step}. ${m}`);

async function newPage(viewport = { width: 390, height: 844 }, theme = 'light') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme, acceptDownloads: true, hasTouch: viewport.width < 800 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND/.test(m.text()) && errors.push(`console: ${m.text()}`));
  return { ctx, page };
}
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png` });

async function demoLogin(page, role) {
  await page.goto(`${BASE}#/login`);
  await page.waitForSelector(`.role-card[data-role="${role}"]`);
  await settle(page, 400);
  await page.click(`.role-card[data-role="${role}"]`);
  await page.waitForSelector('.shell .view > *');
  await settle(page);
}
async function signOut(page) {
  await page.goto(`${BASE}#/me`);
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await page.locator('.sheet').getByRole('button', { name: 'Sign out' }).click();
  await page.waitForSelector('.auth');
}

try {
  const { page } = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.onb');
  await settle(page, 1200);
  await shot(page, '01-onboarding');
  for (let i = 0; i < 3; i++) await page.click('.onb .btn.primary');
  await page.waitForSelector('.auth');
  await settle(page);
  await shot(page, '02-login');
  log('onboarding -> login');

  // wrong password shows an error
  await page.fill('input[type=email]', 'admin@wastewise.app');
  await page.fill('input[type=password]', 'nope');
  await page.click('form button[type=submit]');
  await page.waitForSelector('.form-error:not(.hide)');
  log('wrong password rejected');

  // ---- supervisor raises a request
  await demoLogin(page, 'supervisor');
  assert.equal(await page.locator('.hero h2').first().innerText(), 'Bins full? Raise a pickup.');
  await settle(page, 1400);
  await shot(page, '03-supervisor-home');
  log('supervisor home');

  await page.click('.tab.fab');
  await page.waitForSelector('.type-grid');
  await page.click('.type-tile[data-id="organic"]');
  await page.selectOption('select[aria-label="Registered bins"]', 'BIN-H03');
  assert.equal(await page.inputValue('input[placeholder="Where is the bin?"]'), 'Hostel Mess');
  await page.click('.filter-chip:has-text("Urgent")');
  await page.fill('textarea', 'Mess bin overflowing after the festival dinner');
  await settle(page, 300);
  await shot(page, '04-raise-request');
  await page.click('form button[type=submit]');
  await page.waitForSelector('.success-overlay');
  await settle(page, 700);
  await shot(page, '05-success');
  await page.waitForSelector('.timeline');
  const code = (await page.locator('.topbar h1').innerText()).trim();
  assert.match(code, /^WR-\d+$/);
  await settle(page, 1200);
  await shot(page, '06-request-detail');
  log(`supervisor raised ${code}`);

  // ---- vendor accepts it
  await signOut(page);
  await demoLogin(page, 'vendor');
  const card = page.locator(`.rcard:has(.code:text-is("${code}"))`);
  await card.waitFor();
  await settle(page, 800);
  await shot(page, '07-vendor-feed');
  await card.locator('.swipe').scrollIntoViewIfNeeded();
  await settle(page, 300);
  const knob = card.locator('.swipe .knob');
  const box = await knob.boundingBox();
  const track = await card.locator('.swipe').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let x = 0; x <= track.width; x += 40) await page.mouse.move(box.x + box.width / 2 + x, box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForSelector('.toast:has-text("Accepted")');
  log(`vendor swiped to accept ${code}`);
  await page.click('.tab:has-text("My jobs")');
  await page.locator(`.rcard:has(.code:text-is("${code}"))`).waitFor();
  await settle(page, 1200);
  await shot(page, '08-vendor-jobs');

  // ---- supervisor confirms handover
  await signOut(page);
  await demoLogin(page, 'supervisor');
  await page.locator('.notif, .icon-btn[aria-label="Notifications"] .badge').first().waitFor();
  await page.locator(`.rcard:has(.code:text-is("${code}")) .btn:has-text("Confirm handover")`).click();
  await page.waitForSelector('.sheet .weight');
  await page.fill('.weight input', '86.5');
  await page.click('.sheet .stars button:nth-child(4)');
  await settle(page, 400);
  await shot(page, '09-handover');
  await page.click('.sheet .btn.primary:has-text("Confirm handover")');
  await page.waitForSelector('.toast:has-text("86.5 kg")');
  log('supervisor confirmed handover 86.5 kg');
  await page.goto(`${BASE}#/supervisor/requests`);
  await page.click('.seg button:has-text("Done")');
  await page.locator(`.rcard:has(.code:text-is("${code}"))`).waitFor();

  // ---- admin
  await signOut(page);
  await demoLogin(page, 'admin');
  await page.waitForSelector('.donut');
  await settle(page, 2000);
  await shot(page, '10-admin-dashboard');
  await page.screenshot({ path: `${SHOTS}10b-admin-dashboard-full.png`, fullPage: true });
  log('admin dashboard with charts');
  await page.click('.tab:has-text("Users")');
  await page.waitForSelector('text=Waiting for approval');
  await settle(page, 600);
  await shot(page, '11-admin-users');
  await page.click('.btn:has-text("Approve as Vendor")');
  await page.waitForSelector('.toast:has-text("approved")');
  log('admin approved a vendor request');
  await page.click('.tab:has-text("Bins")');
  await page.waitForSelector('.bin .qr svg');
  await settle(page, 800);
  await shot(page, '12-admin-bins');
  const [labels] = await Promise.all([page.waitForEvent('download'), page.click('.btn:has-text("QR stickers")')]);
  assert.match(labels.suggestedFilename(), /\.pdf$/);
  await page.goto(`${BASE}#/reports`);
  await page.waitForSelector('.kpi');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('.btn:has-text("Download PDF report")')]);
  await pdf.saveAs(`${SHOTS}../sample-report.pdf`);
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('.btn:has-text("Export CSV")')]);
  assert.match(csv.suggestedFilename(), /\.csv$/);
  log('PDF report, CSV export and QR label PDF downloaded');
  await page.goto(`${BASE}#/admin/logs`);
  await page.waitForSelector('.logi');
  await settle(page, 500);
  await shot(page, '13-audit-log');
  await page.goto(`${BASE}#/request/does-not-exist`);
  await page.waitForSelector('text=Request not found');

  // ---- member impact + RBAC guard
  await signOut(page);
  await demoLogin(page, 'member');
  await page.waitForSelector('.donut');
  await settle(page, 1800);
  await shot(page, '14-member-impact');
  await page.goto(`${BASE}#/admin/users`);
  await page.waitForFunction(() => location.hash === '#/member');
  log('member blocked from admin pages (redirected)');
  await page.goto(`${BASE}#/notifications`);
  await settle(page, 600);
  await shot(page, '15-notifications');
  await page.goto(`${BASE}#/me`);
  await settle(page, 600);
  await shot(page, '16-profile');

  // ---- dark mode + desktop layout
  const dark = await newPage({ width: 390, height: 844 }, 'dark');
  await demoLogin(dark.page, 'vendor');
  await settle(dark.page, 1200);
  await shot(dark.page, '17-dark-vendor');
  const desk = await newPage({ width: 1440, height: 900 });
  await demoLogin(desk.page, 'admin');
  await desk.page.waitForSelector('.donut');
  await settle(desk.page, 2200);
  await shot(desk.page, '18-desktop-admin');
  log('dark mode and desktop layout');

  // ---- native bridge (simulated Capacitor Android runtime)
  const nat = await newPage();
  await nat.ctx.addInitScript(() => {
    const calls = [];
    const cbs = {};
    let n = 0;
    window.__nativeCalls = calls;
    window.__nativeCallbacks = cbs;
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      nativePromise: (plugin, method, opts) => {
        calls.push(`${plugin}.${method}`);
        if (plugin === 'Camera') return Promise.resolve({ dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC' });
        return Promise.resolve({});
      },
      nativeCallback: (plugin, method, opts, cb) => {
        calls.push(`${plugin}.${method}:${opts.eventName}`);
        cbs[`${plugin}.${opts.eventName}`] = cb;
        return `cb${++n}`;
      },
    };
  });
  await demoLogin(nat.page, 'supervisor');
  const calls = await nat.page.evaluate(() => window.__nativeCalls);
  for (const c of ['SplashScreen.hide', 'StatusBar.setStyle', 'App.addListener:backButton']) assert.ok(calls.includes(c), `native call ${c}`);
  await nat.page.click('.tab.fab');
  await nat.page.waitForSelector('.photo-drop');
  await nat.page.click('.photo-drop');
  await nat.page.waitForSelector('.photo-drop img');
  assert.ok((await nat.page.evaluate(() => window.__nativeCalls)).includes('Camera.getPhoto'));
  await nat.page.evaluate(() => window.__nativeCallbacks['App.backButton']({ canGoBack: true }));
  await nat.page.waitForFunction(() => location.hash === '#/supervisor');
  log('native bridge: splash, status bar, camera and back button');
} catch (e) {
  console.error('E2E FAILED:', e);
  errors.push(String(e.message || e));
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n - ${[...new Set(errors)].join('\n - ')}`);
  process.exit(1);
}
console.log(`\nE2E passed (${step} checks). Screenshots in docs/screenshots/`);
