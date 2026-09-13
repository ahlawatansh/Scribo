import {
  GoogleAuthProvider,
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  signInWithCredential,
  getRedirectResult,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { app, firebaseConfig } from './config';

function getFirebaseAuth() {
  if (!Capacitor.isNativePlatform()) return getAuth(app);

  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = getFirebaseAuth();

export const authPersistenceReady = setPersistence(
  auth,
  Capacitor.isNativePlatform() ? indexedDBLocalPersistence : browserLocalPersistence
)
  .then(() => {})
  .catch(async (error) => {
    console.warn('Primary auth persistence failed, trying localStorage fallback:', error);
    await setPersistence(auth, browserLocalPersistence);
  })
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

export const googleProvider = new GoogleAuthProvider();

export const isNativeApp = () => Capacitor.isNativePlatform();

const getMedianSocialLogin = () => window.median?.socialLogin?.google || window.Median?.socialLogin?.google || null;

const nativeTokenBridgeUrl = `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/createCustomTokenFromIdToken`;

function getMedianGoogleIdToken(response) {
  return response?.idToken || response?.id_token || response?.authToken || response?.credential || null;
}

function getMedianGoogleError(response) {
  const message = String(response?.error || response?.message || '');
  if (/no credentials?/i.test(message)) {
    return new Error('Google login setup issue: check Median Web Client ID, Android SHA-1/package, save, rebuild, and reinstall APK.');
  }
  return new Error(message || 'Google sign-in was cancelled or failed.');
}

function signInWithMedianGoogle() {
  const medianGoogle = getMedianSocialLogin();
  if (!medianGoogle?.login) return null;

  return new Promise((resolve, reject) => {
    medianGoogle.login({
      callback: async (response) => {
        try {
          if (response?.error) {
            reject(getMedianGoogleError(response));
            return;
          }
          const idToken = getMedianGoogleIdToken(response);
          if (!idToken) {
            reject(getMedianGoogleError(response));
            return;
          }

          const credential = GoogleAuthProvider.credential(idToken);
          const result = await signInWithCredential(auth, credential);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      },
    });
  });
}

async function signInWithCapacitorGoogle() {
  if (!Capacitor.isNativePlatform()) return null;

  const result = await FirebaseAuthentication.signInWithGoogle({
    skipNativeAuth: false,
  });
  const idToken = result?.credential?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token. Check Android package name, SHA-1, and google-services.json.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export async function restoreNativeAuthSession() {
  await authPersistenceReady;

  if (!Capacitor.isNativePlatform() || auth.currentUser) return auth.currentUser || null;

  try {
    const current = await FirebaseAuthentication.getCurrentUser();
    if (!current?.user) return null;

    const tokenResult = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
    const idToken = tokenResult?.token;
    if (!idToken) return null;

    const response = await fetch(nativeTokenBridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) throw new Error('Could not restore saved Android login.');

    const { customToken } = await response.json();
    if (!customToken) throw new Error('Saved Android login token missing.');

    const restored = await signInWithCustomToken(auth, customToken);
    return restored.user;
  } catch (error) {
    console.warn('Native auth restore skipped:', error);
    return null;
  }
}

export async function signOutEverywhere() {
  await Promise.allSettled([
    signOut(auth),
    Capacitor.isNativePlatform() ? FirebaseAuthentication.signOut() : Promise.resolve(),
  ]);
}

export const isWebView = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return (
    /wv/.test(userAgent) ||
    /median/i.test(userAgent) ||
    /Android.*wv/.test(userAgent) ||
    /iPhone|iPod|iPad/.test(userAgent) && !/Safari/.test(userAgent) ||
    window._cordova ||
    window.cordova ||
    window.PhoneGap ||
    window.phonegap
  );
};

export async function setAuthPersistence(rememberMe) {
  await authPersistenceReady;

  if (isNativeApp()) {
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
    } catch {
      await setPersistence(auth, browserLocalPersistence);
    }
    return;
  }
  const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistenceType);
}

export async function signInWithEmail(email, password, rememberMe = true) {
  await setAuthPersistence(rememberMe);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email, password, rememberMe = true) {
  await setAuthPersistence(rememberMe);
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle(rememberMe = true) {
  await setAuthPersistence(rememberMe);

  const capacitorResult = await signInWithCapacitorGoogle();
  if (capacitorResult) {
    return capacitorResult;
  }

  const medianResult = signInWithMedianGoogle();
  if (medianResult) {
    return medianResult;
  }

  if (isWebView() && (window.median || window.Median)) {
    throw new Error('Google login inside APK requires the Median Social Login plugin. Please enable it in Median and rebuild the APK.');
  }

  return signInWithPopup(auth, googleProvider);
}

export async function handleRedirectResult() {
  if (isNativeApp()) return null;

  try {
    const result = await getRedirectResult(auth);
    return result;
  } catch (error) {
    console.error('Redirect result error:', error);
    throw error;
  }
}

export async function signInAnon() {
  return signInAnonymously(auth);
}

export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}
