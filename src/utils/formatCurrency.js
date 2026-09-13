export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return 'Rs. 0';
  return `Rs. ${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
