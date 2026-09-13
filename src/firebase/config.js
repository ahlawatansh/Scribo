import { initializeApp } from 'firebase/app';

export const firebaseConfig = {
  apiKey: 'AIzaSyB4MwIdpRRKIdDzUfpBqAz_RvfrHEmqeVM',
  authDomain: 'shyam-agricultural-store.firebaseapp.com',
  projectId: 'shyam-agricultural-store',
  storageBucket: 'shyam-agricultural-store.firebasestorage.app',
  messagingSenderId: '605263824637',
  appId: '1:605263824637:web:86c0dfe5a133c443122094',
  measurementId: 'G-TGEHQ26P4Z',
};

export const app = initializeApp(firebaseConfig);

if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
  import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (await isSupported()) getAnalytics(app);
    })
    .catch(() => {

    });
}
