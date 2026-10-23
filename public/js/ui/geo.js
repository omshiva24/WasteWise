// Device location (GPS) on phones and browsers, plus address lookup on OpenStreetMap (Nominatim).

import { isNative, nativeCall } from './native.js';
import { normGeo, shortAddress } from '../core/geo.js';

export class GeoError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GeoError';
    this.code = code;
  }
}

let last = null;
const remember = (coords) => {
  const g = normGeo({ lat: coords.latitude, lng: coords.longitude, acc: coords.accuracy });
  if (!g) throw new GeoError('Could not read your location', 'unavailable');
  last = { ...g, at: Date.now() };
  try {
    sessionStorage.setItem('wastewise.lastpos', JSON.stringify(last));
  } catch {
    /* ignore */
  }
  return g;
};

/** Last position from the past few minutes (no prompt, no waiting). */
export function lastKnown(maxAgeMs = 10 * 60_000) {
  if (!last) {
    try {
      last = JSON.parse(sessionStorage.getItem('wastewise.lastpos') || 'null');
    } catch {
      last = null;
    }
  }
  return last && Date.now() - last.at < maxAgeMs ? { lat: last.lat, lng: last.lng, acc: last.acc } : null;
}

function webPosition({ timeout, maxAge }) {
  if (!navigator.geolocation) return Promise.reject(new GeoError('Location is not available on this device', 'unsupported'));
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(
      (p) => {
        try {
          res(remember(p.coords));
        } catch (e) {
          rej(e);
        }
      },
      (e) => rej(
        e.code === 1
          ? new GeoError('Location access is blocked. Allow location for this site in your browser settings, then try again.', 'denied')
          : e.code === 3
            ? new GeoError('Finding your location took too long. Turn on GPS / Location and try again.', 'timeout')
            : new GeoError('Could not find your location. Turn on GPS / Location and try again.', 'unavailable'),
      ),
      { enableHighAccuracy: true, timeout, maximumAge: maxAge },
    ),
  );
}

/** Ask for the current GPS position. Resolves { lat, lng, acc } or throws GeoError with a friendly message. */
export async function getPosition({ timeout = 15000, maxAge = 20000 } = {}) {
  if (isNative()) {
    try {
      let perm = await nativeCall('Geolocation', 'checkPermissions');
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') perm = await nativeCall('Geolocation', 'requestPermissions', { permissions: ['location', 'coarseLocation'] });
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') throw new GeoError('Location permission is off. Allow it for WasteWise in your phone settings.', 'denied');
      const pos = await nativeCall('Geolocation', 'getCurrentPosition', { enableHighAccuracy: true, timeout, maximumAge: maxAge });
      return remember(pos.coords);
    } catch (e) {
      if (e instanceof GeoError) throw e;
      const msg = String(e?.message || e).toLowerCase();
      if (!/not (available|implemented)/.test(msg)) {
        if (msg.includes('disabled') || msg.includes('location services')) throw new GeoError('Location is turned off. Switch on Location in your phone settings.', 'unavailable');
        if (msg.includes('denied')) throw new GeoError('Location permission is off. Allow it for WasteWise in your phone settings.', 'denied');
      }
      // plugin missing: fall back to the WebView's own geolocation
    }
  }
  return webPosition({ timeout, maxAge });
}

/** Keep a live position (vendor map). Returns a stop function. */
export function watchPosition(cb, onError) {
  if (!isNative() && navigator.geolocation?.watchPosition) {
    const id = navigator.geolocation.watchPosition(
      (p) => {
        try {
          cb(remember(p.coords));
        } catch {
          /* ignore bad fix */
        }
      },
      (e) => onError?.(e),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }
  let stopped = false;
  const tick = () => getPosition({ maxAge: 15000 }).then((g) => !stopped && cb(g)).catch((e) => !stopped && onError?.(e));
  tick();
  const t = setInterval(tick, 20000);
  return () => {
    stopped = true;
    clearInterval(t);
  };
}

/** 'granted' | 'prompt' | 'denied' | 'unknown' (browsers only). */
export async function permissionState() {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' });
    return p?.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ---------------------------------------------------------------- OpenStreetMap Nominatim
// Usage policy: at most one request per second, cache results, no autocomplete.
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const cache = new Map();
let queue = Promise.resolve();
let lastCall = 0;
function throttled(url) {
  if (cache.has(url)) return cache.get(url);
  const p = (queue = queue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCall));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
    return res.json();
  }));
  p.catch(() => cache.delete(url));
  cache.set(url, p);
  return p;
}

/** Short street address for a position, or '' if it can't be found. */
export async function reverseGeocode(g) {
  if (!g) return '';
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${g.lat.toFixed(5)}&lon=${g.lng.toFixed(5)}`;
  try {
    return shortAddress(await throttled(url));
  } catch {
    return '';
  }
}

/** Search for a place by name. Results near `near` are preferred. */
export async function searchPlaces(q, near) {
  const query = String(q || '').trim().slice(0, 120);
  if (query.length < 3) return [];
  let url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&accept-language=en&q=${encodeURIComponent(query)}`;
  if (near) url += `&viewbox=${near.lng - 0.4},${near.lat + 0.4},${near.lng + 0.4},${near.lat - 0.4}`;
  try {
    const list = await throttled(url);
    return list.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: shortAddress(r), full: String(r.display_name || '') })).filter((r) => normGeo(r));
  } catch {
    return [];
  }
}
