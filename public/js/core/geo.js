// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Pure location helpers (no browser APIs): validation, distance, formatting, map links.

const round = (n, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

/** Returns a clean { lat, lng, acc } or null when the input is not a valid position. */
export function normGeo(g) {
  if (!g || typeof g !== 'object') return null;
  const lat = Number(g.lat);
  const lng = Number(g.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  const acc = Number(g.acc);
  return { lat: round(lat), lng: round(lng), acc: Number.isFinite(acc) && acc >= 0 ? Math.min(Math.round(acc), 100000) : null };
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function fmtDistance(km) {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Opens turn-by-turn directions in Google Maps (the app on phones, the website elsewhere). */
export function directionsUrl(g) {
  return `https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}&travelmode=driving`;
}

export function mapsUrl(g) {
  return `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`;
}

export const fmtCoords = (g) => (g ? `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}` : '');

/** Short human address from a Nominatim reverse-geocoding result. */
export function shortAddress(r) {
  if (!r) return '';
  const a = r.address || {};
  const first = r.name || a.amenity || a.building || a.shop || a.office || a.tourism || a.leisure || '';
  const road = a.road || a.pedestrian || a.footway || a.path || '';
  const area = a.neighbourhood || a.suburb || a.quarter || a.village || a.hamlet || '';
  const city = a.city || a.town || a.municipality || a.county || a.state_district || '';
  const parts = [first, road, area, city].filter(Boolean);
  const uniq = parts.filter((p, i) => parts.indexOf(p) === i);
  return (uniq.length ? uniq.slice(0, 3).join(', ') : String(r.display_name || '').split(',').slice(0, 3).join(',')).slice(0, 80);
}
