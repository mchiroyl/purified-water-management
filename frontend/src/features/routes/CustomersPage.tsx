import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';
import { localDate, type Customer, type Route } from './types';

export function CustomersPage({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<Customer[]>('/customers') });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canManage });
  const [form, setForm] = useState({ code: '', name: '', contactName: '', phone: '', whatsapp: '', addressReference: '', customerType: 'PERMANENT', creditAllowed: false, creditLimit: 0 });
  const [assignments, setAssignments] = useState<Record<string, { routeId: string; validFrom: string }>>({});
  const create = useMutation({
    mutationFn: () => apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ code: '', name: '', contactName: '', phone: '', whatsapp: '', addressReference: '', customerType: 'PERMANENT', creditAllowed: false, creditLimit: 0 });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
  const assign = useMutation({
    mutationFn: ({ customerId, routeId, validFrom }: { customerId: string; routeId: string; validFrom: string }) =>
      apiRequest<Route>(`/customers/${customerId}/route-assignment`, { method: 'POST', body: JSON.stringify({ routeId, validFrom }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customers'] })
  });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };

  return <main>
    <p className="eyebrow">Maestros operativos</p>
    <h1>Clientes</h1>
    <p className="muted">Clientes permanentes, datos de contacto, crédito autorizado y ruta vigente.</p>
    {canManage && <form className="form-grid panel" onSubmit={submit}>
      <h2 className="wide">Nuevo cliente</h2>
      <label>Código<input required value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} /></label>
      <label>Nombre comercial<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Contacto<input value={form.contactName} onChange={event => setForm({ ...form, contactName: event.target.value })} /></label>
      <label>Teléfono<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
      <label>WhatsApp<input value={form.whatsapp} onChange={event => setForm({ ...form, whatsapp: event.target.value })} /></label>
      <label className="wide">Dirección o referencia<textarea required value={form.addressReference} onChange={event => setForm({ ...form, addressReference: event.target.value })} /></label>
      <label className="checkbox"><input type="checkbox" checked={form.creditAllowed} onChange={event => setForm({ ...form, creditAllowed: event.target.checked, creditLimit: event.target.checked ? form.creditLimit : 0 })} />Permitir crédito</label>
      {form.creditAllowed && <label>Límite de crédito<input type="number" min="0" step="0.01" value={form.creditLimit} onChange={event => setForm({ ...form, creditLimit: Number(event.target.value) })} /></label>}
      {create.error && <div className="alert error wide">{create.error.message}</div>}
      <button className="primary" disabled={create.isPending}>{create.isPending ? 'Guardando…' : 'Guardar cliente'}</button>
    </form>}

    <section className="panel section-panel">
      <div className="section-heading"><h2>Clientes registrados</h2><span>{customers.data?.length ?? 0} clientes</span></div>
      {customers.isLoading && <p>Cargando clientes…</p>}
      {customers.error && <div className="alert error">{customers.error.message}</div>}
      <div className="data-list">{customers.data?.map(customer => {
        const selection = assignments[customer.id] ?? { routeId: customer.routeId ?? '', validFrom: localDate() };
        return <article className="data-row customer-row" key={customer.id}>
          <div><strong>{customer.name}</strong><span>{customer.code} · {customer.contactName || 'Sin contacto'} · {customer.phone || 'Sin teléfono'}</span>
            <small>{customer.routeName ? `${customer.routeName} · ${customer.sellerName ?? 'Sin vendedor'}` : 'Sin ruta asignada'} · Saldo Q{customer.currentBalance.toFixed(2)}</small></div>
          <span className={`status ${customer.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span>
          {canManage && <div className="inline-assignment">
            <select aria-label={`Ruta de ${customer.name}`} value={selection.routeId} onChange={event => setAssignments({ ...assignments, [customer.id]: { ...selection, routeId: event.target.value } })}>
              <option value="">Seleccionar ruta</option>{routes.data?.map(route => <option value={route.id} key={route.id}>{route.code} · {route.name}</option>)}
            </select>
            <input aria-label={`Vigencia de ruta de ${customer.name}`} type="date" value={selection.validFrom} onChange={event => setAssignments({ ...assignments, [customer.id]: { ...selection, validFrom: event.target.value } })} />
            <button className="secondary" disabled={!selection.routeId || assign.isPending} onClick={() => assign.mutate({ customerId: customer.id, ...selection })}>Asignar ruta</button>
          </div>}
        </article>;
      })}</div>
      {assign.error && <div className="alert error">{assign.error.message}</div>}
    </section>
  </main>;
}
