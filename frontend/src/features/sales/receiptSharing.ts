export type ReceiptShareResult = 'SHARED' | 'DOWNLOADED_WITH_WHATSAPP' | 'CANCELLED';

type ReceiptShareDetails = { documentNumber: string; customerName: string };

export function downloadReceiptFile(blob: Blob, documentNumber: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comprobante-${documentNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function shareReceiptFile(blob: Blob, details: ReceiptShareDetails): Promise<ReceiptShareResult> {
  const filename = `comprobante-${details.documentNumber}.pdf`;
  const message = `Hola ${details.customerName}. Adjunto su comprobante interno ${details.documentNumber} de la purificadora de agua.`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  const shareData: ShareData = { title: `Comprobante ${details.documentNumber}`, text: message, files: [file] };

  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return 'SHARED';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'CANCELLED';
      throw error;
    }
  }

  downloadReceiptFile(blob, details.documentNumber);
  const fallbackMessage = `${message} El PDF quedó descargado; puede adjuntarlo a este chat.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(fallbackMessage)}`, '_blank', 'noopener,noreferrer');
  return 'DOWNLOADED_WITH_WHATSAPP';
}
