import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '../../app/PageHeader';
import { StatusPanel } from '../../app/StatusPanel';
import { apiRequest } from '../../services/apiClient';
import { QrCodeVisual } from './QrCodeVisual';

type UserAdmin = {
  id: string; username: string; email: string; status: string; mustChangePassword: boolean;
  roles: string[]; sellerId?: string; sellerCode?: string; sellerDisplayName?: string; createdAt: string;
};
type DeviceAdmin = {
  id: string; userId: string; username: string; friendlyName: string; status: string; appVersion?: string;
  firstSeenAt: string; lastSeenAt: string; revokedAt?: string;
};
type EnrollmentInvitation = {
  id: string; userId: string; username: string; status: string; createdAt: string; expiresAt: string;
  token?: string; payload?: string;
};
const roleOptions = ['ADMINISTRADOR', 'BODEGA', 'VENDEDOR', 'SUPERVISOR'];

export function AdministrationPage() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ['administration', 'users'], queryFn: () => apiRequest<UserAdmin[]>('/administration/users') });
  const devices = useQuery({ queryKey: ['administration', 'devices'], queryFn: () => apiRequest<DeviceAdmin[]>('/administration/devices') });
  const invitations = useQuery({ queryKey: ['administration', 'enrollment'], queryFn: () => apiRequest<EnrollmentInvitation[]>('/administration/device-enrollment/invitations') });
  const [form, setForm] = useState({ username: '', email: '', password: '', roles: ['VENDEDOR'], sellerDisplayName: '' });
  const [enrollmentUserId, setEnrollmentUserId] = useState('');
  const [createdInvitation, setCreatedInvitation] = useState<EnrollmentInvitation | null>(null);
  const create = useMutation({
    mutationFn: () => apiRequest<UserAdmin>('/administration/users', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ username: '', email: '', password: '', roles: ['VENDEDOR'], sellerDisplayName: '' });
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
  const createInvitation = useMutation({
    mutationFn: () => apiRequest<EnrollmentInvitation>('/administration/device-enrollment/invitations', {
      method: 'POST', body: JSON.stringify({ userId: enrollmentUserId })
    }),
    onSuccess: invitation => {
      setCreatedInvitation(invitation);
      void queryClient.invalidateQueries({ queryKey: ['administration', 'enrollment'] });
    }
  });
  const revokeInvitation = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/administration/device-enrollment/invitations/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['administration', 'enrollment'] })
  });
  const toggleRole = (role: string) => setForm(current => ({
    ...current, roles: current.roles.includes(role) ? current.roles.filter(item => item !== role) : [...current.roles, role]
  }));
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };

  return <main>
    <PageHeader eyebrow="Configuración" title="Usuarios y vendedores" description="Crea accesos por rol, registra los datos del vendedor y controla los teléfonos autorizados." />
    <form className="form-grid panel" onSubmit={submit}>
      <h2 className="wide">Nuevo usuario</h2>
      <label>Usuario<input required minLength={3} value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></label>
      <label>Correo<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <label>Contraseña temporal<input required type="password" minLength={12} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
      <fieldset className="role-fieldset"><legend>Roles</legend>{roleOptions.map(role => <label className="checkbox" key={role}>
        <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />{role}
      </label>)}</fieldset>
      {form.roles.includes('VENDEDOR') && <>
        <p className="muted wide">El código del vendedor se asigna automáticamente al crear el usuario (VND-000001).</p>
        <label>Nombre del vendedor<input required value={form.sellerDisplayName} onChange={event => setForm({ ...form, sellerDisplayName: event.target.value })} /></label>
      </>}
      {create.error && <div className="alert error wide">{create.error.message}</div>}
      <button className="primary" disabled={create.isPending || form.roles.length === 0}>{create.isPending ? 'Creando…' : 'Crear usuario'}</button>
    </form>
    <section className="panel section-panel">
      <h2>Usuarios registrados</h2>
      {users.isLoading && <StatusPanel tone="loading">Cargando usuarios…</StatusPanel>}
      {users.error && <StatusPanel tone="error">{users.error.message}</StatusPanel>}
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
    <section className="panel section-panel">
      <h2>Invitar dispositivo por QR</h2>
      <p className="muted">La invitación dura 10 minutos y solo puede utilizarse una vez.</p>
      <div className="inline-form">
        <label>Usuario<select value={enrollmentUserId} onChange={event => setEnrollmentUserId(event.target.value)}>
          <option value="">Seleccione un usuario</option>
          {users.data?.filter(user => user.status === 'ACTIVE').map(user => <option key={user.id} value={user.id}>{user.username}</option>)}
        </select></label>
        <button className="primary" type="button" disabled={!enrollmentUserId || createInvitation.isPending}
          onClick={() => createInvitation.mutate()}>{createInvitation.isPending ? 'Generando…' : 'Generar invitación'}</button>
      </div>
      {createInvitation.error && <div className="alert error">{createInvitation.error.message}</div>}
      {createdInvitation?.token && <div className="enrollment-result">
        <QrCodeVisual value={`${window.location.origin}/enroll?token=${encodeURIComponent(createdInvitation.token)}`} />
        <div><strong>QR para {createdInvitation.username}</strong>
          <p className="muted">Expira: {new Date(createdInvitation.expiresAt).toLocaleString('es-GT')}</p>
          <code>{`${window.location.origin}/enroll?token=${encodeURIComponent(createdInvitation.token)}`}</code>
          <code>{createdInvitation.token}</code>
        </div>
      </div>}
      <div className="data-list">
        {invitations.data?.map(invitation => <article className="data-row" key={invitation.id}>
          <div><strong>{invitation.username}</strong><small>Expira: {new Date(invitation.expiresAt).toLocaleString('es-GT')}</small></div>
          <div className="row-actions"><span className={`status ${invitation.status.toLowerCase()}`}>{invitation.status}</span>
            {invitation.status === 'PENDING' && <button className="secondary danger-button" onClick={() => revokeInvitation.mutate(invitation.id)}>Revocar</button>}</div>
        </article>)}
      </div>
    </section>
  </main>;
}
