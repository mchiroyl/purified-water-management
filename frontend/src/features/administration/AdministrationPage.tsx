import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '../../app/PageHeader';
import { StatusPanel } from '../../app/StatusPanel';
import { apiRequest } from '../../services/apiClient';

type UserAdmin = {
  id: string; username: string; email: string; status: string; mustChangePassword: boolean;
  roles: string[]; sellerId?: string; sellerCode?: string; sellerDisplayName?: string; createdAt: string;
};
type DeviceAdmin = {
  id: string; userId: string; username: string; friendlyName: string; status: string; appVersion?: string;
  firstSeenAt: string; lastSeenAt: string; revokedAt?: string;
};
type Reenrollment = {
  id: string; username: string; status: string; deviceName: string;
  expiresAt: string; createdAt: string;
};
const roleOptions = ['ADMINISTRADOR', 'BODEGA', 'VENDEDOR', 'SUPERVISOR'];

export function AdministrationPage() {
  const queryClient = useQueryClient();
  const qrToken = new URLSearchParams(window.location.search).get('device-reenrollment-token');
  const users = useQuery({ queryKey: ['administration', 'users'], queryFn: () => apiRequest<UserAdmin[]>('/administration/users') });
  const devices = useQuery({ queryKey: ['administration', 'devices'], queryFn: () => apiRequest<DeviceAdmin[]>('/administration/devices') });
  const reenrollments = useQuery({ queryKey: ['administration', 'device-reenrollment'], queryFn: () => apiRequest<Reenrollment[]>('/administration/device-reenrollment') });
  const qrRequest = useQuery({ queryKey: ['administration', 'device-reenrollment', 'qr', qrToken], enabled: Boolean(qrToken), queryFn: () => apiRequest<Reenrollment>(`/administration/device-reenrollment/by-token/${encodeURIComponent(qrToken!)}`) });
  const [approvedNames, setApprovedNames] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ username: '', email: '', password: '', roles: ['VENDEDOR'], sellerDisplayName: '' });
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
  const approveReenrollment = useMutation({
    mutationFn: ({ id, deviceName }: { id: string; deviceName: string }) => apiRequest<Reenrollment>(`/administration/device-reenrollment/${id}/approve`, { method: 'POST', body: JSON.stringify({ deviceName }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['administration', 'device-reenrollment'] });
      void queryClient.invalidateQueries({ queryKey: ['administration', 'devices'] });
    }
  });
  const rejectReenrollment = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/administration/device-reenrollment/${id}/reject`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['administration', 'device-reenrollment'] })
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
      <h2>Reinscripciones de dispositivos</h2>
      <p className="muted">Apruebe únicamente solicitudes verificadas. Al completarse se revocan las sesiones anteriores del usuario.</p>
      {qrRequest.data && <div className="alert success">Solicitud abierta desde QR: {qrRequest.data.username} · {qrRequest.data.deviceName}</div>}
      {qrRequest.error && <div className="alert error">El código QR no es válido, expiró o ya fue utilizado.</div>}
      {reenrollments.error && <div className="alert error">{reenrollments.error.message}</div>}
      {reenrollments.isLoading && <StatusPanel tone="loading">Cargando solicitudes…</StatusPanel>}
      <div className="table-wrap"><table>
        <thead><tr><th>Usuario</th><th>Nombre del dispositivo</th><th>Solicitud</th><th>Expira</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{reenrollments.data?.map(item => {
          const editableName = approvedNames[item.id] ?? item.deviceName;
          const pending = item.status === 'PENDING';
          return <tr key={item.id}><td>{item.username}</td><td>{pending ? <input aria-label={`Nombre para ${item.username}`} value={editableName} onChange={event => setApprovedNames(current => ({ ...current, [item.id]: event.target.value }))} /> : item.deviceName}</td><td>{new Date(item.createdAt).toLocaleString('es-GT')}</td><td>{new Date(item.expiresAt).toLocaleString('es-GT')}</td><td><span className={`status ${pending ? 'pending' : item.status === 'APPROVED' || item.status === 'USED' ? 'active' : 'inactive'}`}>{item.status}</span></td><td><div className="row-actions">{pending && <><button className="secondary" disabled={approveReenrollment.isPending} onClick={() => { if (window.confirm('¿Aprobar esta reinscripción y revocar las sesiones anteriores?')) approveReenrollment.mutate({ id: item.id, deviceName: editableName }); }}>Aprobar</button><button className="secondary danger-button" disabled={rejectReenrollment.isPending} onClick={() => { if (window.confirm('¿Rechazar esta solicitud?')) rejectReenrollment.mutate(item.id); }}>Rechazar</button></>}</div></td></tr>;
        })}</tbody>
      </table></div>
      {(approveReenrollment.error || rejectReenrollment.error) && <div className="alert error">{(approveReenrollment.error || rejectReenrollment.error)?.message}</div>}
    </section>
  </main>;
}
