import {
  addDoc, collection, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { upsertMobileLookup, upsertEmailLookup } from '../../utils/mobileLookup';
import { getCurrentMonthKey } from '../../utils/season';

export default function Farmers() {
  const [farmers, setFarmers] = useState([]);
  const [search, setSearch] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'farmers'), orderBy('createdAt', 'desc')),
      (snap) => setFarmers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => alert.error(err?.message || 'Unable to load customers.', { id: 'farmers-load' })
    );
    return () => unsub();
  }, []);

  const list = useMemo(
    () => farmers.filter((f) => {
      const searchLower = search.toLowerCase();
      return (f.firstName || '').toLowerCase().startsWith(searchLower) ||
             (f.lastName || '').toLowerCase().startsWith(searchLower) ||
             (f.mobile || '').toLowerCase().startsWith(searchLower);
    }),
    [farmers, search]
  );

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 outline-none text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="space-y-5 pb-20">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
        <input
          placeholder="Search customer by name or mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl  focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm placeholder:text-slate-400 text-slate-900 outline-none transition-all"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
          Customers Directory ({list.length})
        </h2>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center bg-white border border-slate-200 rounded-2xl ">
            No customers found.
          </p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200  divide-y divide-slate-100">
            {list.map((f) => {
              const initials = ((f.firstName || '').slice(0, 1) + (f.lastName || '').slice(0, 1)).toUpperCase() || '?';
              return (
                <div
                  key={f.id}
                  className="p-4 flex justify-between items-center hover:bg-slate-50 transition-all group"
                >
                  <button
                    onClick={() => nav(`/shop/farmers/${f.id}`)}
                    className="flex items-center gap-4 text-left flex-1 min-w-0"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary font-bold text-xs uppercase group-hover:bg-primary group-hover:text-white transition-all">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate group-hover:text-primary transition-colors">{f.firstName} {f.lastName}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[13px]">smartphone</span>
                        {f.mobile}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
