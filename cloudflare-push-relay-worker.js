
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

function base64Url(bytesOrText) {
  const bytes = typeof bytesOrText === 'string' ? new TextEncoder().encode(bytesOrText) : bytesOrText;
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
  const clean = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: FCM_SCOPE,
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function getAccessToken(serviceAccount) {
  const assertion = await signJwt(serviceAccount);
  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!response.ok) throw new Error(`OAuth failed: ${await response.text()}`);
  return (await response.json()).access_token;
}

async function verifyShopUser(idToken, env) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;
  const user = (await response.json()).users?.[0];
  const email = String(user?.email || '').toLowerCase();
  if (!email || email !== String(env.SHOP_OWNER_EMAIL || '').toLowerCase()) return null;
  return user;
}

async function sendFcm({ token, notification, data, accessToken, projectId }) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification,
        data,
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'default',
            sound: 'default',
          },
        },
      },
    }),
  });
  return { ok: response.ok, status: response.status, body: await response.text() };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return jsonResponse({ ok: true });
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    try {
      const { idToken, tokens = [], notification = {}, data = {} } = await request.json();
      if (!idToken || !tokens.length || !notification.title || !notification.body) {
        return jsonResponse({ error: 'Missing idToken, tokens, title, or body' }, 400);
      }

      const user = await verifyShopUser(idToken, env);
      if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

      const serviceAccount = JSON.parse(env.SERVICE_ACCOUNT_JSON);
      const accessToken = await getAccessToken(serviceAccount);
      const projectId = serviceAccount.project_id;
      const uniqueTokens = [...new Set(tokens)].slice(0, 100);

      const results = await Promise.all(
        uniqueTokens.map((token) =>
          sendFcm({
            token,
            notification,
            data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? '')])),
            accessToken,
            projectId,
          })
        )
      );

      return jsonResponse({
        ok: true,
        sent: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
      });
    } catch (error) {
      return jsonResponse({ error: error.message || 'Push relay failed' }, 500);
    }
  },
};
