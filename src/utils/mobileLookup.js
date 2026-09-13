import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/db';

export function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

function withoutUndefined(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

export async function upsertMobileLookup(mobile, { farmerId, authUid = undefined, authEmail = undefined } = {}) {
  if (!mobile || !farmerId) return;
  const normalizedEmail = authEmail ? normalizeEmail(authEmail) : null;
  await setDoc(
    doc(db, 'mobile_lookup', mobile),
    withoutUndefined({
      mobile,
      farmerId,
      authUid,
      authEmail: normalizedEmail,
      linkedEmail: normalizedEmail,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}

export async function upsertEmailLookup(authEmail, { farmerId, mobile = undefined, authUid = undefined } = {}) {
  const normalizedEmail = normalizeEmail(authEmail);
  if (!normalizedEmail || !farmerId) return;
  await setDoc(
    doc(db, 'email_lookup', normalizedEmail),
    withoutUndefined({
      authEmail: normalizedEmail,
      farmerId,
      mobile,
      authUid,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}
