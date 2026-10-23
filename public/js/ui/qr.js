// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// QR codes: render bin labels (qrcodegen, MIT) and scan them with the camera
// (native BarcodeDetector where available, otherwise jsQR, Apache-2.0).

import { qrMatrix } from '../core/labels.js';
import { h, s, icon } from './dom.js';
import { sheet, btn, toast } from './components.js';
import { haptic } from './fx.js';

export { qrMatrix };

export function qrSvg(text, { border = 2, dark = '#062e22' } = {}) {
  const m = qrMatrix(text);
  const n = m.length + border * 2;
  let d = '';
  m.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x + border} ${y + border}h1v1h-1z`)));
  return s('svg', { viewBox: `0 0 ${n} ${n}`, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': `QR code ${text}` }, s('rect', { width: n, height: n, fill: '#fff' }), s('path', { d, fill: dark }));
}

let jsQRLoad = null;
function loadJsQR() {
  if (globalThis.jsQR) return Promise.resolve(globalThis.jsQR);
  jsQRLoad ||= new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = new URL('../vendor/jsQR.js', import.meta.url).href;
    sc.onload = () => res(globalThis.jsQR);
    sc.onerror = rej;
    document.head.append(sc);
  });
  return jsQRLoad;
}

async function decodeCanvas(canvas, detector) {
  if (detector) {
    const codes = await detector.detect(canvas).catch(() => []);
    return codes[0]?.rawValue || null;
  }
  const jsQR = await loadJsQR();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data || null;
}

async function makeDetector() {
  try {
    if ('BarcodeDetector' in globalThis) {
      const formats = await globalThis.BarcodeDetector.getSupportedFormats?.();
      if (!formats || formats.includes('qr_code')) return new globalThis.BarcodeDetector({ formats: ['qr_code'] });
    }
  } catch {
    /* use jsQR */
  }
  return null;
}

async function decodeImageFile(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return decodeCanvas(c, await makeDetector());
}

/** Opens the scanner sheet. Resolves with the scanned text, or null if closed. */
export function scanQr({ title = 'Scan bin QR code' } = {}) {
  return new Promise((resolve) => {
    let stream = null;
    let timer = null;
    let result = null;
    const video = h('video', { playsinline: true, muted: true, autoplay: true });
    const status = h('p', { class: 'muted small', style: { textAlign: 'center' } }, 'Point your camera at the QR sticker on the bin');
    const fileIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr-only' });
    const stop = () => {
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    const done = (val, close) => {
      result = val;
      haptic('success');
      close();
    };
    const ui = sheet({
      title,
      onClose: () => {
        stop();
        resolve(result);
      },
      content: (close) => {
        fileIn.addEventListener('change', async () => {
          const f = fileIn.files?.[0];
          if (!f) return;
          status.textContent = 'Reading photo…';
          const v = await decodeImageFile(f).catch(() => null);
          if (v) done(v, close);
          else {
            status.textContent = 'No QR code found in that photo. Try again closer.';
            toast('No QR code found', 'error');
          }
        });
        return h('div', { class: 'stack' },
          h('div', { class: 'qr-video' }, video, h('div', { class: 'frame' }), h('div', { class: 'laser' })),
          status,
          h('div', { class: 'row' }, btn('Use a photo', { kind: 'ghost', block: true, iconName: 'image', onClick: () => fileIn.click() }), btn('Close', { kind: 'soft', block: true, onClick: () => close() })),
          fileIn);
      },
    });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        video.srcObject = stream;
        await video.play().catch(() => {});
        const detector = await makeDetector();
        const c = document.createElement('canvas');
        timer = setInterval(async () => {
          if (!video.videoWidth) return;
          const scale = Math.min(1, 640 / video.videoWidth);
          c.width = Math.round(video.videoWidth * scale);
          c.height = Math.round(video.videoHeight * scale);
          c.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, c.width, c.height);
          const v = await decodeCanvas(c, detector).catch(() => null);
          if (v) done(v, ui.close);
        }, 220);
      } catch {
        status.replaceChildren(icon('camera', { size: 16 }), ' Camera not available - tap "Use a photo" or type the bin ID instead.');
      }
    })();
  });
}
