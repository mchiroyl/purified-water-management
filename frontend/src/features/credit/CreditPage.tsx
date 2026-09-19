import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';
import type { Customer, Route } from '../routes/types';
import { fetchAndDownloadCreditVoucher, fetchAndShareCreditVoucher } from './creditVoucherSharing';
import type {
  CreditBalanceResponse,
  CreditDecisionRequest,
  CreditPaymentMethod,
  CreditPaymentRequest,
  CreditPaymentResponse,
  CreditRoutePendingResponse,
  CreditStatementResponse,
} from './types';

type CreditPageProps = {
  canRecord?: boolean;
  canVerify?: boolean;
  currentUserId?: string;
};

export function CreditPage({ canRecord = true, canVerify = false, currentUserId }: CreditPageProps) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'statement' | 'payment' | 'transfers' | 'routes'>('statement');

  // Deep-link: si llegan con ?customerId=UUID, pre-seleccionar en estado de cuenta y abono
  useEffect(() => {
    const preselect = searchParams.get('customerId');
    if (preselect) {
      setStatementCustomerId(preselect);
      setPaymentCustomerId(preselect);
      setActiveTab('statement');
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

  // ── Formulario de registro de abono ──
  const [paymentCustomerId, setPaymentCustomerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CreditPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState('');
  const [notes, setNotes] = useState('');
  const [lastPaymentRegistered, setLastPaymentRegistered] = useState<CreditPaymentResponse | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Saldo de cliente para el formulario de pago
  const paymentCustomerBalance = useQuery({
    queryKey: ['credit', 'balance', paymentCustomerId],
    queryFn: () => apiRequest<CreditBalanceResponse>(`/credit/customers/${paymentCustomerId}/balance`),
    enabled: !!paymentCustomerId,
  });

  // Mutación de registro de abono
  const recordPaymentMutation = useMutation({
    mutationFn: (data: CreditPaymentRequest) =>
      apiRequest<CreditPaymentResponse>('/credit/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      setLastPaymentRegistered(res);
      setFeedbackMessage({
        type: 'success',
        text: res.paymentMethod === 'CASH'
          ? 'Abono en efectivo registrado y aplicado exitosamente al saldo.'
          : 'Abono por transferencia registrado. Pendiente de verificación por administración.',
      });
      setPaymentAmount('');
      setReference('');
      setBank('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['credit'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: Error) => {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error al registrar el abono.' });
    },
  });

  // ── Transferencias pendientes de verificación ──
  const pendingTransfers = useQuery({
    queryKey: ['credit', 'transfers', 'pending'],
    queryFn: () => apiRequest<CreditPaymentResponse[]>('/credit/payments/transfers/pending'),
    enabled: canVerify,
  });

  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const decisionMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CreditDecisionRequest }) =>
      apiRequest<CreditPaymentResponse>(`/credit/payments/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setRejectingPaymentId(null);
      setRejectionReason('');
      void queryClient.invalidateQueries({ queryKey: ['credit'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: Error) => {
      alert(err.message || 'Error al procesar la decisión.');
    },
  });

  // ── Estado de cuenta por cliente ──
  const [statementCustomerId, setStatementCustomerId] = useState('');
  const customerStatement = useQuery({
    queryKey: ['credit', 'statement', statementCustomerId],
    queryFn: () => apiRequest<CreditStatementResponse>(`/credit/customers/${statementCustomerId}/statement`),
    enabled: !!statementCustomerId,
  });

  // ── Cartera pendiente por ruta ──
  const [pendingRouteId, setPendingRouteId] = useState('');
  const routePending = useQuery({
    queryKey: ['credit', 'route-pending', pendingRouteId],
    queryFn: () => apiRequest<CreditRoutePendingResponse>(`/credit/routes/${pendingRouteId}/pending`),
    enabled: !!pendingRouteId,
  });

  const handleSubmitPayment = (e: FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);
    setLastPaymentRegistered(null);

    if (!paymentCustomerId) {
      setFeedbackMessage({ type: 'error', text: 'Seleccione un cliente.' });
      return;
    }
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setFeedbackMessage({ type: 'error', text: 'El monto debe ser mayor a 0.' });
      return;
    }
    if (paymentMethod === 'TRANSFER' && !reference.trim()) {
      setFeedbackMessage({ type: 'error', text: 'El número de referencia es obligatorio para transferencias.' });
      return;
    }

    const payload: CreditPaymentRequest = {
      customerId: paymentCustomerId,
      amount: amt,
      paymentMethod,
      reference: reference.trim(),
      bank: bank.trim(),
      notes: notes.trim(),
    };

    recordPaymentMutation.mutate(payload);
  };

  return (
    <main>
      <PageHeader
        eyebrow="Cobranza y Finanzas"
        title="Créditos y Abonos"
        description="Control de saldos de clientes, registro de abonos, emisión de comprobantes y verificación de transferencias."
        actions={
          <div className="filter-group">
            <button
              type="button"
              className={activeTab === 'statement' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('statement')}
            >
              Estados de Cuenta
            </button>
            {canRecord && (
              <button
                type="button"
                className={activeTab === 'payment' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('payment')}
              >
                Registrar Abono
              </button>
            )}
            {canVerify && (
              <button
                type="button"
                className={activeTab === 'transfers' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('transfers')}
              >
                Verificar Transferencias {pendingTransfers.data && pendingTransfers.data.length > 0 && `(${pendingTransfers.data.length})`}
              </button>
            )}
            <button
              type="button"
              className={activeTab === 'routes' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('routes')}
            >
              Cartera por Ruta
            </button>
          </div>
        }
      />

      {/* ── TAB 1: REGISTRAR ABONO ── */}
      {activeTab === 'payment' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Registrar Abono a Crédito</h2>
          </div>

          {feedbackMessage && (
            <div className={`alert ${feedbackMessage.type}`}>{feedbackMessage.text}</div>
          )}

          {lastPaymentRegistered && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#e5f6f7',
                borderRadius: '8px',
                border: '1px solid #007680',
                marginBottom: '1.5rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#15343b' }}>
                Comprobante de Abono: {lastPaymentRegistered.id.slice(0, 8).toUpperCase()}
              </h3>
              <p style={{ margin: '0 0 1rem 0' }}>
                Cliente: <strong>{lastPaymentRegistered.customerName}</strong> | Monto: <strong>Q {lastPaymentRegistered.amount.toFixed(2)}</strong>
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    fetchAndDownloadCreditVoucher(lastPaymentRegistered.id)
                  }
                >
                  Descargar Comprobante PDF
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    fetchAndShareCreditVoucher(lastPaymentRegistered.id, {
                      customerName: lastPaymentRegistered.customerName,
                      amount: lastPaymentRegistered.amount,
                    })
                  }
                >
                  Compartir por WhatsApp
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitPayment} className="form-grid">
            <label>
              Cliente *
              <select
                required
                value={paymentCustomerId}
                onChange={e => {
                  setPaymentCustomerId(e.target.value);
                  setFeedbackMessage(null);
                  setLastPaymentRegistered(null);
                }}
              >
                <option value="">-- Seleccionar cliente --</option>
                {customers.data?.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name} (Saldo: Q{c.currentBalance.toFixed(2)})
                  </option>
                ))}
              </select>
            </label>

            {paymentCustomerId && (
              <div
                style={{
                  gridColumn: 'span 2',
                  display: 'flex',
                  gap: '2rem',
                  padding: '0.8rem 1rem',
                  background: '#f5f7f8',
                  borderRadius: '6px',
                  marginBottom: '0.5rem',
                }}
              >
                <div>
                  <small style={{ display: 'block', color: '#555' }}>Límite de Crédito</small>
                  <strong>Q {paymentCustomerBalance.data?.creditLimit.toFixed(2) ?? '…'}</strong>
                </div>
                <div>
                  <small style={{ display: 'block', color: '#555' }}>Saldo Actual Adeudado</small>
                  <strong style={{ color: '#d9534f', fontSize: '1.2rem' }}>
                    Q {paymentCustomerBalance.data?.currentBalance.toFixed(2) ?? '…'}
                  </strong>
                </div>
                <div>
                  <small style={{ display: 'block', color: '#555' }}>Crédito Disponible</small>
                  <strong style={{ color: '#5cb85c' }}>
                    Q {paymentCustomerBalance.data?.availableCredit.toFixed(2) ?? '…'}
                  </strong>
                </div>
              </div>
            )}

            <label>
              Monto a Abonar (Q) *
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="Ej. 150.00"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
              />
            </label>

            <label>
              Método de Pago *
              <select
                required
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as CreditPaymentMethod)}
              >
                <option value="CASH">Efectivo (Confirmación Inmediata)</option>
                <option value="TRANSFER">Transferencia Bancaria (Requiere Verificación)</option>
              </select>
            </label>

            {paymentMethod === 'TRANSFER' && (
              <>
                <label>
                  No. de Boleta / Referencia *
                  <input
                    type="text"
                    required
                    placeholder="Ej. 002938492"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                  />
                </label>

                <label>
                  Banco de Origen / Destino
                  <input
                    type="text"
                    placeholder="Ej. Banrural, BAC, Banco Industrial"
                    value={bank}
                    onChange={e => setBank(e.target.value)}
                  />
                </label>
              </>
            )}

            <label style={{ gridColumn: 'span 2' }}>
              Notas / Observaciones
              <input
                type="text"
                placeholder="Observaciones adicionales sobre el pago…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </label>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="primary" disabled={recordPaymentMutation.isPending}>
                {recordPaymentMutation.isPending ? 'Procesando…' : 'Registrar Abono'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setPaymentCustomerId('');
                  setPaymentAmount('');
                  setReference('');
                  setBank('');
                  setNotes('');
                  setFeedbackMessage(null);
                  setLastPaymentRegistered(null);
                }}
              >
                Limpiar Formulario
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── TAB 2: VERIFICAR TRANSFERENCIAS ── */}
      {activeTab === 'transfers' && canVerify && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Transferencias Pendientes de Verificación</h2>
            <span>{pendingTransfers.data?.length ?? 0} pendientes</span>
          </div>

          {pendingTransfers.isLoading && <p>Cargando transferencias…</p>}
          {pendingTransfers.error && <div className="alert error">{pendingTransfers.error.message}</div>}

          {rejectingPaymentId && (
            <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '6px', marginBottom: '1.5rem' }}>
              <h4>Rechazar Transferencia</h4>
              <p style={{ margin: '0 0 0.5rem 0' }}>Indique el motivo por el cual no se valida la transferencia:</p>
              <input
                type="text"
                style={{ width: '100%', marginBottom: '0.8rem' }}
                placeholder="Ej. Boleta no reflejada en banca en línea, monto no coincide…"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  className="primary"
                  disabled={!rejectionReason.trim() || decisionMutation.isPending}
                  onClick={() =>
                    decisionMutation.mutate({
                      id: rejectingPaymentId,
                      body: { decision: 'REJECT', rejectionReason: rejectionReason.trim() },
                    })
                  }
                >
                  Confirmar Rechazo
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setRejectingPaymentId(null);
                    setRejectionReason('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Banco</th>
                  <th>Referencia</th>
                  <th>Cobrado por</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!pendingTransfers.data || pendingTransfers.data.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center' }} className="muted">
                      No hay transferencias de crédito pendientes de verificación.
                    </td>
                  </tr>
                ) : (
                  pendingTransfers.data.map(t => {
                    const isSelf = currentUserId && t.collectedBy === currentUserId;
                    return (
                      <tr key={t.id}>
                        <td>{new Date(t.createdAt).toLocaleString()}</td>
                        <td>
                          <strong>{t.customerName}</strong>
                          <small>{t.customerCode}</small>
                        </td>
                        <td>
                          <strong style={{ color: '#007680' }}>Q {t.amount.toFixed(2)}</strong>
                        </td>
                        <td>{t.bank || '—'}</td>
                        <td>
                          <code>{t.reference}</code>
                        </td>
                        <td>{t.collectedByName}</td>
                        <td>
                          {isSelf ? (
                            <small className="muted">Registrado por usted (Segregación requerida)</small>
                          ) : (
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="primary"
                                disabled={decisionMutation.isPending}
                                onClick={() =>
                                  decisionMutation.mutate({
                                    id: t.id,
                                    body: { decision: 'APPROVE' },
                                  })
                                }
                              >
                                Verificar
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => setRejectingPaymentId(t.id)}
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 3: ESTADO DE CUENTA ── */}
      {activeTab === 'statement' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Estado de Cuenta de Cliente</h2>
            <select
              value={statementCustomerId}
              onChange={e => setStatementCustomerId(e.target.value)}
              style={{ maxWidth: '350px' }}
            >
              <option value="">-- Seleccionar cliente para consultar --</option>
              {customers.data?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>

          {statementCustomerId && customerStatement.isLoading && <p>Cargando estado de cuenta…</p>}
          {statementCustomerId && customerStatement.error && (
            <div className="alert error">{customerStatement.error.message}</div>
          )}

          {customerStatement.data && (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  marginBottom: '1.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div className="panel" style={{ flex: 1, minWidth: '180px', background: '#f5f7f8' }}>
                  <small style={{ color: '#666' }}>Límite de Crédito</small>
                  <p style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0.3rem 0' }}>
                    Q {customerStatement.data.creditLimit.toFixed(2)}
                  </p>
                </div>
                <div className="panel" style={{ flex: 1, minWidth: '180px', background: '#fff0f0' }}>
                  <small style={{ color: '#666' }}>Saldo Actual Adeudado</small>
                  <p style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0.3rem 0', color: '#d9534f' }}>
                    Q {customerStatement.data.currentBalance.toFixed(2)}
                  </p>
                </div>
                <div className="panel" style={{ flex: 1, minWidth: '180px', background: '#e5f6f7' }}>
                  <small style={{ color: '#666' }}>Crédito Disponible</small>
                  <p style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0.3rem 0', color: '#007680' }}>
                    Q {customerStatement.data.availableCredit.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Descripción / Referencia</th>
                      <th>Monto</th>
                      <th>Saldo Resultante</th>
                      <th>Registrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerStatement.data.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center' }} className="muted">
                          No hay movimientos registrados en la cuenta de crédito de este cliente.
                        </td>
                      </tr>
                    ) : (
                      customerStatement.data.entries.map(item => {
                        const isCharge = item.entryType === 'SALE_CHARGE';
                        return (
                          <tr key={item.id}>
                            <td>{new Date(item.occurredAt).toLocaleString()}</td>
                            <td>
                              <span
                                className={`status ${isCharge ? 'inactive' : 'active'}`}
                                style={{ fontWeight: 'bold' }}
                              >
                                {item.entryType === 'SALE_CHARGE' && 'CARGO (+)'}
                                {item.entryType === 'SALE_VOID' && 'ANULACIÓN (-)'}
                                {item.entryType === 'CREDIT_PAYMENT' && 'ABONO (-)'}
                              </span>
                            </td>
                            <td>{item.description}</td>
                            <td>
                              <strong style={{ color: isCharge ? '#d9534f' : '#5cb85c' }}>
                                {isCharge ? '+' : '-'} Q {item.amount.toFixed(2)}
                              </strong>
                            </td>
                            <td>Q {item.balanceAfter.toFixed(2)}</td>
                            <td>{item.createdByName}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── TAB 4: CARTERA POR RUTA ── */}
      {activeTab === 'routes' && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Cartera de Crédito Pendiente por Ruta</h2>
            <select
              value={pendingRouteId}
              onChange={e => setPendingRouteId(e.target.value)}
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

          {pendingRouteId && routePending.isLoading && <p>Cargando cartera de la ruta…</p>}
          {pendingRouteId && routePending.error && (
            <div className="alert error">{routePending.error.message}</div>
          )}

          {routePending.data && (
            <>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                <div className="panel" style={{ flex: 1, textAlign: 'center', background: '#fff0f0' }}>
                  <h3 style={{ margin: 0, color: '#d9534f' }}>Deuda Total en Ruta</h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#d9534f' }}>
                    Q {routePending.data.totalDebt.toFixed(2)}
                  </p>
                </div>
                <div className="panel" style={{ flex: 1, textAlign: 'center', background: '#f5f7f8' }}>
                  <h3 style={{ margin: 0 }}>Clientes con Saldo Pendiente</h3>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
                    {routePending.data.totalDebtors}
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Código</th>
                      <th>Límite de Crédito</th>
                      <th>Saldo Pendiente</th>
                      <th>Disponible</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routePending.data.debtors.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center' }} className="muted">
                          No hay clientes con deuda pendiente en esta ruta.
                        </td>
                      </tr>
                    ) : (
                      routePending.data.debtors.map(d => (
                        <tr key={d.customerId}>
                          <td><strong>{d.customerName}</strong></td>
                          <td>{d.customerCode}</td>
                          <td>Q {d.creditLimit.toFixed(2)}</td>
                          <td>
                            <strong style={{ color: '#d9534f', fontSize: '1.1rem' }}>
                              Q {d.currentBalance.toFixed(2)}
                            </strong>
                          </td>
                          <td>Q {d.availableCredit.toFixed(2)}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => {
                                  setStatementCustomerId(d.customerId);
                                  setActiveTab('statement');
                                }}
                              >
                                Ver Estado
                              </button>
                              {canRecord && (
                                <button
                                  type="button"
                                  className="primary"
                                  onClick={() => {
                                    setPaymentCustomerId(d.customerId);
                                    setActiveTab('payment');
                                  }}
                                >
                                  Abonar
                                </button>
                              )}
                            </div>
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
