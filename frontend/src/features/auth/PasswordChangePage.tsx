import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useSession } from './SessionContext';

const schema = z.object({
  currentPassword: z.string().min(12, 'Ingrese su contrasena temporal').max(128),
  newPassword: z.string().min(12, 'La nueva contrasena debe tener al menos 12 caracteres').max(128),
  confirmation: z.string().min(12).max(128),
}).refine((values) => values.newPassword === values.confirmation, {
  message: 'Las contrasenas no coinciden', path: ['confirmation'],
});

type FormValues = z.infer<typeof schema>;

export function PasswordChangePage() {
  const { changePassword, busy, logout } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cambiar la contraseña.');
    }
  });

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-title">
        <p className="eyebrow">Seguridad de la cuenta</p>
        <h1 id="password-title">Cambiar contraseña</h1>
        <p className="muted">La contraseña temporal debe reemplazarse antes de utilizar el sistema.</p>
        <form onSubmit={submit} noValidate>
          <label>
            Contraseña temporal
            <div className="password-input-wrapper">
              <input type={showCurrent ? 'text' : 'password'} autoComplete="current-password" {...register('currentPassword')} />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCurrent(v => !v)}
                aria-label={showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showCurrent ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </label>
          {errors.currentPassword && <span className="field-error">{errors.currentPassword.message}</span>}

          <label>
            Nueva contraseña
            <div className="password-input-wrapper">
              <input type={showNew ? 'text' : 'password'} autoComplete="new-password" {...register('newPassword')} />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowNew(v => !v)}
                aria-label={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showNew ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </label>
          {errors.newPassword && <span className="field-error">{errors.newPassword.message}</span>}

          <label>
            Confirmar nueva contraseña
            <div className="password-input-wrapper">
              <input type={showConfirm ? 'text' : 'password'} autoComplete="new-password" {...register('confirmation')} />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirm ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </label>
          {errors.confirmation && <span className="field-error">{errors.confirmation.message}</span>}
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Actualizando...' : 'Cambiar contrasena'}</button>
          <button className="secondary" type="button" onClick={() => void logout()} disabled={busy}>Cerrar sesion</button>
        </form>
      </section>
    </main>
  );
}
