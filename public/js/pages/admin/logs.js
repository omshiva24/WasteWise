// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Admin: audit log of every action, grouped by day.
import { h, icon } from '../../ui/dom.js';
import { inputBox, empty, skeletonList, toast } from '../../ui/components.js';
import { logService } from '../../api/request.service.js';
import { fmtDate } from '../../core/format.js';
import { pageRoot } from '../common.js';

const KIND = {
  'request.create': ['clipboard-list', 'amber', 'raised'],
  'request.accept': ['truck', 'sky', 'accepted'],
  'request.complete': ['circle-check', 'emerald', 'completed'],
  'request.cancel': ['ban', 'slate', 'cancelled'],
  'request.release': ['undo-2', 'amber', 'released'],
  'request.overdue': ['triangle-alert', 'red', 'flagged overdue'],
  'user.signup': ['user-plus', 'violet', 'signed up'],
  'user.role': ['user-cog', 'violet', 'changed role of'],
  'user.activate': ['user-check', 'emerald', 'activated'],
  'user.deactivate': ['ban', 'red', 'deactivated'],
  'user.decline': ['x', 'slate', 'declined'],
  'bin.save': ['qr-code', 'sky', 'saved bin'],
  'bin.delete': ['trash', 'red', 'deleted bin'],
  'auth.signin': ['log-out', 'slate', 'signed in'],
  'auth.signout': ['log-out', 'slate', 'signed out'],
};

export default function adminLogs() {
  const host = h('div', {}, skeletonList(6, 56));
  let logs = [];
  let q = '';
  const search = inputBox({ iconName: 'search', type: 'search', placeholder: 'Search people, codes, actions…', 'aria-label': 'Search the audit log' });
  search.querySelector('input').addEventListener('input', (e) => ((q = e.target.value.toLowerCase()), draw()));

  function draw() {
    const list = logs.filter((l) => !q || `${l.actorName} ${l.action} ${l.target} ${l.detail}`.toLowerCase().includes(q));
    if (!list.length) return host.replaceChildren(empty({ title: 'Nothing logged', text: 'Actions show up here as people use the app.' }));
    const out = [];
    let day = '';
    list.forEach((l) => {
      const d = fmtDate(l.at, { weekday: 'short', day: 'numeric', month: 'short' });
      if (d !== day) {
        day = d;
        out.push(h('div', { class: 'day-label' }, d));
      }
      const [ic, tone, verb] = KIND[l.action] || ['activity', 'slate', l.action];
      out.push(h('div', { class: 'logi' }, h('div', { class: `lb bg-${tone}` }, icon(ic, { size: 17 })), h('div', {},
        h('div', { style: { fontSize: '0.9rem' } }, h('b', l.actorName || 'Someone'), ` ${verb} `, h('b', l.target || '')),
        h('div', { class: 'muted small' }, `${new Date(l.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}${l.detail ? ` · ${l.detail}` : ''}`))));
    });
    host.replaceChildren(h('div', { class: 'card' }, out));
  }

  logService.list(300).then((x) => ((logs = x), draw())).catch((e) => toast(e.message, 'error'));
  return { title: 'Audit log', sub: 'Who did what, and when', back: true, el: pageRoot(search, host) };
}
