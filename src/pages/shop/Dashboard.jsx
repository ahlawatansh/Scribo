import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateLedgerSummary } from '../../utils/transactionDetails';

function toDate(value) {
  if (!value) return null;
  const parsed = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatRelativeTime(timestamp) {
  const date = toDate(timestamp);
  if (!date) return 'Recently';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const [summary, setSummary] = useState({ totalOutstanding: 0, totalUdharGiven: 0, totalFarmers: 0, riskFarmers: 0 });
  const [ledgerSummary, setLedgerSummary] = useState({ totalOutstanding: 0, totalUdharGiven: 0 });
  const [recent, setRecent] = useState([]);
  const [dueSoon, setDueSoon] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'farmers'),
      (snap) => {
        const rows = snap.docs.map((d) => d.data());
        setSummary((prev) => ({
          ...prev,
          totalFarmers: rows.length,
          riskFarmers: rows.filter((r) => r.creditScore === 'risk').length,
        }));
      },
      (err) => alert.error(err?.message || 'Could not load dashboard summary.', { id: 'dash-summary' })
    );
    const u2 = onSnapshot(
      query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecent(rows);
      },
      (err) => alert.error(err?.message || 'Could not load recent purchases.', { id: 'dash-recent' })
    );
    const uLedger = onSnapshot(
      collection(db, 'transactions'),
      (snap) => setLedgerSummary(calculateLedgerSummary(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
      (err) => alert.error(err?.message || 'Could not load ledger summary.', { id: 'dash-ledger-summary' })
    );
    const maxDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const u3 = onSnapshot(
      query(collection(db, 'transactions'), where('type', '==', 'credit')),
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const filtered = all.filter((r) => {
          if (!['pending', 'partial'].includes(r.status)) return false;
          const rd = toDate(r.returnDate);
          return rd ? rd.getTime() <= maxDate.getTime() : false;
        });
        filtered.sort((a, b) => {
          const at = toDate(a.returnDate)?.getTime() ?? Infinity;
          const bt = toDate(b.returnDate)?.getTime() ?? Infinity;
          return at - bt;
        });
        setDueSoon(filtered.slice(0, 5));
      },
      (err) => alert.error(err?.message || 'Could not load due purchases.', { id: 'dash-due' })
    );
    return () => [u1, u2, uLedger, u3].forEach((u) => u());
  }, []);

  const statCards = [
    { label: 'Udhar Issued', value: formatCurrency(ledgerSummary.totalUdharGiven), icon: 'receipt_long', color: 'text-slate-800', iconBg: 'bg-slate-100 text-slate-600' },
    { label: 'Total Customers', value: summary.totalFarmers, icon: 'group', color: 'text-primary', iconBg: 'bg-primary/10 text-primary' },
    { label: 'Due Soon (15d)', value: dueSoon.length, icon: 'calendar_month', color: 'text-amber-600', iconBg: 'bg-amber-50 text-amber-500' },
    { label: 'Critical Accounts', value: summary.riskFarmers, icon: 'warning', color: 'text-red-600', iconBg: 'bg-red-50 text-red-500' },
  ];

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-3xl p-5 border border-green-100  hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
                <span className="material-symbols-outlined text-[22px]" style={{fontVariationSettings:"'FILL' 1"}}>{card.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-tight">{card.label}</p>
                <p className={`text-lg md:text-xl font-black tracking-tight leading-tight mt-0.5 ${card.color}`}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <button
          onClick={() => nav('/shop/farmers')}
          className="flex items-center justify-center gap-3 bg-primary text-white rounded-3xl font-bold text-base py-5 px-6 hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-primary/10"
        >
          <span className="material-symbols-outlined text-[22px]" style={{fontVariationSettings:"'FILL' 1"}}>group_add</span>
          Add / Manage Customers
        </button>
        <button
          onClick={() => nav('/shop/transactions/new')}
          className="flex items-center justify-center gap-3 bg-white border-2 border-primary text-primary rounded-3xl font-bold text-base py-5 px-6 hover:bg-primary/5 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[22px]" style={{fontVariationSettings:"'FILL' 1"}}>add_circle</span>
          Add Purchase
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Recent Purchases</h2>
              <p className="text-xs text-slate-400">Last 5 purchases</p>
            </div>
            <button onClick={() => nav('/shop/history')} className="text-primary text-xs font-semibold hover:underline">
              View All
            </button>
          </div>
          <div className="bg-white rounded-3xl border border-green-100 divide-y divide-green-50 overflow-hidden">
            {recent.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400">No recent activity yet.</p>
              </div>
            ) : (
              recent.map((t) => {
                const isCredit = t.type === 'credit';
                return (
                  <div
                    key={t.id}
                    onClick={() => nav(`/shop/farmers/${t.farmerId}`)}
                    className="flex items-center justify-between p-3.5 hover:bg-green-50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                        {getInitials(t.farmerName)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{t.farmerName}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">{formatRelativeTime(t.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(t.grandTotal)}
                      </p>
                      <span className={`text-[9px] font-black tracking-widest uppercase opacity-70 ${isCredit ? 'text-red-500' : 'text-emerald-500'}`}>
                        {isCredit ? 'UDHAR' : 'PAID'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Due Soon</h2>
              <p className="text-xs text-slate-400">Credits due within 15 days</p>
            </div>
            <button onClick={() => nav('/shop/udhar')} className="text-primary text-xs font-semibold hover:underline">
              Manage Ledger
            </button>
          </div>
          <div className="bg-white rounded-3xl border border-green-100 divide-y divide-green-50 overflow-hidden">
            {dueSoon.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400">No credits due soon.</p>
              </div>
            ) : (
              dueSoon.map((t) => {
                const rd = toDate(t.returnDate);
                return (
                  <div
                    key={t.id}
                    onClick={() => nav(`/shop/farmers/${t.farmerId}`)}
                    className="flex items-center justify-between p-3.5 hover:bg-green-50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                        {getInitials(t.farmerName)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{t.farmerName}</p>
                        <p className="text-[10px] text-red-500 font-semibold tracking-wide">
                          Due: {rd ? rd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Not set'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-red-600">{formatCurrency(t.remainingAmount || t.grandTotal)}</p>
                      <span className="text-[9px] font-black tracking-widest text-red-400 uppercase opacity-80">PENDING</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
