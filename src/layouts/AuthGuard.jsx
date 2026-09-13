import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-background grid place-items-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-white border border-outline  flex items-center justify-center">
          <span
            className="material-symbols-outlined text-primary text-3xl animate-spin"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24", animationDuration: '1.4s' }}
          >
            sync
          </span>
        </div>
        <p className="text-on-surface-variant text-xs font-bold uppercase tracking-[0.2em]">Loading…</p>
      </div>
    </div>
  );
}

export function ShopGuard() {
  const { role, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (role !== 'shop') return <Navigate to="/" replace />;
  return <Outlet />;
}

export function FarmerGuard() {
  const { role, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (role !== 'farmer') return <Navigate to="/" replace />;
  return <Outlet />;
}
