import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { useSession } from './SessionContext';

const schema = z.object({
  username: z.string().min(3, 'Ingrese al menos 3 caracteres').max(80),
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres').max(200)
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login, busy } = useSession();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.username, values.password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible iniciar sesión.');
    }
  });

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">💧</div>
        <p className="eyebrow">Control operativo</p>
        <h1 id="login-title">Sistema Agua Pura</h1>
        <p className="muted">Inicia sesión para continuar.</p>
        <form onSubmit={submit} noValidate>
          <label>Usuario<input autoComplete="username" {...register('username')} /></label>
          {errors.username && <span className="field-error">{errors.username.message}</span>}
          <label>Contraseña<input type="password" autoComplete="current-password" {...register('password')} /></label>
          {errors.password && <span className="field-error">{errors.password.message}</span>}
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
        <p className="muted"><a href="/enroll">¿Tiene una invitación QR para este dispositivo?</a></p>
      </section>
    </main>
  );
}
