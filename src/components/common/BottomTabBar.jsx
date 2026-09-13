import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { label: 'Home', route: '/shop/dashboard', icon: 'home' },
  { label: 'Customers', route: '/shop/farmers', icon: 'group' },
  { label: 'Add', route: '/shop/transactions/new', icon: 'add' },
  { label: 'Ledger', route: '/shop/udhar', icon: 'payments' },
  { label: 'Reports', route: '/shop/report', icon: 'assessment' },
];

export default function BottomTabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 w-full z-40 bg-white/70 border-t border-white/40  pb-6 pt-1"
      style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      <div className="flex justify-around items-center px-2 relative">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.route);

          if (tab.label === 'Add') {
            return (
              <button
                key={tab.route}
                onClick={() => nav(tab.route)}
                className="relative -top-5 flex items-center justify-center w-14 h-14 bg-primary text-white rounded-2xl active:scale-90 transition-all"
              >
                <span className="material-symbols-outlined text-[28px] font-light" style={{fontVariationSettings:"'FILL' 0, 'wght' 200"}}>add</span>
              </button>
            );
          }

          return (
            <button
              key={tab.route}
              onClick={() => nav(tab.route)}
              className={`flex flex-col items-center justify-center px-3 py-3 rounded-2xl transition-all active:scale-90 min-w-[56px] ${
                active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] transition-all ${active ? '' : ''}`}
                style={active ? {fontVariationSettings:"'FILL' 1, 'wght' 500"} : {fontVariationSettings:"'FILL' 0, 'wght' 300"}}
              >{tab.icon}</span>
              <span className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${active ? 'text-primary' : ''}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
