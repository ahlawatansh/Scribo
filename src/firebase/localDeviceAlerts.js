import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './db';
import { alert } from '../utils/alert';
import { formatCurrency } from '../utils/formatCurrency';
import { STORE_ACCOUNT_NAME } from '../utils/constants';

let activeKey = null;
let unsubscribeAll = null;
let listenersReady = false;

function numericId(value) {
  const text = String(value || Date.now());
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 2147483647);
}

function toMillis(value) {
  if (!value) return Date.now();
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

async function ensureLocalNotifications() {
  if (!Capacitor.isNativePlatform()) return false;

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== 'granted') return false;

  if (!listenersReady) {
    listenersReady = true;
    await LocalNotifications.createChannel({
      id: 'account-alerts',
      name: 'Account Alerts',
      description: 'Payment and customer account alerts',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    }).catch(() => {});
  }

  return true;
}

async function showDeviceAlert({ id, title, body }) {
  if (!title && !body) return;

  if (await ensureLocalNotifications()) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: numericId(id),
          title: title || STORE_ACCOUNT_NAME,
          body: body || 'New account update received.',
          channelId: 'account-alerts',
        },
      ],
    }).catch((error) => {
      console.error('Local notification failed:', error);
    });
    return;
  }

  alert.success(`${title || STORE_ACCOUNT_NAME}: ${body || 'New account update received.'}`, { id: `local:${id}` });
}

function saveLastSeen(key, millis) {
  try {
    localStorage.setItem(`kk_alert_seen_${key}`, String(millis));
  } catch {  }
}

function readLastSeen(key) {
  try {
    return Number(localStorage.getItem(`kk_alert_seen_${key}`) || 0);
  } catch {
    return 0;
  }
}

function watchNotificationDocs({ role, farmerId }) {
  const streamKey = role === 'shop' ? 'shop_notifications' : `farmer_notifications_${farmerId}`;
  let lastSeen = readLastSeen(streamKey);
  let initialized = Boolean(lastSeen);
  const q =
    role === 'shop'
      ? query(collection(db, 'notifications'), where('read', '==', false))
      : query(collection(db, 'notifications'), where('farmerId', '==', farmerId));

  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      if (!initialized) {
        initialized = true;
        saveLastSeen(streamKey, now);
        lastSeen = now;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data() || {};
        const createdAt = toMillis(data.createdAt);
        if (createdAt <= lastSeen) return;

        showDeviceAlert({
          id: `${role}-notification-${change.doc.id}`,
          title: role === 'farmer' ? data.customerTitle || data.farmerTitle || data.title : data.title,
          body: role === 'farmer' ? data.customerMessage || data.farmerMessage || data.message : data.message,
        });
      });

      lastSeen = now;
      saveLastSeen(streamKey, now);
    },
    (error) => console.error('Notification alert listener failed:', error)
  );
}

function watchFarmerTransactions(farmerId) {
  const streamKey = `farmer_transactions_${farmerId}`;
  let lastSeen = readLastSeen(streamKey);
  let initialized = Boolean(lastSeen);
  const previous = new Map();

  return onSnapshot(
    query(collection(db, 'transactions'), where('farmerId', '==', farmerId)),
    (snap) => {
      const now = Date.now();

      snap.docChanges().forEach((change) => {
        const data = change.doc.data() || {};
        const id = change.doc.id;
        const prior = previous.get(id);
        previous.set(id, data);

        if (!initialized) return;

        if (change.type === 'added') {
          const createdAt = toMillis(data.createdAt);
          if (createdAt <= lastSeen) return;
          const amount = formatCurrency(data.remainingAmount || data.grandTotal || 0);
          showDeviceAlert({
            id: `txn-added-${id}`,
            title: data.type === 'credit' ? 'New due added' : 'Payment recorded',
            body:
              data.type === 'credit'
                ? `${amount} has been added to your ${STORE_ACCOUNT_NAME}.`
                : `${amount} payment was recorded in your account.`,
          });
        }

        if (change.type === 'modified' && prior) {
          const wasCleared = prior.status === 'cleared' || Number(prior.remainingAmount || 0) === 0;
          const isCleared = data.status === 'cleared' || Number(data.remainingAmount || 0) === 0;
          if (!wasCleared && isCleared) {
            showDeviceAlert({
              id: `txn-cleared-${id}`,
              title: 'Dues cleared',
              body: `${formatCurrency(prior.remainingAmount || data.grandTotal || 0)} was cleared in your ${STORE_ACCOUNT_NAME}.`,
            });
          }
        }
      });

      if (!initialized) initialized = true;
      lastSeen = now;
      saveLastSeen(streamKey, now);
    },
    (error) => console.error('Transaction alert listener failed:', error)
  );
}

export async function registerLocalDeviceAlerts({ user, role, farmerId }) {
  if (!user?.uid || !role) return;
  if (role === 'farmer' && !farmerId) return;

  const nextKey = `${user.uid}:${role}:${farmerId || 'shop'}`;
  if (activeKey === nextKey) return;

  unsubscribeAll?.();
  activeKey = nextKey;

  const unsubscribers = [];
  unsubscribers.push(watchNotificationDocs({ role, farmerId }));
  if (role === 'farmer') unsubscribers.push(watchFarmerTransactions(farmerId));

  unsubscribeAll = () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  };

  await ensureLocalNotifications();
}

export function stopLocalDeviceAlerts() {
  unsubscribeAll?.();
  unsubscribeAll = null;
  activeKey = null;
}
