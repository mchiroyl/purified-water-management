import { apiBlob } from '../../services/apiClient';

export type VoucherShareResult = 'SHARED' | 'DOWNLOADED_WITH_WHATSAPP' | 'CANCELLED';

export function downloadCreditVoucherFile(blob: Blob, voucherNumber: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comprobante-abono-${voucherNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function shareCreditVoucherFile(
  blob: Blob,
  details: { voucherNumber: string; customerName: string; amount: number }
): Promise<VoucherShareResult> {
  const filename = `comprobante-abono-${details.voucherNumber}.pdf`;
  const message = `Hola ${details.customerName}. Adjunto su comprobante de abono ${details.voucherNumber} por un monto de Q ${details.amount.toFixed(2)} de la purificadora de agua.`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  const shareData: ShareData = { title: `Comprobante de Abono ${details.voucherNumber}`, text: message, files: [file] };

  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return 'SHARED';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'CANCELLED';
      throw error;
    }
  }

  downloadCreditVoucherFile(blob, details.voucherNumber);
  const fallbackMessage = `${message} El comprobante PDF quedó descargado; puede adjuntarlo a este chat.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(fallbackMessage)}`, '_blank', 'noopener,noreferrer');
  return 'DOWNLOADED_WITH_WHATSAPP';
}

export async function fetchAndShareCreditVoucher(
  paymentId: string,
  details: { customerName: string; amount: number }
): Promise<VoucherShareResult> {
  const blob = await apiBlob(`/credit/payments/${paymentId}/voucher`);
  const voucherNum = paymentId.slice(0, 8).toUpperCase();
  return shareCreditVoucherFile(blob, { voucherNumber: voucherNum, customerName: details.customerName, amount: details.amount });
}

export async function fetchAndDownloadCreditVoucher(paymentId: string) {
  const blob = await apiBlob(`/credit/payments/${paymentId}/voucher`);
  const voucherNum = paymentId.slice(0, 8).toUpperCase();
  downloadCreditVoucherFile(blob, voucherNum);
}
