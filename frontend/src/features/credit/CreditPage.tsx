import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, type FormEvent } from 'react';
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
  isAdmin?: boolean;
};

export function CreditPage({ canRecord = true, canVerify = false, currentUserId, isAdmin = false }: CreditPageProps) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'statement' | 'payment' | 'transfers' | 'routes'>(
    isAdmin ? 'routes' : 'statement'
  );

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

  type CreditSaleItem = {
    id: string;
    productName: string;
    presentationName?: string;
    quantityBaseUnits: number;
    presentationQuantity?: number;
  };
  type CreditSalePayment = { method: string; amount: number; status: string };
  type CreditSale = {
    id: string;
    customerId?: string;
    status: string;
    creditAmount?: number;
    createdAt: string;
    items: CreditSaleItem[];
    payments?: CreditSalePayment[];
  };

  const sales = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiRequest<CreditSale[]>('/sales'),
    enabled: isAdmin,
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

  // ── Cartera pendiente por ruta y deudores agrupados ──
  const [debtorSearch, setDebtorSearch] = useState('');
  const [selectedDebtorRoute, setSelectedDebtorRoute] = useState<'ALL' | string>('ALL');
  const [collapsedRouteGroups, setCollapsedRouteGroups] = useState<Record<string, boolean>>({});

  const toggleRouteCollapse = (key: string) => {
    setCollapsedRouteGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Clientes que tienen saldo deudor (currentBalance > 0)
  const allDebtors = useMemo(() => {
    return (customers.data ?? []).filter(c => Number(c.currentBalance || 0) > 0.009);
  }, [customers.data]);

  // Total global de la cartera adeudada
  const grandTotalDebt = useMemo(() => {
    return allDebtors.reduce((sum, d) => sum + Number(d.currentBalance || 0), 0);
  }, [allDebtors]);

  // Mapa de productos dejados a crédito por cliente
  const debtorCreditProductsMap = useMemo(() => {
    const map = new Map<string, Array<{ name: string; quantity: number }>>();
    if (!sales.data) return map;

    // Filtrar ventas confirmadas con crédito
    const creditSales = sales.data.filter(s =>
      s.customerId &&
      s.status !== 'ANNULLED' &&
      (Number(s.creditAmount || 0) > 0 || s.payments?.some(p => p.method === 'CREDIT'))
    );

    // Ordenar de más reciente a más antigua
    const sortedSales = [...creditSales].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    for (const sale of sortedSales) {
      if (!sale.customerId) continue;
      const currentList = map.get(sale.customerId) ?? [];
      for (const item of (sale.items ?? [])) {
        const prodName = item.productName || item.presentationName || 'Producto';
        const existing = currentList.find(p => p.name.toLowerCase() === prodName.toLowerCase());
        const qty = Number(item.presentationQuantity || item.quantityBaseUnits || 1);
        if (existing) {
          existing.quantity += qty;
        } else {
          currentList.push({ name: prodName, quantity: qty });
        }
      }
      map.set(sale.customerId, currentList);
    }

    return map;
  }, [sales.data]);

  // Filtro de búsqueda sobre deudores
  const filteredDebtors = useMemo(() => {
    if (!debtorSearch.trim()) return allDebtors;
    const q = debtorSearch.toLowerCase().trim();
    return allDebtors.filter(d => {
      const prods = debtorCreditProductsMap.get(d.id);
      const matchesProduct = prods?.some(p => p.name.toLowerCase().includes(q));
      return (
        d.name?.toLowerCase().includes(q) ||
        d.code?.toLowerCase().includes(q) ||
        d.contactName?.toLowerCase().includes(q) ||
        d.phone?.includes(q) ||
        d.routeName?.toLowerCase().includes(q) ||
        d.sellerName?.toLowerCase().includes(q) ||
        Boolean(matchesProduct)
      );
    });
  }, [allDebtors, debtorSearch, debtorCreditProductsMap]);

  type DebtorRouteGroup = {
    key: string;
    routeId?: string;
    routeCode: string;
    routeName: string;
    sellerName: string;
    totalDebt: number;
    debtors: Customer[];
  };

  // Agrupar deudores por rutas comerciales que tienen deuda
  const debtorGroups = useMemo(() => {
    const map = new Map<string, DebtorRouteGroup>();

    filteredDebtors.forEach(debtor => {
      const key = debtor.routeId || 'UNASSIGNED';
      let group = map.get(key);
      if (!group) {
        const routeMeta = routes.data?.find(r => r.id === debtor.routeId);
        group = {
          key,
          routeId: debtor.routeId,
          routeCode: routeMeta?.code || debtor.routeCode || (debtor.routeId ? 'Ruta' : 'S/R'),
          routeName: routeMeta?.name || debtor.routeName || (debtor.routeId ? 'Ruta Asignada' : 'Clientes con Deuda sin Ruta Asignada'),
          sellerName: routeMeta?.sellerName || debtor.sellerName || 'Sin asignar',
          totalDebt: 0,
          debtors: [],
        };
        map.set(key, group);
      } else {
        if ((!group.sellerName || group.sellerName === 'Sin asignar') && debtor.sellerName) {
          group.sellerName = debtor.sellerName;
        }
        if ((!group.routeName || group.routeName === 'Ruta Asignada') && debtor.routeName) {
          group.routeName = debtor.routeName;
        }
      }
      group.debtors.push(debtor);
      group.totalDebt += Number(debtor.currentBalance || 0);
    });

    // Ordenar deudores dentro de cada grupo por mayor saldo adeudado primero
    map.forEach(g => {
      g.debtors.sort((a, b) => Number(b.currentBalance || 0) - Number(a.currentBalance || 0));
    });

    // Ordenar grupos: rutas con mayor deuda acumulada primero, luego sin ruta asignada
    const result = Array.from(map.values());
    result.sort((a, b) => {
      if (a.key === 'UNASSIGNED') return 1;
      if (b.key === 'UNASSIGNED') return -1;
      return b.totalDebt - a.totalDebt;
    });

    return result;
  }, [filteredDebtors, routes.data]);

  // Grupos mostrados según la píldora de ruta seleccionada
  const displayedDebtorGroups = useMemo(() => {
    if (selectedDebtorRoute === 'ALL') return debtorGroups;
    return debtorGroups.filter(g => g.key === selectedDebtorRoute);
  }, [debtorGroups, selectedDebtorRoute]);

  // Clientes organizados por ruta para desplegables de Estado de Cuenta y Abonos
  const customersGroupedForSelect = useMemo(() => {
    const map = new Map<string, { label: string; items: Customer[] }>();
    (customers.data ?? []).forEach(c => {
      const key = c.routeId || 'UNASSIGNED';
      let g = map.get(key);
      if (!g) {
        const r = routes.data?.find(route => route.id === c.routeId);
        const label = r ? `${r.code} · ${r.name}` : (c.routeName || 'Sin Ruta Asignada');
        g = { label, items: [] };
        map.set(key, g);
      }
      g.items.push(c);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [customers.data, routes.data]);

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
            {isAdmin ? (
              <>
                <button
                  type="button"
                  className={activeTab === 'routes' ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab('routes')}
                >
                  Cartera por Ruta {allDebtors.length > 0 ? `(${allDebtors.length})` : ''}
                </button>
                <button
                  type="button"
                  className={activeTab === 'statement' ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab('statement')}
                >
                  Estados de Cuenta
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={activeTab === 'statement' ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab('statement')}
                >
                  Estados de Cuenta
                </button>
                <button
                  type="button"
                  className={activeTab === 'routes' ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab('routes')}
                >
                  Cartera por Ruta {allDebtors.length > 0 ? `(${allDebtors.length})` : ''}
                </button>
              </>
            )}
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
                {customersGroupedForSelect.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name} {Number(c.currentBalance || 0) > 0 ? `(Saldo: Q ${c.currentBalance.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </optgroup>
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
              style={{ maxWidth: '420px' }}
            >
              <option value="">-- Seleccionar cliente para consultar --</option>
              {customersGroupedForSelect.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name} {Number(c.currentBalance || 0) > 0 ? `(Deuda: Q ${c.currentBalance.toFixed(2)})` : ''}
                    </option>
                  ))}
                </optgroup>
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

      {/* ── TAB 4: CARTERA POR RUTA (DEUDORES AGRUPADOS) ── */}
      {activeTab === 'routes' && (
        <section className="panel section-panel">
          <div
            className="section-heading"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}
          >
            <div>
              <h2>Cartera de Clientes Deudores por Ruta</h2>
              <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>
                Deudores agrupados por rutas comerciales y vendedores que presentan saldos pendientes.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedDebtorRoute}
                onChange={e => setSelectedDebtorRoute(e.target.value)}
                style={{ maxWidth: '280px' }}
                aria-label="Filtrar por ruta"
              >
                <option value="ALL">-- Todas las rutas con deuda ({debtorGroups.length}) --</option>
                {debtorGroups.map(g => (
                  <option key={g.key} value={g.key}>
                    {g.routeCode ? `${g.routeCode} · ` : ''}{g.routeName} (Q {g.totalDebt.toFixed(2)})
                  </option>
                ))}
              </select>

              {displayedDebtorGroups.length > 0 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const allCollapsed = displayedDebtorGroups.every(g => collapsedRouteGroups[g.key]);
                    const next: Record<string, boolean> = {};
                    displayedDebtorGroups.forEach(g => {
                      next[g.key] = !allCollapsed;
                    });
                    setCollapsedRouteGroups(next);
                  }}
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.8rem' }}
                >
                  {displayedDebtorGroups.every(g => collapsedRouteGroups[g.key]) ? '▼ Expandir Todas' : '▲ Colapsar Todas'}
                </button>
              )}
            </div>
          </div>

          {/* Tarjetas KPI de Cartera */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', margin: '1.25rem 0' }}>
            <div className="panel" style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '10px', padding: '1rem' }}>
              <small style={{ color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                Cartera Total Adeudada
              </small>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.35rem 0 0.1rem 0', color: '#dc2626' }}>
                Q {grandTotalDebt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <small style={{ color: '#7f1d1d' }}>Saldo pendiente total en cartera</small>
            </div>

            <div className="panel" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '1rem' }}>
              <small style={{ color: '#0369a1', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                Clientes con Deuda
              </small>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.35rem 0 0.1rem 0', color: '#0284c7' }}>
                {allDebtors.length}
              </p>
              <small style={{ color: '#075985' }}>Clientes activos con saldo &gt; Q 0.00</small>
            </div>

            <div className="panel" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
              <small style={{ color: '#475569', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                Rutas con Cartera Pendiente
              </small>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.35rem 0 0.1rem 0', color: '#334155' }}>
                {debtorGroups.filter(g => g.key !== 'UNASSIGNED').length}
              </p>
              <small style={{ color: '#64748b' }}>Rutas comerciales con deudas activas</small>
            </div>
          </div>

          {/* Búsqueda y Filtros de Ruta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <input
              type="search"
              placeholder="🔍 Buscar deudor por nombre, código, producto, teléfono, ruta o vendedor..."
              value={debtorSearch}
              onChange={e => setDebtorSearch(e.target.value)}
              style={{ width: '100%', maxWidth: '520px' }}
            />

            {debtorGroups.length > 1 && (
              <div className="customer-filter-pills">
                <button
                  type="button"
                  className={`customer-filter-pill ${selectedDebtorRoute === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSelectedDebtorRoute('ALL')}
                >
                  Todas las Rutas con Deuda ({debtorGroups.length})
                </button>
                {debtorGroups.map(g => (
                  <button
                    key={g.key}
                    type="button"
                    className={`customer-filter-pill ${selectedDebtorRoute === g.key ? 'active' : ''}`}
                    onClick={() => setSelectedDebtorRoute(g.key)}
                  >
                    {g.routeCode ? `${g.routeCode} · ` : ''}{g.routeName}
                    <span style={{ opacity: 0.85, fontSize: '0.78rem', marginLeft: '0.2rem' }}>
                      (Q {g.totalDebt.toFixed(2)} · {g.debtors.length})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Estados de carga o listas vacías */}
          {customers.isLoading && <p>Cargando información de deudores y rutas…</p>}

          {!customers.isLoading && allDebtors.length === 0 && (
            <div className="alert success" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <strong>✓ ¡Excelente estado de cobranza!</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>No existen clientes deudores ni saldos pendientes en las rutas registradas.</p>
            </div>
          )}

          {!customers.isLoading && allDebtors.length > 0 && displayedDebtorGroups.length === 0 && (
            <div className="alert muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
              No se encontraron clientes deudores que coincidan con el criterio de búsqueda "{debtorSearch}".
            </div>
          )}

          {/* Grupos de Deudores por Ruta */}
          {!customers.isLoading && displayedDebtorGroups.map(group => {
            const isCollapsed = !!collapsedRouteGroups[group.key];
            const isUnassigned = group.key === 'UNASSIGNED';

            return (
              <div
                key={group.key}
                className="route-group-panel"
                style={{
                  borderLeft: isUnassigned ? '4px solid #f59e0b' : '4px solid #dc2626',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  className={`route-group-banner ${isUnassigned ? 'unassigned' : ''}`}
                  onClick={() => toggleRouteCollapse(group.key)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}
                >
                  <div className="route-group-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>{isUnassigned ? '⚠️' : '🚚'}</span>
                    <div>
                      <h3 className="route-group-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                        {group.routeCode ? `${group.routeCode} — ` : ''}{group.routeName}
                      </h3>
                      <span className="route-group-subtitle" style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        👤 Vendedor asignado: <strong>{group.sellerName}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      Deuda Ruta: Q {group.totalDebt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>

                    <span
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '9999px',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                      }}
                    >
                      {group.debtors.length} {group.debtors.length === 1 ? 'deudor' : 'deudores'}
                    </span>

                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRouteCollapse(group.key);
                      }}
                    >
                      {isCollapsed ? '▼ Ver deudores' : '▲ Ocultar'}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Código</th>
                          <th>Productos a Crédito</th>
                          <th>Contacto / Teléfono</th>
                          <th>Límite Crédito</th>
                          <th>Saldo Adeudado</th>
                          <th>Disponible</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.debtors.map(debtor => {
                          const available = Math.max(0, debtor.creditLimit - debtor.currentBalance);
                          return (
                            <tr key={debtor.id}>
                              <td>
                                <strong>{debtor.name}</strong>
                                {debtor.customerType && (
                                  <span
                                    style={{
                                      display: 'block',
                                      fontSize: '0.75rem',
                                      color: '#64748b',
                                      textTransform: 'capitalize',
                                    }}
                                  >
                                    {debtor.customerType.toLowerCase()}
                                  </span>
                                )}
                              </td>
                              <td>
                                <code>{debtor.code}</code>
                              </td>
                              <td>
                                {(() => {
                                  const prods = debtorCreditProductsMap.get(debtor.id);
                                  if (!prods || prods.length === 0) {
                                    return <span className="muted" style={{ fontSize: '0.8rem' }}>—</span>;
                                  }
                                  return (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '280px' }}>
                                      {prods.map((p, idx) => (
                                        <span
                                          key={idx}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            padding: '0.2rem 0.5rem',
                                            background: '#f0fdf4',
                                            border: '1px solid #bbf7d0',
                                            borderRadius: '0.45rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: '#166534',
                                          }}
                                        >
                                          <span>{p.name.toLowerCase().includes('garraf') ? '💧' : p.name.toLowerCase().includes('fardo') ? '📦' : '🏷️'}</span>
                                          <span>{p.name}</span>
                                          <span
                                            style={{
                                              background: '#dcfce7',
                                              padding: '0.05rem 0.35rem',
                                              borderRadius: '0.25rem',
                                              fontSize: '0.74rem',
                                              fontWeight: 700,
                                            }}
                                          >
                                            x{p.quantity}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td>
                                <div>{debtor.phone || '—'}</div>
                                {debtor.contactName && debtor.contactName !== debtor.name && (
                                  <small className="muted">{debtor.contactName}</small>
                                )}
                              </td>
                              <td>Q {debtor.creditLimit.toFixed(2)}</td>
                              <td>
                                <strong style={{ color: '#dc2626', fontSize: '1.05rem' }}>
                                  Q {debtor.currentBalance.toFixed(2)}
                                </strong>
                              </td>
                              <td>
                                <span style={{ color: available > 0 ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                                  Q {available.toFixed(2)}
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons" style={{ display: 'flex', gap: '0.4rem' }}>
                                  <button
                                    type="button"
                                    className="secondary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                                    onClick={() => {
                                      setStatementCustomerId(debtor.id);
                                      setActiveTab('statement');
                                    }}
                                    title="Ver historial de cargos y abonos del cliente"
                                  >
                                    📄 Estado
                                  </button>
                                  {canRecord && (
                                    <button
                                      type="button"
                                      className="primary"
                                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                                      onClick={() => {
                                        setPaymentCustomerId(debtor.id);
                                        setActiveTab('payment');
                                      }}
                                      title="Registrar un abono para este cliente"
                                    >
                                      💵 Abonar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
