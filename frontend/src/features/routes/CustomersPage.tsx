import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { getMobileDatabase } from '../../offline/SyncContext';
import type { ProvisionalCustomerRecord } from '../../offline/mobileDatabase';
import { apiRequest } from '../../services/apiClient';
import { calendarOnlyProps, currentMonthDateBounds } from '../../utils/dateInput';
import { queueProvisionalCustomer } from './provisionalCustomerOffline';
import { localDate, type Customer, type ProvisionalReview, type Route } from './types';

type CustomersPageProps = {
  canManage: boolean;
  canCreateRouteCustomer?: boolean;
  canReviewProvisional?: boolean;
  deviceId?: string;
};

const emptyRouteCustomer = { routeId: '', name: '', phone: '', whatsapp: '', addressReference: '' };

export function CustomersPage({ canManage, canCreateRouteCustomer = false,
  canReviewProvisional = false, deviceId = '', view = 'create' }: CustomersPageProps & { view?: 'create' | 'list' }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<Customer[]>('/customers') });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canManage || canCreateRouteCustomer });
  const reviews = useQuery({ queryKey: ['customers', 'provisional-reviews'],
    queryFn: () => apiRequest<ProvisionalReview[]>('/customers/provisional-reviews'), enabled: canReviewProvisional });
  const emptyForm = { name: '', contactName: '', phone: '', whatsapp: '', addressReference: '', customerType: 'PERMANENT', creditAllowed: false, creditLimit: 0 };
  const [form, setForm] = useState(emptyForm);
  const [routeCustomer, setRouteCustomer] = useState(emptyRouteCustomer);
  const [localCustomers, setLocalCustomers] = useState<ProvisionalCustomerRecord[]>([]);
  const [localMessage, setLocalMessage] = useState('');
  const [reviewForms, setReviewForms] = useState<Record<string, { targetCustomerId: string; reason: string }>>({});
  const [assignments, setAssignments] = useState<Record<string, { routeId: string; validFrom: string }>>({});
  const create = useMutation({
    mutationFn: () => apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
  const assign = useMutation({
    mutationFn: ({ customerId, routeId, validFrom }: { customerId: string; routeId: string; validFrom: string }) =>
      apiRequest<Route>(`/customers/${customerId}/route-assignment`, { method: 'POST', body: JSON.stringify({ routeId, validFrom }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customers'] })
  });
  const decideReview = useMutation({
    mutationFn: ({ customerId, decision }: { customerId: string; decision: 'APPROVED' | 'REJECTED' | 'MERGED' }) => {
      const values = reviewForms[customerId] ?? { targetCustomerId: '', reason: '' };
      return apiRequest<Customer>(`/customers/${customerId}/registration-decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, targetCustomerId: decision === 'MERGED' ? values.targetCustomerId : null,
          reason: values.reason }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['customers', 'provisional-reviews'] });
    },
  });
  const loadLocalCustomers = useCallback(async () => {
    if (!canCreateRouteCustomer) return;
    const database = await getMobileDatabase();
    const values = await database.getAll('provisionalCustomers');
    setLocalCustomers(values.sort((left, right) => right.createdAtLocal.localeCompare(left.createdAtLocal)));
  }, [canCreateRouteCustomer]);
  useEffect(() => { void loadLocalCustomers(); }, [loadLocalCustomers]);

  const saveProvisional = async () => {
    const selectedRoute = routes.data?.find(route => route.id === routeCustomer.routeId);
    if (!deviceId || !selectedRoute?.sellerId) {
      setLocalMessage('La ruta debe tener vendedor asignado y la sesión debe identificar el dispositivo.');
      return;
    }
    try {
      await queueProvisionalCustomer({ ...routeCustomer, sellerId: selectedRoute.sellerId, deviceId });
      setRouteCustomer(emptyRouteCustomer);
      setLocalMessage('Cliente guardado en el teléfono; se enviará automáticamente al recuperar conexión.');
      await loadLocalCustomers();
    } catch {
      setLocalMessage('No fue posible guardar el cliente en el teléfono.');
    }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };
  const orderedCustomers = [...(customers.data ?? [])].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const dateBounds = currentMonthDateBounds();

  return (
    <main>
      <PageHeader
        eyebrow="Maestros operativos"
        title="Clientes"
        description="Clientes permanentes, datos de contacto, crédito autorizado y ruta vigente."
        actions={<button type="button" className="secondary" onClick={() => navigate(view === 'create' ? '/customers/list' : '/customers')}>
          {view === 'create' ? 'Ver clientes registrados' : 'Nuevo cliente'}
        </button>}
      />

      {/* ── Formulario nuevo cliente ── */}
      {view === 'create' && canManage && (
        <form className="panel catalog-form" onSubmit={submit}>
          <h2>Nuevo cliente</h2>
          <p className="field-hint">El código de cliente se asigna automáticamente al guardar (CLI-000001).</p>
          <div className="form-grid compact-grid customer-create-grid">
            <label>
              Nombre del cliente
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Teléfono
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="wide">
              Dirección o referencia
              <textarea required value={form.addressReference} onChange={e => setForm({ ...form, addressReference: e.target.value })} />
            </label>

            <label className="checkbox wide">
              <input
                type="checkbox"
                checked={form.creditAllowed}
                onChange={e => setForm({ ...form, creditAllowed: e.target.checked, creditLimit: e.target.checked ? form.creditLimit : 0 })}
              />
              Permitir crédito
            </label>

            {form.creditAllowed && (
              <label>
                Límite de crédito
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.creditLimit}
                  onChange={e => setForm({ ...form, creditLimit: Number(e.target.value) })}
                />
              </label>
            )}

          </div>

          {create.error && <div className="alert error">{create.error.message}</div>}

          <div className="form-actions customer-form-actions">
            <button className="primary" disabled={create.isPending}>
              {create.isPending ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      )}

      {/* ── Cliente provisional encontrado en ruta ── */}
      {view === 'create' && canCreateRouteCustomer && (
        <section className="panel section-panel">
          <div className="section-heading">
            <div>
              <h2>Cliente encontrado en ruta</h2>
              <span>Cliente provisional</span>
            </div>
          </div>
          <p className="muted">Se guarda primero en este teléfono, queda pendiente de revisión y puede utilizarse en la venta al contado o por transferencia.</p>
          <div className="form-grid compact-form">
            <label>
              Ruta
              <select required value={routeCustomer.routeId} onChange={e => setRouteCustomer({ ...routeCustomer, routeId: e.target.value })}>
                <option value="">Seleccionar ruta</option>
                {routes.data?.map(route => <option value={route.id} key={route.id}>{route.code} · {route.name}</option>)}
              </select>
            </label>
            <label>
              Nombre
              <input required value={routeCustomer.name} onChange={e => setRouteCustomer({ ...routeCustomer, name: e.target.value })} />
            </label>
            <label>
              Teléfono
              <input value={routeCustomer.phone} onChange={e => setRouteCustomer({ ...routeCustomer, phone: e.target.value })} />
            </label>
            <label className="wide">
              Dirección o referencia
              <textarea required value={routeCustomer.addressReference} onChange={e => setRouteCustomer({ ...routeCustomer, addressReference: e.target.value })} />
            </label>
            <div className="row-actions wide">
              <button
                type="button"
                className="primary"
                disabled={!routeCustomer.routeId || !routeCustomer.name.trim() || !routeCustomer.addressReference.trim()}
                onClick={() => void saveProvisional()}
              >
                Guardar cliente provisional offline
              </button>
            </div>
          </div>
          {localMessage && <div className="alert">{localMessage}</div>}
          {localCustomers.length > 0 && (
            <div className="data-list">
              <h3>Provisionales guardados en el teléfono</h3>
              {localCustomers.map(customer => (
                <article className="data-row" key={customer.localCustomerId}>
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{customer.addressReference}</span>
                  </div>
                  <span className={`status ${customer.syncStatus === 'SYNCED' ? 'active' : 'inactive'}`}>
                    {customer.syncStatus === 'SYNCED' ? 'Enviado' : 'Pendiente'}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Revisión de provisionales ── */}
      {view === 'list' && canReviewProvisional && reviews.data && reviews.data.length > 0 && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Revisión de clientes provisionales</h2>
            <span>{reviews.data?.length ?? 0} pendientes</span>
          </div>
          {reviews.error && <div className="alert error">{reviews.error.message}</div>}
          <div className="data-list">
            {reviews.data?.map(review => {
              const values = reviewForms[review.customer.id] ?? { targetCustomerId: '', reason: '' };
              const permanentCustomers = customers.data?.filter(item => item.customerType === 'PERMANENT' && item.registrationState === 'ACTIVE') ?? [];
              return (
                <article className="data-row customer-review" key={review.customer.id}>
                  <div>
                    <strong>{review.customer.name}</strong>
                    <span>{review.customer.phone || 'Sin teléfono'} · {review.customer.routeName ?? 'Sin ruta'}</span>
                    <small>{review.duplicateCandidates.length ? `Posibles duplicados: ${review.duplicateCandidates.map(item => `${item.code} ${item.name}`).join(', ')}` : 'Sin coincidencias automáticas'}</small>
                  </div>
                  <div className="inline-assignment">
                    <select
                      aria-label={`Cliente definitivo para ${review.customer.name}`}
                      value={values.targetCustomerId}
                      onChange={e => setReviewForms({ ...reviewForms, [review.customer.id]: { ...values, targetCustomerId: e.target.value } })}
                    >
                      <option value="">Cliente definitivo para fusionar</option>
                      {permanentCustomers.map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}
                    </select>
                    <input
                      aria-label={`Motivo para ${review.customer.name}`}
                      placeholder="Motivo para rechazo o fusión"
                      value={values.reason}
                      onChange={e => setReviewForms({ ...reviewForms, [review.customer.id]: { ...values, reason: e.target.value } })}
                    />
                    <button className="primary" disabled={decideReview.isPending} onClick={() => decideReview.mutate({ customerId: review.customer.id, decision: 'APPROVED' })}>Aprobar</button>
                    <button className="secondary" disabled={!values.reason.trim() || decideReview.isPending} onClick={() => decideReview.mutate({ customerId: review.customer.id, decision: 'REJECTED' })}>Rechazar</button>
                    <button className="secondary" disabled={!values.targetCustomerId || !values.reason.trim() || decideReview.isPending} onClick={() => decideReview.mutate({ customerId: review.customer.id, decision: 'MERGED' })}>Fusionar</button>
                  </div>
                </article>
              );
            })}
          </div>
          {decideReview.error && <div className="alert error">{decideReview.error.message}</div>}
        </section>
      )}

      {/* ── Lista de clientes ── */}
      {view === 'list' && <section className="panel section-panel">
        <div className="section-heading">
          <h2>Clientes registrados</h2>
          <span>{customers.data?.length ?? 0} clientes</span>
        </div>
        {customers.isLoading && <p>Cargando clientes…</p>}
        {customers.error && <div className="alert error">{customers.error.message}</div>}
        {orderedCustomers.length > 0 && <div className="table-wrap customer-table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>Código</th><th>Teléfono</th><th>Dirección o referencia</th><th>Ruta y vendedor</th><th>Estado</th><th>Opciones</th></tr></thead>
            <tbody>{orderedCustomers.map(customer => {
            const selection = assignments[customer.id] ?? { routeId: customer.routeId ?? '', validFrom: localDate() };
            return (
              <tr key={customer.id}>
                <td><strong>{customer.name}</strong><small>{customer.contactName || 'Sin contacto'} · Saldo Q{customer.currentBalance.toFixed(2)}</small></td>
                <td>{customer.code}</td>
                <td>{customer.phone || 'Sin teléfono'}</td>
                <td>{customer.addressReference}</td>
                <td>{customer.routeName ? `${customer.routeName} · ${customer.sellerName ?? 'Sin vendedor'}` : 'Sin ruta asignada'}</td>
                <td><span className={`status ${customer.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                  {customer.registrationState === 'PENDING_REVIEW' ? 'Pendiente de revisión' : customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span></td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="action-buttons" style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem' }}
                        title="Ver y registrar garrafones del cliente"
                        onClick={() => navigate(`/jugs?customerId=${customer.id}`)}
                      >
                        🧴 Garrafones
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem' }}
                        title="Ver estado de cuenta y abonar a crédito"
                        onClick={() => navigate(`/credit?customerId=${customer.id}`)}
                      >
                        💳 Crédito
                      </button>
                    </div>
                    {canManage && (
                      <div className="inline-assignment">
                        <select
                          aria-label={`Ruta de ${customer.name}`}
                          value={selection.routeId}
                          onChange={e => setAssignments({ ...assignments, [customer.id]: { ...selection, routeId: e.target.value } })}
                        >
                          <option value="">Seleccionar ruta</option>
                          {routes.data?.map(route => <option value={route.id} key={route.id}>{route.code} · {route.name}</option>)}
                        </select>
                        <input
                          aria-label={`Vigencia de ruta de ${customer.name}`}
                          type="date"
                          min={dateBounds.min}
                          max={dateBounds.max}
                          {...calendarOnlyProps()}
                          value={selection.validFrom}
                          onChange={e => setAssignments({ ...assignments, [customer.id]: { ...selection, validFrom: e.target.value } })}
                        />
                        <button className="secondary" disabled={!selection.routeId || assign.isPending} onClick={() => assign.mutate({ customerId: customer.id, ...selection })}>
                          Asignar ruta
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
            })}</tbody>
          </table>
        </div>}
        {customers.data?.length === 0 && <p className="muted">Aún no hay clientes registrados.</p>}
        {assign.error && <div className="alert error">{assign.error.message}</div>}
      </section>}
    </main>
  );
}
