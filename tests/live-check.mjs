// Smoke test of the deployed website (no sign-in, nothing is written):
// the app boots, Firebase loads under the production security headers, and the
// sign-in screen works. Usage: node tests/live-check.mjs https://wastewise-six-indol.vercel.app
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(process.env.PW_PATH || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const URL_ = process.argv[2] || 'https://wastewise-six-indol.vercel.app';
const OUT = new URL('../docs/live-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const problems = [];
const CI = !!process.env.GITHUB_ACTIONS;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (/Refused to|Content Security Policy/i.test(t)) problems.push(`security policy blocked something: ${t}`);
  else if (m.type() === 'error' && !/favicon/.test(t)) problems.push(`console error: ${t}`);
});
try {
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.onb, .auth-card, .boot-error', { timeout: 40000 });
  if (await page.locator('.boot-error').count()) {
    problems.push(`app did not start: ${(await page.locator('.boot-error').innerText()).replace(/\s+/g, ' ')}`);
  } else {
    if (await page.locator('.onb').count()) {
      await page.click('.onb .btn.ghost');
      await page.waitForSelector('.auth-card');
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}login-phone.png` });
    await page.click('.seg button:has-text("Email")');
    await page.waitForSelector('input[type=password]');
    await page.screenshot({ path: `${OUT}login-email.png` });
    const leaflet = await page.evaluate(async () => (await fetch('./js/vendor/leaflet/leaflet.js', { method: 'HEAD' })).status);
    if (leaflet !== 200) problems.push(`map library missing (${leaflet})`);
    const tile = await page.evaluate(() => new Promise((res) => {
      const img = new Image();
      img.onload = () => res('ok');
      img.onerror = () => res('blocked');
      img.src = 'https://tile.openstreetmap.org/15/23648/15289.png';
    }));
    if (tile !== 'ok') problems.push('map tiles could not load');
    console.log('Live site OK: sign-in screen, Firebase, map library and tiles load.');
  }
} catch (e) {
  problems.push(String(e.message || e));
  await page.screenshot({ path: `${OUT}failure.png` }).catch(() => {});
} finally {
  await browser.close();
}
if (problems.length) {
  console.error(`Live check found ${problems.length} problem(s):\n - ${problems.join('\n - ')}`);
  if (CI) problems.slice(0, 8).forEach((p) => console.log(`::error title=Live site::${p.replace(/\s+/g, ' ').slice(0, 800)}`));
  process.exit(1);
}
