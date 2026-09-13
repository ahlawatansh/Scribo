import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';
import { normalizeTransactionItems, transactionItemsShortText } from '../../utils/transactionDetails';

export default function History() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => alert.error(err?.message || 'Could not load history.', { id: 'history-load' })
    );
    return () => unsub();
  }, []);

  return (
    <div className="space-y-5 pb-20">
      <div className="relative p-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase History</h1>
          <p className="text-xs text-slate-400 mt-1">Last 100 purchases across all seasons</p>
        </div>
        <button
          type="button"
          className="absolute top-4 right-4 text-slate-400 active:scale-90"
          onClick={() => nav(-1)}
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block" style={{fontVariationSettings:"'FILL' 1"}}>receipt_long</span>
            <p className="text-sm text-slate-400">No purchases recorded yet.</p>
          </div>
        ) : (
          rows.map((r) => {
            const isCredit = r.type === 'credit';
            const initials = (r.farmerName || 'F').trim().slice(0, 2).toUpperCase();
            const date = r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt ? new Date(r.createdAt) : null;
            const formattedDate = date ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';

            return (
              <div
                key={r.id}
                className="p-3 md:p-4 flex flex-col gap-3 hover:bg-slate-50 transition-all"
              >
                <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase border ${isCredit ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                    {initials}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 truncate">{r.farmerName || 'Farmer'}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                      {formattedDate} {r.season ? `· ${r.season.replace('_', ' ').toUpperCase()}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(r.grandTotal)}
                  </p>
                  <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full ${isCredit ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                    {isCredit ? 'UDHAR' : 'PAID'}
                  </span>
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
