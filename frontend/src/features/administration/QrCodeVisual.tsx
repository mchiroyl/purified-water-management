import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QrCodeVisual({ value }: { value: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, value, { width: 240, margin: 2, errorCorrectionLevel: 'M' });
  }, [value]);
  return <canvas ref={canvas} className="qr-visual" role="img" aria-label="Código QR de invitación" />;
}
