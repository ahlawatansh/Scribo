import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './db';
import { alert } from '../utils/alert';
import { STORE_ACCOUNT_NAME } from '../utils/constants';

let registrationStarted = false;
let latestRegistrationContext = null;

function tokenDocId(uid, token) {
  const safeToken = btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${uid}_${safeToken.slice(0, 80)}`;
}

async function savePushToken({ token, user, role, farmerId }) {
  if (!token || !user?.uid || !role) return;

  await setDoc(
    doc(db, 'pushTokens', tokenDocId(user.uid, token)),
    {
      token,
      uid: user.uid,
      email: user.email || null,
      role,
      farmerId: farmerId || null,
      platform: Capacitor.getPlatform(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function registerPushNotifications({ user, role, farmerId }) {
  if (!Capacitor.isNativePlatform() || !user?.uid || !role) return;
  latestRegistrationContext = { user, role, farmerId };

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== 'granted') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return;

  if (!registrationStarted) {
    registrationStarted = true;

    await PushNotifications.addListener('registration', async ({ value }) => {
      try {
        await savePushToken({ token: value, ...latestRegistrationContext });
      } catch (error) {
        console.error('Push token save failed:', error);
      }
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const title = notification?.title || STORE_ACCOUNT_NAME;
      const body = notification?.body || 'New account update received.';
      alert.success(`${title}: ${body}`, { id: `push:${notification?.id || Date.now()}` });
    });
  }

  await PushNotifications.register();
}
