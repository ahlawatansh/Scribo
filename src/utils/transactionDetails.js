import { formatCurrency } from './formatCurrency';

export function normalizeTransactionItems(transaction = {}) {
  return Array.isArray(transaction.items)
    ? transaction.items
        .filter((item) => item && (item.name || Number(item.qty) || Number(item.rate)))
        .map((item) => {
          const qty = Number(item.qty || 0);
          const rate = Number(item.rate || 0);
          const total = Number(item.total || qty * rate || 0);
          return {
            ...item,
            name: item.name || 'Item',
            qty,
            rate,
            total,
          };
        })
    : [];
}

export function transactionItemsText(transaction = {}) {
  const items = normalizeTransactionItems(transaction);
  if (items.length === 0) return transaction.notes || 'Purchase details not available';
  return items
    .map((item) => `${item.name} — Qty ${item.qty} × ${formatCurrency(item.rate)} = ${formatCurrency(item.total)}`)
    .join(' • ');
}

export function transactionItemsShortText(transaction = {}) {
  const items = normalizeTransactionItems(transaction);
  if (items.length === 0) return transaction.notes || 'No item details';
  if (items.length === 1) {
    const item = items[0];
    return `${item.name} · Qty ${item.qty} · Rate ${formatCurrency(item.rate)} · Total ${formatCurrency(item.total)}`;
  }
  const first = items[0];
  return `${first.name} +${items.length - 1} more · Total ${formatCurrency(transaction.grandTotal || items.reduce((s, i) => s + i.total, 0))}`;
}

export function getTransactionAmount(transaction = {}) {
  const itemsTotal = normalizeTransactionItems(transaction).reduce((sum, item) => sum + item.total, 0);
  return Number(transaction.grandTotal || itemsTotal || 0);
}

export function getCreditPaidAmount(transaction = {}) {
  const grandTotal = getTransactionAmount(transaction);
  const paidAmount = Number(transaction.paidAmount || 0);
  if (transaction.status === 'cleared') return paidAmount || grandTotal;
  return paidAmount;
}

export function getCreditRemainingAmount(transaction = {}) {
  const grandTotal = getTransactionAmount(transaction);
  const paidAmount = getCreditPaidAmount(transaction);
  const storedRemaining = Number(transaction.remainingAmount);
  if (transaction.status === 'cleared') return 0;
  if (Number.isFinite(storedRemaining) && transaction.remainingAmount !== undefined && transaction.remainingAmount !== null) {
    return Math.max(0, storedRemaining);
  }
  return Math.max(0, grandTotal - paidAmount);
}

export function calculateLedgerSummary(transactions = []) {
  return transactions.reduce(
    (summary, transaction) => {
      const grandTotal = getTransactionAmount(transaction);
      if (transaction.type === 'credit') {
        const remainingAmount = getCreditRemainingAmount(transaction);
        const paidAmount = getCreditPaidAmount(transaction);
        summary.totalUdharGiven += grandTotal;
        if (['pending', 'partial'].includes(transaction.status)) {
          summary.totalOutstanding += remainingAmount;
        }
        summary.totalPaid += paidAmount;
        summary.totalPaidAgainstUdhar += paidAmount;
      } else {
        const paidAmount = Number(transaction.paidAmount || grandTotal || 0);
        summary.totalCashSales += grandTotal;
        summary.totalPaid += paidAmount;
      }
      return summary;
    },
    { totalUdharGiven: 0, totalOutstanding: 0, totalPaid: 0, totalPaidAgainstUdhar: 0, totalCashSales: 0 }
  );
}
