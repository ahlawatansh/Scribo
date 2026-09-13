import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { useState } from 'react';

export default function FarmerLayout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { user, farmerData } = useAuth();
  const [showStoreInfo, setShowStoreInfo] = useState(false);

  const tabs = [
    { label: 'Home', to: '/farmer/balance', icon: 'home' },
    { label: 'Alerts', to: '/farmer/notifications', icon: 'notifications' },
    { label: 'History', to: '/farmer/transactions', icon: 'receipt_long' },
    { label: 'Profile', to: '/farmer/profile', icon: 'person' },
  ];

  const displayName = farmerData?.firstName
    ? `${farmerData.firstName}${farmerData.lastName ? ' ' + farmerData.lastName : ''}`
    : (user?.displayName || 'Farmer');

  const initials = farmerData?.firstName
    ? ((farmerData.firstName[0] || '') + (farmerData.lastName?.[0] || '')).toUpperCase()
    : (user?.displayName?.[0]?.toUpperCase() || '?');

  const photoURL = user?.photoURL || null;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header
        className="sticky top-0 z-40 flex justify-between items-center w-full px-4 py-3 bg-white/70 border-b border-white/40 "
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/dark.png" alt="Logo" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-on-surface leading-none shop-name">Scribo</h1>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Customer Login</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-4 py-6 pb-28 animate-fade-in-up">
        <Outlet />
      </main>

      {showStoreInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowStoreInfo(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">Store Information</h3>
              <button onClick={() => setShowStoreInfo(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-3 divide-y divide-slate-100">
              {[
                { label: 'Store Name', value: 'Scribo', icon: 'store' },
                { label: 'Owner', value: 'Ansh Ahlawat', icon: 'person' },
                { label: 'Street', value: 'Bharat Singh Chowk', icon: 'location_on' },
                { label: 'Address', value: 'Kahanaur', icon: 'location_on' },
                { label: 'Phone', value: '+91 7357133910', icon: 'call' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 w-full z-40 bg-white/70 border-t border-white/40  pb-6 pt-1"
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <div className="flex justify-around items-center px-2">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.to);
            return (
              <button
                key={tab.to}
                type="button"
                onClick={() => nav(tab.to)}
                className={`flex flex-col items-center justify-center px-3 py-3 rounded-2xl transition-all active:scale-90 min-w-[56px] ${
                  active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={active ? {fontVariationSettings:"'FILL' 1, 'wght' 500"} : {fontVariationSettings:"'FILL' 0, 'wght' 300"}}
                >{tab.icon}</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${active ? 'text-primary' : ''}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
