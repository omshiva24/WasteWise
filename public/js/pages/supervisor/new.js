// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Supervisor: raise a waste pickup request (GPS location + map pin, optional bin QR, type, photo, priority).
import { h, icon } from '../../ui/dom.js';
import { btn, field, inputBox, selectBox, setBusy, successOverlay, toast } from '../../ui/components.js';
import { requestService, binService } from '../../api/request.service.js';
import { WASTE_TYPES, LIMITS } from '../../core/constants.js';
import { validateNewRequest } from '../../core/lifecycle.js';
import { scanQr } from '../../ui/qr.js';
import { takePhoto } from '../../ui/camera.js';
import { haptic } from '../../ui/fx.js';
import { pageRoot, lifetime } from '../common.js';
import { getPosition, reverseGeocode, permissionState, lastKnown } from '../../ui/geo.js';
import { miniMap, pickLocation, geoToast } from '../../ui/map.js';
import { normGeo, fmtCoords } from '../../core/geo.js';
import { isNative } from '../../ui/native.js';

export default function raiseRequest({ navigate }) {
  const life = lifetime();
  const form = { wasteType: '', binId: '', location: '', zone: '', notes: '', priority: 'normal', estKg: '', photo: null, geo: null };
  let bins = [];

  // --- waste type grid
  const typeGrid = h('div', { class: 'type-grid', role: 'radiogroup', 'aria-label': 'Waste type' }, WASTE_TYPES.map((w) =>
    h('button', { type: 'button', class: 'type-tile', role: 'radio', 'aria-checked': 'false', style: { '--tile-color': w.color }, dataset: { id: w.id }, onclick: (e) => pickType(w.id, e.currentTarget) },
      h('span', { class: 'bub', style: { background: `linear-gradient(135deg, ${w.color}, color-mix(in srgb, ${w.color} 70%, #000))` } }, icon(w.icon, { size: 24 })), w.label)));
  function pickType(id) {
    form.wasteType = id;
    haptic();
    [...typeGrid.children].forEach((c) => {
      const on = c.dataset.id === id;
      c.classList.toggle('on', on);
      c.setAttribute('aria-checked', String(on));
    });
    typeField.setError('');
  }
  const typeField = field('What kind of waste?', typeGrid);

  // --- location: GPS / map pin + address
  const locInput = inputBox({ iconName: 'map-pin', placeholder: 'e.g. Hostel Mess back gate', maxlength: LIMITS.location });
  const loc = locInput.querySelector('input');
  loc.addEventListener('input', () => ((form.location = loc.value), (loc.dataset.auto = '')));
  const mapHost = h('div', { class: 'loc-preview' });
  const gpsBtn = btn('Use my current location', { kind: 'sky', block: true, iconName: 'locate-fixed', cls: 'gps-btn' });
  const pickBtn = btn('Pick on map', { kind: 'ghost', block: true, iconName: 'map' });
  const geoInfo = h('div', { class: 'geo-info hide' });
  let preview = null;

  function setGeo(g, address, source) {
    form.geo = normGeo(g);
    preview?.destroy?.();
    preview = form.geo ? miniMap(form.geo, { color: '#059669', directions: false, height: 170 }) : null;
    mapHost.replaceChildren(...(preview ? [preview] : []));
    geoInfo.classList.toggle('hide', !form.geo);
    if (form.geo) {
      geoInfo.replaceChildren(icon('circle-check', { size: 16 }), h('span', `${source} · ${fmtCoords(form.geo)}${form.geo.acc ? ` · accurate to ±${form.geo.acc} m` : ''}`));
      gpsBtn.querySelector('span').textContent = 'Update with my location';
      pickBtn.querySelector('span').textContent = 'Adjust pin on map';
    }
    if (address && (!loc.value || loc.dataset.auto)) {
      loc.value = address.slice(0, LIMITS.location);
      loc.dataset.auto = '1';
      form.location = loc.value;
    }
    locField.setError('');
  }
  async function useGps(silent) {
    if (!silent) setBusy(gpsBtn, true, 'Finding you…');
    try {
      const g = await getPosition();
      setGeo(g, '', 'GPS location');
      haptic('success');
      reverseGeocode(g).then((a) => a && setGeo(form.geo, a, 'GPS location'));
    } catch (e) {
      if (!silent) geoToast(e);
    } finally {
      gpsBtn.disabled = false;
      gpsBtn.replaceChildren(icon('locate-fixed', { size: 18 }), h('span', form.geo ? 'Update with my location' : 'Use my current location'));
    }
  }
  gpsBtn.addEventListener('click', () => useGps(false));
  pickBtn.addEventListener('click', async () => {
    const r = await pickLocation({ initial: form.geo, title: 'Where is the waste?' });
    if (r) setGeo(r, r.address, 'Pinned on map');
  });
  const locField = field('Description', locInput, { hint: 'Filled in from the map - edit it so the vendor finds the exact spot.' });

  // --- bin (optional)
  const binInput = h('input', { class: 'input', placeholder: 'e.g. BIN-A01 (optional)', maxlength: LIMITS.binId, autocapitalize: 'characters', 'aria-label': 'Bin ID' });
  const binSelect = selectBox([{ value: '', label: 'Choose a registered bin…' }], '', { 'aria-label': 'Registered bins' });
  const scanBtn = btn('Scan QR', { kind: 'sky', iconName: 'scan-line', onClick: async () => {
    const v = await scanQr();
    if (v) applyBin(String(v).trim(), true);
  } });
  function applyBin(id, scanned) {
    const up = id.toUpperCase().replace(/^WASTEWISE:/, '');
    binInput.value = up;
    form.binId = up;
    const b = bins.find((x) => x.id === up);
    if (b) {
      loc.value = b.location;
      loc.dataset.auto = '';
      form.location = b.location;
      form.zone = b.zone || '';
      binSelect.value = b.id;
      if (!form.wasteType && b.wasteType) pickType(b.wasteType);
      if (b.geo) setGeo(b.geo, '', `Bin ${b.id}`);
      locField.setError('');
    }
    binField.setError('');
    if (scanned) toast(b ? `Bin ${up} - ${b.location}` : `Scanned ${up}`, 'success');
  }
  binInput.addEventListener('input', () => applyBin(binInput.value, false));
  binSelect.addEventListener('change', () => binSelect.value && applyBin(binSelect.value, false));
  let qBin = new URLSearchParams(location.hash.split('?')[1] || '').get('bin');
  life.add(binService.watch((list) => {
    bins = list;
    if (qBin && list.some((b) => b.id === qBin)) setTimeout(() => (applyBin(qBin, false), (qBin = null)), 0);
    binSelect.replaceChildren(h('option', { value: '' }, list.length ? 'Choose a registered bin…' : 'No bins registered yet'), ...list.map((b) => h('option', { value: b.id }, `${b.id} - ${b.location}`)));
  }));
  const binField = field('Bin (optional)', h('div', { class: 'stack-sm' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, binInput), scanBtn), binSelect), { hint: 'Registered bins have a QR sticker - scanning fills in the bin and its location.' });

  // Pre-fill from GPS when the person already allowed location.
  const known = lastKnown(3 * 60_000);
  if (known) setTimeout(() => !form.geo && (setGeo(known, '', 'GPS location'), reverseGeocode(known).then((a) => a && setGeo(form.geo, a, 'GPS location'))), 0);
  else (isNative() ? Promise.resolve('granted') : permissionState()).then((st) => st === 'granted' && !form.geo && useGps(true));

  // --- priority
  const prio = h('div', { class: 'row' }, ['normal', 'urgent'].map((p) =>
    h('button', { type: 'button', class: `filter-chip ${p === form.priority ? 'on' : ''}`, 'aria-pressed': String(p === form.priority), onclick: (e) => {
      form.priority = p;
      haptic();
      [...prio.children].forEach((c) => {
        c.classList.toggle('on', c === e.currentTarget);
        c.setAttribute('aria-pressed', String(c === e.currentTarget));
      });
    } }, icon(p === 'urgent' ? 'flame' : 'clock', { size: 16 }), p === 'urgent' ? 'Urgent' : 'Normal')));

  // --- estimate, notes, photo
  const est = inputBox({ iconName: 'weight', type: 'number', inputmode: 'decimal', min: '0', step: '1', placeholder: 'Optional' });
  est.querySelector('input').addEventListener('input', (e) => (form.estKg = e.target.value));
  const notes = h('textarea', { class: 'input', maxlength: LIMITS.notes, placeholder: 'Anything the vendor should know? (gate code, timing…)' });
  notes.addEventListener('input', () => (form.notes = notes.value));
  const photoBox = h('button', { type: 'button', class: 'photo-drop', 'aria-label': 'Add a photo of the bin' }, icon('camera', { size: 26 }), 'Add a photo of the bin');
  photoBox.addEventListener('click', async () => {
    const p = await takePhoto().catch(() => null);
    if (!p) return;
    form.photo = p;
    photoBox.replaceChildren(h('img', { src: p, alt: 'Bin photo' }));
    haptic('success');
  });

  const submit = btn('Raise pickup request', { kind: 'primary', size: 'lg', block: true, iconName: 'send', type: 'submit' });
  submit.replaceChildren(icon('truck', { size: 20 }), h('span', 'Raise pickup request'));
  const el = h('form', { novalidate: true }, pageRoot(
    h('div', { class: 'card pad-lg stack' }, typeField),
    h('div', { class: 'card pad-lg stack' }, h('div', { class: 'card-title' }, icon('map-pinned', { size: 18 }), 'Where is it?'), h('div', { class: 'row loc-btns' }, gpsBtn, pickBtn), geoInfo, mapHost, locField),
    h('div', { class: 'card pad-lg stack' }, binField),
    h('div', { class: 'card pad-lg stack' }, field('Priority', prio), field('Estimated weight (kg)', est), field('Notes', notes), field('Photo', photoBox)),
    submit));

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.binId = binInput.value;
    form.location = loc.value || (form.geo ? 'Pinned location' : '');
    const v = validateNewRequest(form);
    typeField.setError(v.errors.wasteType || '');
    binField.setError(v.errors.binId || '');
    locField.setError(v.errors.location || '');
    if (!v.ok) {
      haptic('error');
      el.querySelector('.err:not(:empty)')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(submit, true, 'Sending to vendors…');
    try {
      const req = await requestService.create(form);
      await successOverlay({ title: 'Pickup requested!', text: `${req.code} is now live for vendors near ${req.location}` });
      navigate(`/request/${req.id}`, { replace: true });
    } catch (err) {
      toast(err.message, 'error');
      submit.disabled = false;
      submit.replaceChildren(icon('truck', { size: 20 }), h('span', 'Raise pickup request'));
    }
  });

  return { title: 'Raise pickup', sub: 'Takes about 10 seconds', back: true, el, destroy: () => (life.destroy(), preview?.destroy?.()) };
}
