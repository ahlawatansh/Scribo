import { collection, doc, onSnapshot, query, where, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { db } from '../../firebase/db';
import { alert } from '../../utils/alert';
import { formatCurrency } from '../../utils/formatCurrency';

function toastErrorOnce(message, id) {
  alert.error(message, { id: `err:${id}` });
}

function notifyLoadError(err, fallback) {
  const msg = err?.message || '';
  if (msg.toLowerCase().includes('query requires an index')) {
    toastErrorOnce('First-time setup running. Create the Firestore index and refresh.', 'firestore-index');
    return;
  }
  toastErrorOnce(msg || fallback, (msg || fallback).toLowerCase().slice(0, 80));
}

export default function Balance() {
  const { farmerId, farmerData } = useAuth();
  const [pending, setPending] = useState([]);
  const [creditRows, setCreditRows] = useState([]);
  const [liveFarmer, setLiveFarmer] = useState(farmerData);

  useEffect(() => { setLiveFarmer(farmerData); }, [farmerData]);

  useEffect(() => {
    if (!farmerId) return;
    const unsubFarmer = onSnapshot(
      doc(db, 'farmers', farmerId),
      (snap) => { if (snap.exists()) setLiveFarmer({ id: snap.id, ...snap.data() }); },
      (err) => notifyLoadError(err, 'Could not load balance.')
    );
    return () => unsubFarmer?.();
  }, [farmerId]);

  useEffect(() => {
    if (!farmerId) return;
    const unsub = onSnapshot(
      query(collection(db, 'transactions'), where('farmerId', '==', farmerId)),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const credits = rows.filter((r) => r.type === 'credit');
        setCreditRows(credits);
        const filtered = credits.filter((r) => ['pending', 'partial'].includes(r.status));
        filtered.sort((a, b) => {
          const ad = a?.createdAt?.toDate ? a.createdAt.toDate() : a?.createdAt ? new Date(a.createdAt) : null;
          const bd = b?.createdAt?.toDate ? b.createdAt.toDate() : b?.createdAt ? new Date(b.createdAt) : null;
          const at = ad && !Number.isNaN(ad.getTime()) ? ad.getTime() : 0;
          const bt = bd && !Number.isNaN(bd.getTime()) ? bd.getTime() : 0;
          return bt - at;
        });
        setPending(filtered);
      },
      (err) => notifyLoadError(err, 'Could not load purchase history.')
    );
    return () => unsub?.();
  }, [farmerId]);

  const outstanding = pending.reduce((sum, r) => sum + Number(r.remainingAmount || 0), 0);
  const totalGiven = creditRows.length
    ? creditRows.reduce((sum, r) => sum + Number(r.grandTotal || 0), 0)
    : Number(liveFarmer?.totalUdharGiven || 0);
  const totalPaid = liveFarmer?.totalPaid || 0;

  const ownerUpiId = '7357133910@upi';
  const ownerMobile = '+917357133910';
  const ownerName = 'Scribo';
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const buildUpiParams = (amount, note) => new URLSearchParams({
    pa: ownerUpiId,
    pn: ownerName,
    am: Number(amount || 0).toFixed(2),
    cu: 'INR',
    tn: note,
  }).toString();

  const openUpiPaymentApp = (amount, note) => {
    const isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    const description = `${note} | Mobile: ${ownerMobile}`;
    const params = buildUpiParams(amount, description);
    const upiUrl = `upi://pay?${params}`;

    if (!isPhone) {
      navigator.clipboard?.writeText(ownerUpiId).catch(() => {});
      alert.error('Open this on a phone with a UPI payment app installed. UPI ID copied.', { id: 'upi-mobile-only' });
      return;
    }

    window.location.href = upiUrl;
  };

  const generatePaymentNote = (transaction) => {
    const date = transaction.createdAt?.toDate ? transaction.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
    const items = transaction.items || [];
    const itemsText = items.length > 0 ? items.map(item => `${item.name || 'Item'} x${item.qty || item.quantity || 1}`).join(', ') : 'N/A';
    return `Payment for: ${date} | Items: ${itemsText} | Total: ${formatCurrency(transaction.grandTotal || 0)}`;
  };

  const handlePayNow = () => {
    if (outstanding <= 0) {
      alert.error('No outstanding amount to pay.', { id: 'no-outstanding' });
      return;
    }

    const paymentDetails = pending.map(p => {
      const date = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
      const items = p.items || [];
      const itemsText = items.length > 0 ? items.map(item => `${item.name || 'Item'} x${item.qty || item.quantity || 1}`).join(', ') : 'N/A';
      return `${date}: ${itemsText} - ${formatCurrency(p.remainingAmount || 0)}`;
    }).join(' | ');

    const note = `Shyam dues: ${paymentDetails}`;

    openUpiPaymentApp(outstanding, note);
  };

  const handlePayIndividual = (transaction) => {
    const note = generatePaymentNote(transaction);
    const amount = transaction.remainingAmount || 0;

    openUpiPaymentApp(amount, note);
  };

  const handleConfirmPayment = async () => {
    if (outstanding <= 0 || paymentConfirmed) return;

    setConfirmingPayment(true);
    try {

      const updatePromises = pending.map(p => {
        const transactionRef = doc(db, 'transactions', p.id);
        return updateDoc(transactionRef, {
          status: 'cleared',
          remainingAmount: 0,
          clearedAt: serverTimestamp()
        });
      });

      await Promise.all(updatePromises);

      const farmerName = liveFarmer?.firstName ? `${liveFarmer.firstName} ${liveFarmer.lastName || ''}` : liveFarmer?.fullName || 'Customer';
      await addDoc(collection(db, 'notifications'), {
        type: 'payment_received',
        title: 'Payment Received',
        message: `${farmerName} paid ${formatCurrency(outstanding)} via UPI`,
        customerTitle: 'Payment submitted',
        customerMessage: `Your ${formatCurrency(outstanding)} payment update was sent to Scribo.`,
        amount: outstanding,
        farmerId: farmerId,
        farmerName: farmerName,
        createdAt: serverTimestamp(),
        read: false
      });

      alert.success('Payment confirmed! Your dues have been cleared.', { id: 'payment-confirmed' });
      setPaymentConfirmed(true);
    } catch (e) {
      console.error('Payment confirmation error:', e);
      alert.error('Failed to confirm payment. Please try again.', { id: 'payment-confirm-error' });
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleConfirmIndividualPayment = async (transaction) => {
    setConfirmingPayment(true);
    try {
      const transactionRef = doc(db, 'transactions', transaction.id);
      await updateDoc(transactionRef, {
        status: 'cleared',
        remainingAmount: 0,
        clearedAt: serverTimestamp()
      });

      const farmerName = liveFarmer?.firstName ? `${liveFarmer.firstName} ${liveFarmer.lastName || ''}` : liveFarmer?.fullName || 'Customer';
      await addDoc(collection(db, 'notifications'), {
        type: 'payment_received',
        title: 'Payment Received',
        message: `${farmerName} paid ${formatCurrency(transaction.remainingAmount || 0)} via UPI`,
        customerTitle: 'Payment submitted',
        customerMessage: `Your ${formatCurrency(transaction.remainingAmount || 0)} payment update was sent to Scribo.`,
        amount: transaction.remainingAmount || 0,
        farmerId: farmerId,
        farmerName: farmerName,
        createdAt: serverTimestamp(),
        read: false
      });

      alert.success('Payment confirmed!', { id: 'payment-confirmed' });
    } catch (e) {
      console.error('Payment confirmation error:', e);
      alert.error('Failed to confirm payment. Please try again.', { id: 'payment-confirm-error' });
    } finally {
      setConfirmingPayment(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">

      <div className="bg-primary rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div>
          <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Hello, {liveFarmer?.firstName || 'Farmer'}</p>
          <h2 className="text-4xl font-black tracking-tight text-white mt-2">{formatCurrency(outstanding)}</h2>
          <p className="text-xs text-white/70 mt-1.5 font-medium">Amount to Pay</p>
        </div>
        {outstanding > 0 && (
          <div className="mt-4 inline-flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            Payment pending
          </div>
        )}
        {outstanding > 0 && (
          <button
            onClick={handlePayNow}
            className="w-full mt-4 bg-white text-primary py-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings:"'FILL' 1"}}>payment</span>
            Pay Now
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-3xl p-4 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px] text-slate-500" style={{fontVariationSettings:"'FILL' 1"}}>account_balance_wallet</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Udhar Issued</p>
              <p className="text-lg font-bold text-slate-800 leading-tight">{formatCurrency(totalGiven)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-4 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px] text-emerald-600" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Paid</p>
              <p className="text-lg font-bold text-emerald-600 leading-tight">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 text-sm">Pending Dues</h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 border border-green-200 text-slate-600 font-bold">
            {pending.length} {pending.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {pending.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-green-100">
            <span className="material-symbols-outlined text-3xl text-emerald-400 block mb-2" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>
            <p className="text-sm text-slate-400">No pending dues. You&apos;re all clear!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => {
              const rd = p.returnDate?.toDate ? p.returnDate.toDate() : p.returnDate ? new Date(p.returnDate) : null;
              const isOverdue = rd ? rd.getTime() < Date.now() : false;
              const formattedDate = rd ? rd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
              const paymentDate = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
              const items = p.items || [];
              const itemsText = items.length > 0 ? items.map(item => `${item.name || 'Item'} x${item.quantity || 1}`).join(', ') : 'N/A';
              return (
                <div
                  key={p.id}
                  className={`rounded-3xl border p-4 space-y-3 transition-all ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-green-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 min-w-0">
                      <p className={`font-bold text-lg ${isOverdue ? 'text-red-600' : 'text-slate-800'}`}>{formatCurrency(p.remainingAmount || 0)}</p>
                      <p className="text-xs text-slate-400 uppercase tracking-wider truncate">
                        Due: <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>{formattedDate}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handlePayIndividual(p)}
                      className="w-12 h-12 rounded-xl bg-white text-primary flex items-center justify-center active:scale-[0.98] transition-all flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings:"'FILL' 1"}}>payment</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <div className="text-xs text-slate-500 space-y-1">
                      <p><span className="font-semibold">Payment Date:</span> {paymentDate}</p>
                      <p><span className="font-semibold">Items:</span> {itemsText || 'N/A'}</p>
                      <p><span className="font-semibold">Grand Total:</span> {formatCurrency(p.grandTotal || 0)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
