// Take a photo of the bin: native camera in the Android / iOS app, file picker
// with camera capture in browsers. Images are resized and compressed to JPEG.

import { isNative, nativeCall } from './native.js';

const MAX_SIDE = 960;

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export async function compress(src, maxBytes = 330_000) {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let q = 0.78;
  let out = c.toDataURL('image/jpeg', q);
  while (out.length * 0.75 > maxBytes && q > 0.35) {
    q -= 0.1;
    out = c.toDataURL('image/jpeg', q);
  }
  return out;
}

function pickFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.setAttribute('capture', 'environment');
    inp.addEventListener('change', () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(f);
    });
    inp.click();
  });
}

/** Returns a compressed JPEG data URL, or null if the user cancelled. */
export async function takePhoto() {
  let src = null;
  if (isNative()) {
    try {
      const p = await nativeCall('Camera', 'getPhoto', { quality: 70, resultType: 'dataUrl', source: 'PROMPT', width: 1280, correctOrientation: true, promptLabelHeader: 'Bin photo' });
      src = p?.dataUrl || null;
    } catch (e) {
      if (String(e?.message || e).toLowerCase().includes('cancel')) return null;
      src = await pickFile();
    }
  } else src = await pickFile();
  return src ? compress(src) : null;
}
