import { collection, doc, increment, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';
import { calculateLedgerSummary, getCreditRemainingAmount, normalizeTransactionItems, transactionItemsShortText } from '../../utils/transactionDetails';
import { sendCustomerPushAlert } from '../../firebase/freePushRelay';
import { STORE_ACCOUNT_NAME } from '../../utils/constants';

function transactionItemsTextForReminder(transaction) {
  return transactionItemsShortText(transaction).replace(/\s+/g, ' ');
}

function toDate(value) {
  if (!value) return null;
  const parsed = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export default function UdharList() {
  const [rows, setRows] = useState([]);
  const [allCreditRows, setAllCreditRows] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'transactions'), where('type', '==', 'credit')),
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllCreditRows(all);
        const filtered = all.filter((r) => ['pending', 'partial'].includes(r.status));
        filtered.sort((a, b) => {
          const at = toDate(a?.returnDate)?.getTime() ?? Infinity;
          const bt = toDate(b?.returnDate)?.getTime() ?? Infinity;
          return at - bt;
        });
        setRows(filtered);
      },
      (err) => alert.error(err?.message || 'Could not load credit entries.', { id: 'udhar-load' })
    );
    return () => unsub();
  }, []);

  const clearTxn = async (r) => {
    const delta = getCreditRemainingAmount(r);
    try {
      await updateDoc(doc(db, 'transactions', r.id), {
        status: 'cleared', paidAmount: r.grandTotal, remainingAmount: 0,
        clearedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'farmers', r.farmerId), {
        totalOutstanding: increment(-delta), totalPaid: increment(delta), updatedAt: serverTimestamp(),
      });
      await sendCustomerPushAlert({
        farmerId: r.farmerId,
        title: 'Dues cleared',
        body: `${formatCurrency(delta)} was cleared in your ${STORE_ACCOUNT_NAME}.`,
        data: {
          type: 'dues_cleared',
          transactionId: r.id,
          farmerId: r.farmerId,
        },
      });
      alert.success('Credit entry cleared.', { id: 'udhar-cleared' });
    } catch (e) {
      alert.error(e?.message || 'Could not clear transaction.', { id: 'udhar-clear-failed' });
    }
  };

  const sendWhatsApp = (r) => {
    const details = transactionItemsTextForReminder(r);
    const msg = `Hello ${r.farmerName || 'Customer'}, this is a reminder from Scribo. Your pending credit amount of ${formatCurrency(getCreditRemainingAmount(r))} is due for payment. Purchase: ${details}. Kindly clear the balance at your earliest convenience. Thank you.`;
    window.open(`https://wa.me/91${r.farmerMobile}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const ledgerSummary = calculateLedgerSummary(allCreditRows);

  return (
    <div className="space-y-5 pb-20">
      <div className="relative p-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Udhar Ledger</h2>
          <p className="text-xs text-slate-400">All pending credits across customers</p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <div className="p-4 md:p-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Balance Summary</h2>
        </div>
        <div className="p-4 md:p-5 space-y-6 md:space-y-7">

          <div className="grid grid-cols-2 gap-4 md:gap-5">
            {[
              { label: 'Amount to Pay', value: formatCurrency(ledgerSummary.totalOutstanding), color: 'text-red-600', icon: 'warning', accent: 'bg-red-50 border-red-200' },
              { label: 'Udhar Issued', value: formatCurrency(ledgerSummary.totalUdharGiven), color: 'text-slate-800', icon: 'account_balance_wallet', accent: 'bg-slate-50 border-slate-200' },
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
              { label: 'Paid Against Udhar', value: formatCurrency(ledgerSummary.totalPaidAgainstUdhar), color: 'text-emerald-600', icon: 'check_circle', accent: 'bg-emerald-50 border-emerald-200' },
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
            <h3 className="text-base font-black text-slate-800">Pending Credits</h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-bold border border-slate-200">{rows.length} records</span>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl text-center border border-slate-200 max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-3xl" style={{fontVariationSettings:"'FILL' 1"}}>history_edu</span>
              </div>
              <h3 className="font-bold text-slate-800 text-base">No pending credits</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                All credit entries are cleared! Add purchases to track udhar here.
              </p>
            </div>
          ) : (
            rows.map((r) => {
              const rd = toDate(r.returnDate);
              const isOverdue = rd ? rd.getTime() < Date.now() : false;
              const formattedDate = rd ? rd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
              const items = normalizeTransactionItems(r);
              return (
                <div
                  key={r.id}
                  className="p-4 md:p-5 hover:bg-slate-50 transition-all space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOverdue ? 'bg-red-50 border border-red-100 text-red-500' : 'bg-slate-50 border border-slate-100 text-slate-600'}`}>
                      <span className="material-symbols-outlined text-lg" style={{fontVariationSettings:"'FILL' 1"}}>
                        {isOverdue ? 'warning' : 'pending_actions'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{r.farmerName || 'Farmer'}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                        {r.farmerMobile} · Due: {formattedDate}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${isOverdue ? 'text-red-600' : 'text-red-600'}`}>
                      {formatCurrency(getCreditRemainingAmount(r))}
                    </p>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isOverdue ? 'Overdue' : 'Pending'}
                    </span>
                  </div>
                  </div>
                  {items.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                        <span className="col-span-6">Item</span><span className="col-span-2 text-right">Qty</span><span className="col-span-2 text-right">Rate</span><span className="col-span-2 text-right">Total</span>
                      </div>
                      {items.map((item, idx) => (
                        <div key={item.id || `${r.id}-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] text-slate-600">
                          <span className="col-span-6 font-semibold text-slate-700 truncate">{item.name}</span>
                          <span className="col-span-2 text-right">Qty {item.qty}</span>
                          <span className="col-span-2 text-right">{formatCurrency(item.rate)}</span>
                          <span className="col-span-2 text-right font-bold">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      className="flex-1 h-11 px-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 text-sm font-semibold text-slate-600 hover:text-green-700 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      onClick={() => sendWhatsApp(r)}
                    >
                      <span className="material-symbols-outlined text-[16px]">chat</span>
                      Remind
                    </button>
                    <button
                      className="flex-1 h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-1.5"
                      onClick={() => clearTxn(r)}
                    >
                      <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
                      Clear
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
