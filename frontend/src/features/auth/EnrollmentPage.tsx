import { useEffect, useRef, useState } from 'react';
import { useSession } from './SessionContext';

export function EnrollmentPage() {
  const { enroll, busy } = useSession();
  const [token, setToken] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('token');
    const value = fromUrl?.trim() ?? '';
    return value.length > 64 && value.length % 64 === 0 && /^([A-Za-z0-9_-]{64})+$/.test(value)
      ? value.slice(0, 64)
      : value;
  });
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), []);

  const scan = async () => {
    setError(null);
    const Detector = (window as unknown as { BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect(video: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
    }}).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite escanear QR. Pegue el token manualmente.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new Detector({ formats: ['qr_code'] });
      const find = async () => {
        if (!streamRef.current || !videoRef.current) return;
        const codes = await detector.detect(videoRef.current);
        const value = codes[0]?.rawValue;
        if (value) {
          setToken(value);
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          setCameraOpen(false);
          return;
        }
        window.setTimeout(() => void find(), 250);
      };
      void find();
    } catch {
      setError('No fue posible acceder a la cámara. Puede pegar el token manualmente.');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await enroll(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La invitación no es válida.');
    }
  };

  return <main className="auth-page">
    <section className="auth-card" aria-labelledby="enrollment-title">
      <div className="brand-mark" aria-hidden="true">💧</div>
      <p className="eyebrow">Alta controlada</p>
      <h1 id="enrollment-title">Registrar dispositivo</h1>
      <p className="muted">Escanee el QR que le mostró el administrador o pegue su contenido.</p>
      {cameraOpen && <video ref={videoRef} className="qr-camera" aria-label="Vista previa de cámara" muted playsInline />}
      <form onSubmit={submit} noValidate>
        <label>Token de invitación
          <textarea required value={token} onChange={event => setToken(event.target.value)} placeholder="https://sistema/enroll?token=…" />
        </label>
        <button className="secondary" type="button" onClick={() => void scan()} disabled={cameraOpen}>Usar cámara para escanear QR</button>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="primary" type="submit" disabled={busy || !token.trim()}>{busy ? 'Registrando…' : 'Aceptar invitación'}</button>
      </form>
      <a className="text-button" href="/">Volver al inicio de sesión</a>
    </section>
  </main>;
}
