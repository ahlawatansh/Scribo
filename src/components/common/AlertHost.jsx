import { useEffect, useRef, useState } from 'react';
import { alert } from '../../utils/alert';

const ICON_MAP = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

const COLOR_MAP = {
  success: {
    icon: 'text-emerald-600',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    btn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    title: 'text-emerald-800',
  },
  error: {
    icon: 'text-red-600',
    border: 'border-red-200',
    bg: 'bg-red-50',
    btn: 'bg-red-600 hover:bg-red-500 text-white',
    title: 'text-red-800',
  },
  info: {
    icon: 'text-violet-600',
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    btn: 'bg-violet-600 hover:brightness-110 text-white',
    title: 'text-violet-800',
  },
};

export default function AlertHost() {
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return alert.subscribe((next) => {
      if (next) {
        setCurrent(next);
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(false), 3000);
      } else {
        setVisible(false);
      }
    });
  }, []);

  if (!current) return null;

  const type = current.type || 'info';
  const colors = COLOR_MAP[type] || COLOR_MAP.info;
  const icon = ICON_MAP[type] || ICON_MAP.info;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={() => { setVisible(false); alert.dismiss(); }}
      />

      <div
        className={`relative w-full max-w-sm rounded-2xl overflow-hidden  transition-all duration-300 bg-white border ${colors.border} ${
          visible ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'
        }`}
      >
        <button
          type="button"
          aria-label="Close notification"
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 active:scale-90 transition"
          onClick={() => { setVisible(false); alert.dismiss(); }}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors.bg} border ${colors.border}`}>
            <span
              className={`material-symbols-outlined text-3xl ${colors.icon}`}
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              {icon}
            </span>
          </div>

          <p className="text-slate-800 font-semibold text-base leading-snug max-w-[260px] break-words">
            {current.message}
          </p>

          <button
            type="button"
            className={`px-8 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all active:scale-95 ${colors.btn}`}
            onClick={() => { setVisible(false); alert.dismiss(); }}
          >
            OK
          </button>
        </div>

        <p className="pb-4 text-center text-[10px] text-slate-400 uppercase tracking-[0.15em]">
          Tap outside to dismiss
        </p>
      </div>
    </div>
  );
}
