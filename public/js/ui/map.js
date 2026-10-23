// Live maps (Leaflet + OpenStreetMap/CARTO tiles): pins, "you are here", mini maps
// and a full-screen location picker with GPS, search and a draggable map.

import { MAP } from '../config.js';
import { h, icon } from './dom.js';
import { btn, sheet, toast } from './components.js';
import { resolvedTheme } from './state.js';
import { getPosition, lastKnown, reverseGeocode, searchPlaces, GeoError } from './geo.js';
import { normGeo, fmtCoords, directionsUrl } from '../core/geo.js';
import { haptic } from './fx.js';
import { isNative } from './native.js';

let loading = null;
/** Loads Leaflet once, on the first screen that needs a map. */
export function loadLeaflet() {
  if (globalThis.L?.map) return Promise.resolve(globalThis.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = h('link', { rel: 'stylesheet', href: './js/vendor/leaflet/leaflet.css' });
    const js = h('script', { src: './js/vendor/leaflet/leaflet.js' });
    js.addEventListener('load', () => resolve(globalThis.L));
    js.addEventListener('error', () => {
      loading = null;
      reject(new Error('The map could not load'));
    });
    document.head.append(css, js);
  });
  return loading;
}

/** Coloured map pin (DOM element) used as a Leaflet divIcon. */
export function pinEl({ color = '#059669', iconName = 'map-pin', pulse = false, label } = {}) {
  return h('div', { class: `ww-pin ${pulse ? 'pulse' : ''}`, style: { '--c': color } },
    h('span', { class: 'ww-pin-head' }, icon(iconName, { size: 17 })),
    label ? h('span', { class: 'ww-pin-label' }, label) : null);
}

/**
 * Creates a map inside `el`. Returns helpers; call destroy() when the page closes.
 * opts: { center, zoom, interactive, zoomControl }
 */
/** Resolves once the element is in the page and has a size (Leaflet needs both). */
function whenSized(el, timeout = 4000) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if ((el.isConnected && el.clientWidth > 0 && el.clientHeight > 0) || performance.now() - t0 > timeout) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

export async function createMap(el, { center, zoom = 16, interactive = true, zoomControl = true } = {}) {
  const L = await loadLeaflet();
  await whenSized(el);
  const c = normGeo(center) || MAP.fallback;
  const map = L.map(el, {
    center: [c.lat, c.lng],
    zoom: normGeo(center) ? zoom : MAP.fallback.zoom,
    zoomControl: false,
    dragging: interactive,
    touchZoom: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    boxZoom: false,
    keyboard: interactive,
    tapHold: false,
    worldCopyJump: true,
    zoomSnap: 0.5,
  });
  map.attributionControl.setPrefix(false);
  if (interactive && zoomControl) L.control.zoom({ position: 'bottomright' }).addTo(map);
  const tiles = L.tileLayer(resolvedTheme() === 'dark' ? MAP.dark : MAP.light, { attribution: MAP.attribution, subdomains: 'abcd', maxZoom: 20, crossOrigin: true }).addTo(map);
  tiles.on('tileerror', () => el.classList.add('tiles-failed'));
  const layer = L.layerGroup().addTo(map);
  let meLayer = null;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize({ animate: false })) : null;
  ro?.observe(el);

  const api = {
    L,
    map,
    /** Replace all pins. items: [{ geo, color, iconName, pulse, label, popup: () => Element, onClick }] */
    setPins(items) {
      layer.clearLayers();
      const out = [];
      for (const it of items) {
        const g = normGeo(it.geo);
        if (!g) continue;
        const m = L.marker([g.lat, g.lng], {
          icon: L.divIcon({ className: 'ww-pin-wrap', html: pinEl(it), iconSize: [38, 46], iconAnchor: [19, 44], popupAnchor: [0, -40] }),
          title: it.title || '',
          riseOnHover: true,
          keyboard: true,
        }).addTo(layer);
        if (it.popup) m.bindPopup(() => it.popup(), { closeButton: false, maxWidth: 280, minWidth: 220, className: 'ww-popup' });
        if (it.onClick) m.on('click', () => it.onClick());
        out.push(m);
      }
      return out;
    },
    /** Pulsing blue "you are here" dot with accuracy circle. */
    showMe(g) {
      const p = normGeo(g);
      if (!p) return;
      if (!meLayer) {
        meLayer = {
          circle: L.circle([p.lat, p.lng], { radius: p.acc || 30, className: 'ww-acc', stroke: false, interactive: false }).addTo(map),
          dot: L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'ww-me', html: h('span', { class: 'ww-me-dot' }), iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map),
        };
      } else {
        meLayer.circle.setLatLng([p.lat, p.lng]).setRadius(p.acc || 30);
        meLayer.dot.setLatLng([p.lat, p.lng]);
      }
    },
    /** Zoom to show every point (plus the user's own position if given). */
    fit(points, { maxZoom = 16, padding = 48 } = {}) {
      const pts = points.map(normGeo).filter(Boolean);
      if (!pts.length) return;
      if (pts.length === 1) return map.setView([pts[0].lat, pts[0].lng], maxZoom, { animate: false });
      map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [padding, padding], maxZoom, animate: false });
    },
    flyTo(g, z = 17) {
      const p = normGeo(g);
      if (p) map.flyTo([p.lat, p.lng], z, { duration: 0.8 });
    },
    center: () => normGeo({ lat: map.getCenter().lat, lng: map.getCenter().lng }),
    destroy() {
      ro?.disconnect();
      map.remove();
    },
  };
  return api;
}

/** Small read-only map with one pin, plus Directions / open buttons. Loads lazily. */
export function miniMap(geo, { color = '#059669', iconName = 'map-pin', height = 190, label, directions = true } = {}) {
  const g = normGeo(geo);
  if (!g) return null;
  const box = h('div', { class: 'mini-map', style: { height: `${height}px` }, role: 'img', 'aria-label': `Map showing ${label || 'the location'}` });
  const wrap = h('div', { class: 'mini-map-wrap' }, box,
    h('div', { class: 'mini-map-foot' },
      h('span', { class: 'muted small coords' }, icon('map-pin', { size: 13 }), fmtCoords(g), g.acc ? ` · ±${g.acc} m` : ''),
      directions ? h('a', { class: 'btn primary sm', href: directionsUrl(g), target: '_blank', rel: 'noopener' }, icon('navigation', { size: 16 }), 'Directions') : null));
  let m = null;
  const start = () => createMap(box, { center: g, zoom: 16, interactive: false }).then((x) => {
    m = x;
    m.setPins([{ geo: g, color, iconName, pulse: true }]);
  }).catch(() => box.classList.add('tiles-failed'));
  if ('IntersectionObserver' in globalThis) {
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (io.disconnect(), start()));
    requestAnimationFrame(() => io.observe(box));
  } else setTimeout(start, 50);
  wrap.destroy = () => m?.destroy();
  return wrap;
}

/** Friendly toast for location errors. */
export function geoToast(e) {
  toast(e instanceof GeoError ? e.message : 'Could not get your location', 'error', 4200);
}

/**
 * Full-screen location picker: GPS, place search and a draggable map with a centre pin.
 * Resolves { lat, lng, acc, address } or null when cancelled.
 */
export function pickLocation({ initial = null, title = 'Choose the exact spot' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    let m = null;
    let acc = normGeo(initial)?.acc ?? null;
    let address = '';
    let lookupT = null;
    const mapBox = h('div', { class: 'picker-map' });
    const pin = h('div', { class: 'picker-pin', 'aria-hidden': 'true' }, pinEl({ color: '#059669', iconName: 'map-pin' }), h('i', { class: 'picker-shadow' }));
    const addr = h('div', { class: 'picker-addr' }, icon('map-pin', { size: 16 }), h('span', 'Move the map to place the pin'));
    const searchInput = h('input', { class: 'input', type: 'search', placeholder: 'Search a place, road or landmark', 'aria-label': 'Search a place', enterkeyhint: 'search' });
    const results = h('div', { class: 'picker-results hide' });
    const locate = h('button', { type: 'button', class: 'picker-locate', 'aria-label': 'Go to my location' }, icon('locate-fixed', { size: 22 }));
    const confirm = btn('Use this spot', { kind: 'primary', size: 'lg', block: true, iconName: 'check' });

    const setAddr = (text, busy) => addr.replaceChildren(icon(busy ? 'loader-circle' : 'map-pin', { size: 16, cls: busy ? 'spin' : '' }), h('span', text));
    const lookup = () => {
      clearTimeout(lookupT);
      const c = m?.center();
      if (!c) return;
      setAddr(fmtCoords(c), true);
      lookupT = setTimeout(async () => {
        address = await reverseGeocode(c);
        setAddr(address || fmtCoords(c));
      }, 900);
    };
    async function goToMe(silent) {
      locate.classList.add('busy');
      try {
        const g = await getPosition();
        acc = g.acc;
        m?.showMe(g);
        m?.map.setView([g.lat, g.lng], 18);
        haptic();
      } catch (e) {
        if (!silent) geoToast(e);
      } finally {
        locate.classList.remove('busy');
      }
    }
    async function runSearch() {
      const q = searchInput.value;
      if (q.trim().length < 3) return;
      results.classList.remove('hide');
      results.replaceChildren(h('div', { class: 'muted small pad' }, 'Searching…'));
      const list = await searchPlaces(q, m?.center());
      results.replaceChildren(...(list.length ? list.map((r) => h('button', { type: 'button', class: 'picker-result', onclick: () => {
        results.classList.add('hide');
        acc = null;
        m?.map.setView([r.lat, r.lng], 17);
      } }, icon('map-pin', { size: 16 }), h('span', {}, h('b', r.label), h('small', r.full)))) : [h('div', { class: 'muted small pad' }, 'No places found - try another name, or move the map')]));
    }
    searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), runSearch()));

    const s = sheet({
      title,
      subtitle: 'Drag the map so the pin sits exactly on the bin or waste spot.',
      label: 'Choose location',
      focus: false,
      onClose: () => {
        m?.destroy();
        if (!done) resolve(null);
      },
      content: (close) => {
        confirm.addEventListener('click', () => {
          const c = m?.center();
          if (!c) return;
          done = true;
          resolve({ ...c, acc, address });
          close();
        });
        locate.addEventListener('click', () => goToMe(false));
        return h('div', { class: 'stack-sm' },
          h('div', { class: 'row' }, h('div', { class: 'grow' }, searchInput), btn('', { kind: 'ghost', iconName: 'search', ariaLabel: 'Search', onClick: runSearch })),
          results,
          h('div', { class: 'picker' }, mapBox, pin, locate),
          addr, confirm);
      },
    });
    s.el.classList.add('map-sheet');

    const start = normGeo(initial) || lastKnown();
    requestAnimationFrame(async () => {
      try {
        m = await createMap(mapBox, { center: start, zoom: 18 });
      } catch {
        setAddr('The map could not load - check your internet connection');
        return;
      }
      const me = lastKnown();
      if (me) m.showMe(me);
      m.map.on('movestart', () => pin.classList.add('lifted'));
      m.map.on('moveend', () => {
        pin.classList.remove('lifted');
        lookup();
      });
      m.map.on('dragstart', () => (acc = null));
      lookup();
      if (!normGeo(initial)) goToMe(true);
    });
  });
}

/** Opens directions in Google Maps / the phone's maps app. */
export function openDirections(geo) {
  const g = normGeo(geo);
  if (!g) return;
  const url = directionsUrl(g);
  if (isNative()) window.open(url, '_system');
  else window.open(url, '_blank', 'noopener');
}
