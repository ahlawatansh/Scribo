import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';
import { normalizeTransactionItems, transactionItemsShortText } from '../../utils/transactionDetails';

function notifyLoadError(err, fallback) {
  const msg = err?.message || '';
  if (msg.toLowerCase().includes('query requires an index')) {
    alert.error('First-time setup running. Please create the Firestore index and refresh.', { id: 'firestore-index' });
    return;
  }
  alert.error(msg || fallback, { id: (msg || fallback).toLowerCase().slice(0, 80) });
}

function txnLabel(type, status) {
  if (type === 'cash') return 'Direct Payment';
  if (type === 'credit' && status === 'cleared') return 'Credit (Cleared)';
  if (type === 'credit') return 'Credit / Udhar';
  return type || 'Purchase';
}

function txnDate(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'dd MMM yyyy');
}

function sortByCreatedAtDesc(a, b) {
  const ad = a?.createdAt?.toDate ? a.createdAt.toDate() : a?.createdAt ? new Date(a.createdAt) : null;
  const bd = b?.createdAt?.toDate ? b.createdAt.toDate() : b?.createdAt ? new Date(b.createdAt) : null;
  const at = ad && !Number.isNaN(ad.getTime()) ? ad.getTime() : 0;
  const bt = bd && !Number.isNaN(bd.getTime()) ? bd.getTime() : 0;
  return bt - at;
}

export default function MyTransactions() {
  const { farmerId } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!farmerId) return;
    const unsub = onSnapshot(
      query(collection(db, 'transactions'), where('farmerId', '==', farmerId)),
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortByCreatedAtDesc)),
      (err) => notifyLoadError(err, 'Could not load purchase history.')
    );
    return () => unsub?.();
  }, [farmerId]);

  return (
    <div className="space-y-5 pb-20 px-4 md:px-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase History</h1>
        <p className="text-xs text-slate-400 mt-1">All purchases and ledger records for your account</p>
      </div>

      <div className="divide-y divide-slate-200">
        {rows.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border border-slate-200  max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>receipt_long</span>
            </div>
            <h3 className="font-bold text-slate-800 text-base">No purchases yet</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              When the shop records a purchase using your mobile, it will appear here.
            </p>
          </div>
        ) : (
          rows.map((r) => {
            const isCredit = r.type === 'credit';
            const isCleared = r.status === 'cleared';
            const label = txnLabel(r.type, r.status);
            const dateStr = txnDate(r.createdAt);

            return (
              <div
                key={r.id}
                className="py-8 flex flex-col gap-6"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${isCredit ? 'bg-red-50 border-red-200 text-red-500' : 'bg-emerald-50 border-emerald-200 text-emerald-600'} flex-shrink-0`}>
                      <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>
                        {isCredit ? 'pending_actions' : 'check_circle'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 text-base leading-snug">{label}</p>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{dateStr}</p>
                      {!!r.notes && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-500 text-xs">
                          <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                          <span className="font-medium truncate max-w-[200px] md:max-w-sm">Note: {r.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-black text-xl md:text-2xl leading-none ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(r.grandTotal)}
                    </p>
                    <div className="mt-2">
                      <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase border ${
                        isCleared ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isCredit ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {r.status || 'paid'}
                      </span>
                    </div>
                  </div>
                </div>
                {r.items && r.items.length > 0 && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase tracking-wider">
                          <th className="text-left pb-2 font-semibold">Item</th>
                          <th className="text-right pb-2 font-semibold">Qty</th>
                          <th className="text-right pb-2 font-semibold">Rate</th>
                          <th className="text-right pb-2 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-700">
                        {r.items.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            <td className="py-2">{item.name || 'Item'}</td>
                            <td className="py-2 text-right">{item.qty || 0}</td>
                            <td className="py-2 text-right">{formatCurrency(item.rate || 0)}</td>
                            <td className="py-2 text-right font-semibold">{formatCurrency(item.total || (item.qty * item.rate) || 0)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-300">
                          <td colSpan={3} className="py-2 font-bold text-slate-800">Grand Total</td>
                          <td className="py-2 text-right font-bold text-slate-800">{formatCurrency(r.grandTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
