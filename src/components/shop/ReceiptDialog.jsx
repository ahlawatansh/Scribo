import { getManualWhatsAppShareLink, sendReceiptPdfToCustomer } from '../../utils/whatsappBot';
import { formatCurrency } from '../../utils/formatCurrency';

export default function ReceiptDialog({ open, transaction, pdfDoc, onDone }) {
  if (!open || !transaction) return null;

  const isCredit = transaction.type === 'credit';
  const displayTotal = formatCurrency(transaction.grandTotal || 0);

  const onSendPdf = async () => {
    if (!pdfDoc) return;
    await sendReceiptPdfToCustomer(transaction, pdfDoc);
  };

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[4px]"
        aria-hidden="true"
        onClick={onDone}
      />

      <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-100  overflow-hidden animate-fade-in-up">
        <div className="p-6 pb-2 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
            <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings:"'FILL' 1, 'wght' 600"}}>check_circle</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900 leading-tight">Purchase Completed!</h2>
            <p className="text-xs text-slate-400 font-medium">Receipt PDF is ready to send directly to the customer.</p>
          </div>
        </div>

        <div className="mx-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider">Customer</span>
            <span className="font-bold text-slate-800 truncate max-w-[180px]">
              {transaction.farmerName || 'Farmer'}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider">Mobile</span>
            <span className="font-semibold text-slate-700">
              +91 {transaction.farmerMobile || '—'}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider">Payment Mode</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
              isCredit ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}>
              {isCredit ? 'Udhar / Credit' : 'Direct Cash'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-200/60 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grand Total</span>
            <span className="text-2xl font-black text-primary">{displayTotal}</span>
          </div>
        </div>

        <div className="p-6 space-y-3.5">
          <button
            type="button"
            onClick={onSendPdf}
            className="w-full h-12 bg-primary hover:brightness-110 text-white font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 "
          >
            <span className="material-symbols-outlined text-lg" style={{fontVariationSettings:"'FILL' 1"}}>send</span>
            Send PDF Directly to Customer
          </button>

          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col gap-1 text-[11px] text-emerald-700">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <span className="material-symbols-outlined text-sm">info</span>
              Customer WhatsApp Fallback
            </div>
            <p className="leading-relaxed">
              If your browser cannot share PDF files directly, the app opens WhatsApp with the customer's number and receipt details already filled in; review and press Send in WhatsApp.
            </p>
          </div>

          <a
            href={getManualWhatsAppShareLink(transaction)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4 fill-emerald-600" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.453L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.45 5.467 0 9.911-4.385 9.914-9.777.001-2.61-1.015-5.066-2.862-6.915C16.47 2.062 14.025 1.048 11.45 1.048 5.98 1.048 1.536 5.433 1.533 10.825c0 1.503.415 2.97 1.202 4.269L1.72 20.442l5.441-1.424z"/>
            </svg>
            Open Customer WhatsApp
          </a>
        </div>

        <div className="px-6 pb-6 pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="px-6 h-11 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 active:scale-95 transition-all"
          >
            New Purchase
          </button>
        </div>
      </div>
    </div>
  );
}
