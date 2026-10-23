// WasteWise Cloud Functions (Firebase, Node 20).
//  - onRequestWrite: in-app notification + push (FCM) on every status change
//  - flagOverdueRequests: every 6 hours, flags requests still OPEN / ACCEPTED after 7 days
//    and alerts admins, the supervisor and the vendor.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();
const db = getFirestore();
const OVERDUE_MS = 7 * 24 * 60 * 60 * 1000;
const REGION = 'asia-south1';

async function uidsByRole(role) {
  const snap = await db.collection('users').where('role', '==', role).where('active', '==', true).get();
  return snap.docs.map((d) => d.id);
}

/** Store an in-app notification for each user and send a push to their devices. */
async function notify(uids, { title, body, requestId = null, kind = 'info' }) {
  const to = [...new Set(uids.filter(Boolean))];
  if (!to.length) return;
  const now = Date.now();
  const batch = db.batch();
  for (const uid of to) batch.set(db.collection('notifications').doc(), { to: uid, title, body, requestId, kind, at: now, read: false });
  await batch.commit();

  const users = await Promise.all(to.map((uid) => db.doc(`users/${uid}`).get()));
  const owners = [];
  const tokens = [];
  users.forEach((u) => (u.get('fcmTokens') || []).forEach((t) => (tokens.push(t), owners.push(u.ref))));
  if (!tokens.length) return;
  for (let i = 0; i < tokens.length; i += 500) {
    const slice = tokens.slice(i, i + 500);
    const res = await getMessaging().sendEachForMulticast({
      tokens: slice,
      notification: { title, body },
      data: { requestId: requestId || '', kind },
      android: { priority: 'high', notification: { channelId: 'pickups', color: '#059669' } },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    // Remove tokens of uninstalled apps.
    await Promise.all(res.responses.map((r, k) => {
      const code = r.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        return owners[i + k].update({ fcmTokens: FieldValue.arrayRemove(slice[k]) }).catch(() => {});
      }
      return null;
    }));
  }
}

export const onRequestWrite = onDocumentWritten({ document: 'requests/{id}', region: REGION }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after) return;
  const id = event.params.id;
  const code = after.code || id;

  if (!before) {
    const vendors = await uidsByRole('vendor');
    await notify(vendors, { title: after.priority === 'urgent' ? 'Urgent pickup nearby' : 'New pickup nearby', body: `${code} - ${after.location}`, requestId: id, kind: 'new' });
    return;
  }
  if (before.status === after.status) return;

  switch (after.status) {
    case 'ACCEPTED':
      await notify([after.createdBy], { title: 'Pickup accepted', body: `${after.vendorName} accepted ${code}`, requestId: id, kind: 'accepted' });
      break;
    case 'COMPLETED':
      await notify([after.vendorId], { title: 'Handover confirmed', body: `${code}: ${after.weightKg} kg handed over${after.rating ? ` - rated ${after.rating}/5` : ''}`, requestId: id, kind: 'completed' });
      break;
    case 'OPEN': {
      // released by the vendor
      const vendors = (await uidsByRole('vendor')).filter((v) => v !== before.vendorId);
      await notify([after.createdBy], { title: 'Pickup released', body: `${code} is open again`, requestId: id, kind: 'released' });
      await notify(vendors, { title: 'Pickup available again', body: `${code} - ${after.location}`, requestId: id, kind: 'new' });
      break;
    }
    case 'CANCELLED':
      if (before.vendorId) await notify([before.vendorId], { title: 'Request cancelled', body: `${code} was cancelled`, requestId: id, kind: 'cancelled' });
      break;
    default:
      break;
  }
});

export const flagOverdueRequests = onSchedule({ schedule: 'every 6 hours', timeZone: 'Asia/Kolkata', region: REGION }, async () => {
  const cutoff = Date.now() - OVERDUE_MS;
  const admins = await uidsByRole('admin');
  let flagged = 0;
  for (const status of ['OPEN', 'ACCEPTED']) {
    const snap = await db.collection('requests').where('status', '==', status).where('createdAt', '<', cutoff).get();
    for (const doc of snap.docs) {
      const r = doc.data();
      if (r.overdue) continue;
      await doc.ref.update({ overdue: true, overdueAt: Date.now() });
      const body = `${r.code} at ${r.location} has waited more than 7 days`;
      await notify([...admins, r.createdBy], { title: 'Request overdue', body, requestId: doc.id, kind: 'overdue' });
      if (r.vendorId) await notify([r.vendorId], { title: 'Pickup overdue', body, requestId: doc.id, kind: 'overdue' });
      await db.collection('logs').add({ at: Date.now(), actor: 'system', actorName: 'Overdue check', action: 'request.overdue', target: r.code, detail: 'Flagged after 7 days' });
      flagged += 1;
    }
  }
  logger.info(`Overdue check: flagged ${flagged} request(s)`);
});
