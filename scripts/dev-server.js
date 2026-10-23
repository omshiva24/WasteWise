// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Zero-dependency static server for local development: node scripts/dev-server.js [port]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
// Same security headers as production (vercel.json), so CSP problems show up locally too.
const VERCEL = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const SECURITY = Object.fromEntries(VERCEL.headers[0].headers.filter((x) => !/Strict-Transport/.test(x.key)).map((x) => [x.key, x.value]));
// End-to-end tests against the Firebase emulators need to reach them on localhost.
if (process.env.WW_EMULATOR) SECURITY['Content-Security-Policy'] = SECURITY['Content-Security-Policy'].replace('connect-src', 'connect-src http://127.0.0.1:9099 http://127.0.0.1:8080 ws://127.0.0.1:8080');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      let file = join(ROOT, path);
      if (!file.startsWith(ROOT)) throw Object.assign(new Error('forbidden'), { code: 403 });
      if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { ...SECURITY, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (e) {
      res.writeHead(e.code === 403 ? 403 : 404, { 'Content-Type': 'text/plain' });
      res.end(e.code === 403 ? 'Forbidden' : 'Not found');
    }
  })
  .listen(PORT, () => console.log(`WasteWise running at http://localhost:${PORT}`));
