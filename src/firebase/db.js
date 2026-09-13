import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { app } from './config';

function getFirebaseDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = getFirebaseDb();
