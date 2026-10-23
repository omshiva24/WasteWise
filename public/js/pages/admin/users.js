// Admin: approve access requests, change roles, activate / deactivate accounts.
import { h, icon } from '../../ui/dom.js';
import { avatar, btn, chip, segmented, sheet, toggle, toast, empty, skeletonList, sectionTitle, inputBox } from '../../ui/components.js';
import { userService } from '../../api/user.service.js';
import { ROLE_META, ROLES } from '../../core/constants.js';
import { state } from '../../ui/state.js';
import { pageRoot } from '../common.js';

export default function adminUsers() {
  let users = [];
  let role = 'all';
  let q = '';
  const pendingHost = h('div');
  const listHost = h('div', {}, skeletonList(5, 70));
  const seg = segmented([{ value: 'all', label: 'All' }, ...ROLES.map((r) => ({ value: r, label: ROLE_META[r].label }))], role, (v) => ((role = v), draw()));
  const search = inputBox({ iconName: 'search', type: 'search', placeholder: 'Search name or email', 'aria-label': 'Search users' });
  search.querySelector('input').addEventListener('input', (e) => ((q = e.target.value.toLowerCase()), draw()));

  async function load() {
    users = await userService.list();
    draw();
  }

  function roleSheet(u) {
    sheet({
      title: `Change role - ${u.name}`,
      subtitle: u.email,
      content: (close) => h('div', { class: 'stack-sm' }, ROLES.map((r) =>
        h('button', { type: 'button', class: `role-card ${u.role === r ? 'picked' : ''}`, style: { gridTemplateColumns: 'auto 1fr', alignItems: 'center', display: 'grid', gap: '12px' }, onclick: async () => {
          try {
            await userService.setRole(u.uid, r);
            toast(`${u.name} is now ${ROLE_META[r].label.toLowerCase()}`, 'success');
            close();
            load();
          } catch (e) {
            toast(e.message, 'error');
          }
        } }, h('span', { class: `ric bg-${ROLE_META[r].tone}` }, icon(ROLE_META[r].icon, { size: 20 })), h('span', {}, h('span', { class: 'rn' }, ROLE_META[r].label), h('br'), h('span', { class: 'rd' }, ROLE_META[r].blurb))))),
    });
  }

  function row(u) {
    const me = u.uid === state.user?.uid;
    return h('div', { class: 'urow' },
      avatar(u.name),
      h('div', { style: { minWidth: '0' } },
        h('div', { class: 'un ellipsis' }, u.name, me ? ' (you)' : ''),
        h('div', { class: 'ue ellipsis' }, u.company ? `${u.company} · ${u.email}` : u.email),
        h('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, chip(ROLE_META[u.role]?.label || u.role, ROLE_META[u.role]?.tone || 'slate', ROLE_META[u.role]?.icon), u.active === false ? chip('Deactivated', 'red', 'ban') : null)),
      h('div', { class: 'row', style: { gap: '8px' } },
        btn('', { kind: 'ghost', size: 'sm', iconName: 'user-cog', ariaLabel: `Change role for ${u.name}`, onClick: () => roleSheet(u), disabled: me }),
        me ? null : toggle(u.active !== false, async (on) => {
          try {
            await userService.setActive(u.uid, on);
            toast(on ? `${u.name} activated` : `${u.name} deactivated`, on ? 'success' : 'info');
            load();
          } catch (e) {
            toast(e.message, 'error');
          }
        }, `Account active for ${u.name}`)));
  }

  function draw() {
    const pending = users.filter((u) => u.requestedRole);
    pendingHost.replaceChildren(...(pending.length ? [sectionTitle(`Waiting for approval (${pending.length})`), h('div', { class: 'stack-sm' }, pending.map((u) =>
      h('div', { class: 'card', style: { borderColor: 'color-mix(in srgb, var(--sky) 45%, var(--line))' } },
        h('div', { class: 'row' }, avatar(u.name), h('div', { class: 'grow' }, h('div', { style: { fontWeight: '700' } }, u.name), h('div', { class: 'muted small' }, `${u.email}${u.company ? ` · ${u.company}` : ''}`)), chip(`wants ${u.requestedRole}`, ROLE_META[u.requestedRole]?.tone || 'sky', ROLE_META[u.requestedRole]?.icon)),
        h('div', { class: 'row', style: { marginTop: '12px' } },
          btn('Decline', { kind: 'ghost', block: true, onClick: async () => { await userService.decline(u.uid).catch((e) => toast(e.message, 'error')); toast('Request declined', 'info'); load(); } }),
          btn(`Approve as ${ROLE_META[u.requestedRole]?.label}`, { kind: 'primary', block: true, iconName: 'user-check', onClick: async () => { try { await userService.setRole(u.uid, u.requestedRole); toast(`${u.name} approved`, 'success'); load(); } catch (e) { toast(e.message, 'error'); } } })))))] : []));
    const list = users.filter((u) => (role === 'all' || u.role === role) && (!q || `${u.name} ${u.email} ${u.company || ''}`.toLowerCase().includes(q)));
    const counts = { all: users.length };
    for (const r of ROLES) counts[r] = users.filter((u) => u.role === r).length;
    seg.setCounts(counts);
    listHost.replaceChildren(list.length ? h('div', { class: 'stack-sm stagger' }, list.map((u, i) => {
      const r = row(u);
      r.style.setProperty('--i', String(Math.min(i, 12)));
      return r;
    })) : empty({ title: 'No users found' }));
  }

  load().catch((e) => toast(e.message, 'error'));
  return { title: 'Users & roles', el: pageRoot(pendingHost, seg, search, listHost) };
}
