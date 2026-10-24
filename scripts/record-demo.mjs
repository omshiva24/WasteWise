// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Records the app in action (for the YouTube demo video): one MP4 clip per scene, captured
// frame-by-frame from Chromium at phone resolution, with visible taps. Uses sample data and an
// offline stand-in for Firebase, so nothing touches the real database.
//   node scripts/record-demo.mjs        (needs Playwright + ffmpeg; real map tiles need internet)
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const require = createRequire(process.env.PW_PATH || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = new URL('../', import.meta.url).pathname;
const OUT = `${ROOT}demo-video/`;
const PORT = 5203;
const BASE = `http://localhost:${PORT}/`;
const HOME = { lat: 12.0236, lng: 79.8566 };
const FAKE = readFileSync(`${ROOT}tests/e2e/fake-firebase.js`, 'utf8');
const OFFLINE = !!process.env.OFFLINE_TILES;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- sample data
const DAY = 86_400_000;
function sampleData(now) {
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const near = (k = 0.006) => ({ lat: +(HOME.lat + (rnd() - 0.5) * k).toFixed(6), lng: +(HOME.lng + (rnd() - 0.5) * k).toFixed(6), acc: 8 + Math.round(rnd() * 10) });
  const users = {
    'u-admin': { name: 'Asha Raman', role: 'admin', phone: '+919876500001', email: '', company: '', active: true, requestedRole: null, createdAt: now - 150 * DAY },
    'u-sup': { name: 'Karthik Selvam', role: 'supervisor', phone: '+919876543210', email: '', company: '', active: true, requestedRole: null, createdAt: now - 140 * DAY },
    'u-sup2': { name: 'Divya Iyer', role: 'supervisor', phone: '+919876500004', email: '', company: '', active: true, requestedRole: null, createdAt: now - 120 * DAY },
    'u-ven': { name: 'Ravi Kumar', role: 'vendor', phone: '+919876500003', email: '', company: 'GreenCycle Recyclers', active: true, requestedRole: null, createdAt: now - 130 * DAY },
    'u-ven2': { name: 'Salim Basha', role: 'vendor', phone: '+919876500005', email: '', company: 'EcoHaul Puducherry', active: true, requestedRole: null, createdAt: now - 100 * DAY },
    'u-mem': { name: 'Meena Raj', role: 'member', phone: '+919876500006', email: '', company: '', active: true, requestedRole: 'vendor', createdAt: now - 1 * DAY },
    'u-mem2': { name: 'Arun Prakash', role: 'member', phone: '+919876500007', email: '', company: 'CleanCity Services', active: true, requestedRole: 'vendor', createdAt: now - 2 * DAY },
  };
  const places = [['BIN-L01', 'Library Block - Entrance', 'North campus', 'paper'], ['BIN-H03', 'Hostel Mess - Back Gate', 'Hostel zone', 'organic'], ['BIN-S02', 'Science Block', 'Academic zone', 'plastic'],
    ['BIN-G01', 'Main Gate', 'North campus', 'mixed'], ['BIN-C04', 'Canteen', 'Hostel zone', 'organic'], ['BIN-A01', 'Admin Building', 'Academic zone', 'paper'],
    ['BIN-P02', 'Sports Complex', 'South campus', 'plastic'], ['BIN-E01', 'Computer Centre', 'Academic zone', 'ewaste']];
  const bins = {};
  for (const [id, location, zone, wasteType] of places) bins[id] = { location, zone, wasteType, capacityL: 240, geo: near(0.008), updatedAt: now - 90 * DAY };
  const requests = {};
  const vendors = [['u-ven', 'GreenCycle Recyclers', '+919876500003'], ['u-ven2', 'EcoHaul Puducherry', '+919876500005']];
  const sups = [['u-sup', 'Karthik Selvam', '+919876543210'], ['u-sup2', 'Divya Iyer', '+919876500004']];
  let code = 1001;
  const add = (status, created) => {
    const [bid, b] = pick(Object.entries(bins));
    const [sid, sname, sphone] = pick(sups);
    const [vid, vname, vphone] = pick(vendors);
    const accepted = status === 'OPEN' ? null : created + Math.round((2 + rnd() * 20) * 3_600_000);
    const completed = status === 'COMPLETED' ? accepted + Math.round((1 + rnd() * 30) * 3_600_000) : null;
    const id = `r${code}`;
    const history = [{ status: 'OPEN', at: created, by: sid, byName: sname, note: 'Request raised' }];
    if (accepted) history.push({ status: 'ACCEPTED', at: accepted, by: vid, byName: vname, note: 'Pickup accepted' });
    const weightKg = completed ? Math.round(25 + rnd() * 160) : null;
    if (completed) history.push({ status: 'COMPLETED', at: completed, by: sid, byName: sname, note: `Handed over ${weightKg} kg` });
    requests[id] = {
      code: `WR-${code++}`, wasteType: rnd() < 0.7 ? b.wasteType : pick(['plastic', 'organic', 'paper', 'glass', 'metal', 'mixed']), binId: bid, location: b.location, zone: b.zone,
      notes: '', priority: rnd() < 0.2 ? 'urgent' : 'normal', estKg: null, geo: b.geo, hasPhoto: false,
      status, createdBy: sid, createdByName: sname, createdByPhone: sphone, createdAt: created, updatedAt: completed || accepted || created,
      acceptedAt: accepted, vendorId: accepted ? vid : null, vendorName: accepted ? vname : null, vendorPhone: accepted ? vphone : null,
      completedAt: completed, weightKg, rating: completed ? 3 + Math.floor(rnd() * 3) : null, overdue: false, history,
    };
  };
  for (let i = 0; i < 46; i++) add('COMPLETED', now - Math.round((2 + rnd() * 150) * DAY));
  for (let i = 0; i < 2; i++) add('ACCEPTED', now - Math.round((0.3 + rnd()) * DAY));
  for (let i = 0; i < 2; i++) add('OPEN', now - Math.round((8 + rnd() * 3) * DAY)); // overdue
  for (let i = 0; i < 2; i++) add('OPEN', now - Math.round((1 + rnd() * 10) * 3_600_000));
  const db = { users, bins, requests, notifications: {}, logs: {}, photos: {}, meta: { setup: { adminUid: 'u-admin', at: now - 150 * DAY }, counters: { requests: code } } };
  const auth = { users: Object.fromEntries(Object.entries(users).map(([uid, u]) => [uid, { uid, phone: u.phone, displayName: u.name }])), session: null };
  return { db, auth };
}

// ---------------------------------------------------------------- browser
const server = spawn(process.execPath, ['scripts/dev-server.js', String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  geolocation: { latitude: HOME.lat, longitude: HOME.lng, accuracy: 9 }, permissions: ['geolocation'], locale: 'en-IN', timezoneId: 'Asia/Kolkata',
});
const { db, auth } = sampleData(Date.now());
await ctx.addInitScript((s) => {
  window.__WW_TEST__ = { config: { apiKey: 'demo', authDomain: 'demo', projectId: 'demo-wastewise', appId: 'demo' } };
  try {
    if (!localStorage.getItem('fakefs.db')) {
      localStorage.setItem('fakefs.db', s.db);
      localStorage.setItem('fakefs.auth', s.auth);
    }
    localStorage.setItem('wastewise.onboarded', '1');
  } catch { /* ignore */ }
  // visible finger taps for the video
  addEventListener('pointerdown', (e) => {
    const dot = document.createElement('div');
    Object.assign(dot.style, { position: 'fixed', left: `${e.clientX - 24}px`, top: `${e.clientY - 24}px`, width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', border: '3px solid rgba(5,150,105,0.95)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', zIndex: 2147483647, pointerEvents: 'none', transform: 'scale(0.7)', transition: 'transform 0.5s ease-out, opacity 0.5s ease-out' });
    document.documentElement.appendChild(dot);
    const move = (ev) => Object.assign(dot.style, { left: `${ev.clientX - 24}px`, top: `${ev.clientY - 24}px` });
    addEventListener('pointermove', move, true);
    addEventListener('pointerup', () => {
      removeEventListener('pointermove', move, true);
      dot.style.transform = 'scale(1.5)';
      dot.style.opacity = '0';
      setTimeout(() => dot.remove(), 520);
    }, { once: true, capture: true });
  }, true);
}, { db: JSON.stringify(db), auth: JSON.stringify(auth) });
await ctx.route('https://www.gstatic.com/firebasejs/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: route.request().url().endsWith('/fake-core.js') ? FAKE : "export * from './fake-core.js';" }));
if (OFFLINE) await ctx.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN89+5dPQAJ5gO3wZ6chQAAAABJRU5ErkJggg==', 'base64') }));
// Real street addresses on CI; a fixed one when running offline.
if (OFFLINE) await ctx.route(/nominatim\.openstreetmap\.org/, (route) => {
  const reverse = new URL(route.request().url()).pathname.startsWith('/reverse');
  const place = { name: '', display_name: 'Kalapet, Puducherry', address: { suburb: 'Kalapet', city: 'Puducherry' } };
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(reverse ? place : [{ ...place, lat: String(HOME.lat), lon: String(HOME.lng) }]) });
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.warn('pageerror', e.message));
const wait = (ms) => page.waitForTimeout(ms);
const smooth = async (dy, ms = 1100) => {
  await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), dy);
  await wait(ms);
};
const top = async () => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(700);
};
const signInAs = async (uid, path) => {
  await page.evaluate((id) => {
    const a = JSON.parse(localStorage.getItem('fakefs.auth'));
    a.session = id;
    localStorage.setItem('fakefs.auth', JSON.stringify(a));
  }, uid);
  await page.goto(`${BASE}#${path}`);
  await page.reload();
  await page.waitForSelector('.shell .view > *');
  await wait(1500);
};
const manifest = [];

/** Captures every frame Chromium paints while `fn` runs and saves it as an MP4 clip. */
async function record(name, fn) {
  const dir = `${OUT}${name}/`;
  mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = `${dir}${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp || Date.now() / 1000 });
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId });
    } catch {
      /* page closed */
    }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 93, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  await wait(300);
  const info = (await fn()) || {};
  await wait(500);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  const tEnd = Date.now() / 1000;
  let list = '';
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(f.t + 0.05, tEnd);
    list += `file '${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
  });
  list += `file '${frames[frames.length - 1].file}'\n`;
  writeFileSync(`${dir}list.txt`, list);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}list.txt`, '-fps_mode', 'cfr', '-r', '30',
    '-vf', 'scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:(ow-iw)/2:(oh-ih)/2:color=0xeef4f0,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', `${OUT}${name}.mp4`]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${OUT}${name}.mp4`]).toString().trim());
  rmSync(dir, { recursive: true, force: true });
  manifest.push({ name, seconds: +dur.toFixed(2), frames: frames.length, ...info });
  console.log(`recorded ${name}: ${dur.toFixed(1)} s, ${frames.length} frames`);
}
const still = (name) => page.screenshot({ path: `${OUT}still-${name}.png` });

try {
  // ---- 1. sign in with mobile OTP
  await page.goto(`${BASE}#/login`);
  await page.waitForSelector('.auth-card');
  await wait(1200);
  await record('signin', async () => {
    await wait(900);
    await page.click('input[aria-label="Mobile number"]');
    await page.type('input[aria-label="Mobile number"]', '9876543210', { delay: 120 });
    await wait(500);
    await page.click('button:has-text("Send OTP")');
    await page.waitForSelector('input.otp:visible');
    await wait(1000);
    await page.type('input.otp', '123456', { delay: 180 });
    await page.waitForSelector('.shell .view > *');
    await wait(2600);
  });
  await still('supervisor-home');

  // ---- 2. supervisor raises a pickup with GPS
  let code = '';
  await record('raise', async () => {
    await page.click('.tab.fab');
    await page.waitForSelector('.type-grid');
    await wait(1100);
    await page.click('.type-tile[data-id="paper"]');
    await wait(700);
    await page.click('.gps-btn');
    await page.waitForSelector('.loc-preview .mini-map .ww-pin');
    await page.waitForFunction(() => document.querySelector('input[placeholder="e.g. Hostel Mess back gate"]')?.value.length > 3, null, { timeout: 8000 }).catch(() => {});
    if (!(await page.inputValue('input[placeholder="e.g. Hostel Mess back gate"]'))) await page.type('input[placeholder="e.g. Hostel Mess back gate"]', 'Library back gate', { delay: 40 });
    await wait(2200);
    await still('raise-gps');
    await smooth(520);
    await wait(300);
    await page.click('.filter-chip:has-text("Urgent")');
    await wait(400);
    await page.click('textarea');
    await page.type('textarea', 'Paper and cardboard boxes near the back gate', { delay: 32 });
    await wait(500);
    await smooth(600);
    await page.click('form button[type=submit]');
    await page.waitForSelector('.success-overlay');
    await page.waitForSelector('.timeline');
    code = (await page.locator('.topbar h1').innerText()).trim();
    await wait(1600);
    await smooth(470, 1300);
    await wait(2200);
    return { code };
  });

  // ---- 3. vendor: nearest first, live map, swipe to accept, directions and call
  await ctx.setGeolocation({ latitude: HOME.lat + 0.004, longitude: HOME.lng + 0.003, accuracy: 12 });
  await signInAs('u-ven', '/vendor');
  await page.waitForSelector('.rcard .dist');
  await wait(800);
  await record('vendor', async () => {
    await wait(1800);
    await smooth(380, 1300);
    await top();
    await page.click('.tab:has-text("Map")');
    await page.waitForSelector('.map-full .ww-pin');
    await wait(OFFLINE ? 1500 : 3200);
    await still('vendor-map');
    const pin = page.locator('.map-full .ww-pin.pulse').first();
    await (await pin.count() ? pin : page.locator('.map-full .ww-pin').first()).click();
    await page.waitForSelector('.ww-popup .pop');
    await wait(2200);
    await page.click('.tab:has-text("Pickups")');
    const card = page.locator(`.rcard:has(.code:text-is("${code}"))`);
    await card.waitFor();
    await wait(1300);
    await card.locator('.swipe').scrollIntoViewIfNeeded();
    await wait(700);
    const knob = await card.locator('.swipe .knob').boundingBox();
    const track = await card.locator('.swipe').boundingBox();
    await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
    await page.mouse.down();
    for (let x = 0; x <= track.width; x += 12) {
      await page.mouse.move(knob.x + knob.width / 2 + x, knob.y + knob.height / 2);
      await wait(16);
    }
    await page.mouse.up();
    await page.waitForSelector('.toast:has-text("Accepted")');
    await wait(1800);
    await page.click('.tab:has-text("My jobs")');
    await page.locator(`.rcard:has(.code:text-is("${code}"))`).waitFor();
    await wait(1100);
    await page.locator(`.rcard:has(.code:text-is("${code}"))`).click();
    await page.waitForSelector('a.btn:has-text("Directions")');
    await wait(1400);
    await smooth(330, 1300);
    await wait(2300);
  });
  await still('vendor-job');

  // ---- 4. supervisor gets notified and confirms the handover
  await ctx.setGeolocation({ latitude: HOME.lat, longitude: HOME.lng, accuracy: 9 });
  await signInAs('u-sup', '/supervisor');
  await record('handover', async () => {
    await wait(1600);
    await page.click('.icon-btn[aria-label="Notifications"]');
    await wait(2300);
    await page.click('.tab:has-text("Home")');
    await page.locator(`.rcard:has(.code:text-is("${code}")) .btn:has-text("Confirm handover")`).waitFor();
    await wait(900);
    await page.locator(`.rcard:has(.code:text-is("${code}")) .btn:has-text("Confirm handover")`).click();
    await page.waitForSelector('.sheet .weight');
    await wait(900);
    await page.fill('.weight input', '');
    await page.type('.weight input', '86.5', { delay: 200 });
    await wait(600);
    await page.click('.sheet .stars button:nth-child(5)');
    await wait(1000);
    await page.click('.sheet .btn.primary:has-text("Confirm handover")');
    await page.waitForSelector('.toast:has-text("86.5 kg")');
    await wait(3000);
  });

  // ---- 5. admin: dashboard, live map, approvals, bins
  await signInAs('u-admin', '/admin');
  await record('admin', async () => {
    await wait(2800);
    await still('admin-dashboard');
    await smooth(520, 1500);
    await smooth(560, 1500);
    await smooth(600, 1500);
    await top();
    await page.click('.hero .btn:has-text("Live map")');
    await page.waitForSelector('.map-full .ww-pin');
    await wait(OFFLINE ? 1500 : 3400);
    await still('admin-map');
    await page.click('.tab:has-text("Users")');
    await page.waitForSelector('text=Waiting for approval');
    await wait(2300);
    await page.click('.tab:has-text("Bins")');
    await page.waitForSelector('.bin .qr svg');
    await wait(2400);
  });

  // ---- 6. community impact
  await record('impact', async () => {
    await page.goto(`${BASE}#/member`);
    await page.waitForSelector('.donut');
    await wait(2300);
    await smooth(600, 1500);
    await smooth(600, 1500);
    await wait(600);
  });

  // ---- 7. get the app (Android + iPhone)
  await record('getapp', async () => {
    await page.goto(`${BASE}#/get`);
    await page.waitForSelector('.get-card');
    await wait(2000);
    await smooth(640, 1600);
    await wait(1600);
  });

  // ---- 8. about the creator
  await record('about', async () => {
    await page.goto(`${BASE}#/about`);
    await page.waitForSelector('.about-card.why');
    await wait(2200);
    await smooth(560, 1700);
    await wait(1200);
    await smooth(640, 1700);
    await wait(1500);
  });

  // ---- dark mode still for the thumbnail
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${BASE}#/vendor`);
  await signInAs('u-ven', '/map');
  await page.waitForSelector('.map-full .ww-pin');
  await wait(OFFLINE ? 1200 : 3000);
  await still('dark-map');
  writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 1));
  console.log('done', manifest);
} catch (e) {
  console.error('RECORDING FAILED', e);
  await page.screenshot({ path: `${OUT}failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
