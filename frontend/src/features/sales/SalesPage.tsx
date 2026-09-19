import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../app/PageHeader';
import { useState, type FormEvent } from 'react';
import { apiBlob, apiRequest } from '../../services/apiClient';
import { openMobileDatabase, type GeoLocationSnapshot } from '../../offline/mobileDatabase';
import { captureCurrentLocation } from '../../services/geolocation';
import { cacheReceipt, findCachedReceipt, markReceiptPending } from './receiptOffline';
import { downloadReceiptFile, shareReceiptFile } from './receiptSharing';
import type { JugBalanceResponse } from '../jugs/types';
import type { CreditBalanceResponse, CreditPaymentMethod } from '../credit/types';

type Route = { id: string; code: string; name: string; status: string };
type Customer = { id: string; code: string; name: string; status: string; routeId?: string; customerType: string; creditAllowed: boolean; creditLimit: number; currentBalance: number };
type Presentation = { id: string; code: string; name: string; active: boolean };
type Product = { id: string; code: string; name: string; active: boolean; controlsInventory: boolean; presentations: Presentation[] };
type SaleItem = { id: string; productName: string; presentationName: string; presentationQuantity: number; quantityBaseUnits: number; unitPrice: number; lineTotal: number; priceSource: string };
type Payment = { id: string; method: string; amount: number; status: string; reference: string; bank: string };
type Sale = { id: string; documentNumber: string; routeCode: string; routeName: string; sellerName: string; customerCode: string; customerName: string; status: string; subtotal: number; total: number; currencyCode: string; createdAt: string; items: SaleItem[]; payments?: Payment[]; pendingTransferAmount?: number; rejectedTransferAmount?: number; creditAmount?: number; routeId?: string; customerId?: string };
type ItemForm = { presentationId: string; quantity: number };
type PaymentForm = { method: string; amount: string; reference: string; bank: string; evidenceReference: string };

const money = (value: number) => `Q${Number(value).toFixed(2)}`;
const newPayment = (method = 'CASH'): PaymentForm => ({ method, amount: '', reference: '', bank: '', evidenceReference: '' });

type SaleLocation = { latitude: number; longitude: number; accuracyMeters: number | null; capturedAt: string; persistedAt: string };

// ── Banner contextual de cliente ────────────────────────────────────────────
function CustomerContextBanner({
  customerId,
  jugBalance,
  creditBalance,
  jugLoading,
  creditLoading,
}: {
  customerId: string;
  jugBalance: JugBalanceResponse | undefined;
  creditBalance: CreditBalanceResponse | undefined;
  jugLoading: boolean;
  creditLoading: boolean;
}) {
  if (!customerId) return null;
  if (jugLoading || creditLoading) {
    return (
      <div className="customer-context-banner loading">
        <span className="muted" style={{ fontSize: '0.82rem' }}>Consultando situación del cliente…</span>
      </div>
    );
  }
  const hasJugs = (jugBalance?.jugsOutstanding ?? 0) > 0;
  const creditDebt = Number(creditBalance?.currentBalance ?? 0);
  const available = Number(creditBalance?.availableCredit ?? 0);
  const hasDebt = creditDebt > 0;
  const creditExhausted = hasDebt && available <= 0;
  if (!hasJugs && !hasDebt) return null;
  return (
    <div className="customer-context-banner">
      {hasJugs && (
        <div className="context-row jug-warning">
          <span>🧴</span>
          <span>Garrafones prestados: <strong>{jugBalance!.jugsOutstanding}</strong> — pendientes de devolver o cobrar.</span>
        </div>
      )}
      {hasDebt && !creditExhausted && (
        <div className="context-row credit-info">
          <span>💳</span>
          <span>Saldo deudor: <strong>Q{creditDebt.toFixed(2)}</strong> · Disponible: <strong>Q{available.toFixed(2)}</strong> de Q{Number(creditBalance!.creditLimit).toFixed(2)} límite.</span>
        </div>
      )}
      {creditExhausted && (
        <div className="context-row credit-blocked">
          <span>🛑</span>
          <span><strong>Crédito agotado</strong> — Saldo: Q{creditDebt.toFixed(2)}. El cliente debe abonar antes de usar más crédito.</span>
        </div>
      )}
    </div>
  );
}

// ── Panel post-venta: registrar préstamo de garrafón ────────────────────────
function PostSaleJugPanel({ sale, onDismiss }: { sale: Sale; onDismiss: () => void }) {
  const [quantity, setQuantity] = useState(1);
  const [jugError, setJugError] = useState('');
  const lendJug = useMutation({
    mutationFn: () =>
      apiRequest('/jugs/events', {
        method: 'POST',
        body: JSON.stringify({
          customerId: sale.customerId,
          routeId: sale.routeId,
          saleId: sale.id,
          eventType: 'LENT',
          quantity,
        }),
      }),
    onSuccess: onDismiss,
    onError: (err: Error) => setJugError(err.message || 'Error al registrar el préstamo.'),
  });
  return (
    <div className="post-sale-jug-panel panel">
      <div className="section-heading">
        <span>✅ <strong>Venta {sale.documentNumber} confirmada</strong></span>
        <button type="button" className="secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }} onClick={onDismiss}>Omitir</button>
      </div>
      <p style={{ margin: '0.4rem 0 0.6rem', fontSize: '0.88rem' }}>
        🧴 ¿Dejó garrafones a <strong>{sale.customerName}</strong>? Regístrelo ahora para mantener el control.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.88rem' }}>
          Cantidad:
          <input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} style={{ width: '4.5rem' }} />
        </label>
        <button type="button" className="primary" disabled={lendJug.isPending || quantity < 1} onClick={() => { setJugError(''); lendJug.mutate(); }} style={{ fontSize: '0.88rem' }}>
          {lendJug.isPending ? 'Registrando…' : 'Registrar préstamo'}
        </button>
        <button type="button" className="secondary" onClick={onDismiss} style={{ fontSize: '0.88rem' }}>No, omitir</button>
      </div>
      {jugError && <div className="alert error" style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>{jugError}</div>}
    </div>
  );
}

// ── Mini-formulario de abono inline ────────────────────────────────────────
function InlineAbonoForm({ customerId, routeId, onDone }: { customerId: string; routeId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<CreditPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState('');
  const [abonoError, setAbonoError] = useState('');
  const [abonoSuccess, setAbonoSuccess] = useState('');
  const abono = useMutation({
    mutationFn: () =>
      apiRequest('/credit/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          routeId: routeId || undefined,
          amount: Number(amount),
          paymentMethod: method,
          reference: method === 'TRANSFER' ? reference : undefined,
          bank: method === 'TRANSFER' ? bank : undefined,
        }),
      }),
    onSuccess: () => {
      setAbonoSuccess(method === 'CASH' ? 'Abono en efectivo registrado.' : 'Abono por transferencia registrado — pendiente de verificación.');
      void queryClient.invalidateQueries({ queryKey: ['credit'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      setTimeout(onDone, 2500);
    },
    onError: (err: Error) => setAbonoError(err.message || 'Error al registrar el abono.'),
  });
  return (
    <div className="inline-abono-form">
      <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem' }}>💳 Registrar abono</strong>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: '0.85rem' }}>Monto<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '6rem', marginLeft: '0.3rem' }} /></label>
        <label style={{ fontSize: '0.85rem' }}>Medio<select value={method} onChange={e => setMethod(e.target.value as CreditPaymentMethod)} style={{ marginLeft: '0.3rem' }}><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option></select></label>
        {method === 'TRANSFER' && <><label style={{ fontSize: '0.85rem' }}>Referencia<input value={reference} onChange={e => setReference(e.target.value)} style={{ width: '7rem', marginLeft: '0.3rem' }} /></label><label style={{ fontSize: '0.85rem' }}>Banco<input value={bank} onChange={e => setBank(e.target.value)} style={{ width: '7rem', marginLeft: '0.3rem' }} /></label></>}
        <button type="button" className="primary" style={{ fontSize: '0.85rem' }} disabled={abono.isPending || !amount || Number(amount) <= 0} onClick={() => { setAbonoError(''); abono.mutate(); }}>{abono.isPending ? 'Registrando…' : 'Confirmar abono'}</button>
        <button type="button" className="secondary" style={{ fontSize: '0.85rem' }} onClick={onDone}>Cancelar</button>
      </div>
      {abonoError && <div className="alert error" style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>{abonoError}</div>}
      {abonoSuccess && <div className="alert success" style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>{abonoSuccess}</div>}
    </div>
  );
}

// ── Mini-formulario de devolución de garrafones inline ───────────────────────
function InlineJugReturnForm({
  customerId,
  routeId,
  maxReturnable,
  onDone,
}: {
  customerId: string;
  routeId: string;
  maxReturnable?: number;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(maxReturnable && maxReturnable > 0 ? Math.min(maxReturnable, 1) : 1);
  const [notes, setNotes] = useState('');
  const [returnError, setReturnError] = useState('');
  const [returnSuccess, setReturnSuccess] = useState('');

  const returnJug = useMutation({
    mutationFn: () =>
      apiRequest('/jugs/events', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          routeId,
          eventType: 'RETURNED',
          quantity: Number(quantity),
          notes: notes.trim() || 'Devolución en visita sin compra',
        }),
      }),
    onSuccess: () => {
      setReturnSuccess(`✅ Devolución de ${quantity} garrafón(es) registrada.`);
      void queryClient.invalidateQueries({ queryKey: ['jugs'] });
      setTimeout(onDone, 2500);
    },
    onError: (err: Error) => setReturnError(err.message || 'Error al registrar la devolución.'),
  });

  return (
    <div className="inline-abono-form" style={{ marginTop: '0.5rem', background: '#f0fafb' }}>
      <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem' }}>🧴 Registrar devolución de garrafones vacíos</strong>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: '0.85rem' }}>
          Cantidad devuelta:
          <input
            type="number"
            min="1"
            max={maxReturnable && maxReturnable > 0 ? maxReturnable : undefined}
            step="1"
            value={quantity}
            onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
            style={{ width: '5rem', marginLeft: '0.3rem' }}
          />
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          Nota:
          <input
            type="text"
            placeholder="Opcional"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ width: '9rem', marginLeft: '0.3rem' }}
          />
        </label>
        <button
          type="button"
          className="primary"
          style={{ fontSize: '0.85rem' }}
          disabled={returnJug.isPending || quantity < 1}
          onClick={() => { setReturnError(''); returnJug.mutate(); }}
        >
          {returnJug.isPending ? 'Registrando…' : 'Confirmar devolución'}
        </button>
        <button type="button" className="secondary" style={{ fontSize: '0.85rem' }} onClick={onDone}>
          Cancelar
        </button>
      </div>
      {returnError && <div className="alert error" style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>{returnError}</div>}
      {returnSuccess && <div className="alert success" style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>{returnSuccess}</div>}
    </div>
  );
}

export function SalesPage({ canSell, canViewLocation }: { canSell: boolean; canViewLocation: boolean }) {
  const queryClient = useQueryClient();
  const sales = useQuery({ queryKey: ['sales'], queryFn: () => apiRequest<Sale[]>('/sales') });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canSell });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<Customer[]>('/customers'), enabled: canSell });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canSell });
  const [routeId, setRouteId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<ItemForm[]>([{ presentationId: '', quantity: 1 }]);
  const [payments, setPayments] = useState<PaymentForm[]>([newPayment()]);
  const [receiptError, setReceiptError] = useState('');
  const [receiptMessage, setReceiptMessage] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [locationPanelSaleId, setLocationPanelSaleId] = useState<string | null>(null);

  // ── Post-venta: panel de préstamo de garrafón ───────────────────────────────
  const [postSalePanelSale, setPostSalePanelSale] = useState<Sale | null>(null);

  // ── Queries contextuales al seleccionar cliente (ventas) ────────────────────
  const saleJugBalance = useQuery({
    queryKey: ['jugs', 'balance', customerId],
    queryFn: () => apiRequest<JugBalanceResponse>(`/jugs/customers/${customerId}/balance`),
    enabled: !!customerId,
  });
  const saleCreditBalance = useQuery({
    queryKey: ['credit', 'balance', customerId],
    queryFn: () => apiRequest<CreditBalanceResponse>(`/credit/customers/${customerId}/balance`),
    enabled: !!customerId,
  });

  // ── Visita sin compra ──────────────────────────────────────────────────────
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitRouteId, setVisitRouteId] = useState('');
  const [visitCustomerId, setVisitCustomerId] = useState('');
  const [visitReason, setVisitReason] = useState('NO_ESTABA');
  const [visitNote, setVisitNote] = useState('');
  const [visitCapturing, setVisitCapturing] = useState(false);
  const [visitError, setVisitError] = useState('');
  const [visitSuccess, setVisitSuccess] = useState('');
  const [showVisitAbono, setShowVisitAbono] = useState(false);
  const [showVisitJugReturn, setShowVisitJugReturn] = useState(false);

  // ── Queries contextuales al seleccionar cliente (visita) ───────────────────
  const visitJugBalance = useQuery({
    queryKey: ['jugs', 'balance', visitCustomerId],
    queryFn: () => apiRequest<JugBalanceResponse>(`/jugs/customers/${visitCustomerId}/balance`),
    enabled: !!visitCustomerId,
  });
  const visitCreditBalance = useQuery({
    queryKey: ['credit', 'balance', visitCustomerId],
    queryFn: () => apiRequest<CreditBalanceResponse>(`/credit/customers/${visitCustomerId}/balance`),
    enabled: !!visitCustomerId,
  });

  const locationQuery = useQuery({
    queryKey: ['sale-location', locationPanelSaleId],
    queryFn: () => apiRequest<SaleLocation>(`/sales/${locationPanelSaleId}/location`),
    enabled: locationPanelSaleId !== null,
  });
  const create = useMutation({
    mutationFn: (location: GeoLocationSnapshot) => apiRequest<Sale>('/sales', {
      method: 'POST',
      body: JSON.stringify({ clientReference: crypto.randomUUID(), routeId, customerId, items,
        payments: payments.map(payment => ({ ...payment, amount: payment.amount === '' ? null : Number(payment.amount) })), location })
    }),
    onSuccess: async (sale) => {
      // Mostrar panel de garrafón post-venta antes de limpiar el formulario
      setPostSalePanelSale({ ...sale, routeId, customerId });
      setCustomerId('');
      setItems([{ presentationId: '', quantity: 1 }]);
      setPayments([newPayment()]);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
  });

  const registerVisit = useMutation({
    mutationFn: (location: GeoLocationSnapshot) => apiRequest<{ customerName: string; visitReason: string; fullNote: string }>('/sales/no-purchase-visit', {
      method: 'POST',
      body: JSON.stringify({
        routeId: visitRouteId,
        customerId: visitCustomerId,
        visitReason,
        visitNote: visitNote.trim() || null,
        location,
      }),
    }),
    onSuccess: (data) => {
      const reasonLabel = visitReason === 'NO_ESTABA' ? 'Cliente no estaba'
        : visitReason === 'NO_NECESITABA' ? 'No necesitaba' : 'Otro motivo';
      setVisitSuccess(`✅ Visita registrada para ${data.customerName ?? 'el cliente'}. Motivo: ${reasonLabel}. La ubicación GPS quedó almacenada.`);
      setVisitCustomerId('');
      setVisitNote('');
      setVisitReason('NO_ESTABA');
      setTimeout(() => setVisitSuccess(''), 8000);
    },
  });

  const submitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVisitError('');
    setVisitSuccess('');
    setVisitCapturing(true);
    try {
      const location = await captureCurrentLocation('registrar la visita sin compra');
      registerVisit.mutate(location);
    } catch (err) {
      setVisitError(err instanceof Error ? err.message : 'No fue posible obtener la ubicación.');
    } finally {
      setVisitCapturing(false);
    }
  };

  const visitAvailableCustomers = customers.data?.filter(c => c.status === 'ACTIVE' && c.routeId === visitRouteId) ?? [];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocationError('');
    setIsCapturingLocation(true);
    try {
      const location = await captureCurrentLocation('confirmar la venta');
      create.mutate(location);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'No fue posible obtener la ubicación.');
    } finally {
      setIsCapturingLocation(false);
    }
  };
  const presentations = products.data?.filter(product => product.active && product.controlsInventory)
    .flatMap(product => product.presentations.filter(item => item.active).map(item => ({ ...item, product }))) ?? [];
  const availableCustomers = customers.data?.filter(customer => customer.status === 'ACTIVE' && customer.routeId === routeId) ?? [];
  const selectedCustomer = availableCustomers.find(customer => customer.id === customerId);
  const allowedPaymentMethods = ['CASH', 'TRANSFER', ...(selectedCustomer?.customerType === 'PERMANENT' && selectedCustomer.creditAllowed ? ['CREDIT'] : [])];
  const nextPaymentMethod = allowedPaymentMethods.find(method => !payments.some(payment => payment.method === method));

  // ── Validación preventiva de crédito ────────────────────────────────────────
  const creditPayment = payments.find(p => p.method === 'CREDIT');
  const creditAmountRequested = creditPayment?.amount !== '' ? Number(creditPayment?.amount ?? 0) : 0;
  const availableCredit = Number(saleCreditBalance.data?.availableCredit
    ?? Math.max(0, (selectedCustomer?.creditLimit ?? 0) - (selectedCustomer?.currentBalance ?? 0)));
  const creditOverLimit = !!creditPayment && creditAmountRequested > 0 && creditAmountRequested > availableCredit;
  const creditExhaustedForSale = saleCreditBalance.data !== undefined
    && Number(saleCreditBalance.data.availableCredit) <= 0
    && Number(saleCreditBalance.data.currentBalance) > 0;
  const creditBlockedByExhaustion = !!creditPayment && creditExhaustedForSale;
  const saleBlocked = creditOverLimit || creditBlockedByExhaustion;

  const obtainReceipt = async (sale: Sale) => {
    const database = await openMobileDatabase();
    try {
      if (!navigator.onLine) {
        const cached = await findCachedReceipt(database, sale.id);
        if (cached) return cached.file.content;
        await markReceiptPending(database, sale.id, sale.documentNumber);
        throw new Error('Sin conexión: el comprobante quedó pendiente y podrá obtenerse al recuperar Internet.');
      }
      try {
        const blob = await apiBlob(`/sales/${sale.id}/receipt`);
        await cacheReceipt(database, sale.id, sale.documentNumber, blob);
        return blob;
      } catch (error) {
        const cached = await findCachedReceipt(database, sale.id);
        if (cached) return cached.file.content;
        await markReceiptPending(database, sale.id, sale.documentNumber);
        throw error;
      }
    } finally {
      database.close();
    }
  };
  const downloadReceipt = async (sale: Sale) => {
    setReceiptError('');
    setReceiptMessage('');
    try {
      const blob = await obtainReceipt(sale);
      downloadReceiptFile(blob, sale.documentNumber);
      setReceiptMessage('Comprobante descargado y guardado para uso sin conexión.');
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'No fue posible descargar el comprobante.');
    }
  };
  const shareReceipt = async (sale: Sale) => {
    setReceiptError('');
    setReceiptMessage('');
    try {
      const blob = await obtainReceipt(sale);
      const result = await shareReceiptFile(blob, sale);
      if (result === 'SHARED') setReceiptMessage('Comprobante compartido desde el dispositivo.');
      if (result === 'DOWNLOADED_WITH_WHATSAPP') setReceiptMessage('PDF descargado. Adjunte el archivo en el chat de WhatsApp abierto.');
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'No fue posible compartir el comprobante.');
    }
  };

  return <main>
    <PageHeader eyebrow="Operación en ruta" title="Ventas" description="Los precios, conversiones, totales, correlativos e inventario se calculan y confirman en el servidor." />

    {/* ── Panel post-venta: préstamo de garrafón ─────────────────────────── */}
    {postSalePanelSale && (
      <PostSaleJugPanel
        sale={postSalePanelSale}
        onDismiss={() => setPostSalePanelSale(null)}
      />
    )}

    {canSell && <form className="panel section-panel" onSubmit={submit}>
      <h2>Nueva venta</h2>
      <div className="form-grid compact-grid">
        <label>Ruta<select required value={routeId} onChange={event => { setRouteId(event.target.value); setCustomerId(''); setPayments([newPayment()]); }}>
          <option value="">Seleccionar</option>{routes.data?.filter(route => route.status === 'ACTIVE').map(route => <option key={route.id} value={route.id}>{route.code} · {route.name}</option>)}
        </select></label>
        <label>Cliente<select required value={customerId} disabled={!routeId} onChange={event => { setCustomerId(event.target.value); setPayments([newPayment()]); }}>
          <option value="">Seleccionar</option>{availableCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.code} · {customer.name}</option>)}
        </select></label>
      </div>

      {/* ── Banner contextual de garrafones + crédito ───────────────────────── */}
      <CustomerContextBanner
        customerId={customerId}
        jugBalance={saleJugBalance.data}
        creditBalance={saleCreditBalance.data}
        jugLoading={saleJugBalance.isFetching}
        creditLoading={saleCreditBalance.isFetching}
      />

      <h3>Productos</h3>
      <div className="data-list">{items.map((item, index) => <div className="sale-item-editor" key={index}>
        <label>Presentación<select required value={item.presentationId} onChange={event => setItems(current => current.map((row, position) => position === index ? { ...row, presentationId: event.target.value } : row))}>
          <option value="">Seleccionar</option>{presentations.map(presentation => <option key={presentation.id} value={presentation.id}>{presentation.product.code} · {presentation.product.name} · {presentation.name}</option>)}
        </select></label>
        <label>Cantidad<input required type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={event => setItems(current => current.map((row, position) => position === index ? { ...row, quantity: Number(event.target.value) } : row))} /></label>
        {items.length > 1 && <button type="button" className="secondary" onClick={() => setItems(current => current.filter((_row, position) => position !== index))}>Quitar</button>}
      </div>)}</div>
      <h3>Forma de pago</h3><p className="muted">Con un solo medio puede dejar el monto vacío para aplicar el total calculado por el servidor.</p>
      <div className="data-list">{payments.map((payment, index) => <div className="payment-editor" key={index}>
        <label>Medio<select value={payment.method} onChange={event => setPayments(current => current.map((row, position) => position === index ? { ...row, method: event.target.value, reference: '', bank: '', evidenceReference: '' } : row))}>
          <option value="CASH" disabled={payments.some((row, position) => position !== index && row.method === 'CASH')}>Efectivo</option><option value="TRANSFER" disabled={payments.some((row, position) => position !== index && row.method === 'TRANSFER')}>Transferencia</option>{selectedCustomer?.customerType === 'PERMANENT' && selectedCustomer.creditAllowed && <option value="CREDIT" disabled={payments.some((row, position) => position !== index && row.method === 'CREDIT')}>Crédito</option>}
        </select></label>
        <label>Monto {payments.length === 1 && '(opcional)'}<input required={payments.length > 1} type="number" min="0.01" step="0.01" value={payment.amount} onChange={event => setPayments(current => current.map((row, position) => position === index ? { ...row, amount: event.target.value } : row))} /></label>
        {payment.method === 'TRANSFER' && <><label>Referencia<input required value={payment.reference} onChange={event => setPayments(current => current.map((row, position) => position === index ? { ...row, reference: event.target.value } : row))} /></label><label>Banco<input value={payment.bank} onChange={event => setPayments(current => current.map((row, position) => position === index ? { ...row, bank: event.target.value } : row))} /></label><label>Evidencia opcional<input value={payment.evidenceReference} onChange={event => setPayments(current => current.map((row, position) => position === index ? { ...row, evidenceReference: event.target.value } : row))} /></label></>}
        {payment.method === 'CREDIT' && selectedCustomer && (
          <div>
            <p className="credit-available">Disponible: Q{availableCredit.toFixed(2)}</p>
            {creditOverLimit && (
              <p className="alert error" style={{ fontSize: '0.83rem', margin: '0.25rem 0 0' }}>
                El monto supera el crédito disponible (Q{availableCredit.toFixed(2)}). Reduzca el monto o registre un abono en Créditos.
              </p>
            )}
            {creditBlockedByExhaustion && !creditOverLimit && (
              <p className="alert error" style={{ fontSize: '0.83rem', margin: '0.25rem 0 0' }}>
                🛑 El cliente no tiene crédito disponible. Debe abonar antes de continuar.
              </p>
            )}
          </div>
        )}
        {payments.length > 1 && <button type="button" className="secondary" onClick={() => setPayments(current => current.filter((_row, position) => position !== index))}>Quitar pago</button>}
      </div>)}</div>
      <button type="button" className="secondary add-payment" disabled={!nextPaymentMethod} onClick={() => nextPaymentMethod && setPayments(current => [...current, newPayment(nextPaymentMethod)])}>Dividir pago</button>
      <div className="form-actions"><button type="button" className="secondary" onClick={() => setItems(current => [...current, { presentationId: '', quantity: 1 }])}>Agregar producto</button><button className="primary" disabled={isCapturingLocation || create.isPending || saleBlocked}>{isCapturingLocation ? 'Refinando precisión GPS…' : create.isPending ? 'Confirmando…' : 'Confirmar venta'}</button></div>
      {isCapturingLocation && <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Buscando señal GPS de alta precisión. Puede tomar hasta 30 segundos.</p>}
      {(locationError || create.error) && <div className="alert error">{locationError || create.error?.message}</div>}
    </form>}

    {/* ── Visita sin compra ─────────────────────────────────────────────── */}
    {canSell && (
      <section className="panel section-panel">
        <div className="section-heading">
          <h2>🚶 Visita sin compra</h2>
          <button type="button" className="secondary" onClick={() => { setVisitOpen(v => !v); setVisitError(''); setVisitSuccess(''); setShowVisitAbono(false); setShowVisitJugReturn(false); }}>
            {visitOpen ? '▲ Ocultar' : '▼ Registrar'}
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          Registra cuando visitaste a un cliente pero no realizó compra hoy. El sistema capturará las coordenadas GPS como respaldo ético y auditable.
        </p>
        {visitOpen && (
          <form onSubmit={e => void submitVisit(e)} className="form-grid compact-grid" style={{ marginTop: '1rem' }}>
            <label>Ruta
              <select required value={visitRouteId} onChange={e => { setVisitRouteId(e.target.value); setVisitCustomerId(''); setShowVisitAbono(false); setShowVisitJugReturn(false); }}>
                <option value="">Seleccionar</option>
                {routes.data?.filter(r => r.status === 'ACTIVE').map(r => (
                  <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
                ))}
              </select>
            </label>
            <label>Cliente
              <select required value={visitCustomerId} disabled={!visitRouteId} onChange={e => { setVisitCustomerId(e.target.value); setShowVisitAbono(false); setShowVisitJugReturn(false); }}>
                <option value="">Seleccionar</option>
                {visitAvailableCustomers.map(c => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
              </select>
            </label>

            {/* ── Banner contextual en visita ───────────────────────────────── */}
            {visitCustomerId && (
              <div className="wide">
                {(visitJugBalance.isFetching || visitCreditBalance.isFetching) && (
                  <p className="muted" style={{ fontSize: '0.82rem' }}>Consultando situación del cliente…</p>
                )}
                {!visitJugBalance.isFetching && !visitCreditBalance.isFetching && (
                  <>
                    <div className="customer-context-banner" style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>📋 Situación del cliente</strong>
                      {(visitJugBalance.data?.jugsOutstanding ?? 0) > 0 ? (
                        <div className="context-row jug-warning">
                          <span>🧴</span>
                          <span>Garrafones prestados: <strong>{visitJugBalance.data!.jugsOutstanding}</strong> — pendientes de devolver.</span>
                          {!showVisitJugReturn && (
                            <button
                              type="button"
                              className="secondary"
                              style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem', marginLeft: '0.5rem' }}
                              onClick={() => setShowVisitJugReturn(true)}
                            >
                              + Registrar devolución
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="context-row" style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                          <span>🧴</span>
                          <span>Sin garrafones pendientes.</span>
                          {!showVisitJugReturn && (
                            <button
                              type="button"
                              className="link-button"
                              style={{ fontSize: '0.78rem', padding: '0 0.3rem', marginLeft: '0.4rem' }}
                              onClick={() => setShowVisitJugReturn(true)}
                            >
                              + Recibir vacíos
                            </button>
                          )}
                        </div>
                      )}
                      {Number(visitCreditBalance.data?.currentBalance ?? 0) > 0 && (
                        <div className="context-row credit-info">
                          <span>💳</span>
                          <span>Saldo deudor: <strong>Q{Number(visitCreditBalance.data!.currentBalance).toFixed(2)}</strong></span>
                          {!showVisitAbono && (
                            <button
                              type="button"
                              className="secondary"
                              style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem', marginLeft: '0.5rem' }}
                              onClick={() => setShowVisitAbono(true)}
                            >
                              + Registrar abono
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {showVisitJugReturn && (
                      <InlineJugReturnForm
                        customerId={visitCustomerId}
                        routeId={visitRouteId}
                        maxReturnable={visitJugBalance.data?.jugsOutstanding}
                        onDone={() => setShowVisitJugReturn(false)}
                      />
                    )}
                    {showVisitAbono && (
                      <InlineAbonoForm
                        customerId={visitCustomerId}
                        routeId={visitRouteId}
                        onDone={() => setShowVisitAbono(false)}
                      />
                    )}
                  </>
                )}
              </div>
            )}
            <label>Motivo de visita
              <select value={visitReason} onChange={e => setVisitReason(e.target.value)}>
                <option value="NO_ESTABA">Cliente no estaba</option>
                <option value="NO_NECESITABA">No necesitaba</option>
                <option value="OTRO">Otro motivo</option>
              </select>
            </label>
            <label className="wide">Nota adicional (opcional)
              <textarea
                value={visitNote}
                maxLength={300}
                placeholder="Detalles adicionales…"
                onChange={e => setVisitNote(e.target.value)}
              />
            </label>
            <div className="form-actions wide">
              <button
                type="submit"
                className="primary"
                disabled={visitCapturing || registerVisit.isPending || !visitRouteId || !visitCustomerId}
              >
                {visitCapturing ? 'Obteniendo GPS…' : registerVisit.isPending ? 'Registrando…' : '📍 Registrar visita'}
              </button>
            </div>
            {visitCapturing && (
              <p className="muted wide" style={{ fontSize: '0.85rem' }}>Buscando señal GPS de alta precisión. Puede tomar hasta 30 segundos.</p>
            )}
            {visitError && <div className="alert error wide">{visitError}</div>}
            {registerVisit.error && <div className="alert error wide">{(registerVisit.error as Error).message}</div>}
            {visitSuccess && <div className="alert success wide">{visitSuccess}</div>}
          </form>
        )}
      </section>
    )}

    <section className="section-panel"><div className="section-heading"><h2>Ventas confirmadas</h2><span>{sales.data?.length ?? 0} ventas</span></div>
      {receiptError && <div className="alert error">{receiptError}</div>}
      {receiptMessage && <div className="alert success">{receiptMessage}</div>}
      {sales.isLoading && <p>Cargando ventas…</p>}
      {sales.error && <div className="alert error">{sales.error.message}</div>}
      <div className="sales-grid">{sales.data?.map(sale => <article className="panel sale-card" key={sale.id}>
        <div className="section-heading"><div><strong className="document-number">{sale.documentNumber}</strong><span>{sale.customerCode} · {sale.customerName}</span></div><strong>{money(sale.total)}</strong></div>
        <p className="audit-line">{sale.routeCode} · {sale.routeName} · {sale.sellerName} · {new Date(sale.createdAt).toLocaleString('es-GT')}</p>
        <div className="data-list">{sale.items.map(item => <div className="data-row sale-line" key={item.id}><span>{item.presentationName} · {Number(item.presentationQuantity)} × {money(item.unitPrice)}</span><strong>{money(item.lineTotal)}</strong></div>)}</div>
        <div className="payment-summary">{sale.payments?.map(payment => <span key={payment.id}>{payment.method === 'CASH' ? 'Efectivo' : payment.method === 'TRANSFER' ? 'Transferencia' : 'Crédito'}: {money(payment.amount)} · {payment.status}</span>)}</div>
        {Number(sale.pendingTransferAmount) > 0 && <p className="status-note">Transferencia pendiente: {money(Number(sale.pendingTransferAmount))}</p>}
        {Number(sale.rejectedTransferAmount) > 0 && <p className="alert error">Transferencia rechazada: {money(Number(sale.rejectedTransferAmount))}</p>}
        <div className="sale-total"><span>Total {sale.currencyCode}</span><strong>{money(sale.total)}</strong></div>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => void downloadReceipt(sale)}>Descargar PDF</button>
          <button type="button" className="primary" onClick={() => void shareReceipt(sale)}>Compartir / WhatsApp</button>
        </div>
        {canViewLocation && (
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setLocationPanelSaleId(prev => prev === sale.id ? null : sale.id)}>
              {locationPanelSaleId === sale.id ? 'Ocultar ubicación' : 'Ver ubicación'}
            </button>
          </div>
        )}
        {canViewLocation && locationPanelSaleId === sale.id && (
          <div className="location-panel">
            {locationQuery.isLoading && <p className="muted">Cargando coordenadas…</p>}
            {locationQuery.error && <p className="alert error">{locationQuery.error.message}</p>}
            {locationQuery.data && (
              <>
                <p className="muted" style={{ fontSize: '0.82rem', margin: '0.5rem 0 0.25rem' }}>
                  <strong>Lat:</strong> {Number(locationQuery.data.latitude).toFixed(8)} &nbsp;
                  <strong>Lon:</strong> {Number(locationQuery.data.longitude).toFixed(8)}
                  {locationQuery.data.accuracyMeters != null && <> &nbsp; <strong>Precisión:</strong> ±{Number(locationQuery.data.accuracyMeters).toFixed(1)} m</>}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${Number(locationQuery.data.latitude).toFixed(8)},${Number(locationQuery.data.longitude).toFixed(8)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary"
                  style={{ fontSize: '0.82rem' }}
                >
                  Abrir en Google Maps
                </a>
              </>
            )}
          </div>
        )}
      </article>)}</div>
    </section>
  </main>;
}
