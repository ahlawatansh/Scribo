export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, danger = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden  animate-fade-in-up bg-white border border-slate-200">
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${danger ? 'bg-red-50 border border-red-200' : 'bg-violet-50 border border-violet-200'}`}>
            <span
              className={`material-symbols-outlined text-3xl ${danger ? 'text-red-600' : 'text-violet-600'}`}
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              {danger ? 'delete' : 'help'}
            </span>
          </div>

          {title && (
            <h3 className="text-slate-900 font-bold text-base leading-tight">{title}</h3>
          )}
          <p className="text-slate-500 text-sm leading-relaxed max-w-[260px]">{message}</p>

          <div className="flex gap-3 w-full mt-1">
            <button
              type="button"
              className="flex-1 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-all active:scale-95"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`flex-1 h-11 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                danger
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-primary hover:brightness-110 text-white'
              }`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>

        <p className="pb-4 text-center text-[10px] text-slate-400 uppercase tracking-[0.15em] shop-name">
          Scribo
        </p>
      </div>
    </div>
  );
}
