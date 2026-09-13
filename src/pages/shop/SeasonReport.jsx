import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';
import { getCurrentMonthKey, getCurrentMonthDisplay } from '../../utils/season';

function groupByMonth(rows) {
  const map = {};
  rows.forEach((r) => {
    const month = r.season || 'unknown';
    if (!map[month]) map[month] = [];
    map[month].push(r);
  });
  return map;
}

function formatMonth(m) {
  const parts = m.split('_');
  if (parts.length === 2) {
    const year = parts[0];
    const monthNum = parseInt(parts[1], 10);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[monthNum - 1]} ${year}`;
  }
  return m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MonthlyReport() {
  const [overall, setOverall] = useState({ totalCredit: 0, recovered: 0, pending: 0, txns: 0 });
  const [byMonthEntries, setByMonthEntries] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'transactions'))
      .then((snap) => {
        const rows = snap.docs.map((d) => d.data());
        const totalCredit = rows.filter((r) => r.type === 'credit').reduce((s, r) => s + (r.grandTotal || 0), 0);
        const recovered = rows.reduce((s, r) => s + (r.paidAmount || 0), 0);
        const pending = rows.reduce((s, r) => s + (r.remainingAmount || 0), 0);
        setOverall({ totalCredit, recovered, pending, txns: rows.length });

        const grouped = groupByMonth(rows);
        const entries = Object.entries(grouped).map(([month, list]) => ({
          month,
          txns: list.length,
          totalCredit: list.filter((r) => r.type === 'credit').reduce((s, r) => s + (r.grandTotal || 0), 0),
          recovered: list.reduce((s, r) => s + (r.paidAmount || 0), 0),
          pending: list.reduce((s, r) => s + (r.remainingAmount || 0), 0),
        }));
        entries.sort((a, b) => b.month.localeCompare(a.month));
        setByMonthEntries(entries);

        const currentMonthKey = getCurrentMonthKey();
        const currentMonthData = grouped[currentMonthKey];
        if (currentMonthData) {
          setCurrentMonth({
            month: currentMonthKey,
            txns: currentMonthData.length,
            totalCredit: currentMonthData.filter((r) => r.type === 'credit').reduce((s, r) => s + (r.grandTotal || 0), 0),
            recovered: currentMonthData.reduce((s, r) => s + (r.paidAmount || 0), 0),
            pending: currentMonthData.reduce((s, r) => s + (r.remainingAmount || 0), 0),
          });
        } else {
          setCurrentMonth(null);
        }
      })
      .catch((e) => alert.error(e?.message || 'Could not load monthly report.', { id: 'monthly-report' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <span className="animate-spin material-symbols-outlined text-3xl text-primary">sync</span>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="px-4 md:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Monthly Analysis</h1>
        <p className="text-xs text-slate-400 mt-1">Overall performance across all months</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <div className="p-4 md:p-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">All-Time Summary</h2>
        </div>
        <div className="p-4 md:p-5 space-y-6 md:space-y-7">

          <div className="grid grid-cols-2 gap-4 md:gap-5">
            {[
              { label: 'Total Sale', value: formatCurrency(overall.recovered), color: 'text-emerald-600', icon: 'check_circle', accent: 'bg-emerald-50 border-emerald-200' },
              { label: 'Udhar Issued', value: formatCurrency(overall.totalCredit), color: 'text-slate-800', icon: 'account_balance_wallet', accent: 'bg-slate-50 border-slate-200' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center border ${c.accent} flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-[20px] md:text-[22px] ${c.color}`} style={{fontVariationSettings:"'FILL' 1"}}>{c.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className={`text-base md:text-lg font-black leading-tight whitespace-nowrap ${c.color}`}>{c.value}</p>
                  <p className={`text-[11px] md:text-xs text-slate-400 leading-tight truncate mt-2`}>{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-5">
            {[
              { label: 'Pending Udhar', value: formatCurrency(overall.pending), color: 'text-red-600', icon: 'warning', accent: 'bg-red-50 border-red-200' },
              { label: 'Transactions', value: overall.txns, color: 'text-primary', icon: 'receipt_long', accent: 'bg-primary/5 border-primary/10' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-4 min-w-0">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center border ${c.accent} flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-[20px] md:text-[22px] ${c.color}`} style={{fontVariationSettings:"'FILL' 1"}}>{c.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className={`text-base md:text-lg font-black leading-tight whitespace-nowrap ${c.color}`}>{c.value}</p>
                  <p className={`text-[11px] md:text-xs text-slate-400 leading-tight truncate mt-2`}>{c.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {byMonthEntries.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          <div className="p-4 md:p-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">By Month</h2>
          </div>
          {byMonthEntries.map((entry) => {
            const recoveryPct = entry.totalCredit > 0 ? Math.round(((entry.totalCredit - entry.pending) / entry.totalCredit) * 100) : 0;
            return (
              <div key={entry.month} className="p-4 md:p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{formatMonth(entry.month)}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{entry.txns} transactions</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${recoveryPct >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : recoveryPct >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {recoveryPct}% recovery rate
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${recoveryPct >= 80 ? 'bg-emerald-500' : recoveryPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(recoveryPct, 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm pl-3 md:pl-5">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Udhar Issued</p>
                    <p className="font-bold text-slate-800">{formatCurrency(entry.totalCredit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Total Sale</p>
                    <p className="font-bold text-emerald-600">{formatCurrency(entry.recovered)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Pending</p>
                    <p className="font-bold text-red-600">{formatCurrency(entry.pending)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 text-center">
          <p className="text-sm text-slate-400">No details available</p>
        </div>
      )}
    </div>
  );
}
