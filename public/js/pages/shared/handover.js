// Handover sheet: supervisor confirms the weight handed to the vendor and rates the pickup.
import { h, icon } from '../../ui/dom.js';
import { sheet, btn, stars, setBusy, toast } from '../../ui/components.js';
import { requestService } from '../../api/request.service.js';
import { confetti, haptic } from '../../ui/fx.js';
import { WASTE_BY_ID } from '../../core/constants.js';

export function openHandover(req, { onDone } = {}) {
  let rating = 5;
  const input = h('input', { type: 'number', inputmode: 'decimal', min: '0.1', max: '50000', step: '0.1', value: req.estKg || '', placeholder: '0', 'aria-label': 'Weight in kilograms' });
  const bump = (d) => {
    const v = Math.max(0, Math.round(((Number(input.value) || 0) + d) * 10) / 10);
    input.value = String(v);
    haptic();
    input.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  };
  const note = h('input', { class: 'input', placeholder: 'Note for the record (optional)', maxlength: 280 });
  const err = h('div', { class: 'form-error hide', role: 'alert' });
  const save = btn('Confirm handover', { kind: 'primary', size: 'lg', block: true, iconName: 'check-check' });
  const w = WASTE_BY_ID[req.wasteType];

  sheet({
    title: 'Confirm handover',
    subtitle: `${req.code} · ${w?.label || ''} · ${req.vendorName || 'vendor'}`,
    content: (close) => {
      save.addEventListener('click', async () => {
        err.classList.add('hide');
        const kg = Number(input.value);
        if (!kg || kg <= 0) {
          err.replaceChildren(icon('triangle-alert', { size: 18 }), 'Enter the weight handed over (kg)');
          err.classList.remove('hide');
          input.focus();
          return;
        }
        setBusy(save, true, 'Saving…');
        try {
          const done = await requestService.complete(req.id, { weightKg: kg, rating, note: note.value });
          close();
          confetti();
          haptic('success');
          toast(`Handover confirmed - ${done.weightKg} kg recorded`, 'success');
          onDone?.(done);
        } catch (e) {
          err.replaceChildren(icon('triangle-alert', { size: 18 }), e.message);
          err.classList.remove('hide');
          save.disabled = false;
          save.replaceChildren(icon('check-check', { size: 18 }), h('span', 'Confirm handover'));
        }
      });
      return h('div', { class: 'stack' },
        h('div', { class: 'weight' },
          h('div', { class: 'big' }, input, h('span', 'kg')),
          h('div', { class: 'steps' }, [-5, -1, 1, 5, 10, 25].map((d) => btn(`${d > 0 ? '+' : ''}${d}`, { kind: 'ghost', size: 'sm', onClick: () => bump(d) })))),
        h('div', { class: 'field', style: { textAlign: 'center' } }, h('label', 'How was the pickup?'), stars(rating, (n) => (rating = n))),
        note, err, save);
    },
  });
}
