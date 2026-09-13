import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, authPersistenceReady, restoreNativeAuthSession, signOutEverywhere } from '../firebase/auth';
import { registerLocalDeviceAlerts, stopLocalDeviceAlerts } from '../firebase/localDeviceAlerts';
import { registerPushNotifications } from '../firebase/pushNotifications';
import { resolveRoleForUser } from '../utils/authRole';

const AuthContext = createContext(null);

function readRememberedSession() {
  try {
    return JSON.parse(localStorage.getItem('kk_device_session') || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [rememberedSession] = useState(() => readRememberedSession());
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(() => rememberedSession?.role || null);
  const [farmerMobile, setFarmerMobile] = useState(null);
  const [farmerId, setFarmerId] = useState(() => rememberedSession?.farmerId || null);
  const [farmerData, setFarmerData] = useState(null);
  const [loading, setLoading] = useState(() => !rememberedSession?.role);

  const applyRoleState = ({ role: r, farmerId: fid, farmerData: fdata, farmerMobile: fm }) => {
    setRole(r);
    setFarmerId(fid);
    setFarmerData(fdata);
    setFarmerMobile(fm);
  };

  const refreshSession = async (currentUser) => {
    const resolved = await resolveRoleForUser(currentUser);
    applyRoleState(resolved);
    return resolved;
  };

  const rememberDeviceSession = (currentUser, resolved) => {
    try {
      localStorage.setItem('kk_device_session', JSON.stringify({
        uid: currentUser.uid,
        email: currentUser.email || '',
        role: resolved?.role || null,
        farmerId: resolved?.farmerId || null,
        savedAt: Date.now(),
      }));
    } catch {  }
  };

  const forgetDeviceSession = () => {
    try {
      localStorage.removeItem('kk_device_session');
    } catch {  }
  };

  useEffect(() => {
    let unsub = null;
    let alive = true;

    const subscribe = () => onAuthStateChanged(auth, async (u) => {
      if (!alive) return;
      if (!u) {
        setUser(null);
        applyRoleState({ role: null, farmerId: null, farmerData: null, farmerMobile: null });
        stopLocalDeviceAlerts();
        setLoading(false);
        return;
      }
      setUser(u);
      try {
        const resolved = await refreshSession(u);
        rememberDeviceSession(u, resolved);
        await registerLocalDeviceAlerts({
          user: u,
          role: resolved?.role,
          farmerId: resolved?.farmerId,
        }).catch((error) => console.error('Local alert registration failed:', error));
        await registerPushNotifications({
          user: u,
          role: resolved?.role,
          farmerId: resolved?.farmerId,
        }).catch((error) => console.error('Push notification registration failed:', error));
      } catch {
        applyRoleState({ role: null, farmerId: null, farmerData: null, farmerMobile: null });
      }
      setLoading(false);
    });

    authPersistenceReady.finally(() => {
      if (alive) {
        unsub = subscribe();
        restoreNativeAuthSession().catch(() => {});
      }
    });

    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  const logout = async () => {
    forgetDeviceSession();
    stopLocalDeviceAlerts();
    await signOutEverywhere();
  };

  const value = {
    user,
    role,
    farmerMobile,
    farmerId,
    farmerData,
    loading,
    logout,
    refreshSession,
    applyRoleState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
