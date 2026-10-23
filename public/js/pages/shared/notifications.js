// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Notification centre (live).
import { h, icon } from '../../ui/dom.js';
import { btn, empty } from '../../ui/components.js';
import { notificationService } from '../../api/request.service.js';
import { timeAgo } from '../../core/format.js';
import { state, onState } from '../../ui/state.js';
import { pageRoot } from '../common.js';
import { DAY } from '../../core/constants.js';

const KIND = { new: ['truck', 'sky'], accepted: ['truck', 'sky'], completed: ['circle-check', 'emerald'], overdue: ['triangle-alert', 'red'], role: ['user-check', 'violet'], released: ['undo-2', 'amber'], cancelled: ['ban', 'slate'], info: ['bell', 'slate'] };

export default function notifications({ navigate }) {
  const host = h('div');
  const markAll = btn('Mark all read', { kind: 'ghost', size: 'sm', iconName: 'check-check', onClick: () => notificationService.markAllRead() });
  function draw() {
    const list = state.notifications;
    markAll.classList.toggle('hide', !state.unread);
    if (!list.length) return host.replaceChildren(empty({ artName: 'bell', title: 'No notifications yet', text: 'Updates about your pickups will appear here.' }));
    const today = list.filter((n) => Date.now() - n.at < DAY);
    const earlier = list.filter((n) => Date.now() - n.at >= DAY);
    const item = (n, i) => {
      const [ic, tone] = KIND[n.kind] || KIND.info;
      return h('div', { class: `notif ${n.read ? '' : 'unread'}`, style: { '--i': String(Math.min(i, 12)) }, role: 'button', tabindex: '0', onclick: () => {
        notificationService.markRead(n.id);
        if (n.requestId && state.user?.role !== 'member') navigate(`/request/${n.requestId}`);
        else if (n.kind === 'role') navigate(state.user?.role === 'admin' ? '/admin/users' : '/me');
      } }, h('div', { class: `nb bg-${tone}` }, icon(ic, { size: 20 })), h('div', {}, h('div', { class: 'nt' }, n.title), h('div', { class: 'nd' }, n.body), h('div', { class: 'muted small' }, timeAgo(n.at))), n.read ? h('span') : h('span', { class: 'dot', 'aria-label': 'unread' }));
    };
    host.replaceChildren(
      today.length ? h('div', { class: 'day-label' }, 'Today') : '', today.length ? h('div', { class: 'stack-sm stagger' }, today.map(item)) : '',
      earlier.length ? h('div', { class: 'day-label' }, 'Earlier') : '', earlier.length ? h('div', { class: 'stack-sm stagger' }, earlier.slice(0, 40).map(item)) : '');
  }
  draw();
  const off = onState(draw);
  return { title: 'Notifications', back: true, el: pageRoot(h('div', { class: 'row between' }, h('span', { class: 'muted small' }, 'Live updates about pickups'), markAll), host), destroy: off };
}
