import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';
import type { Customer, Route } from '../routes/types';
import type {
  JugBalanceResponse,
  JugEventRequest,
  JugEventType,
  JugHistoryResponse,
  JugRouteSummaryResponse,
} from './types';

type JugsPageProps = {
  canRecord?: boolean;
  canViewSummary?: boolean;
};

export function JugsPage({ canRecord = true, canViewSummary = true }: JugsPageProps) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'record' | 'customers' | 'routes'>('customers');

  // Deep-link: si llegan con ?customerId=UUID, pre-seleccionar el cliente en historial
  useEffect(() => {
    const preselect = searchParams.get('customerId');
    if (preselect) {
      setHistoryCustomerId(preselect);
      setActiveTab('customers');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catálogos
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers'),
  });

  const routes = useQuery({
    queryKey: ['routes'],
    queryFn: () => apiRequest<Route[]>('/routes'),
  });

  // Estado del formulario de registro
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [eventType, setEventType] = useState<JugEventType>('LENT');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estado para consulta de historial por cliente
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const customerHistory = useQuery({
    queryKey: ['jugs', 'history', historyCustomerId],
    queryFn: () => apiRequest<JugHistoryResponse>(`/jugs/customers/${historyCustomerId}/history`),
    enabled: !!historyCustomerId,
  });

  // Estado para resumen por ruta
  const [summaryRouteId, setSummaryRouteId] = useState('');
  const routeSummary = useQuery({
    queryKey: ['jugs', 'route-summary', summaryRouteId],
    queryFn: () => apiRequest<JugRouteSummaryResponse>(`/jugs/routes/${summaryRouteId}/summary`),
    enabled: !!summaryRouteId,
  });

  // Saldo de cliente seleccionado en formulario
  const currentCustomerBalance = useQuery({
    queryKey: ['jugs', 'balance', selectedCustomerId],
    queryFn: () => apiRequest<JugBalanceResponse>(`/jugs/customers/${selectedCustomerId}/balance`),
    enabled: !!selectedCustomerId,
  });

  // Filtro para listado de clientes
  const [customerSearch, setCustomerSearch] = useState('');

  // Mutación para registrar evento
  const recordMutation = useMutation({
    mutationFn: (data: JugEventRequest) =>
      apiRequest('/jugs/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setFeedbackMessage({ type: 'success', text: 'Evento de garrafón registrado exitosamente.' });
      setQuantity(1);
      setUnitPrice('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['jugs'] });
    },
    onError: (err: Error) => {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error al registrar el evento.' });
    },
  });

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    setFeedbackMessage(null);
    const found = customers.data?.find(c => c.id === custId);
    if (found?.routeId) {
      setSelectedRouteId(found.routeId);
    }
  };

  const handleSubmitEvent = (e: FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    if (!selectedCustomerId) {
      setFeedbackMessage({ type: 'error', text: 'Seleccione un cliente.' });
      return;
    }
    if (!selectedRouteId) {
      setFeedbackMessage({ type: 'error', text: 'Seleccione una ruta.' });
      return;
    }
    if (quantity <= 0) {
      setFeedbackMessage({ type: 'error', text: 'La cantidad debe ser mayor a 0.' });
      return;
    }

    const payload: JugEventRequest = {
      customerId: selectedCustomerId,
      routeId: selectedRouteId,
      eventType,
      quantity,
      unitPrice: eventType.startsWith('CHARGED') && unitPrice ? parseFloat(unitPrice) : null,
      notes: notes.trim(),
    };

    recordMutation.mutate(payload);
  };

  const filteredCustomers = (customers.data ?? []).filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <main>
      <PageHeader
        eyebrow="Operación y Control"
        title="Control de Garrafones"
        description="Gestión de envases prestados a clientes, devoluciones y cobro por pérdidas o deterioro."
        actions={
          <div className="filter-group">
            <button
              type="button"
              className={activeTab === 'customers' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('customers')}
            >
              Saldos de Clientes
            </button>
            {canRecord && (
              <button
                type="button"
                className={activeTab === 'record' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('record')}
              >
                Registrar Movimiento
              </button>
            )}
            {canViewSummary && (
              <button
                type="button"
                className={activeTab === 'routes' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('routes')}
              >
                Resumen por Ruta
              </button>
            )}
          </div>
        }
      />

      {/* ── TAB 1: SALDOS POR CLIENTE ── */}
      {activeTab === 'customers' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Saldos de Garrafones por Cliente</h2>
            <input
              type="search"
              placeholder="Buscar por cliente o código…"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
          </div>

          {customers.isLoading && <p>Cargando clientes…</p>}
          {customers.error && <div className="alert error">{customers.error.message}</div>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Código</th>
                  <th>Ruta</th>
                  <th>Teléfono</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(cust => (
                  <tr key={cust.id}>
                    <td>
                      <strong>{cust.name}</strong>
                      <small>{cust.contactName || 'Sin contacto'}</small>
                    </td>
                    <td>{cust.code}</td>
                    <td>{cust.routeName ?? 'Sin ruta'}</td>
                    <td>{cust.phone || '—'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setHistoryCustomerId(cust.id)}
                        >
                          Ver Historial
                        </button>
                        {canRecord && (
                          <button
                            type="button"
                            className="primary"
                            onClick={() => {
                              handleCustomerSelect(cust.id);
                              setActiveTab('record');
                            }}
                          >
                            Movimiento
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── MODAL / PANEL DE HISTORIAL ── */}
      {historyCustomerId && (
        <section className="panel section-panel" style={{ marginTop: '1.5rem', borderColor: 'var(--primary, #007680)' }}>
          <div className="section-heading">
            <div>
              <h2>Historial de Garrafones — {customerHistory.data?.customerName ?? 'Cargando…'}</h2>
              <span className="status active" style={{ fontSize: '1rem', padding: '0.3rem 0.8rem' }}>
                Garrafones Pendientes: <strong>{customerHistory.data?.jugsOutstanding ?? 0}</strong>
              </span>
            </div>
            <button type="button" className="secondary" onClick={() => setHistoryCustomerId(null)}>
              Cerrar
            </button>
          </div>

          {customerHistory.isLoading && <p>Cargando historial…</p>}
          {customerHistory.error && <div className="alert error">{customerHistory.error.message}</div>}

          {customerHistory.data && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Precio Unitario</th>
                    <th>Ruta</th>
                    <th>Registrado por</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {customerHistory.data.events.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center' }} className="muted">
                        No hay movimientos de garrafones para este cliente.
                      </td>
                    </tr>
                  ) : (
                    customerHistory.data.events.map(ev => {
                      const isAddition = ev.eventType === 'LENT';
                      return (
                        <tr key={ev.id}>
                          <td>{new Date(ev.createdAt).toLocaleString()}</td>
                          <td>
                            <span
                              className={`status ${isAddition ? 'active' : 'inactive'}`}
                              style={{ fontWeight: 'bold' }}
                            >
                              {ev.eventType === 'LENT' && 'PRESTADO (+)'}
                              {ev.eventType === 'RETURNED' && 'DEVUELTO (-)'}
                              {ev.eventType === 'CHARGED_LOSS' && 'COBRO PÉRDIDA (-)'}
                              {ev.eventType === 'CHARGED_DAMAGE' && 'COBRO DAÑO (-)'}
                            </span>
                          </td>
                          <td>
                            <strong>{ev.quantity}</strong>
                          </td>
                          <td>{ev.unitPrice ? `Q ${ev.unitPrice.toFixed(2)}` : '—'}</td>
                          <td>{ev.routeName}</td>
                          <td>{ev.registeredByName}</td>
                          <td>{ev.notes || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── TAB 2: REGISTRAR MOVIMIENTO ── */}
      {activeTab === 'record' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Registrar Movimiento de Garrafón</h2>
          </div>

          {feedbackMessage && (
            <div className={`alert ${feedbackMessage.type}`}>{feedbackMessage.text}</div>
          )}

          <form onSubmit={handleSubmitEvent} className="form-grid">
            <label>
              Cliente *
              <select
                required
                value={selectedCustomerId}
                onChange={e => handleCustomerSelect(e.target.value)}
              >
                <option value="">-- Seleccionar cliente --</option>
                {customers.data?.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedCustomerId && (
              <div style={{ gridColumn: 'span 2', padding: '0.8rem', background: '#f0f9fa', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <p style={{ margin: 0 }}>
                  Garrafones en poder del cliente actualmente:{' '}
                  <strong style={{ fontSize: '1.2rem', color: '#007680' }}>
                    {currentCustomerBalance.data?.jugsOutstanding ?? '…'}
                  </strong>
                </p>
              </div>
            )}

            <label>
              Ruta *
              <select
                required
                value={selectedRouteId}
                onChange={e => setSelectedRouteId(e.target.value)}
              >
                <option value="">-- Seleccionar ruta --</option>
                {routes.data?.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.code} · {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo de Evento *
              <select
                required
                value={eventType}
                onChange={e => setEventType(e.target.value as JugEventType)}
              >
                <option value="LENT">Dejar Garrafones Prestados (+)</option>
                <option value="RETURNED">Recibir Vacíos Devueltos (-)</option>
                <option value="CHARGED_LOSS">Cobrar Garrafón Perdido (-)</option>
                <option value="CHARGED_DAMAGE">Cobrar Garrafón Dañado (-)</option>
              </select>
            </label>

            <label>
              Cantidad de Garrafones *
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
              />
            </label>

            {eventType.startsWith('CHARGED') && (
              <label>
                Precio Unitario de Cobro (Q) *
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Ej. 45.00"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                />
              </label>
            )}

            <label style={{ gridColumn: 'span 2' }}>
              Notas / Observaciones
              <input
                type="text"
                placeholder="Detalle o motivo del movimiento…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </label>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="primary" disabled={recordMutation.isPending}>
                {recordMutation.isPending ? 'Registrando…' : 'Guardar Movimiento'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setFeedbackMessage(null);
                  setSelectedCustomerId('');
                  setQuantity(1);
                  setNotes('');
                }}
              >
                Limpiar
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── TAB 3: RESUMEN POR RUTA ── */}
      {activeTab === 'routes' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Garrafones Pendientes por Ruta</h2>
            <select
              value={summaryRouteId}
              onChange={e => setSummaryRouteId(e.target.value)}
              style={{ maxWidth: '300px' }}
            >
              <option value="">-- Seleccionar ruta --</option>
              {routes.data?.map(r => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name}
                </option>
              ))}
            </select>
          </div>

          {summaryRouteId && routeSummary.isLoading && <p>Cargando resumen de ruta…</p>}
          {summaryRouteId && routeSummary.error && <div className="alert error">{routeSummary.error.message}</div>}

          {routeSummary.data && (
            <>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                <div className="panel" style={{ flex: 1, textAlign: 'center', background: '#e5f6f7' }}>
                  <h3 style={{ margin: 0, color: '#007680' }}>Total Garrafones en Calle</h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
                    {routeSummary.data.totalJugsOutstanding}
                  </p>
                </div>
                <div className="panel" style={{ flex: 1, textAlign: 'center', background: '#f5f7f8' }}>
                  <h3 style={{ margin: 0 }}>Clientes con Garrafones</h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
                    {routeSummary.data.totalCustomersWithJugs}
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Ruta</th>
                      <th>Garrafones Pendientes</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeSummary.data.customerBalances.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center' }} className="muted">
                          No hay clientes con garrafones pendientes en esta ruta.
                        </td>
                      </tr>
                    ) : (
                      routeSummary.data.customerBalances.map(cb => (
                        <tr key={cb.customerId}>
                          <td><strong>{cb.customerName}</strong></td>
                          <td>{cb.routeName}</td>
                          <td>
                            <strong style={{ color: '#007680', fontSize: '1.1rem' }}>
                              {cb.jugsOutstanding}
                            </strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setHistoryCustomerId(cb.customerId)}
                            >
                              Ver Historial
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
