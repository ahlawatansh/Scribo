import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  updateDoc,
  serverTimestamp,
  addDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/db';
import { upsertMobileLookup, upsertEmailLookup, normalizeEmail } from './mobileLookup';
import { getCurrentMonthKey } from './season';

export async function getShopOwnerEmail() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'shop'));
    if (!snap.exists()) return null;
    return snap.data().ownerEmail || null;
  } catch {
    return null;
  }
}

function providerIdForUser(user) {
  return user?.providerData?.[0]?.providerId || null;
}

async function syncFarmerIdentity(farmerId, data, user, { updateFarmer = true } = {}) {
  const authEmail = normalizeEmail(user?.email || data?.authEmail || '');
  const payload = {};
  if (user?.uid && data?.authUid !== user.uid) payload.authUid = user.uid;
  if (authEmail && data?.authEmail !== authEmail) payload.authEmail = authEmail;
  if (providerIdForUser(user)) payload.authProvider = providerIdForUser(user);

  if (updateFarmer && Object.keys(payload).length > 0) {
    await updateDoc(doc(db, 'farmers', farmerId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  }

  const mobile = data?.mobile || null;
  if (mobile) {
    await upsertMobileLookup(mobile, {
      farmerId,
      authUid: user?.uid || data?.authUid || null,
      authEmail,
    });
  }

  return {
    ...data,
    ...payload,
    authEmail: authEmail || data?.authEmail || null,
    authUid: user?.uid || data?.authUid || null,
  };
}

async function farmerResultFromId(farmerId, user, fallbackMobile = null) {
  const farmerSnap = await getDoc(doc(db, 'farmers', farmerId));
  if (!farmerSnap.exists()) return null;
  let data = farmerSnap.data();
  try {
    data = await syncFarmerIdentity(farmerId, data, user);
  } catch {

  }
  return {
    role: 'farmer',
    farmerId,
    farmerData: { ...data, mobile: data.mobile || fallbackMobile || null },
    farmerMobile: data.mobile || fallbackMobile,
  };
}

export async function resolveRoleForUser(user) {
  if (!user) return { role: null, farmerId: null, farmerData: null, farmerMobile: null };
  const userEmail = normalizeEmail(user.email || '');

  try {
    const ownerEmail = normalizeEmail(await getShopOwnerEmail());
    if (ownerEmail && userEmail === ownerEmail) {
      return { role: 'shop', farmerId: null, farmerData: null, farmerMobile: null };
    }
  } catch {

  }

  try {
    const byUid = await getDocs(
      query(collection(db, 'farmers'), where('authUid', '==', user.uid), limit(1))
    );
    if (!byUid.empty) {
      const d = byUid.docs[0];
      const result = await farmerResultFromId(d.id, user);
      if (result) return result;
    }
  } catch {

  }

  if (userEmail) {
    try {
      const emailLookup = await getDoc(doc(db, 'email_lookup', userEmail));
      if (emailLookup.exists() && emailLookup.data().farmerId) {
        const result = await farmerResultFromId(emailLookup.data().farmerId, user, emailLookup.data().mobile);
        if (result) return result;
      }
    } catch {

    }
  }

  if (userEmail) {
    try {
      const byEmail = await getDocs(
        query(collection(db, 'farmers'), where('authEmail', '==', userEmail), limit(1))
      );
      if (!byEmail.empty) {
        const d = byEmail.docs[0];
        const result = await farmerResultFromId(d.id, user);
        if (result) return result;
      }
    } catch {

    }
  }

  try {
    const byLookup = await getDocs(
      query(collection(db, 'mobile_lookup'), where('authUid', '==', user.uid), limit(1))
    );
    if (!byLookup.empty) {
      const lookup = byLookup.docs[0].data();
      if (lookup.farmerId) {
        const result = await farmerResultFromId(lookup.farmerId, user, lookup.mobile);
        if (result) return result;
      }
    }
  } catch {

  }

  return { role: null, farmerId: null, farmerData: null, farmerMobile: null };
}

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || 'Farmer', lastName: parts.slice(1).join(' ') };
}

async function linkFarmerByMobileClient(user, mobile, fullName = '') {
  const { firstName, lastName } = splitName(fullName);
  const authEmail = normalizeEmail(user?.email || '');

  try {
    const ownedSnap = await getDocs(
      query(collection(db, 'farmers'), where('authUid', '==', user.uid), limit(1))
    );
    if (!ownedSnap.empty) {
      const owned = ownedSnap.docs[0].data();
      if (owned.mobile && owned.mobile !== mobile) {
        throw new Error('This account is already linked with another mobile number.');
      }
    }
  } catch (e) {
    if (e.message && e.message.includes('already linked')) throw e;

  }

  if (authEmail) {
    try {
      const emailLookup = await getDoc(doc(db, 'email_lookup', authEmail));
      if (emailLookup.exists()) {
        const linked = emailLookup.data();
        if (linked.mobile && linked.mobile !== mobile) {
          throw new Error('This Google/email account is already linked with another mobile number.');
        }
      }
    } catch (e) {
      if (e.message && e.message.includes('already linked')) throw e;

    }
  }

  const lookupRef = doc(db, 'mobile_lookup', mobile);
  let lookupSnap;
  try {
    lookupSnap = await getDoc(lookupRef);
  } catch {
    throw new Error(
      'Unable to verify mobile. Make sure the shop has registered this mobile number, and that Firestore rules are deployed.'
    );
  }

  if (lookupSnap.exists()) {
    const lookup = lookupSnap.data();
    if (lookup.authUid && lookup.authUid !== user.uid) {
      throw new Error('This mobile is already linked to another account.');
    }

    const farmerId = lookup.farmerId;
    if (!farmerId) {
      throw new Error('Mobile record is incomplete. Ask the shop to add this mobile again.');
    }

    try {
      await updateDoc(doc(db, 'farmers', farmerId), {
        authUid: user.uid,
        authEmail: authEmail || null,
        authProvider: providerIdForUser(user),
        firstName: firstName || lookup.firstName || 'Farmer',
        lastName: lastName || lookup.lastName || '',
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      const msg = e?.message || '';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        throw new Error(
          'Permission denied updating farmer record. Please ask the shop owner to deploy Firestore security rules (see FIREBASE_CONSOLE_SETUP.md).'
        );
      }
      throw e;
    }

    try {
      await setDoc(
        lookupRef,
        {
          mobile,
          farmerId,
          authUid: user.uid,
          authEmail: authEmail || lookup.authEmail || null,
          linkedEmail: authEmail || lookup.authEmail || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to update mobile_lookup:', e);
      throw e;
    }

    const farmerSnap = await getDoc(doc(db, 'farmers', farmerId));
    const farmerData = farmerSnap.exists() ? farmerSnap.data() : { mobile, firstName, lastName };

    return {
      farmerId,
      farmerData: {
        ...farmerData,
        mobile: farmerData.mobile || mobile,
        authUid: user.uid,
        authEmail: authEmail || null,
        authProvider: providerIdForUser(user),
      },
    };
  }

  try {
    const created = await addDoc(collection(db, 'farmers'), {
      mobile,
      firstName,
      lastName,
      address: '',
      creditScore: null,
      suggestedLimit: 0,
      totalOutstanding: 0,
      totalUdharGiven: 0,
      totalPaid: 0,
      season: getCurrentMonthKey(),
      authUid: user.uid,
      authEmail: authEmail || null,
      authProvider: providerIdForUser(user),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await upsertMobileLookup(mobile, {
      farmerId: created.id,
      authUid: user.uid,
      authEmail: authEmail || null,
    });

    const farmerSnap = await getDoc(doc(db, 'farmers', created.id));

    return {
      farmerId: created.id,
      farmerData: farmerSnap.exists()
        ? { ...farmerSnap.data(), mobile, authUid: user.uid, authEmail: authEmail || null }
        : { mobile, firstName, lastName, authUid: user.uid, authEmail: authEmail || null },
    };
  } catch (e) {
    const msg = e?.message || '';
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
      throw new Error(
        'Permission denied creating farmer record. Your mobile may not be registered by the shop yet. Ask the shop owner to add your mobile number first, then try again.'
      );
    }
    throw e;
  }
}

export async function linkFarmerByMobile(user, mobile, fullName = '') {
  return linkFarmerByMobileClient(user, mobile, fullName);
}

export async function findLinkedEmailByMobile(mobile) {
  try {
    const mobileLookupSnap = await getDocs(
      query(collection(db, 'mobile_lookup'), where('mobile', '==', mobile), limit(1))
    );

    if (!mobileLookupSnap.empty) {
      const mobileDoc = mobileLookupSnap.docs[0];
      const data = mobileDoc.data();
      const email = data.authEmail || data.linkedEmail || null;
      if (email) {
        return email;
      }
    }
  } catch (e) {
    console.error('Error finding linked email by mobile (mobile_lookup):', e);
  }

  try {
    const emailLookupSnap = await getDocs(
      query(collection(db, 'email_lookup'), where('mobile', '==', mobile), limit(1))
    );
    if (!emailLookupSnap.empty) {
      const emailDoc = emailLookupSnap.docs[0];
      const email = emailDoc.id;
      return email;
    }
  } catch (e) {
    console.error('Error finding linked email by mobile (email_lookup):', e);
  }

  try {
    const farmerSnap = await getDocs(
      query(collection(db, 'farmers'), where('mobile', '==', mobile), limit(1))
    );
    if (!farmerSnap.empty) {
      const farmerDoc = farmerSnap.docs[0];
      const farmerData = farmerDoc.data();
      const email = farmerData.authEmail || null;
      if (email) return email;
    }
  } catch (e) {
    console.error('Error finding linked email by mobile (farmers):', e);
  }

  return null;
}

export async function findLinkedMobileByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  try {
    const lookup = await getDoc(doc(db, 'email_lookup', normalizedEmail));
    if (!lookup.exists()) return null;
    return lookup.data().mobile || null;
  } catch {
    return null;
  }
}
