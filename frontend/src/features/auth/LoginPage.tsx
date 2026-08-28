import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { QRCodeSVG } from 'qrcode.react';
import { z } from 'zod';
import { apiRequest } from '../../services/apiClient';
import { getDeviceName, saveKnownDeviceId } from './deviceIdentity';
import { useSession } from './SessionContext';

const schema = z.object({
  username: z.string().min(3, 'Ingrese al menos 3 caracteres').max(80),
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres').max(200)
});

type FormValues = z.infer<typeof schema>;
type Reenrollment = { id: string; username: string; token?: string; status: string; deviceName: string; expiresAt: string; deviceId?: string };
const statusText: Record<string, string> = { PENDING: 'pendiente de aprobación', APPROVED: 'aprobada', REJECTED: 'rechazada', EXPIRED: 'expirada', USED: 'completada' };

export function LoginPage() {
  const { login, busy } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [reenrollment, setReenrollment] = useState<Reenrollment | null>(null);
  const [reEnrollmentMode, setReEnrollmentMode] = useState(false);
  const completeInProgress = useRef(false);
  const deviceName = useMemo(() => getDeviceName(), []);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try { await login(values.username, values.password, deviceName); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible iniciar sesión.'); }
  });
  const requestReenrollment = handleSubmit(async (values) => {
    setError(null); completeInProgress.current = false;
    try {
      const request = await apiRequest<Reenrollment>('/auth/device-reenrollment/request', { method: 'POST', body: JSON.stringify({ username: values.username, password: values.password, deviceName }) });
      setReenrollment(request);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible crear la solicitud.'); }
  });

  useEffect(() => {
    if (!reenrollment?.token || reenrollment.status !== 'PENDING') return;
    const poll = window.setInterval(async () => {
      try {
        const status = await apiRequest<Reenrollment>(`/auth/device-reenrollment/${encodeURIComponent(reenrollment.token!)}/status`);
        setReenrollment(current => current ? { ...status, token: current.token } : current);
        if (status.status === 'APPROVED' && !completeInProgress.current) {
          completeInProgress.current = true;
          const complete = await apiRequest<Reenrollment>(`/auth/device-reenrollment/${encodeURIComponent(reenrollment.token!)}/complete`, { method: 'POST' });
          if (!complete.deviceId) throw new Error('No fue posible registrar el nuevo dispositivo.');
          saveKnownDeviceId(complete.deviceId);
          await login(getValues('username'), getValues('password'), deviceName);
        }
      } catch (cause) { completeInProgress.current = false; setError(cause instanceof Error ? cause.message : 'No fue posible consultar la solicitud.'); }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [deviceName, getValues, login, reenrollment?.status, reenrollment?.token]);

  const qrValue = reenrollment?.token ? `${window.location.origin}/administration?device-reenrollment-token=${encodeURIComponent(reenrollment.token)}` : '';
  return <main className="auth-page"><section className="auth-card" aria-labelledby="login-title">
    <div className="brand-mark" aria-hidden="true">💧</div><p className="eyebrow">Control operativo</p><h1 id="login-title">Sistema Agua Pura</h1>
    <p className="muted">{reEnrollmentMode ? 'Solicite autorización para reinscribir este dispositivo.' : 'Inicia sesión para continuar.'}</p>
    <form onSubmit={reEnrollmentMode ? requestReenrollment : submit} noValidate>
      <label>Usuario<input autoComplete="username" {...register('username')} /></label>{errors.username && <span className="field-error">{errors.username.message}</span>}
      <label>Contraseña<input type="password" autoComplete="current-password" {...register('password')} /></label>{errors.password && <span className="field-error">{errors.password.message}</span>}
      {reenrollment && <div className="reenrollment-card" role="status"><strong>Solicitud {statusText[reenrollment.status] ?? reenrollment.status}</strong>{reenrollment.token && <><QRCodeSVG value={qrValue} size={156} includeMargin /><code>{reenrollment.token}</code><small>Escanee el QR desde la sesión del administrador o use el código temporal para identificar la solicitud.</small></>}<small>Expira: {new Date(reenrollment.expiresAt).toLocaleString('es-GT')}</small></div>}
      {error && <div className="alert error" role="alert">{error}</div>}
      <button className="primary" type="submit" disabled={busy || Boolean(reenrollment && reenrollment.status === 'PENDING')}>{reEnrollmentMode ? 'Solicitar reinscripción' : busy ? 'Ingresando…' : 'Ingresar'}</button>
      <button className="link-button" type="button" onClick={() => { setReEnrollmentMode(value => !value); setReenrollment(null); setError(null); completeInProgress.current = false; }}>{reEnrollmentMode ? 'Volver a iniciar sesión' : 'Reinscribir dispositivo'}</button>
    </form>
  </section></main>;
}
