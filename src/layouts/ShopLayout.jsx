import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import BottomTabBar from '../components/common/BottomTabBar';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase/db';

export default function ShopLayout() {
  const nav = useNavigate();
  const { logout } = useAuthContext();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'notifications'), where('read', '==', false)),
      (snap) => {
        setUnreadCount(snap.docs.length);
      },
      (err) => {
        console.error('Notifications load error:', err);
      }
    );
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header
        className="sticky top-0 z-40 flex justify-between items-center w-full px-4 md:px-8 py-3 bg-white/70 border-b border-white/40 "
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/dark.png" alt="Logo" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-on-surface leading-none shop-name">Scribo</h1>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Business Login</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => nav('/shop/notifications')}
            className="relative p-2.5 rounded-2xl active:scale-95 text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => nav('/shop/profile')}
            className="relative p-2.5 rounded-2xl active:scale-95 text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[22px]">account_circle</span>
          </button>
        </div>
      </header>

      <aside
        className="hidden lg:flex fixed top-[61px] bottom-0 left-0 z-30 flex-col py-6 w-64 bg-white/70 border-r border-white/40 "
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <nav className="flex-1 space-y-1 px-4">
          {[
            { icon: 'dashboard', label: 'Dashboard', to: '/shop/dashboard' },
            { icon: 'group', label: 'Customers', to: '/shop/farmers' },
            { icon: 'add_circle', label: 'New Purchase', to: '/shop/transactions/new' },
            { icon: 'analytics', label: 'Ledger', to: '/shop/udhar' },
            { icon: 'bar_chart', label: 'Reports', to: '/shop/report' },
            { icon: 'person', label: 'Profile', to: '/shop/profile' },
            { icon: 'notifications', label: 'Notifications', to: '/shop/notifications' },
          ].map((item) => (
            <button
              key={item.to}
              onClick={() => nav(item.to)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-2xl transition-colors font-medium text-sm"
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-green-100 mt-auto">
          <button
            onClick={logout}
            className="flex items-center gap-3 text-error font-bold text-sm tracking-tight hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Sign Out
          </button>
          <p className="text-[9px] text-on-surface-variant/40 uppercase tracking-widest mt-4">Scribo</p>
        </div>
      </aside>

      <div className="lg:pl-64 min-h-screen">
        <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-24 lg:pb-12 animate-fade-in-up">
          <Outlet />
        </main>
      </div>

      <BottomTabBar />
    </div>
  );
}
