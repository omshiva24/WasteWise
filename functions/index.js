// WasteWise Cloud Functions (OPTIONAL - needs the Firebase Blaze plan; the app works without them).
//  - pushOnNotification: sends every in-app notification to the person's phone (FCM push)
//  - alertVendorsOnNewRequest: tells every vendor when a new pickup is raised
//  - flagOverdueRequests: every 6 hours, flags requests still OPEN / ACCEPTED after 7 days
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();
const db = getFirestore();
const OVERDUE_MS = 7 * 24 * 60 * 60 * 1000;
const REGION = 'asia-south1';

async function uidsByRole(role) {
  const snap = await db.collection('users').where('role', '==', role).get();
  return snap.docs.filter((d) => d.get('active') !== false).map((d) => d.id);
}

/** Store in-app notifications (each one is then pushed by pushOnNotification). */
async function notify(uids, { title, body, requestId = null, kind = 'info' }) {
  const to = [...new Set(uids.filter(Boolean))];
  if (!to.length) return;
  const batch = db.batch();
  for (const uid of to) batch.set(db.collection('notifications').doc(), { to: uid, from: 'system', title, body, requestId, kind, at: Date.now(), read: false });
  await batch.commit();
}

export const pushOnNotification = onDocumentCreated({ document: 'notifications/{id}', region: REGION }, async (event) => {
  const n = event.data?.data();
  if (!n?.to) return;
  const user = await db.doc(`users/${n.to}`).get();
  const tokens = user.get('fcmTokens') || [];
  if (!tokens.length) return;
  const res = await getMessaging().sendEachForMulticast({
    tokens: tokens.slice(0, 500),
    notification: { title: n.title, body: n.body },
    data: { requestId: n.requestId || '', kind: n.kind || 'info' },
    android: { priority: 'high', notification: { channelId: 'pickups', color: '#059669' } },
    apns: { payload: { aps: { sound: 'default' } } },
  });
  // Remove tokens of uninstalled apps.
  const dead = res.responses.map((r, i) => (/registration-token-not-registered|invalid-argument/.test(r.error?.code || '') ? tokens[i] : null)).filter(Boolean);
  if (dead.length) await user.ref.update({ fcmTokens: FieldValue.arrayRemove(...dead) });
});

export const alertVendorsOnNewRequest = onDocumentCreated({ document: 'requests/{id}', region: REGION }, async (event) => {
  const r = event.data?.data();
  if (!r) return;
  const vendors = await uidsByRole('vendor');
  await notify(vendors, { title: r.priority === 'urgent' ? 'Urgent pickup nearby' : 'New pickup nearby', body: `${r.code} - ${r.location}`, requestId: event.params.id, kind: 'new' });
});

export const flagOverdueRequests = onSchedule({ schedule: 'every 6 hours', timeZone: 'Asia/Kolkata', region: REGION }, async () => {
  const cutoff = Date.now() - OVERDUE_MS;
  const admins = await uidsByRole('admin');
  let flagged = 0;
  for (const status of ['OPEN', 'ACCEPTED']) {
    const snap = await db.collection('requests').where('status', '==', status).get();
    for (const doc of snap.docs) {
      const r = doc.data();
      if (r.overdue || r.createdAt >= cutoff) continue;
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
