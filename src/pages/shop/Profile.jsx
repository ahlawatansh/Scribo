import { collection, getDocs } from 'firebase/firestore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { downloadCsvTables } from '../../utils/csvExport';
import { getCurrentMonthDisplay } from '../../utils/season';

function toSafeValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function flattenForExport(obj, prefix = '') {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;
    if (val !== null && typeof val === 'object' && typeof val.toDate !== 'function' && !Array.isArray(val)) {
      Object.assign(result, flattenForExport(val, fullKey));
    } else {
      result[fullKey] = toSafeValue(val);
    }
  }
  return result;
}

export default function Profile() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const photoURL = user?.photoURL || null;
  const displayName = user?.displayName || 'Ansh Ahlawat';
  const initials = (displayName || 'S').slice(0, 2).toUpperCase();

  const onDownloadData = async () => {
    setDownloading(true);
    try {
      const [farmersSnap, txSnap] = await Promise.all([
        getDocs(collection(db, 'farmers')),
        getDocs(collection(db, 'transactions')),
      ]);

      const farmers = farmersSnap.docs.map((d) => flattenForExport({ id: d.id, ...d.data() }));
      const transactions = txSnap.docs.map((d) => {
        const data = d.data();
        const { items: _items, ...rest } = data;
        return flattenForExport({ id: d.id, ...rest });
      });

      downloadCsvTables(
        [
          { title: 'Summary', rows: [{
            Store: 'Scribo',
            ExportDate: new Date().toLocaleDateString('en-IN'),
            ExportedBy: user?.email || '',
            TotalFarmers: farmers.length,
            TotalTransactions: transactions.length,
          }] },
          { title: 'Farmers', rows: farmers },
          { title: 'Transactions', rows: transactions },
        ],
        `Shyam-Agri-Store-${new Date().toISOString().slice(0, 10)}.csv`
      );
      alert.success('CSV file downloaded!', { id: 'data-exported' });
    } catch (e) {
      alert.error(e?.message || 'Failed to export data.', { id: 'excel-error' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5 pb-20 max-w-lg mx-auto animate-fade-in-up">

      <div className="relative p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
            {photoURL ? (
              <img src={photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>person</span>
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{displayName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{user?.email || 'Business owner account'}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Made with
              <span className="material-symbols-outlined text-[11px]" style={{fontVariationSettings:"'FILL' 1"}}>favorite</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          className="absolute top-4 right-4 text-slate-400 active:scale-90"
          onClick={() => nav(-1)}
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-green-100 space-y-3">
        <h3 className="text-xs font-bold text-primary uppercase tracking-wider">About Myself</h3>
        <div className="space-y-1 divide-y divide-green-50">
          {[
            { label: 'LinkedIn', value: 'View Profile', link: 'https://www.linkedin.com/in/anshahlawat/', icon: 'link' },
            { label: 'Figma Portfolio', value: 'View Portfolio', link: 'https://www.figma.com/@anshahlawat1', icon: 'design_services' },
            { label: 'Portfolio Website', value: 'Visit Website', link: 'https://portfolio-delta-one-q6995xlb7n.vercel.app/', icon: 'language' },
            { label: 'Splity', value: 'View App', link: 'https://splity-mu.vercel.app/', icon: 'apps' },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center py-2.5">
              <div className="flex items-center gap-2 text-slate-500">
                <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              {item.link ? (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary hover:underline cursor-pointer"
                >
                  {item.value}
                </a>
              ) : (
                <span className="text-sm font-semibold text-slate-800 text-right max-w-[55%] truncate">{item.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-green-100 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data & Backup</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Download all your customers and transaction data as a CSV file for records or analysis.
        </p>
        <button
          type="button"
          disabled={downloading}
          className="w-full h-12 bg-primary hover:brightness-110 disabled:opacity-50 text-white font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          onClick={onDownloadData}
        >
          <span className="material-symbols-outlined text-lg" style={{fontVariationSettings:"'FILL' 1"}}>table_chart</span>
          {downloading ? 'Exporting…' : 'Download Data (.csv)'}
        </button>
      </div>

      <button
        type="button"
        className="w-full h-12 bg-red-50 border border-red-200 text-red-600 font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        onClick={async () => { await logout(); nav('/'); }}
      >
        <span className="material-symbols-outlined text-lg">logout</span>
        Sign Out
      </button>

      <p className="text-center text-[10px] text-slate-300 uppercase tracking-[0.2em] shop-name">
        Scribo
      </p>
    </div>
  );
}
