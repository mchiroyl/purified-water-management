import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareReceiptFile } from './receiptSharing';

afterEach(() => vi.restoreAllMocks());

describe('shareReceiptFile', () => {
  it('shares the PDF file with the native Web Share API when supported', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    const result = await shareReceiptFile(new Blob(['%PDF'], { type: 'application/pdf' }), {
      documentNumber: 'V-42', customerName: 'Tienda Centro'
    });

    expect(result).toBe('SHARED');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Comprobante V-42', files: [expect.any(File)]
    }));
    expect(open).not.toHaveBeenCalled();
  });

  it('downloads the PDF and opens the official WhatsApp link as fallback', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => false) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:receipt') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    const result = await shareReceiptFile(new Blob(['%PDF'], { type: 'application/pdf' }), {
      documentNumber: 'V-42', customerName: 'Tienda Centro'
    });

    expect(result).toBe('DOWNLOADED_WITH_WHATSAPP');
    expect(click).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/\?text=/), '_blank', 'noopener,noreferrer');
  });
});
