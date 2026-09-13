import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const nav = useNavigate();
  return (
    <div className="space-y-5 pb-20">
      <div className="relative p-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Notifications</h2>
          <p className="text-xs text-slate-400 mt-1">Updates and ledger alerts</p>
        </div>
        <button
          type="button"
          className="absolute top-4 right-4 text-slate-400 active:scale-90"
          onClick={() => nav(-1)}
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <div className="flex flex-col items-center justify-center p-10 bg-white border border-slate-200 rounded-2xl  text-center max-w-md mx-auto mt-8 animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary border border-primary/20">
          <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings:"'FILL' 1"}}>notifications</span>
        </div>
        <h3 className="font-bold text-slate-800 text-base">No notifications</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          When you create credit entries or payment reminders, you will see alerts and system logs here.
        </p>
      </div>
    </div>
  );
}
