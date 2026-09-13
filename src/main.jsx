import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import AlertHost from './components/common/AlertHost';
import SplashScreen from './components/common/SplashScreen';
import './styles/global.css';

function getRememberedRoute() {
  try {
    const saved = JSON.parse(localStorage.getItem('kk_device_session') || 'null');
    if (saved?.role === 'shop') return '/shop/dashboard';
    if (saved?.role === 'farmer') return '/farmer/balance';
  } catch {  }
  return null;
}

function AppWithSplash() {
  const [rememberedRoute] = useState(() => getRememberedRoute());
  const [splashComplete, setSplashComplete] = useState(() => Boolean(rememberedRoute));

  if (rememberedRoute && window.location.pathname === '/') {
    window.history.replaceState(null, '', rememberedRoute);
  }

  return (
    <>
      {!rememberedRoute && <SplashScreen onComplete={() => setSplashComplete(true)} />}
      {splashComplete && (
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <AuthProvider>
            <App />
            <AlertHost />
          </AuthProvider>
        </BrowserRouter>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWithSplash />
  </React.StrictMode>
);
