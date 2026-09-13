const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Razorpay = require('razorpay');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const STORE_ACCOUNT_NAME = 'Shyam Agriculture Store Account';

const razorpay = new Razorpay({
  key_id: functions.config().razorpay?.key_id || '',
  key_secret: functions.config().razorpay?.key_secret || '',
});

function allowCors(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

function formatInr(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
}

function chunk(items, size = 500) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function sendToTokens(tokens, notification, data = {}) {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (!uniqueTokens.length) return;

  await Promise.all(
    chunk(uniqueTokens).map((tokenChunk) =>
      admin.messaging().sendEachForMulticast({
        tokens: tokenChunk,
        notification,
        data: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value ?? '')])
        ),
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
          },
        },
      })
    )
  );
}

async function getFarmerTokens(farmerId) {
  if (!farmerId) return [];
  const snap = await db.collection('pushTokens').where('farmerId', '==', farmerId).get();
  return snap.docs.map((doc) => doc.data().token);
}

async function getShopTokens() {
  const snap = await db.collection('pushTokens').where('role', '==', 'shop').get();
  return snap.docs.map((doc) => doc.data().token);
}

function notificationDataPayload(notification, notificationId, recipientRole) {
  return {
    type: notification.type || 'notification',
    notificationId,
    farmerId: notification.farmerId || '',
    recipientRole,
  };
}

exports.createCustomTokenFromIdToken = functions.https.onRequest(async (req, res) => {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const idToken = req.body?.idToken;
    if (!idToken) {
      res.status(400).json({ error: 'Missing idToken' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const customToken = await admin.auth().createCustomToken(decoded.uid);
    res.json({ customToken });
  } catch (error) {
    console.error('createCustomTokenFromIdToken failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

async function setCustomClaims(uid, claims) {
  await admin.auth().setCustomUserClaims(uid, claims);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function authProviderForContext(context) {
  return context.auth?.token?.firebase?.sign_in_provider || null;
}

async function upsertIdentityLookups({ mobile, farmerId, uid, email }) {
  const normalizedEmail = normalizeEmail(email);
  await db.collection('mobile_lookup').doc(mobile).set(
    {
      mobile,
      farmerId,
      authUid: uid || null,
      authEmail: normalizedEmail || null,
      linkedEmail: normalizedEmail || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (normalizedEmail) {
    await db.collection('email_lookup').doc(normalizedEmail).set(
      {
        authEmail: normalizedEmail,
        farmerId,
        mobile,
        authUid: uid || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}

function getCurrentSeasonKey(date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month >= 5 && month <= 9) return `${year}_kharif`;
  if (month === 10 || month === 11 || (month >= 0 && month <= 2)) return `${year}_rabi`;
  return `${year}_zaid`;
}

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || 'Farmer', lastName: parts.slice(1).join(' ') };
}

exports.linkFarmerAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not logged in');

  const { mobile, fullName = '' } = data || {};
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid mobile number');
  }

  const uid = context.auth.uid;
  const email = normalizeEmail(context.auth.token.email || null);
  const { firstName, lastName } = splitName(fullName);

  const ownedSnap = await db.collection('farmers').where('authUid', '==', uid).limit(1).get();
  if (!ownedSnap.empty) {
    const owned = ownedSnap.docs[0].data();
    if (owned.mobile && owned.mobile !== mobile) {
      throw new functions.https.HttpsError(
        'already-exists',
        'This account is already linked with another mobile number.'
      );
    }
  }

  const lookupRef = db.collection('mobile_lookup').doc(mobile);
  const lookupSnap = await lookupRef.get();
  let farmerId = null;

  if (lookupSnap.exists) {
    const lookup = lookupSnap.data();
    if (lookup.authUid && lookup.authUid !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'This mobile is already linked to another account.');
    }
    farmerId = lookup.farmerId || null;
  }

  if (!farmerId) {
    const byMobileSnap = await db.collection('farmers').where('mobile', '==', mobile).limit(1).get();
    if (!byMobileSnap.empty) {
      farmerId = byMobileSnap.docs[0].id;
    }
  }

  if (farmerId) {
    const farmerRef = db.collection('farmers').doc(farmerId);
    const existing = (await farmerRef.get()).data() || {};
    await farmerRef.set(
      {
        authUid: uid,
        authEmail: email || null,
        authProvider: authProviderForContext(context),
        firstName: firstName || existing.firstName || 'Farmer',
        lastName: lastName || existing.lastName || '',
        mobile: existing.mobile || mobile,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (!ownedSnap.empty && ownedSnap.docs[0].id !== farmerId) {
      await db.collection('farmers').doc(ownedSnap.docs[0].id).update({
        authUid: admin.firestore.FieldValue.delete(),
        authEmail: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } else {
    const created = await db.collection('farmers').add({
      mobile,
      firstName,
      lastName,
      address: '',
      creditScore: null,
      suggestedLimit: 0,
      totalOutstanding: 0,
      totalUdharGiven: 0,
      totalPaid: 0,
      season: getCurrentSeasonKey(),
      authUid: uid,
      authEmail: email || null,
      authProvider: authProviderForContext(context),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    farmerId = created.id;
  }

  await upsertIdentityLookups({ mobile, farmerId, uid, email });

  const farmerData = (await db.collection('farmers').doc(farmerId).get()).data() || {};

  return {
    farmerId,
    farmerData: {
      ...farmerData,
      mobile: farmerData.mobile || mobile,
      authUid: uid,
      authEmail: email || null,
      authProvider: authProviderForContext(context),
    },
  };
});

exports.verifyShopKeyAndSetClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not logged in');
  const { securityKey } = data || {};
  if (securityKey !== '123456') throw new functions.https.HttpsError('permission-denied', 'Invalid security key');
  await setCustomClaims(context.auth.uid, { role: 'shop' });
  return { ok: true };
});

exports.setFarmerMobileClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not logged in');
  const { mobile } = data || {};
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) throw new functions.https.HttpsError('invalid-argument', 'Invalid mobile number');

  const farmerSnap = await db
    .collection('farmers')
    .where('mobile', '==', mobile)
    .limit(1)
    .get();

  if (farmerSnap.empty) throw new functions.https.HttpsError('not-found', 'Farmer not found for this mobile');

  const farmerDoc = farmerSnap.docs[0];
  const farmer = farmerDoc.data();
  const uid = context.auth.uid;
  const email = normalizeEmail(context.auth.token.email || null);
  if (farmer.authUid && farmer.authUid !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'This email is not linked to this mobile');
  }

  await db.collection('farmers').doc(farmerDoc.id).set(
    {
      authUid: uid,
      authEmail: email || farmer.authEmail || null,
      authProvider: authProviderForContext(context),
      mobile: farmer.mobile || mobile,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await upsertIdentityLookups({ mobile, farmerId: farmerDoc.id, uid, email: email || farmer.authEmail || null });

  await setCustomClaims(uid, { role: 'farmer', farmerMobile: mobile });
  return { ok: true, farmerId: farmerDoc.id };
});

exports.createRazorpayOrder = functions.https.onCall(async (data) => {
  const amount = data.amount;
  const order = await razorpay.orders.create({ amount, currency: 'INR' });
  return { orderId: order.id, amount: order.amount, currency: order.currency };
});

exports.verifyAndRecordPayment = functions.https.onCall(async (data) => {
  const signature = crypto
    .createHmac('sha256', functions.config().razorpay?.webhook_secret || '')
    .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
    .digest('hex');
  if (signature !== data.razorpaySignature) throw new functions.https.HttpsError('permission-denied', 'Invalid signature');
  await db.collection('payments').add({
    amount: data.amount,
    farmerId: data.farmerId,
    method: 'upi',
    razorpayPaymentId: data.razorpayPaymentId,
    razorpayOrderId: data.razorpayOrderId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

exports.sendManualReminder = functions.https.onCall(async () => ({ ok: true }));
exports.sendPurchaseReceipt = functions.https.onCall(async () => ({ ok: true }));
exports.sendPaymentConfirmation = functions.https.onCall(async () => ({ ok: true }));
exports.sendPaymentReminder = functions.pubsub.schedule('every 24 hours').onRun(async () => ({ ok: true }));

exports.notifyFarmerOnTransactionCreate = functions.firestore
  .document('transactions/{transactionId}')
  .onCreate(async (snap, context) => {
    const txn = snap.data() || {};
    const tokens = await getFarmerTokens(txn.farmerId);
    if (!tokens.length) return null;

    const amount = formatInr(txn.remainingAmount || txn.grandTotal);
    const isCredit = txn.type === 'credit';
    await sendToTokens(
      tokens,
      {
        title: isCredit ? 'New due added' : 'Payment recorded',
        body: isCredit
          ? `${amount} has been added to your ${STORE_ACCOUNT_NAME}.`
          : `${amount} payment purchase was recorded in your account.`,
      },
      {
        type: 'transaction_created',
        transactionId: context.params.transactionId,
        farmerId: txn.farmerId,
      }
    );
    return null;
  });

exports.notifyFarmerOnTransactionUpdate = functions.firestore
  .document('transactions/{transactionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    const wasCleared = before.status === 'cleared' || Number(before.remainingAmount || 0) === 0;
    const isCleared = after.status === 'cleared' || Number(after.remainingAmount || 0) === 0;
    if (wasCleared || !isCleared) return null;

    const tokens = await getFarmerTokens(after.farmerId);
    if (!tokens.length) return null;

    await sendToTokens(
      tokens,
      {
        title: 'Dues cleared',
        body: `${formatInr(before.remainingAmount || after.grandTotal)} was cleared in your ${STORE_ACCOUNT_NAME}.`,
      },
      {
        type: 'dues_cleared',
        transactionId: context.params.transactionId,
        farmerId: after.farmerId,
      }
    );
    return null;
  });

exports.notifyShopOnNotificationCreate = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data() || {};
    const notificationId = context.params.notificationId;
    const title = notification.title || `${STORE_ACCOUNT_NAME} update`;
    const body = notification.message || 'A customer account was updated.';
    const jobs = [];

    const shopTokens = await getShopTokens();
    if (shopTokens.length) {
      jobs.push(
        sendToTokens(
          shopTokens,
          { title, body },
          notificationDataPayload(notification, notificationId, 'shop')
        )
      );
    }

    if (notification.farmerId) {
      const farmerTokens = await getFarmerTokens(notification.farmerId);
      if (farmerTokens.length) {
        jobs.push(
          sendToTokens(
            farmerTokens,
            {
              title: notification.customerTitle || notification.farmerTitle || title,
              body: notification.customerMessage || notification.farmerMessage || body,
            },
            notificationDataPayload(notification, notificationId, 'farmer')
          )
        );
      }
    }

    await Promise.all(jobs);
    return null;
  });
