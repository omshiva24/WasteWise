// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Admin: registered bins with map locations and QR codes, add / edit bins, printable QR stickers (PDF).
import { h, icon } from '../../ui/dom.js';
import { btn, field, inputBox, selectBox, sheet, toast, confirmSheet, empty, skeletonList, setBusy } from '../../ui/components.js';
import { binService } from '../../api/request.service.js';
import { WASTE_TYPES, WASTE_BY_ID, LIMITS } from '../../core/constants.js';
import { buildBinLabels } from '../../core/labels.js';
import { qrSvg } from '../../ui/qr.js';
import { saveFile } from '../../ui/native.js';
import { pageRoot, lifetime } from '../common.js';
import { pickLocation, miniMap, geoToast } from '../../ui/map.js';
import { getPosition, reverseGeocode } from '../../ui/geo.js';
import { normGeo, fmtCoords } from '../../core/geo.js';

let knownZones = [];

function binForm(bin) {
  bin = bin || {};
  const id = inputBox({ iconName: 'qr-code', placeholder: 'BIN-A05', value: bin.id || '', maxlength: LIMITS.binId, disabled: !!bin.id, autocapitalize: 'characters' });
  const loc = inputBox({ iconName: 'map-pin', placeholder: 'e.g. Library Block - Entrance', value: bin.location || '', maxlength: LIMITS.location });
  const zone = h('input', { class: 'input', list: 'zones', placeholder: 'Zone / area (optional)', value: bin.zone || '' });
  const zones = h('datalist', { id: 'zones' }, knownZones.map((z) => h('option', { value: z })));
  let geo = normGeo(bin.geo);
  const geoHost = h('div', { class: 'stack-sm' });
  const drawGeo = () => {
    geoHost.replaceChildren(
      geo ? h('div', { class: 'geo-info' }, icon('circle-check', { size: 16 }), h('span', `Pinned at ${fmtCoords(geo)}`)) : h('div', { class: 'muted small' }, 'Not on the map yet - vendors navigate using this pin.'),
      h('div', { class: 'row' },
        btn('Use my location', { kind: 'sky', size: 'sm', block: true, iconName: 'locate-fixed', onClick: async (e) => {
          const b = e.currentTarget;
          setBusy(b, true, 'Finding you…');
          try {
            geo = await getPosition();
            const a = await reverseGeocode(geo);
            if (a && !loc.querySelector('input').value) loc.querySelector('input').value = a;
          } catch (err) {
            geoToast(err);
          }
          drawGeo();
        } }),
        btn(geo ? 'Adjust on map' : 'Pick on map', { kind: 'ghost', size: 'sm', block: true, iconName: 'map', onClick: async () => {
          const r = await pickLocation({ initial: geo, title: `Where is ${id.querySelector('input').value || 'this bin'}?` });
          if (r) {
            geo = normGeo(r);
            if (r.address && !loc.querySelector('input').value) loc.querySelector('input').value = r.address;
            drawGeo();
          }
        } })));
  };
  drawGeo();
  const type = selectBox(WASTE_TYPES.map((w) => ({ value: w.id, label: w.label })), bin.wasteType || 'mixed');
  const cap = inputBox({ iconName: 'container', type: 'number', min: '20', step: '20', value: bin.capacityL || 240 });
  const save = btn(bin.id ? 'Save changes' : 'Add bin', { kind: 'primary', size: 'lg', block: true, iconName: 'check' });
  return { id, loc, zone, type, cap, save, geo: () => geo, el: h('div', { class: 'stack' }, field('Bin ID', id), field('Map location', geoHost), field('Description', loc), field('Zone', h('div', {}, zone, zones)), h('div', { class: 'row' }, h('div', { class: 'grow' }, field('Usual waste', type)), h('div', { class: 'grow' }, field('Capacity (L)', cap))), save) };
}

function openEditor(bin) {
  const f = binForm(bin);
  sheet({
    title: bin?.id ? `Edit ${bin.id}` : 'Add a bin',
    subtitle: 'A QR sticker is generated automatically.',
    content: (close) => {
      f.save.addEventListener('click', async () => {
        setBusy(f.save, true, 'Saving…');
        try {
          const saved = await binService.save({ id: f.id.querySelector('input').value, location: f.loc.querySelector('input').value, zone: f.zone.value, wasteType: f.type.value, capacityL: f.cap.querySelector('input').value, geo: f.geo() });
          toast(`${saved.id} saved`, 'success');
          close();
        } catch (e) {
          toast(e.message, 'error');
          f.save.disabled = false;
          f.save.replaceChildren(icon('check', { size: 18 }), h('span', bin?.id ? 'Save changes' : 'Add bin'));
        }
      });
      return f.el;
    },
  });
}

export default function adminBins({ navigate }) {
  const life = lifetime();
  let bins = [];
  const grid = h('div', {}, skeletonList(2, 200));
  const download = btn('QR stickers (PDF)', { kind: 'ghost', iconName: 'printer', onClick: async () => {
    if (!bins.length) return toast('Add a bin first', 'info');
    await saveFile('wastewise-bin-qr-labels.pdf', 'application/pdf', buildBinLabels(bins).toBytes());
    toast(`QR labels for ${bins.length} bins ready to print`, 'success');
  } });
  life.add(binService.watch((list) => {
    bins = list;
    knownZones = [...new Set(list.map((b) => b.zone).filter(Boolean))].sort();
    grid.replaceChildren(list.length ? h('div', { class: 'bins stagger' }, list.map((b, i) => {
      const w = WASTE_BY_ID[b.wasteType];
      return h('div', { class: 'bin', style: { '--i': String(Math.min(i, 14)) }, role: 'button', tabindex: '0', 'aria-label': `Bin ${b.id} at ${b.location}`, onclick: () => binMenu(b) },
        h('div', { class: 'qr' }, qrSvg(b.id)), h('div', { class: 'bid' }, b.id), h('div', { class: 'small' }, b.location), h('div', { class: 'muted small' }, [b.zone, w?.label].filter(Boolean).join(' · ')),
        h('div', { class: `bin-geo ${b.geo ? 'on' : ''}` }, icon(b.geo ? 'map-pinned' : 'map-pin', { size: 13 }), b.geo ? 'On the map' : 'No map pin'));
    })) : empty({ title: 'No bins yet', text: 'Add your first bin to print its QR sticker.' }));
  }));

  function binMenu(b) {
    sheet({
      title: b.id,
      subtitle: [b.location, b.zone].filter(Boolean).join(' · '),
      content: (close) => h('div', { class: 'stack' },
        h('div', { style: { width: '170px', margin: '0 auto', background: '#fff', borderRadius: '18px', padding: '10px' } }, qrSvg(b.id)),
        b.geo ? miniMap(b.geo, { color: '#475569', iconName: 'trash', height: 150 }) : null,
        h('div', { class: 'row' },
          btn('Edit', { kind: 'ghost', block: true, iconName: 'wrench', onClick: () => (close(), setTimeout(() => openEditor(b), 300)) }),
          btn('Delete', { kind: 'danger', block: true, iconName: 'trash', onClick: async () => {
            close();
            if (await confirmSheet({ title: `Delete ${b.id}?`, text: 'Old requests keep their bin ID; the QR sticker will no longer match a registered bin.', confirmLabel: 'Delete bin', kind: 'danger', iconName: 'trash' })) {
              await binService.remove(b.id).catch((e) => toast(e.message, 'error'));
              toast(`${b.id} deleted`, 'info');
            }
          } }))),
    });
  }

  return { title: 'Bins & QR codes', el: pageRoot(h('div', { class: 'row wrap' }, btn('Add bin', { iconName: 'plus', onClick: () => openEditor(null) }), download, btn('Map', { kind: 'ghost', iconName: 'map', onClick: () => navigate('/map') })), grid), destroy: life.destroy };
}
