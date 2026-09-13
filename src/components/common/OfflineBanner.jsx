import useOnlineStatus from '../../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] pointer-events-none flex items-center justify-center gap-2 bg-primary text-white text-xs font-bold py-2.5 px-4 text-center shadow-lg" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
      <span className="material-symbols-outlined text-[16px]">wifi_off</span>
      No internet connection — some features may not work
    </div>
  );
}
