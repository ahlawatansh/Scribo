import jsPDF from 'jspdf';

export function exportFarmerLedger(farmer, transactions) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Scribo - Customer Ledger', 15, 15);
  doc.setFontSize(11);
  doc.text(`Name: ${farmer.firstName} ${farmer.lastName || ''}`, 15, 25);
  let y = 35;
  transactions.forEach((t) => {
    doc.text(`${t.type} - Rs. ${t.grandTotal}`, 15, y);
    y += 7;
  });
  doc.save('farmer-ledger.pdf');
}

export function exportSeasonReport(data, season) {
  const doc = new jsPDF();
  doc.text(`Season Report - ${season}`, 15, 15);
  doc.text(`Total Credit: Rs. ${data.totalCreditGiven || 0}`, 15, 30);
  doc.save('season-report.pdf');
}
