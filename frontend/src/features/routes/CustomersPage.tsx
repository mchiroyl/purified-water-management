import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    whatsapp: '',
    addressReference: '',
    creditAllowed: false,
    creditLimit: 0,
    status: 'ACTIVE',
  });
  const [showUpdateSuccessModal, setShowUpdateSuccessModal] = useState(false);
  const [updatedCustomerName, setUpdatedCustomerName] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState<{
    customerName: string;
    customerCode?: string;
    routeName: string;
    validFrom: string;
  } | null>(null);
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };
  const create = useMutation({
    mutationFn: () => apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
  const updateCustomer = useMutation({
    mutationFn: () => {
      if (!editingCustomer) throw new Error('Cliente no seleccionado');
      return apiRequest<Customer>(`/customers/${editingCustomer.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
    },
    onSuccess: (data) => {
      const name = data?.name || editForm.name;
      setEditingCustomer(null);
      setUpdatedCustomerName(name);
      setShowUpdateSuccessModal(true);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
  const assign = useMutation({
    mutationFn: ({ customerId, routeId, validFrom }: { customerId: string; routeId: string; validFrom: string }) =>
      apiRequest<Route>(`/customers/${customerId}/route-assignment`, { method: 'POST', body: JSON.stringify({ routeId, validFrom }) }),
    onSuccess: (data, variables) => {
      const customer = customers.data?.find(c => c.id === variables.customerId);
      const route = routes.data?.find(r => r.id === variables.routeId);
      setAssignmentSuccess({
        customerName: customer?.name ?? 'Cliente',
        customerCode: customer?.code,
        routeName: route ? `${route.code} · ${route.name}` : (data?.name ?? 'Ruta'),
        validFrom: variables.validFrom,
      });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
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
  const orderedCustomers = useMemo(() => [...(customers.data ?? [])].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [customers.data]);
  const dateBounds = currentMonthDateBounds();

  type RouteGroup = {
    key: string;
    routeId?: string;
    routeCode?: string;
    routeName: string;
    sellerName?: string;
    customers: Customer[];
  };

  // Filtrar clientes por búsqueda
  const searchFilteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return orderedCustomers;
    const q = searchQuery.toLowerCase().trim();
    return orderedCustomers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.contactName?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.addressReference?.toLowerCase().includes(q) ||
      c.routeName?.toLowerCase().includes(q) ||
      c.sellerName?.toLowerCase().includes(q)
    );
  }, [orderedCustomers, searchQuery]);

  // Agrupar clientes según estén asignados a cada ruta y vendedor
  const routeGroups = useMemo(() => {
    const map = new Map<string, RouteGroup>();

    searchFilteredCustomers.forEach(customer => {
      const key = customer.routeId || 'UNASSIGNED';
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          routeId: customer.routeId,
          routeCode: customer.routeCode,
          routeName: customer.routeName || (customer.routeId ? 'Ruta asignada' : 'Sin ruta asignada'),
          sellerName: customer.sellerName,
          customers: [],
        };
        map.set(key, group);
      } else {
        if (!group.sellerName && customer.sellerName) group.sellerName = customer.sellerName;
        if (!group.routeName && customer.routeName) group.routeName = customer.routeName;
      }
      group.customers.push(customer);
    });

    // Ordenar clientes alfabéticamente dentro de cada grupo
    map.forEach(g => {
      g.customers.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    });

    // Ordenar grupos: Rutas asignadas primero (alfabéticamente por nombre), luego los no asignados
    const result = Array.from(map.values());
    result.sort((a, b) => {
      if (a.key === 'UNASSIGNED') return 1;
      if (b.key === 'UNASSIGNED') return -1;
      return a.routeName.localeCompare(b.routeName, 'es', { sensitivity: 'base' });
    });

    return result;
  }, [searchFilteredCustomers]);

  // Grupos mostrados según el filtro seleccionado
  const displayedGroups = useMemo(() => {
    if (selectedRouteFilter === 'ALL') return routeGroups;
    return routeGroups.filter(g => g.key === selectedRouteFilter);
  }, [routeGroups, selectedRouteFilter]);

  const renderCustomerTable = (customerList: Customer[]) => (
    <div className="table-wrap customer-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Código</th>
            <th>Teléfono</th>
            <th>Dirección o referencia</th>
            <th>Ruta y vendedor</th>
            <th>Estado</th>
            <th>Opciones</th>
          </tr>
        </thead>
        <tbody>
          {customerList.map(customer => {
            const selection = assignments[customer.id] ?? { routeId: customer.routeId ?? '', validFrom: localDate() };
            return (
              <tr key={customer.id}>
                <td>
                  <strong>{customer.name}</strong>
                  <small>{customer.contactName || 'Sin contacto'} · Saldo Q{customer.currentBalance.toFixed(2)}</small>
                </td>
                <td>{customer.code}</td>
                <td>{customer.phone || 'Sin teléfono'}</td>
                <td>{customer.addressReference}</td>
                <td>
                  {customer.routeName ? (
                    <span>
                      <strong>{customer.routeName}</strong>
                      <br />
                      <small style={{ color: 'var(--muted)' }}>👤 {customer.sellerName ?? 'Sin vendedor'}</small>
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                      Sin ruta asignada
                    </span>
                  )}
                </td>
                <td>
                  <span className={`status ${customer.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                    {customer.registrationState === 'PENDING_REVIEW' ? 'Pendiente de revisión' : customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="action-buttons" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="primary"
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem' }}
                        title="Iniciar venta para este cliente"
                        onClick={() => navigate(`/sales?customerId=${customer.id}`)}
                      >
                        ⚡ Vender
                      </button>
                      {canManage && (
                        <>
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
                          <button
                            type="button"
                            className="secondary"
                            style={{
                              padding: '0.2rem 0.6rem',
                              fontSize: '0.85rem',
                              color: '#007680',
                              borderColor: '#007680',
                              fontWeight: 600,
                            }}
                            title="Modificar datos, crédito o estado del cliente"
                            onClick={() => {
                              setEditingCustomer(customer);
                              setEditForm({
                                name: customer.name,
                                contactName: customer.contactName || '',
                                phone: customer.phone || '',
                                whatsapp: customer.whatsapp || '',
                                addressReference: customer.addressReference || '',
                                creditAllowed: customer.creditAllowed,
                                creditLimit: customer.creditLimit || 0,
                                status: customer.status,
                              });
                            }}
                          >
                            ✏️ Modificar
                          </button>
                        </>
                      )}
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
                        <button
                          className="secondary"
                          disabled={!selection.routeId || assign.isPending}
                          onClick={() => assign.mutate({ customerId: customer.id, ...selection })}
                        >
                          {assign.isPending && assign.variables?.customerId === customer.id ? 'Asignando…' : 'Asignar ruta'}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

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
      {view === 'list' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <div>
              <h2>Clientes registrados</h2>
              <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                Agrupados según su ruta y vendedor asignado
              </span>
            </div>
            <span className="badge" style={{ fontSize: '0.9rem', padding: '0.35rem 0.8rem' }}>
              {customers.data?.length ?? 0} clientes totales
            </span>
          </div>

          {customers.isLoading && <p>Cargando clientes…</p>}
          {customers.error && <div className="alert error">{customers.error.message}</div>}

          {/* Barra de Filtros y Búsqueda */}
          {customers.data && customers.data.length > 0 && (
            <div className="customer-filter-bar">
              <div className="customer-filter-top">
                <input
                  type="search"
                  className="customer-search-input"
                  placeholder="🔍 Buscar cliente por nombre, código, teléfono o dirección..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <div className="customer-view-toggle">
                  <button
                    type="button"
                    className={`customer-view-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                    onClick={() => setViewMode('grouped')}
                  >
                    📑 Agrupado por Ruta
                  </button>
                  <button
                    type="button"
                    className={`customer-view-btn ${viewMode === 'flat' ? 'active' : ''}`}
                    onClick={() => setViewMode('flat')}
                  >
                    📋 Lista Plana
                  </button>
                </div>
              </div>

              {/* Píldoras de filtro rápido por ruta */}
              <div className="customer-filter-pills">
                <button
                  type="button"
                  className={`customer-filter-pill ${selectedRouteFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSelectedRouteFilter('ALL')}
                >
                  Todas las rutas ({searchFilteredCustomers.length})
                </button>
                {routeGroups.map(grp => (
                  <button
                    type="button"
                    key={grp.key}
                    className={`customer-filter-pill ${selectedRouteFilter === grp.key ? 'active' : ''}`}
                    onClick={() => setSelectedRouteFilter(grp.key)}
                  >
                    {grp.key === 'UNASSIGNED' ? '⚠️' : '🚚'} {grp.routeName}
                    {grp.sellerName ? ` (${grp.sellerName})` : ''} · <strong>{grp.customers.length}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vista Agrupada por Ruta y Vendedor */}
          {viewMode === 'grouped' && displayedGroups.length > 0 && (
            <div className="customer-groups-container">
              {displayedGroups.map(group => {
                const isCollapsed = Boolean(collapsedGroups[group.key]);
                const isUnassigned = group.key === 'UNASSIGNED';

                return (
                  <article className="route-group-panel" key={group.key}>
                    <div
                      className={`route-group-banner ${isUnassigned ? 'unassigned' : ''}`}
                      onClick={() => toggleGroupCollapse(group.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleGroupCollapse(group.key); }}
                    >
                      <div className="route-group-info">
                        <span style={{ fontSize: '1.5rem' }}>{isUnassigned ? '⚠️' : '🚚'}</span>
                        <div>
                          <h3 className="route-group-title">
                            {isUnassigned ? 'Clientes Sin Ruta Asignada' : `Ruta ${group.routeName} ${group.routeCode ? `(${group.routeCode})` : ''}`}
                          </h3>
                          <span className="route-group-subtitle">
                            👤 Vendedor responsable: <strong style={{ color: group.sellerName ? '#0f766e' : '#b45309' }}>
                              {group.sellerName || 'Sin vendedor asignado'}
                            </strong>
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          className="badge"
                          style={{
                            background: isUnassigned ? '#fef3c7' : '#e0f2fe',
                            color: isUnassigned ? '#92400e' : '#0369a1',
                            fontWeight: 600,
                            padding: '0.3rem 0.75rem',
                            borderRadius: '1rem',
                            fontSize: '0.85rem',
                          }}
                        >
                          👥 {group.customers.length} {group.customers.length === 1 ? 'cliente' : 'clientes'}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
                          {isCollapsed ? '▼ Desplegar' : '▲ Plegar'}
                        </span>
                      </div>
                    </div>

                    {!isCollapsed && renderCustomerTable(group.customers)}
                  </article>
                );
              })}
            </div>
          )}

          {/* Vista Plana Corrida */}
          {viewMode === 'flat' && searchFilteredCustomers.length > 0 && (
            renderCustomerTable(searchFilteredCustomers)
          )}

          {customers.data && customers.data.length > 0 && searchFilteredCustomers.length === 0 && (
            <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
              No se encontraron clientes que coincidan con la búsqueda "{searchQuery}".
            </p>
          )}

          {customers.data?.length === 0 && <p className="muted">Aún no hay clientes registrados.</p>}
          {assign.error && <div className="alert error">{assign.error.message}</div>}
        </section>
      )}

      {/* ── Modal de modificación de cliente ── */}
      {editingCustomer && (
        <div className="modal-backdrop" role="presentation">
          <form
            className="modal-panel"
            onSubmit={e => {
              e.preventDefault();
              updateCustomer.mutate();
            }}
            aria-modal="true"
            role="dialog"
            style={{ maxWidth: '600px', width: '92%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Modificar cliente</h2>
                <span className="muted" style={{ fontSize: '0.88rem' }}>
                  {editingCustomer.code} · {editingCustomer.customerType === 'OCCASIONAL' ? 'Cliente Provisional' : 'Cliente Permanente'}
                </span>
              </div>
              <span className={`status ${editForm.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                {editForm.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="form-grid compact-form">
              <label>
                Nombre / Razón Social
                <input
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </label>
              <label>
                Persona de contacto
                <input
                  placeholder="Opcional"
                  value={editForm.contactName}
                  onChange={e => setEditForm({ ...editForm, contactName: e.target.value })}
                />
              </label>
              <label>
                Teléfono
                <input
                  placeholder="Opcional"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </label>
              <label>
                WhatsApp
                <input
                  placeholder="Opcional"
                  value={editForm.whatsapp}
                  onChange={e => setEditForm({ ...editForm, whatsapp: e.target.value })}
                />
              </label>
              <label className="wide">
                Dirección o referencia
                <textarea
                  required
                  value={editForm.addressReference}
                  onChange={e => setEditForm({ ...editForm, addressReference: e.target.value })}
                />
              </label>

              <label
                className="checkbox wide"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#f8fafc',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <input
                  type="checkbox"
                  checked={editForm.creditAllowed}
                  onChange={e =>
                    setEditForm({
                      ...editForm,
                      creditAllowed: e.target.checked,
                      creditLimit: e.target.checked ? (editForm.creditLimit || 500) : 0,
                    })
                  }
                />
                <span><strong>Permitir crédito</strong> (autoriza al cliente para comprar al crédito en ruta)</span>
              </label>

              {editForm.creditAllowed && (
                <label
                  className="wide"
                  style={{
                    background: '#f0fdf4',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <strong>Límite de crédito autorizado (Q)</strong>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.creditLimit}
                    onChange={e => setEditForm({ ...editForm, creditLimit: Number(e.target.value) })}
                    style={{ marginTop: '0.35rem' }}
                  />
                </label>
              )}

              <label>
                Estado
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </label>
            </div>

            {updateCustomer.error && (
              <div className="alert error wide" style={{ marginTop: '0.85rem' }}>
                {updateCustomer.error.message}
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" className="secondary" onClick={() => setEditingCustomer(null)}>
                Cancelar
              </button>
              <button className="primary" disabled={updateCustomer.isPending || !editForm.name.trim()}>
                {updateCustomer.isPending ? 'Guardando cambios…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Ventana flotante: Datos actualizados ── */}
      {showUpdateSuccessModal && (
        <div className="floating-toast-overlay" role="dialog" aria-modal="true">
          <div className="floating-toast-card">
            <div className="floating-toast-icon">✅</div>
            <div className="floating-toast-body">
              <h3>Datos actualizados</h3>
              <p>
                Los datos del cliente <strong>{updatedCustomerName}</strong> se actualizaron exitosamente.
              </p>
            </div>
            <div className="floating-toast-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setShowUpdateSuccessModal(false)}
                autoFocus
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ventana emergente: Asignación de ruta exitosa ── */}
      {assignmentSuccess && (
        <div className="floating-toast-overlay" role="dialog" aria-modal="true" aria-labelledby="assignment-success-title">
          <div className="floating-toast-card">
            <div className="floating-toast-icon">✅</div>
            <div className="floating-toast-body">
              <h3 id="assignment-success-title">Ruta asignada exitosamente</h3>
              <p>
                El cliente <strong>{assignmentSuccess.customerCode ? `${assignmentSuccess.customerCode} · ` : ''}{assignmentSuccess.customerName}</strong> fue vinculado con éxito a la ruta:
              </p>
              <div style={{
                margin: '0.75rem 0',
                padding: '0.7rem 1rem',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '0.65rem',
                color: '#15803d',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#166534' }}>
                  🚚 {assignmentSuccess.routeName}
                </div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#15803d' }}>
                  Vigencia a partir de: <strong>{assignmentSuccess.validFrom}</strong>
                </div>
              </div>
            </div>
            <div className="floating-toast-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setAssignmentSuccess(null)}
                autoFocus
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
