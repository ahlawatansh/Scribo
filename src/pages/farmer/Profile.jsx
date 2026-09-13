import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { downloadCsvTables } from '../../utils/csvExport';
import { getCurrentMonthDisplay } from '../../utils/season';
import { upsertMobileLookup, upsertEmailLookup } from '../../utils/mobileLookup';

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

export default function FarmerProfileScreen() {
  const nav = useNavigate();
  const { farmerData, farmerId, logout, user, refreshSession } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const photoURL = user?.photoURL || null;
  const displayName = farmerData?.firstName
    ? `${farmerData.firstName}${farmerData.lastName ? ' ' + farmerData.lastName : ''}`
    : (user?.displayName || 'Farmer');
  const initials = farmerData?.firstName
    ? ((farmerData.firstName[0] || '') + (farmerData.lastName?.[0] || '')).toUpperCase()
    : (user?.displayName?.[0]?.toUpperCase() || '?');

  const onStartEdit = (field, currentVal) => {
    setEditingField(field);
    setEditValue(currentVal || '');
  };

  const onSaveField = async (field) => {
    if (!farmerId) return;
    try {
      const docRef = doc(db, 'farmers', farmerId);
      if (field === 'name') {
        const parts = editValue.trim().split(/\s+/).filter(Boolean);
        const firstName = parts[0] || 'Farmer';
        const lastName = parts.slice(1).join(' ');
        await updateDoc(docRef, {
          firstName,
          lastName,
          updatedAt: serverTimestamp(),
        });
      } else if (field === 'email') {
        const trimmedEmail = editValue.trim().toLowerCase();
        await updateDoc(docRef, {
          authEmail: trimmedEmail,
          updatedAt: serverTimestamp(),
        });
        if (farmerData?.mobile) {
          await upsertMobileLookup(farmerData.mobile, {
            farmerId,
            authUid: user.uid,
            authEmail: trimmedEmail,
          });
          await upsertEmailLookup(trimmedEmail, {
            farmerId,
            mobile: farmerData.mobile,
            authUid: user.uid,
          });
        }
      } else if (field === 'address') {
        await updateDoc(docRef, {
          address: editValue.trim(),
          updatedAt: serverTimestamp(),
        });
      }
      await refreshSession(user);
      alert.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated!`);
    } catch (e) {
      alert.error(e?.message || 'Failed to update field.');
    } finally {
      setEditingField(null);
    }
  };

  const onDownloadData = async () => {
    setDownloading(true);
    try {
      const txSnap = farmerId
        ? await getDocs(query(collection(db, 'transactions'), where('farmerId', '==', farmerId)))
        : { docs: [] };
      const transactions = txSnap.docs.map((d) => {
        const data = d.data();
        const { items: _items, ...rest } = data;
        return flattenForExport({ id: d.id, ...rest });
      });
      const farmerRow = farmerData ? [flattenForExport({ id: farmerId || '', ...farmerData })] : [];

      downloadCsvTables(
        [
          { title: 'My Profile', rows: farmerRow },
          { title: 'Purchase History', rows: transactions },
        ],
        `My-Ledger-${new Date().toISOString().slice(0, 10)}.csv`
      );
      alert.success('CSV file downloaded!', { id: 'data-exported' });
    } catch (e) {
      alert.error(e?.message || 'Export failed.', { id: 'excel-error' });
    } finally {
      setDownloading(false);
    }
  };

  const joinDate = farmerData?.createdAt
    ? (farmerData.createdAt.toDate ? farmerData.createdAt.toDate() : new Date(farmerData.createdAt))
      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="space-y-8 pb-24 max-w-md mx-auto">

      <div className="flex items-center gap-4 py-2">
        <div className="w-16 h-16 rounded-3xl overflow-hidden border-2 border-primary/20 flex-shrink-0">
          {photoURL ? (
            <img src={photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-black text-xl">
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">{displayName}</h2>
          {user?.email && <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>}
          <div className="flex flex-wrap gap-2 mt-1.5">
            {farmerData?.mobile && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[11px]">smartphone</span>
                +91 {farmerData.mobile}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase">
              Customer
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 py-2">
        <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Account Details</h3>
        <div className="space-y-0.5 divide-y divide-green-50">
          {[
            { label: 'Full Name', value: displayName, rawValue: displayName, icon: 'person', field: 'name' },
            { label: 'Mobile', value: farmerData?.mobile ? `+91 ${farmerData.mobile}` : '—', icon: 'smartphone' },
            { label: 'Email', value: farmerData?.authEmail || user?.email || '—', icon: 'mail' },
            { label: 'Address', value: farmerData?.address || 'Not provided', rawValue: farmerData?.address || '', icon: 'location_on', field: 'address' },
            {
              label: 'Month',
              value: getCurrentMonthDisplay(),
              icon: 'calendar_month'
            },
            { label: 'Member Since', value: joinDate || 'Recently joined', icon: 'calendar_month' },
          ].map((item) => {
            const isEditing = item.field && editingField === item.field;
            return (
              <div key={item.label} className="flex justify-between items-center py-2.5 min-h-[44px]">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                  <span className="text-xs font-medium text-slate-500">{item.label}</span>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1.5 max-w-[65%]">
                    <input
                      type="text"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 w-full"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSaveField(item.field);
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => onSaveField(item.field)}
                      className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingField(null)}
                      className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 hover:bg-red-100 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => item.field && onStartEdit(item.field, item.rawValue)}
                    className={`text-sm font-semibold text-slate-800 text-right max-w-[55%] truncate ${
                      item.field ? 'cursor-pointer hover:text-primary transition-colors underline decoration-dotted decoration-slate-300' : ''
                    }`}
                    title={item.field ? 'Click to edit' : undefined}
                  >
                    {item.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="py-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Ledger Summary</h3>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-2xl border border-red-100">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px] text-red-500" style={{fontVariationSettings:"'FILL' 1"}}>account_balance_wallet</span>
            </div>
            <div>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wide">Amount to Pay</p>
              <p className="text-sm font-black text-red-600">{farmerData?.totalOutstanding ? `Rs. ${farmerData.totalOutstanding.toLocaleString('en-IN')}` : 'Rs. 0'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px] text-slate-500" style={{fontVariationSettings:"'FILL' 1"}}>receipt_long</span>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Udhar Issued</p>
              <p className="text-sm font-black text-slate-700">{farmerData?.totalUdharGiven ? `Rs. ${farmerData.totalUdharGiven.toLocaleString('en-IN')}` : 'Rs. 0'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px] text-emerald-600" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
            </div>
            <div>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Total Paid</p>
              <p className="text-sm font-black text-emerald-700">{farmerData?.totalPaid ? `Rs. ${farmerData.totalPaid.toLocaleString('en-IN')}` : 'Rs. 0'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 py-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</h3>
        <button
          type="button"
          disabled={downloading}
          className="w-full h-12 bg-primary disabled:opacity-50 text-white font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          onClick={onDownloadData}
        >
          <span className="material-symbols-outlined text-lg" style={{fontVariationSettings:"'FILL' 1"}}>table_chart</span>
          {downloading ? 'Exporting…' : 'Download My Data (.csv)'}
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

      <p className="text-center text-[10px] text-slate-300 uppercase tracking-[0.2em]">
        <span className="shop-name">Scribo</span> · Customer View
      </p>
    </div>
  );
}
