import { jsPDF } from 'jspdf';

export const RECEIPT_STORE_NAME = 'Scribo';
export const RECEIPT_BUSINESS_LINE = 'The smart digital ledger for growing small businesses';
export const RECEIPT_DEALER_LINE = 'Your complete business dashboard, right in your pocket';

export function generateReceiptPdf(transaction) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [16, 124, 65];
  const secondaryColor = [71, 85, 105];
  const darkTextColor = [15, 23, 42];
  const lightGray = [248, 250, 252];

  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(RECEIPT_STORE_NAME, 15, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(RECEIPT_BUSINESS_LINE, 15, 20);
  doc.text(RECEIPT_DEALER_LINE, 15, 26);

  doc.setTextColor(...darkTextColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('INVOICE / LEDGER ENTRY', 15, 52);

  const dateStr = transaction.createdAt
    ? (transaction.createdAt.toDate ? transaction.createdAt.toDate() : new Date(transaction.createdAt))
      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date & Time:   ${dateStr}`, 15, 58);
  doc.text(`Month:   ${(transaction.season || '').replace('_', ' ').toUpperCase()}`, 15, 63);

  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO (CUSTOMER):', 120, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name:   ${transaction.farmerName || 'Customer'}`, 120, 58);
  doc.text(`Mobile: +91 ${transaction.farmerMobile || '—'}`, 120, 63);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, 74, 195, 74);

  let y = 82;
  doc.setFillColor(...lightGray);
  doc.rect(15, y - 5, 180, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(9);
  doc.text('S.No', 17, y);
  doc.text('Item Description', 32, y);
  doc.text('Qty', 120, y, { align: 'center' });
  doc.text('Rate', 150, y, { align: 'right' });
  doc.text('Total', 190, y, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(15, y + 4, 195, y + 4);

  y += 11;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkTextColor);

  const items = transaction.items || [];
  items.forEach((item, index) => {
    const sNo = index + 1;
    const rateVal = Number(item.rate) || 0;
    const qtyVal = Number(item.qty) || 0;
    const rowTotal = item.total || (rateVal * qtyVal);

    doc.text(String(sNo), 17, y);

    doc.text(String(item.name || 'Item'), 32, y);

    doc.text(String(qtyVal), 120, y, { align: 'center' });

    doc.text(`Rs. ${rateVal.toLocaleString('en-IN')}`, 150, y, { align: 'right' });

    doc.text(`Rs. ${rowTotal.toLocaleString('en-IN')}`, 190, y, { align: 'right' });

    y += 8;
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(15, y - 4, 195, y - 4);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('LEDGER SUMMARY', 120, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);

  y += 6;
  doc.text('Subtotal Amount:', 120, y);
  doc.text(`Rs. ${Number(transaction.grandTotal).toLocaleString('en-IN')}`, 190, y, { align: 'right' });

  y += 6;
  const isCredit = transaction.type === 'credit';
  doc.text(isCredit ? 'Amount Added to Credit:' : 'Amount Paid (Direct):', 120, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(isCredit ? [220, 38, 38] : primaryColor));
  doc.text(`Rs. ${Number(transaction.grandTotal).toLocaleString('en-IN')}`, 190, y, { align: 'right' });

  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.35);
  doc.line(145, 251, 195, 251);
  doc.setTextColor(...darkTextColor);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Ansh Ahlawat', 170, 247, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(...secondaryColor);
  doc.text('Proprietor', 170, 257, { align: 'center' });

  y = 265;
  doc.setDrawColor(226, 232, 240);
  doc.line(15, y, 195, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.text('Thank you for your trust & business!', 105, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.setFontSize(8);
  doc.text('Ditch the spreadsheets. Take control of your business with Scribo.', 105, y, { align: 'center' });

  return doc;
}
