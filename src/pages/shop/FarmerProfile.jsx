import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateLedgerSummary, normalizeTransactionItems, transactionItemsShortText } from '../../utils/transactionDetails';

function sortByCreatedAtDesc(a, b) {
  const ad = a?.createdAt?.toDate ? a.createdAt.toDate() : a?.createdAt ? new Date(a.createdAt) : null;
  const bd = b?.createdAt?.toDate ? b.createdAt.toDate() : b?.createdAt ? new Date(b.createdAt) : null;
  const at = ad && !Number.isNaN(ad.getTime()) ? ad.getTime() : 0;
  const bt = bd && !Number.isNaN(bd.getTime()) ? bd.getTime() : 0;
  return bt - at;
}

export default function FarmerProfile() {
  const { farmerId } = useParams();
  const [farmer, setFarmer] = useState(null);
  const [txns, setTxns] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    getDoc(doc(db, 'farmers', farmerId))
      .then((d) => setFarmer(d.exists() ? { id: d.id, ...d.data() } : false))
      .catch((err) => alert.error(err?.message || 'Could not load farmer.', { id: 'farmer-load' }));
    const unsub = onSnapshot(
      query(collection(db, 'transactions'), where('farmerId', '==', farmerId)),
      (snap) => setTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortByCreatedAtDesc)),
      (err) => alert.error(err?.message || 'Could not load farmer transactions.', { id: 'farmer-txns' })
    );
    return () => unsub();
  }, [farmerId]);

  if (farmer === false) {
    return (
      <div className="text-center py-12 bg-white rounded-full border border-slate-200">
        <p className="text-slate-400 mb-4">Farmer not found.</p>
        <button onClick={() => nav('/shop/farmers')} className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/20">
          Back to Directory
        </button>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="flex justify-center items-center py-24 text-primary">
        <span className="animate-spin material-symbols-outlined text-3xl">sync</span>
      </div>
    );
  }

  const initials = ((farmer.firstName || '').slice(0, 1) + (farmer.lastName || '').slice(0, 1)).toUpperCase() || '?';
  const ledgerSummary = calculateLedgerSummary(txns);
  const totalOutstanding = txns.length ? ledgerSummary.totalOutstanding : (farmer.totalOutstanding || 0);
  const totalUdharGiven = txns.length ? ledgerSummary.totalUdharGiven : (farmer.totalUdharGiven || 0);
  const totalPaid = txns.length ? ledgerSummary.totalPaid : (farmer.totalPaid || 0);

  return (
    <div className="space-y-5">
      <div className="relative p-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{farmer.firstName} {farmer.lastName}</h2>
          <p className="text-xs text-slate-400">Customer Profile · {farmer.mobile}</p>
        </div>
        <button
          type="button"
          className="absolute top-4 right-4 text-slate-400 active:scale-90"
          onClick={() => nav('/shop/farmers')}
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <div className="p-4 md:p-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Balance Summary</h2>
        </div>
        <div className="p-4 md:p-5 space-y-6 md:space-y-7">

          <div className="grid grid-cols-2 gap-4 md:gap-5">
            {[
              { label: 'Amount to Pay', value: formatCurrency(totalOutstanding), color: 'text-red-600', icon: 'warning', accent: 'bg-red-50 border-red-200' },
              { label: 'Udhar Issued', value: formatCurrency(totalUdharGiven), color: 'text-slate-800', icon: 'account_balance_wallet', accent: 'bg-slate-50 border-slate-200' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center border ${c.accent} flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-[20px] md:text-[22px] ${c.color}`} style={{fontVariationSettings:"'FILL' 1"}}>{c.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className={`text-base md:text-lg font-black leading-tight whitespace-nowrap ${c.color}`}>{c.value}</p>
                  <p className="text-[11px] md:text-xs text-slate-400 leading-tight truncate">{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-5">
            {[
              { label: 'Total Paid', value: formatCurrency(totalPaid), color: 'text-emerald-600', icon: 'check_circle', accent: 'bg-emerald-50 border-emerald-200' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-4 min-w-0">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center border ${c.accent} flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-[20px] md:text-[22px] ${c.color}`} style={{fontVariationSettings:"'FILL' 1"}}>{c.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className={`text-base md:text-lg font-black leading-tight whitespace-nowrap ${c.color}`}>{c.value}</p>
                  <p className="text-[11px] md:text-xs text-slate-400 leading-tight truncate">{c.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-slate-200 my-8"></div>

      <section className="space-y-5 min-h-[420px]">
        <div className="flex items-center justify-between px-4 md:px-6">
          <div>
            <h3 className="text-base font-black text-slate-800">Purchase History</h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-bold border border-slate-200">{txns.length} records</span>
        </div>

        <div className="divide-y divide-slate-100">
          {txns.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No purchases recorded yet.</p>
          ) : (
            txns.map((t) => {
              const isCredit = t.type === 'credit';
              const date = t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt ? new Date(t.createdAt) : null;
              const formattedDate = date ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
              const items = normalizeTransactionItems(t);
              return (
                <div
                  key={t.id}
                  className="p-4 md:p-5 hover:bg-slate-50 transition-all space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCredit ? 'bg-red-50 border border-red-100 text-red-500' : 'bg-emerald-50 border border-emerald-100 text-emerald-600'}`}>
                      <span className="material-symbols-outlined text-lg" style={{fontVariationSettings:"'FILL' 1"}}>
                        {isCredit ? 'pending_actions' : 'check_circle'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{isCredit ? 'Udhar Entry' : 'Payment / Cash'}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                        {formattedDate}{t.notes ? ` · Note: ${t.notes}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(t.grandTotal)}
                    </p>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      t.status === 'cleared' ? 'bg-emerald-100 text-emerald-700'
                      : isCredit && t.status === 'pending' ? 'bg-red-100 text-red-700'
                      : isCredit && t.status === 'partial' ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isCredit && t.status === 'pending' ? 'Unpaid' : isCredit && t.status === 'partial' ? 'Partial' : 'Cleared'}
                    </span>
                  </div>
                  </div>
                  {items.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                        <span className="col-span-6">Item</span><span className="col-span-2 text-right">Qty</span><span className="col-span-2 text-right">Rate</span><span className="col-span-2 text-right">Total</span>
                      </div>
                      {items.map((item, idx) => (
                        <div key={item.id || `${t.id}-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] text-slate-600">
                          <span className="col-span-6 font-semibold text-slate-700 truncate">{item.name}</span>
                          <span className="col-span-2 text-right">Qty {item.qty}</span>
                          <span className="col-span-2 text-right">{formatCurrency(item.rate)}</span>
                          <span className="col-span-2 text-right font-bold">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
