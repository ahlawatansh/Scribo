import { addDoc, collection, doc, getDoc, getDocs, increment, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';
import { upsertMobileLookup } from '../../utils/mobileLookup';
import { getCurrentMonthKey } from '../../utils/season';
import { generateReceiptPdf } from '../../utils/receiptGenerator';
import { getWhatsAppReceiptMessage, resolveReceiptPdfDownloadUrl } from '../../utils/whatsappBot';
import { sendCustomerPushAlert } from '../../firebase/freePushRelay';
import { STORE_ACCOUNT_NAME } from '../../utils/constants';

function createItem() {
  return { id: crypto.randomUUID(), name: '', qty: 1, rate: '' };
}

function StepIndicator({ selectedFarmer, hasItems, paymentType }) {
  const steps = [
    { num: 1, label: 'Customer', detail: 'Select', done: !!selectedFarmer },
    { num: 2, label: 'Items', detail: 'Add', done: hasItems },
    { num: 3, label: paymentType === 'credit' ? 'Udhar' : 'Direct', detail: paymentType === 'credit' ? 'Credit' : 'Immediate', done: true },
  ];
  return (
    <div className="flex items-center justify-between bg-white rounded-3xl border border-green-100 p-3 md:p-4 gap-1 md:gap-3 overflow-x-auto">
      {steps.map((step, i) => {
        const isActive = i === 2 ? true : (i === 0 ? true : step.done || steps[i - 1]?.done);
        const isComplete = step.done;
        const creditMode = step.num === 3 && paymentType === 'credit';
        return (
          <div key={step.num} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2.5 flex-shrink-0">
              <div
                className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center font-bold text-xs md:text-sm border-2 transition-all flex-shrink-0 ${
                  isComplete
                    ? creditMode
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-primary border-primary text-white'
                    : isActive
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-slate-200 text-slate-400 bg-slate-50'
                }`}
              >
                {isComplete && !creditMode ? (
                  <span className="material-symbols-outlined text-xs md:text-sm" style={{fontVariationSettings:"'FILL' 1"}}>check</span>
                ) : (
                  step.num
                )}
              </div>
              <div className="flex flex-col leading-tight">
                <span
                  className={`text-[10px] md:text-xs font-bold whitespace-nowrap ${
                    isComplete
                      ? creditMode ? 'text-red-600' : 'text-primary'
                      : isActive ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-[9px] md:text-[10px] text-slate-400 whitespace-nowrap">{step.detail}</span>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1.5 md:mx-3 rounded-full transition-all ${step.done ? 'bg-primary' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AddTransaction() {
  const [allFarmers, setAllFarmers] = useState([]);
  const [q, setQ] = useState('');
  const [quickMobile, setQuickMobile] = useState('');
  const [quickName, setQuickName] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [paymentType, setPaymentType] = useState('cash');
  const [returnDate, setReturnDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 6);
    return date.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([createItem()]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, 'farmers')))
      .then((snap) => setAllFarmers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((e) => alert.error(e?.message || 'Could not load farmers.', { id: 'txn-load-farmers' }));
  }, []);

  useEffect(() => {
    if (selectedFarmer) {
      getDocs(query(collection(db, 'transactions'), where('farmerId', '==', selectedFarmer.id), limit(10)))
        .then((snap) => {
          if (!snap.empty) {
            const txns = snap.docs.map((d) => d.data());

            txns.sort((a, b) => {
              const aTime = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const bTime = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return bTime - aTime;
            });
            const lastTx = txns[0];
            setPaymentType(lastTx.type || 'cash');
          } else {
            setPaymentType('cash');
          }
        })
        .catch(() => setPaymentType('cash'));
    } else {
      setPaymentType('cash');
    }
  }, [selectedFarmer]);

  const results = useMemo(() => {
    if (q.length < 2) return [];
    return allFarmers.filter((f) => `${f.firstName} ${f.lastName} ${f.mobile}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  }, [q, allFarmers]);

  const grandTotal = useMemo(() => items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0), [items]);
  const hasItems = items.some((i) => i.name && Number(i.qty) > 0 && Number(i.rate) > 0);

  const ensureFarmerByMobile = async (mobile, displayName = '') => {
    const lookupSnap = await getDoc(doc(db, 'mobile_lookup', mobile));
    if (lookupSnap.exists() && lookupSnap.data().farmerId) {
      const farmerSnap = await getDoc(doc(db, 'farmers', lookupSnap.data().farmerId));
      if (farmerSnap.exists()) return { id: farmerSnap.id, ...farmerSnap.data() };
    }
    const existingSnap = await getDocs(query(collection(db, 'farmers'), where('mobile', '==', mobile), limit(1)));
    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      await upsertMobileLookup(mobile, { farmerId: existing.id });
      return { id: existing.id, ...existing.data() };
    }
    const [firstName = 'Farmer', ...rest] = (displayName || '').trim().split(/\s+/).filter(Boolean);
    const lastName = rest.join(' ');
    const createdRef = await addDoc(collection(db, 'farmers'), {
      mobile, firstName: firstName || 'Farmer', lastName: lastName || '', address: '',
      creditScore: null, suggestedLimit: 0, totalOutstanding: 0, totalUdharGiven: 0, totalPaid: 0,
      season: getCurrentMonthKey(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await upsertMobileLookup(mobile, { farmerId: createdRef.id });
    return { id: createdRef.id, mobile, firstName: firstName || 'Farmer', lastName: lastName || '' };
  };

  const save = async () => {
    const validItems = items.filter((i) => i.name && Number(i.qty) > 0 && Number(i.rate) > 0)
      .map((i) => ({ ...i, qty: Number(i.qty), rate: Number(i.rate), total: Number(i.qty) * Number(i.rate) }));
    if (!validItems.length) { alert.error('Add at least one valid item.', { id: 'txn-items' }); return; }
    if (paymentType === 'credit' && !returnDate) { alert.error('Select a due date.', { id: 'txn-due-date' }); return; }
    try {
      let farmer = selectedFarmer;
      if (!farmer) {
        if (!/^[6-9]\d{9}$/.test(quickMobile)) { alert.error('Select a farmer or enter a valid mobile number.', { id: 'txn-farmer' }); return; }
        farmer = await ensureFarmerByMobile(quickMobile, quickName);
      }
      const docRef = await addDoc(collection(db, 'transactions'), {
        farmerId: farmer.id,
        farmerName: `${farmer.firstName || ''} ${farmer.lastName || ''}`.trim() || quickName || 'Farmer',
        farmerMobile: farmer.mobile || quickMobile,
        type: paymentType, items: validItems, grandTotal,
        returnDate: paymentType === 'credit' ? new Date(returnDate) : null,
        status: paymentType === 'credit' ? 'pending' : null,
        paidAmount: paymentType === 'cash' ? grandTotal : 0,
        remainingAmount: paymentType === 'credit' ? grandTotal : 0,
        notes, season: getCurrentMonthKey(), reminderSent: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        clearedAt: paymentType === 'cash' ? serverTimestamp() : null,
      });
      await updateDoc(doc(db, 'farmers', farmer.id), {

        totalUdharGiven: increment(paymentType === 'credit' ? grandTotal : 0),
        totalOutstanding: increment(paymentType === 'credit' ? grandTotal : 0),
        totalPaid: increment(paymentType === 'cash' ? grandTotal : 0),
        updatedAt: serverTimestamp(),
      });

      const txObj = {
        id: docRef.id,
        farmerId: farmer.id,
        farmerName: `${farmer.firstName || ''} ${farmer.lastName || ''}`.trim() || quickName || 'Farmer',
        farmerMobile: farmer.mobile || quickMobile,
        type: paymentType, items: validItems, grandTotal,
        returnDate: paymentType === 'credit' ? new Date(returnDate) : null,
        status: paymentType === 'credit' ? 'pending' : null,
        paidAmount: paymentType === 'cash' ? grandTotal : 0,
        remainingAmount: paymentType === 'credit' ? grandTotal : 0,
        notes, season: getCurrentMonthKey(),
        createdAt: new Date(),
      };

      const pdf = generateReceiptPdf(txObj);

      await sendCustomerPushAlert({
        farmerId: farmer.id,
        title: paymentType === 'credit' ? 'New due added' : 'Payment recorded',
        body:
          paymentType === 'credit'
            ? `${formatCurrency(grandTotal)} has been added to your ${STORE_ACCOUNT_NAME}.`
            : `${formatCurrency(grandTotal)} payment purchase was recorded in your account.`,
        data: {
          type: 'transaction_created',
          transactionId: docRef.id,
          farmerId: farmer.id,
        },
      });

      setUploadingReceipt(true);
      let cloudinaryUrl = null;
      let receiptDownloadUrl = null;
      try {
        const pdfBlob = pdf.output('blob');
        const formData = new FormData();
        formData.append('file', pdfBlob, `receipt_${Date.now()}.pdf`);
        formData.append('upload_preset', 'unsigned_preset');
        formData.append('folder', 'receipts');
        formData.append('resource_type', 'raw');

        const response = await fetch(`https://api.cloudinary.com/v1_1/db9d4o2cs/raw/upload`, {
          method: 'POST',
          body: formData,
        });

        const uploadResult = await response.json();

        if (uploadResult.secure_url) {
          cloudinaryUrl = uploadResult.secure_url;
          receiptDownloadUrl = await resolveReceiptPdfDownloadUrl(cloudinaryUrl, txObj);

          if (receiptDownloadUrl) {
            txObj.receiptPdfUrl = cloudinaryUrl;
            txObj.receiptPdfDownloadUrl = receiptDownloadUrl;
            await updateDoc(docRef, {
              receiptPdfUrl: cloudinaryUrl,
              receiptPdfDownloadUrl: receiptDownloadUrl,
              updatedAt: serverTimestamp(),
            });
          } else {
            console.warn('Receipt PDF uploaded, but Cloudinary blocked public delivery. Sending WhatsApp receipt without PDF link.');
          }
        } else {
          console.error('Upload failed, no secure_url:', uploadResult);
        }
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
      }

      const mobile = farmer.mobile || quickMobile;
      const whatsappMessage = getWhatsAppReceiptMessage(txObj, receiptDownloadUrl || '');
      const whatsappUrl = `https://wa.me/91${mobile}?text=${encodeURIComponent(whatsappMessage)}`;

      window.location.href = whatsappUrl;
      setUploadingReceipt(false);

      setItems([createItem()]); setReturnDate(new Date().toISOString().slice(0, 10));
      setNotes(''); setQ(''); setQuickMobile(''); setQuickName(''); setSelectedFarmer(null);
    } catch (e) {
      alert.error(e?.message || 'Failed to save purchase.', { id: 'txn-save-failed' });
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl h-13 px-4 py-3.5 outline-none text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
  const sectionHeader = "text-sm font-bold text-slate-800 flex items-center gap-2";

  return (
    <div className="max-w-[1000px] mx-auto pb-32">
      <section className="py-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Purchase</h1>
        <p className="text-slate-500 text-sm mt-1">Record a purchase or credit entry for a customer.</p>
      </section>

      <div className="mb-6">
        <StepIndicator selectedFarmer={selectedFarmer} hasItems={hasItems} paymentType={paymentType} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 flex flex-col gap-5">

          <div className="bg-white rounded-2xl border border-slate-200  overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
              <h2 className={sectionHeader}>
                <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[16px]">person</span>
                </span>
                Step 1 — Select Customer
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {!selectedFarmer ? (
                <>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                    <input
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm placeholder:text-slate-400 text-slate-900 outline-none transition-all"
                      placeholder="Search by name or mobile number..."
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  {results.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                      {results.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => { setSelectedFarmer(f); setQ(''); }}
                          className="w-full text-left py-3.5 px-4 hover:bg-slate-50 text-sm flex items-center justify-between transition-colors"
                        >
                          <span className="font-semibold text-slate-800">{f.firstName} {f.lastName}</span>
                          <span className="text-xs text-slate-400 tracking-wider font-medium">{f.mobile}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Sale — New Customer</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder="Mobile number (10 digits)"
                        value={quickMobile}
                        onChange={(e) => setQuickMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                      <input
                        className={inputClass}
                        placeholder="Full Name"
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/15 transition-all">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-primary font-bold text-sm uppercase">
                    {((selectedFarmer.firstName || '').slice(0, 1) + (selectedFarmer.lastName || '').slice(0, 1)).toUpperCase() || '?'}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base font-bold text-slate-900 truncate">{selectedFarmer.firstName} {selectedFarmer.lastName}</span>
                      <span className="text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Selected</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        {selectedFarmer.mobile}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-amber-600">
                        <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                        {formatCurrency(selectedFarmer.totalOutstanding || 0)} Amount to Pay
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedFarmer(null)} className="text-slate-400 active:text-red-500 flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200  overflow-hidden">
            <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100">
              <h2 className={sectionHeader}>
                <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[16px]">shopping_bag</span>
                </span>
                Step 2 — Items
              </h2>
              <button
                type="button"
                onClick={() => setItems([...items, createItem()])}
                className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-lg"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                ADD ITEM
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <div key={it.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="ml-1.5 mr-0.5 text-sm md:text-base font-black text-slate-500 uppercase tracking-wide flex-shrink-0 min-w-[2.35rem]">#{idx + 1}</span>
                    <input
                      className="flex-1 max-w-[84%] md:max-w-[80%] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                      placeholder="add items"
                      value={it.name}
                      onChange={(e) => setItems(items.map((x) => x.id === it.id ? { ...x, name: e.target.value.toUpperCase() } : x))}
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                        className="text-slate-300 active:text-red-500 flex-shrink-0"
                      >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Qty</label>
                      <input
                        className="w-full text-center bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-sm text-slate-800 font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={(e) => setItems(items.map((x) => x.id === it.id ? { ...x, qty: e.target.value } : x))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Rate</label>
                      <input
                        className="w-full text-center bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-sm text-slate-800 font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        type="number"
                        min="0"
                        value={it.rate}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setItems(items.map((x) => x.id === it.id ? { ...x, rate: e.target.value } : x))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Total</label>
                      <div className="w-full flex items-center justify-center bg-primary/5 border border-primary/15 rounded-xl py-2.5 text-sm font-bold text-primary">
                        {formatCurrency((Number(it.qty) || 0) * (Number(it.rate) || 0))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Payable</span>
              <span className="text-2xl font-black text-primary">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200  overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className={sectionHeader}>
                <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[16px]">account_balance</span>
                </span>
                Step 3 — Select Direct / Udhar
              </h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPaymentType('cash')}
                className={`group flex flex-col items-center gap-3 py-5 px-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${paymentType === 'cash' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:border-primary/40'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${paymentType === 'cash' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <span className="material-symbols-outlined text-[26px]" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
                </div>
                <div className="text-center">
                  <span className="block font-bold text-sm">Direct</span>
                  <span className="block text-[10px] opacity-70 uppercase tracking-wider mt-0.5">Immediate</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('credit')}
                className={`group flex flex-col items-center gap-3 py-5 px-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${paymentType === 'credit' ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:border-red-300'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${paymentType === 'credit' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <span className="material-symbols-outlined text-[26px]" style={{fontVariationSettings:"'FILL' 1"}}>pending_actions</span>
                </div>
                <div className="text-center">
                  <span className="block font-bold text-sm">Udhar</span>
                  <span className="block text-[10px] opacity-70 uppercase tracking-wider mt-0.5">Credit Entry</span>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200  overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className={sectionHeader}>
                <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[16px]">event_note</span>
                </span>
                Schedule & Notes
              </h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2 min-w-0">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date (for Udhar)</label>
                <input
                  type="date"
                  disabled={paymentType === 'cash'}
                  className="w-full py-3.5 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all outline-none text-[16px] appearance-none"
                  style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield',
                    fontSize: '16px',
                    padding: '12px 16px',
                    minHeight: '48px'
                  }}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Internal Notes</label>
                <textarea
                  className="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm text-slate-800 h-[88px] resize-none placeholder:text-slate-300 outline-none transition-all"
                  placeholder="e.g. Delivery instructions, special notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            onClick={save}
            disabled={uploadingReceipt}
            className="w-full py-5 bg-primary text-white rounded-2xl font-bold text-base hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[22px]" style={{fontVariationSettings:"'FILL' 1"}}>done_all</span>
            {uploadingReceipt ? 'Uploading Receipt...' : 'CONFIRM PURCHASE'}
          </button>
        </div>

        <aside className="lg:col-span-4 hidden lg:flex flex-col gap-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col gap-5 sticky top-24">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Order Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                  {selectedFarmer ? `${selectedFarmer.firstName} ${selectedFarmer.lastName || ''}` : quickName || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Payment</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${paymentType === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {paymentType === 'cash' ? 'DIRECT PAYMENT' : 'UDHAR / CREDIT'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Items</span>
                <span className="text-slate-800 font-medium">{items.filter((i) => i.name).length}</span>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total</span>
                  <span className="text-3xl font-black text-primary">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={save}
              disabled={uploadingReceipt}
              className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>done_all</span>
              {uploadingReceipt ? 'Uploading...' : 'Confirm'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
