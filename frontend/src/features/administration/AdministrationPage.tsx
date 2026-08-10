import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';

type UserAdmin = {
  id: string; username: string; email: string; status: string; mustChangePassword: boolean;
  roles: string[]; sellerId?: string; sellerCode?: string; sellerDisplayName?: string; createdAt: string;
};
type DeviceAdmin = {
  id: string; userId: string; username: string; friendlyName: string; status: string; appVersion?: string;
  firstSeenAt: string; lastSeenAt: string; revokedAt?: string;
};
const roleOptions = ['ADMINISTRADOR', 'BODEGA', 'VENDEDOR', 'SUPERVISOR'];

export function AdministrationPage() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ['administration', 'users'], queryFn: () => apiRequest<UserAdmin[]>('/administration/users') });
  const devices = useQuery({ queryKey: ['administration', 'devices'], queryFn: () => apiRequest<DeviceAdmin[]>('/administration/devices') });
  const [form, setForm] = useState({ username: '', email: '', password: '', roles: ['VENDEDOR'], sellerCode: '', sellerDisplayName: '' });
  const create = useMutation({
    mutationFn: () => apiRequest<UserAdmin>('/administration/users', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ username: '', email: '', password: '', roles: ['VENDEDOR'], sellerCode: '', sellerDisplayName: '' });
      void queryClient.invalidateQueries({ queryKey: ['administration', 'users'] });
    }
  });
  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => apiRequest<UserAdmin>(`/administration/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['administration', 'users'] })
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest<DeviceAdmin>(`/administration/devices/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['administration', 'devices'] })
  });
  const toggleRole = (role: string) => setForm(current => ({
    ...current, roles: current.roles.includes(role) ? current.roles.filter(item => item !== role) : [...current.roles, role]
  }));
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };

  return <main>
    <p className="eyebrow">Configuración</p>
    <h1>Usuarios y vendedores</h1>
    <p className="muted">Crea accesos por rol, registra los datos del vendedor y controla los teléfonos autorizados.</p>
    <form className="form-grid panel" onSubmit={submit}>
      <h2 className="wide">Nuevo usuario</h2>
      <label>Usuario<input required minLength={3} value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></label>
      <label>Correo<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <label>Contraseña temporal<input required type="password" minLength={12} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
      <fieldset className="role-fieldset"><legend>Roles</legend>{roleOptions.map(role => <label className="checkbox" key={role}>
        <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />{role}
      </label>)}</fieldset>
      {form.roles.includes('VENDEDOR') && <>
        <label>Código de vendedor<input required value={form.sellerCode} onChange={event => setForm({ ...form, sellerCode: event.target.value })} /></label>
        <label>Nombre del vendedor<input required value={form.sellerDisplayName} onChange={event => setForm({ ...form, sellerDisplayName: event.target.value })} /></label>
      </>}
      {create.error && <div className="alert error wide">{create.error.message}</div>}
      <button className="primary" disabled={create.isPending || form.roles.length === 0}>{create.isPending ? 'Creando…' : 'Crear usuario'}</button>
    </form>
    <section className="panel section-panel">
      <h2>Usuarios registrados</h2>
      {users.isLoading && <p>Cargando usuarios…</p>}
      {users.error && <div className="alert error">{users.error.message}</div>}
      <div className="data-list">{users.data?.map(user => <article className="data-row" key={user.id}>
        <div><strong>{user.sellerDisplayName || user.username}</strong><span>{user.sellerCode ? `${user.sellerCode} · ` : ''}{user.username} · {user.email}</span><small>{user.roles.join(', ')}</small></div>
        <div className="row-actions"><span className={`status ${user.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span>
          <button className="secondary" onClick={() => status.mutate({ id: user.id, next: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}>{user.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button></div>
      </article>)}</div>
    </section>
    <section className="panel section-panel">
      <h2>Dispositivos registrados</h2>
      {devices.error && <div className="alert error">{devices.error.message}</div>}
      <div className="data-list">{devices.data?.map(device => <article className="data-row" key={device.id}>
        <div><strong>{device.friendlyName}</strong><span>{device.username}{device.appVersion ? ` · App ${device.appVersion}` : ''}</span><small>Último acceso: {new Date(device.lastSeenAt).toLocaleString('es-GT')}</small></div>
        <div className="row-actions"><span className={`status ${device.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{device.status === 'ACTIVE' ? 'Activo' : 'Revocado'}</span>
          {device.status !== 'REVOKED' && <button className="secondary danger-button" onClick={() => revoke.mutate(device.id)}>Revocar</button>}</div>
      </article>)}</div>
    </section>
  </main>;
}
