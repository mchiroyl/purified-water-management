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
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cambiar la contrasena.');
    }
  });

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-title">
        <p className="eyebrow">Seguridad de la cuenta</p>
        <h1 id="password-title">Cambiar contrasena</h1>
        <p className="muted">La contrasena temporal debe reemplazarse antes de utilizar el sistema.</p>
        <form onSubmit={submit} noValidate>
          <label>Contrasena temporal<input type="password" autoComplete="current-password" {...register('currentPassword')} /></label>
          {errors.currentPassword && <span className="field-error">{errors.currentPassword.message}</span>}
          <label>Nueva contrasena<input type="password" autoComplete="new-password" {...register('newPassword')} /></label>
          {errors.newPassword && <span className="field-error">{errors.newPassword.message}</span>}
          <label>Confirmar nueva contrasena<input type="password" autoComplete="new-password" {...register('confirmation')} /></label>
          {errors.confirmation && <span className="field-error">{errors.confirmation.message}</span>}
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Actualizando...' : 'Cambiar contrasena'}</button>
          <button className="secondary" type="button" onClick={() => void logout()} disabled={busy}>Cerrar sesion</button>
        </form>
      </section>
    </main>
  );
}
