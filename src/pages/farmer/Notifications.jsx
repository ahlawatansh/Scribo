import { addDays, format, isBefore, isToday } from 'date-fns';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';

function toDate(value) {
  if (!value) return null;
  const parsed = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export default function FarmerNotifications() {
  const { farmerId } = useAuth();
  const [rows, setRows] = useState([]);
  const [appNotifications, setAppNotifications] = useState([]);

  useEffect(() => {
    if (!farmerId) return;
    const unsub = onSnapshot(
      query(collection(db, 'transactions'), where('farmerId', '==', farmerId)),
      (snap) =>
        setRows(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const at = toDate(a?.createdAt)?.getTime() ?? 0;
              const bt = toDate(b?.createdAt)?.getTime() ?? 0;
              return bt - at;
            })
        ),
      (err) => alert.error(err?.message || 'Could not load notifications.', { id: 'farmer-notifs-load' })
    );
    return () => unsub?.();
  }, [farmerId]);

  useEffect(() => {
    if (!farmerId) return;
    const unsub = onSnapshot(
      query(collection(db, 'notifications'), where('farmerId', '==', farmerId)),
      (snap) =>
        setAppNotifications(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const at = toDate(a?.createdAt)?.getTime() ?? 0;
              const bt = toDate(b?.createdAt)?.getTime() ?? 0;
              return bt - at;
            })
        ),
      (err) => alert.error(err?.message || 'Could not load account notifications.', { id: 'farmer-app-notifs-load' })
    );
    return () => unsub?.();
  }, [farmerId]);

  const alerts = useMemo(() => {
    const now = new Date();
    const soon = addDays(now, 3);
    const items = appNotifications.map((n) => ({
      id: `notification-${n.id}`,
      icon: n.type === 'payment_received' ? 'payments' : 'notifications',
      level: n.type === 'payment_received' ? 'Payment' : 'Update',
      title: n.customerTitle || n.farmerTitle || n.title || 'Account update',
      body: n.customerMessage || n.farmerMessage || n.message || 'Your account has a new update.',
      variant: n.type === 'payment_received' ? 'paid' : 'due',
    }));
    rows.forEach((r) => {
      const returnDate = toDate(r.returnDate);
      const createdAt = toDate(r.createdAt);
      const type = String(r.type || '').toLowerCase();
      const status = String(r.status || '').toLowerCase();
      const remaining = Number(r.remainingAmount || 0);
      const isCredit = type === 'credit';
      const isPendingCredit = isCredit && (['pending', 'partial'].includes(status) || (status === '' && remaining > 0));

      if (isPendingCredit && returnDate && isBefore(returnDate, now) && !isToday(returnDate)) {
        items.push({
          id: `${r.id}-overdue`,
          icon: 'warning',
          level: 'Overdue',
          title: 'Payment overdue',
          body: `${formatCurrency(r.remainingAmount || 0)} was due on ${format(returnDate, 'dd MMM yyyy')}`,
          variant: 'overdue',
        });
      } else if (isPendingCredit && returnDate && isBefore(returnDate, soon)) {
        items.push({
          id: `${r.id}-due`,
          icon: 'event_upcoming',
          level: 'Due soon',
          title: 'Upcoming due date',
          body: `${formatCurrency(r.remainingAmount || 0)} due on ${format(returnDate, 'dd MMM yyyy')}`,
          variant: 'due',
        });
      }
      if (type === 'cash' && createdAt && isToday(createdAt)) {
        items.push({
          id: `${r.id}-paid`,
          icon: 'check_circle',
          level: 'Paid',
          title: 'Payment recorded today',
          body: `Business marked ${formatCurrency(r.grandTotal || 0)} as paid.`,
          variant: 'paid',
        });
      }
    });
    const rank = (lvl) => (lvl === 'Overdue' ? 0 : lvl === 'Due soon' ? 1 : 2);
    return items.sort((a, b) => rank(a.level) - rank(b.level) || a.title.localeCompare(b.title));
  }, [appNotifications, rows]);

  const variantStyles = {
    overdue: { icon: 'text-red-600', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700 border-red-200', card: 'border-red-200' },
    due: { icon: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200', card: 'border-amber-200' },
    paid: { icon: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', card: 'border-emerald-200' },
  };

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="text-xs text-slate-400 mt-1">Due alerts, payment updates, and reminders</p>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 bg-white border border-slate-200 rounded-2xl  text-center max-w-md mx-auto mt-8 animate-fade-in-up">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-200">
              <span className="material-symbols-outlined text-emerald-500 text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>notifications_active</span>
            </div>
            <h3 className="font-bold text-slate-800 text-base">All caught up!</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              No pending dues or alerts. Due date reminders and payment updates will appear here.
            </p>
          </div>
        ) : (
          alerts.map((a) => {
            const styles = variantStyles[a.variant] || variantStyles.paid;
            return (
              <div
                key={a.id}
                className={`bg-white rounded-2xl p-5 border  hover:shadow-md transition-all animate-fade-in-up ${styles.card}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${styles.bg}`}>
                    <span className={`material-symbols-outlined text-xl ${styles.icon}`} style={{fontVariationSettings:"'FILL' 1"}}>{a.icon}</span>
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-slate-800 leading-tight">{a.title}</p>
                      <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border ${styles.badge}`}>
                        {a.level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{a.body}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
