import { RECEIPT_STORE_NAME } from './receiptGenerator';

function formatMobileForWhatsApp(mobile = '') {
  let cleaned = String(mobile).replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = `91${cleaned}`;
  return cleaned;
}

export function getWhatsAppReceiptText(transaction) {
  return `Dear ${transaction?.farmerName || 'Customer'},

Your purchase receipt from ${RECEIPT_STORE_NAME} is ready.

Scribo: Seamless ledgers, smart reports, and happy customers.`;
}

export function getReceiptPdfDownloadUrl(fileUrl, transaction = null) {
  if (!fileUrl) return '';

  try {
    const url = new URL(fileUrl);
    const uploadPath = '/raw/upload/';
    if (!url.hostname.includes('cloudinary.com') || !url.pathname.includes(uploadPath)) {
      return fileUrl;
    }
    if (url.pathname.includes(`${uploadPath}fl_attachment`)) {
      return fileUrl;
    }

    const filename = getReceiptPdfFileName(transaction)
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    const [prefix, suffix] = url.pathname.split(uploadPath);
    url.pathname = `${prefix}${uploadPath}fl_attachment:${filename}/${suffix}`;
    return url.toString();
  } catch {
    return fileUrl;
  }
}

async function canDeliverReceiptUrl(fileUrl) {
  if (!fileUrl || typeof fetch === 'undefined') return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(fileUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveReceiptPdfDownloadUrl(fileUrl, transaction = null) {
  if (!fileUrl) return '';

  const downloadUrl = getReceiptPdfDownloadUrl(fileUrl, transaction);
  if (await canDeliverReceiptUrl(downloadUrl)) return downloadUrl;
  if (downloadUrl !== fileUrl && await canDeliverReceiptUrl(fileUrl)) return fileUrl;

  return '';
}

export function getWhatsAppReceiptMessage(transaction, receiptPdfUrl = '') {
  const receiptText = getWhatsAppReceiptText(transaction);
  const downloadUrl = getReceiptPdfDownloadUrl(receiptPdfUrl, transaction);
  const closingText = `Manage transactions, delight customers, and grow your business with Scribo.\n${RECEIPT_STORE_NAME}`;

  if (!downloadUrl) return `${receiptText}\n\n${closingText}`;
  return `${receiptText}\n\nDownload Receipt PDF: ${downloadUrl}\n\n${closingText}`;
}

export function getManualWhatsAppShareLink(transaction, receiptPdfUrl = '') {
  const mobile = formatMobileForWhatsApp(transaction?.farmerMobile || '');
  const text = getWhatsAppReceiptMessage(transaction, receiptPdfUrl || transaction?.receiptPdfDownloadUrl || transaction?.receiptPdfUrl || '');
  return `https://api.whatsapp.com/send?phone=${mobile}&text=${encodeURIComponent(text)}`;
}

export function getReceiptPdfFileName(transaction) {
  const safeName = (transaction?.farmerName || 'Customer').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  return `Receipt_${safeName}_${Date.now().toString().slice(-6)}.pdf`;
}

function createPdfFile(pdfDoc, filename) {
  const blob = pdfDoc.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
}

export async function sendReceiptPdfToCustomer(transaction, pdfDoc) {
  const filename = getReceiptPdfFileName(transaction);
  const text = getWhatsAppReceiptText(transaction);

  if (typeof navigator !== 'undefined' && pdfDoc) {
    try {
      const file = createPdfFile(pdfDoc, filename);
      const sharePayload = {
        title: `${RECEIPT_STORE_NAME} Receipt`,
        text,
        files: [file],
      };

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share(sharePayload);
        return { ok: true, method: 'native-file-share' };
      }
    } catch (error) {

      if (error?.name === 'AbortError') {
        return { ok: false, method: 'native-file-share-cancelled', error };
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.open(getManualWhatsAppShareLink(transaction), '_blank', 'noopener,noreferrer');
    return { ok: true, method: 'whatsapp-prefilled-text' };
  }

  return { ok: false, method: 'unavailable' };
}

export async function sendReceiptViaWhatsApp(transaction, pdfDoc = null) {
  return sendReceiptPdfToCustomer(transaction, pdfDoc);
}
