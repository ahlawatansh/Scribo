import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './db';

const relayUrl = import.meta.env.VITE_PUSH_RELAY_URL || '';

async function getFarmerDeviceTokens(farmerId) {
  if (!farmerId) return [];
  const snap = await getDocs(query(collection(db, 'pushTokens'), where('farmerId', '==', farmerId)));
  return [...new Set(snap.docs.map((doc) => doc.data()?.token).filter(Boolean))];
}

export async function sendCustomerPushAlert({ farmerId, title, body, data = {} }) {
  if (!relayUrl || !farmerId || !title || !body) return;

  try {
    const tokens = await getFarmerDeviceTokens(farmerId);
    if (!tokens.length) return;

    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;

    const response = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        tokens,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries({ source: 'shop-app', ...data }).map(([key, value]) => [key, String(value ?? '')])
        ),
      }),
    });

    if (!response.ok) {
      console.warn('Push relay failed:', await response.text());
    }
  } catch (error) {
    console.warn('Customer push alert skipped:', error);
  }
}
