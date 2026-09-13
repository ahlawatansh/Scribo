import { differenceInDays } from 'date-fns';

export function calculateCreditScore(transactions) {
  const creditTxns = transactions.filter((t) => t.type === 'credit');
  if (!creditTxns.length) return { score: null, suggestedLimit: 0 };
  const now = new Date();
  let onTime = 0;
  let late = 0;
  let missed = 0;
  creditTxns.forEach((t) => {
    if (t.status === 'cleared' && t.clearedAt && t.returnDate) {
      (t.clearedAt.toDate() <= t.returnDate.toDate()) ? onTime++ : late++;
    } else if ((t.status === 'pending' || t.status === 'partial') && t.returnDate) {
      if (differenceInDays(now, t.returnDate.toDate()) > 90) missed++;
    }
  });
  const score = missed || late > onTime ? 'risk' : late ? 'good' : 'ideal';
  return { score, suggestedLimit: 0 };
}
