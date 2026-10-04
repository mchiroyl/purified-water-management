import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { useState, useEffect, useMemo, Fragment, type FormEvent } from 'react';
import {
  Droplets,
  CreditCard,
  Zap,
  Star,
  Tag,
  MapPin,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  FileText,
  Plus,
  Receipt,
  UserPlus,
  Phone,
  Banknote,
  ArrowRightLeft,
  Search,
  Filter,
  ShieldAlert,
} from 'lucide-react';
import { apiBlob, apiRequest } from '../../services/apiClient';
import { openMobileDatabase, type GeoLocationSnapshot } from '../../offline/mobileDatabase';
import { captureCurrentLocation } from '../../services/geolocation';
import { cacheReceipt, findCachedReceipt, markReceiptPending } from './receiptOffline';
import { downloadReceiptFile, shareReceiptFile } from './receiptSharing';
import { useOptionalSession } from '../auth/SessionContext';
import { queueProvisionalCustomer } from '../routes/provisionalCustomerOffline';
import { CustomerCombobox } from './CustomerCombobox';
import type { JugBalanceResponse } from '../jugs/types';
import type { CreditBalanceResponse, CreditPaymentMethod } from '../credit/types';

type Route = { id: string; code: string; name: string; status: string };
type Customer = {
  id: string;
  code: string;
  name: string;
  status: string;
  routeId?: string;
  customerType: string;
  creditAllowed: boolean;
  creditLimit: number;
  currentBalance: number;
  registrationState?: string;
  addressReference?: string;
  contactName?: string;
  phone?: string;
  whatsapp?: string;
};
type Presentation = { id: string; code: string; name: string; active: boolean };
type Product = { id: string; code: string; name: string; active: boolean; controlsInventory: boolean; presentations: Presentation[] };
type SaleItem = { id: string; productName: string; presentationName: string; presentationQuantity: number; quantityBaseUnits: number; unitPrice: number; lineTotal: number; priceSource: string };
type Payment = { id: string; method: string; amount: number; status: string; reference: string; bank: string };
type Sale = { id: string; documentNumber: string; routeCode: string; routeName: string; sellerName: string; customerCode: string; customerName: string; status: string; subtotal: number; total: number; currencyCode: string; createdAt: string; items: SaleItem[]; payments?: Payment[]; pendingTransferAmount?: number; rejectedTransferAmount?: number; creditAmount?: number; routeId?: string; customerId?: string };
type ItemForm = { presentationId: string; quantity: number };
type PaymentForm = { method: string; amount: string; reference: string; bank: string; evidenceReference: string };

type SaleGroup = {
  key: string;
  routeCode?: string;
  routeName: string;
  sellerName: string;
  dateKey: string;
  dateFormatted: string;
  totalAmount: number;
  sales: Sale[];
};

function getSaleDateInfo(isoDateStr: string) {
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) {
      return { dateKey: '0000-00-00', dateFormatted: 'Fecha no registrada' };
    }
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

    const dateFormatted = new Intl.DateTimeFormat('es-GT', {
      timeZone: 'America/Guatemala',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);

    return { dateKey, dateFormatted };
  } catch {
    return { dateKey: '0000-00-00', dateFormatted: 'Fecha no registrada' };
  }
}

const money = (value: number) => `Q${Number(value).toFixed(2)}`;
const newPayment = (method = 'CASH'): PaymentForm => ({ method, amount: '', reference: '', bank: '', evidenceReference: '' });

type SaleLocation = { latitude: number; longitude: number; accuracyMeters: number | null; capturedAt: string; persistedAt: string };

// ── Banner contextual de cliente ────────────────────────────────────────────
// ── Banner contextual de cliente ────────────────────────────────────────────
function CustomerContextBanner({
  customerId,
  customer,
  jugBalance,
  creditBalance,
  jugLoading,
  creditLoading,
  onToggleJugReturn,
  onToggleAbono,
  isJugReturnOpen,
  isAbonoOpen,
}: {
  customerId: string;
  customer?: Customer;
  jugBalance: JugBalanceResponse | undefined;
  creditBalance: CreditBalanceResponse | undefined;
  jugLoading: boolean;
  creditLoading: boolean;
  onToggleJugReturn: () => void;
  onToggleAbono: () => void;
  isJugReturnOpen: boolean;
  isAbonoOpen: boolean;
}) {
  if (!customerId) return null;
  const isProvisional = (customer?.customerType === 'OCCASIONAL' || customer?.registrationState === 'PROVISIONAL') && !customer?.creditAllowed;
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
  return (
    <div className="customer-context-banner" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {isProvisional && (
        <div className="context-row" style={{ background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', padding: '0.45rem 0.65rem', borderRadius: '0.45rem', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Zap size={15} strokeWidth={2} style={{ color: '#ca8a04', flexShrink: 0 }} />
          <span><strong>Cliente Provisional en Ruta:</strong> Aplica tarifa estándar de lista general. Venta al contado o transferencia (crédito no disponible).</span>
        </div>
      )}
      {hasJugs ? (
        <div className="context-row jug-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', background: '#fffbeb', border: '1px solid #fde68a', padding: '0.45rem 0.65rem', borderRadius: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Droplets size={15} strokeWidth={2} style={{ color: '#d97706' }} />
            <span style={{ fontSize: '0.85rem' }}>Garrafones prestados: <strong>{jugBalance!.jugsOutstanding}</strong> — pendientes de devolver o cobrar.</span>
          </div>
          <button type="button" className="secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} onClick={onToggleJugReturn}>
            <RotateCcw size={13} strokeWidth={2} />
            {isJugReturnOpen ? 'Cerrar devolución' : 'Devolver garrafones'}
          </button>
        </div>
      ) : (
        <div className="context-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '0.45rem 0.65rem', borderRadius: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Droplets size={15} strokeWidth={2} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '0.85rem' }}>Garrafones prestados: <strong>0</strong> (al día, sin envases pendientes).</span>
          </div>
        </div>
      )}
      {hasDebt && (
        <div className={`context-row ${creditExhausted ? 'credit-blocked' : 'credit-info'}`} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.4rem',
          padding: '0.45rem 0.65rem',
          borderRadius: '0.45rem',
          background: creditExhausted ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${creditExhausted ? '#fecaca' : '#bfdbfe'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {creditExhausted ? <ShieldAlert size={15} strokeWidth={2} style={{ color: '#b91c1c' }} /> : <CreditCard size={15} strokeWidth={2} style={{ color: '#1d4ed8' }} />}
            <span style={{ fontSize: '0.85rem' }}>
              {creditExhausted ? <strong>Crédito agotado — </strong> : null}
              Saldo deudor: <strong>Q{creditDebt.toFixed(2)}</strong> · Disponible: <strong>Q{available.toFixed(2)}</strong> de Q{Number(creditBalance?.creditLimit ?? 0).toFixed(2)} límite.
            </span>
          </div>
          <button type="button" className="secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} onClick={onToggleAbono}>
            <CreditCard size={13} strokeWidth={2} />
            {isAbonoOpen ? 'Cerrar abono' : 'Registrar abono'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Badge de precio en vivo (Especial vs General) ───────────────────────────
type PriceDecisionResponse = { unitPrice: number; source: string; priceVersionId?: string; priceTierId?: string; specialPriceId?: string };

function ItemPriceBadge({ customerId, presentationId, quantity }: { customerId?: string; presentationId?: string; quantity: number }) {
  const query = useQuery({
    queryKey: ['pricing', 'resolve', customerId, presentationId, quantity],
    enabled: Boolean(customerId && presentationId && quantity > 0),
    queryFn: () => apiRequest<PriceDecisionResponse>('/pricing/resolve', {
      method: 'POST',
      body: JSON.stringify({ customerId, presentationId, quantityBaseUnits: quantity })
    }),
    staleTime: 30_000
  });

  if (!customerId || !presentationId || quantity <= 0) return null;
  if (query.isLoading) {
    return <span className="muted" style={{ fontSize: '0.82rem', padding: '0.2rem 0' }}>Cotizando precio oficial…</span>;
  }
  if (query.error || !query.data) return null;

  const isSpecial = query.data.source === 'CUSTOMER_SPECIAL_PRICE';
  const unitPrice = Number(query.data.unitPrice || 0);
  const lineTotal = unitPrice * quantity;

  return (
    <div style={{
      display: 'inline-flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '0.45rem',
      padding: '0.35rem 0.75rem',
      borderRadius: '0.55rem',
      fontSize: '0.84rem',
      fontWeight: 600,
      background: isSpecial ? '#fef9c3' : '#f1f5f9',
      color: isSpecial ? '#854d0e' : '#334155',
      border: `1px solid ${isSpecial ? '#facc15' : '#cbd5e1'}`,
      marginTop: '0.35rem',
      width: 'fit-content'
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        {isSpecial ? <Star size={13} strokeWidth={2.5} style={{ color: '#ca8a04' }} /> : <Tag size={13} strokeWidth={2} />}
        {isSpecial ? 'Precio Especial asignado:' : 'Precio General de lista:'}
      </span>
      <strong>Q{unitPrice.toFixed(2)} c/u</strong>
      <span>· Subtotal: <strong>Q{lineTotal.toFixed(2)}</strong></span>
    </div>
  );
}

// ── Mini-formulario de abono inline ────────────────────────────────────────
function InlineAbonoForm({
  customerId,
  routeId,
  customerName,
  onDone,
  onSuccessToast,
}: {
  customerId: string;
  routeId: string;
  customerName?: string;
  onDone: () => void;
  onSuccessToast?: (toast: { title: string; message: string; icon?: string }) => void;
}) {
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
      const formattedAmount = `Q${Number(amount).toFixed(2)}`;
      const methodLabel = method === 'CASH' ? 'en efectivo y aplicado al saldo' : 'por transferencia bancaria (pendiente de verificación)';
      const msg = `Abono de ${formattedAmount} ${methodLabel}${customerName ? ` para ${customerName}` : ''} procesado con éxito.`;
      setAbonoSuccess(msg);
      void queryClient.invalidateQueries({ queryKey: ['credit'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (onSuccessToast) {
        onSuccessToast({
          title: 'Abono registrado',
          message: msg,
          icon: '💳',
        });
      }
      setTimeout(onDone, 1800);
    },
    onError: (err: Error) => setAbonoError(err.message || 'Error al registrar el abono.'),
  });
  return (
    <div className="inline-abono-form" style={{ marginTop: '0.5rem', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
      <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#1e40af' }}>
        💳 Registrar abono al crédito {customerName ? `de ${customerName}` : ''}
      </strong>
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
  customerName,
  maxReturnable,
  onDone,
  onSuccessToast,
}: {
  customerId: string;
  routeId: string;
  customerName?: string;
  maxReturnable?: number;
  onDone: () => void;
  onSuccessToast?: (toast: { title: string; message: string; icon?: string }) => void;
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
          notes: notes.trim() || 'Devolución de garrafones vacíos',
        }),
      }),
    onSuccess: () => {
      const msg = `Se registró exitosamente la devolución de ${quantity} garrafón(es) vacío(s)${customerName ? ` para ${customerName}` : ''}.`;
      setReturnSuccess(`✅ ${msg}`);
      void queryClient.invalidateQueries({ queryKey: ['jugs'] });
      if (onSuccessToast) {
        onSuccessToast({
          title: 'Devolución de garrafones procesada',
          message: msg,
          icon: '🧴',
        });
      }
      setTimeout(onDone, 1800);
    },
    onError: (err: Error) => setReturnError(err.message || 'Error al registrar la devolución.'),
  });

  return (
    <div className="inline-abono-form" style={{ marginTop: '0.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
      <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', color: '#166534' }}>
        🧴 Registrar devolución de garrafones vacíos {customerName ? `de ${customerName}` : ''}
      </strong>
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


export function SalesPage({ canSell, canViewLocation, view }: { canSell: boolean; canViewLocation: boolean; view?: 'create' | 'list' }) {
  const currentView = view ?? (canSell ? 'create' : 'list');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sales = useQuery({ queryKey: ['sales'], queryFn: () => apiRequest<Sale[]>('/sales') });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canSell });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<Customer[]>('/customers'), enabled: canSell });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canSell });
  const [searchParams] = useSearchParams();
  const [routeId, setRouteId] = useState('');
  const [customerId, setCustomerId] = useState('');

  useEffect(() => {
    const preselect = searchParams.get('customerId');
    if (preselect) {
      setCustomerId(preselect);
    }
  }, [searchParams]);
  const [items, setItems] = useState<ItemForm[]>([{ presentationId: '', quantity: 1 }]);
  const [payments, setPayments] = useState<PaymentForm[]>([newPayment()]);
  const [receiptError, setReceiptError] = useState('');
  const [receiptMessage, setReceiptMessage] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [locationPanelSaleId, setLocationPanelSaleId] = useState<string | null>(null);

  // ── Agrupación y visualización de lista de ventas (Ruta + Vendedor + Fecha) ──
  const [salesSearch, setSalesSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const collapseAllGroups = () => {
    const next: Record<string, boolean> = {};
    for (const g of groupedSales) {
      next[g.key] = true;
    }
    setCollapsedGroups(next);
  };

  const expandAllGroups = () => {
    setCollapsedGroups({});
  };

  const groupedSales = useMemo<SaleGroup[]>(() => {
    if (!sales.data || sales.data.length === 0) return [];

    const query = salesSearch.trim().toLowerCase();
    const filtered = query
      ? sales.data.filter(s =>
          (s.documentNumber && s.documentNumber.toLowerCase().includes(query)) ||
          (s.customerName && s.customerName.toLowerCase().includes(query)) ||
          (s.customerCode && s.customerCode.toLowerCase().includes(query)) ||
          (s.routeName && s.routeName.toLowerCase().includes(query)) ||
          (s.routeCode && s.routeCode.toLowerCase().includes(query)) ||
          (s.sellerName && s.sellerName.toLowerCase().includes(query))
        )
      : sales.data;

    const map = new Map<string, SaleGroup>();

    for (const sale of filtered) {
      const routeCode = sale.routeCode || '';
      const routeName = sale.routeName || 'Sin Ruta Asignada';
      const sellerName = sale.sellerName || 'Sin Vendedor';
      const { dateKey, dateFormatted } = getSaleDateInfo(sale.createdAt);

      const groupKey = `${routeCode || routeName}___${sellerName}___${dateKey}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          routeCode,
          routeName,
          sellerName,
          dateKey,
          dateFormatted,
          totalAmount: 0,
          sales: []
        });
      }

      const group = map.get(groupKey)!;
      group.totalAmount += Number(sale.total) || 0;
      group.sales.push(sale);
    }

    const list = Array.from(map.values()).sort((a, b) => {
      if (b.dateKey !== a.dateKey) {
        return b.dateKey.localeCompare(a.dateKey);
      }
      if (a.routeName !== b.routeName) {
        return a.routeName.localeCompare(b.routeName);
      }
      return a.sellerName.localeCompare(b.sellerName);
    });

    for (const group of list) {
      group.sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [sales.data, salesSearch]);

  // ── Modal de Venta Confirmada y Préstamo de Garrafón ───────────────────────
  const [confirmedSaleModal, setConfirmedSaleModal] = useState<{
    sale: Sale;
    customerName: string;
    routeId: string;
    customerId: string;
    suggestedJugQty: number;
  } | null>(null);
  const [postSaleJugQty, setPostSaleJugQty] = useState(1);
  const [postSaleJugLentSuccess, setPostSaleJugLentSuccess] = useState(false);
  const [postSaleJugError, setPostSaleJugError] = useState('');

  // ── Notificación flotante de confirmación (Toast modal) ────────────────────
  const [successToast, setSuccessToast] = useState<{ title: string; message: string; icon?: string } | null>(null);

  // ── Formularios contextuales inline en formulario de Venta ─────────────────
  const [showSaleJugReturn, setShowSaleJugReturn] = useState(false);
  const [showSaleAbono, setShowSaleAbono] = useState(false);

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

  // ── Contexto de sesión y ruta asignada al vendedor ────────────────────────
  const session = useOptionalSession();
  const user = session?.user;
  const isAdminOrSupervisor = Boolean(user?.roles.some(r => r === 'ADMINISTRADOR' || r === 'SUPERVISOR'));
  const isSeller = Boolean(user?.roles.includes('VENDEDOR') && !isAdminOrSupervisor);
  const assignedRoute = isSeller
    ? (routes.data?.find(r => r.status === 'ACTIVE') ?? routes.data?.[0] ?? null)
    : null;

  useEffect(() => {
    if (assignedRoute) {
      if (routeId !== assignedRoute.id) {
        setRouteId(assignedRoute.id);
      }
      if (visitRouteId !== assignedRoute.id) {
        setVisitRouteId(assignedRoute.id);
      }
    }
  }, [assignedRoute, routeId, visitRouteId]);

  // ── Alta rápida de cliente provisional en ruta ─────────────────────────────
  const [showProvisionalModal, setShowProvisionalModal] = useState(false);
  const [provisionalForm, setProvisionalForm] = useState({ name: '', phone: '', addressReference: '' });
  const [provisionalLoading, setProvisionalLoading] = useState(false);
  const [provisionalError, setProvisionalError] = useState('');
  const [provisionalSuccess, setProvisionalSuccess] = useState('');
  const [localProvisionalCustomers, setLocalProvisionalCustomers] = useState<Customer[]>([]);

  const handleSaveProvisional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeId) return;
    setProvisionalError('');
    setProvisionalLoading(true);

    try {
      if (navigator.onLine) {
        // Modo Online: registrar en el backend como cliente ocasional/provisional
        const created = await apiRequest<Customer>('/customers/occasional', {
          method: 'POST',
          body: JSON.stringify({
            routeId,
            name: provisionalForm.name.trim(),
            phone: provisionalForm.phone.trim() || undefined,
            whatsapp: provisionalForm.phone.trim() || undefined,
            addressReference: provisionalForm.addressReference.trim(),
          }),
        });

        // Actualizar caché de clientes en memoria inmediatamente
        queryClient.setQueryData<Customer[]>(['customers'], (old) => old ? [created, ...old] : [created]);
        setCustomerId(created.id);
        setProvisionalSuccess(`✅ Cliente provisional registrado: ${created.name} (${created.code}). Aplicando tarifa general.`);
        setShowProvisionalModal(false);
        setProvisionalForm({ name: '', phone: '', addressReference: '' });
        setTimeout(() => setProvisionalSuccess(''), 10000);
      } else {
        // Modo Offline: guardar en base de datos local del teléfono (IndexedDB)
        const sellerId = user?.id || '';
        const deviceId = user?.deviceId || '';
        const queued = await queueProvisionalCustomer({
          routeId,
          sellerId,
          deviceId,
          name: provisionalForm.name.trim(),
          phone: provisionalForm.phone.trim(),
          whatsapp: provisionalForm.phone.trim(),
          addressReference: provisionalForm.addressReference.trim(),
        });

        const localCustomer: Customer = {
          id: queued.localCustomerId,
          code: 'PROV-LOCAL',
          name: queued.name,
          status: 'ACTIVE',
          customerType: 'OCCASIONAL',
          creditAllowed: false,
          creditLimit: 0,
          currentBalance: 0,
          routeId,
          registrationState: 'PROVISIONAL',
          addressReference: queued.addressReference,
          phone: queued.normalizedPhone || undefined,
          whatsapp: queued.whatsapp ?? undefined
        };

        setLocalProvisionalCustomers(prev => [localCustomer, ...prev]);
        setCustomerId(queued.localCustomerId);
        setProvisionalSuccess(`📱 Cliente provisional guardado en el teléfono: ${queued.name}. Se sincronizará automáticamente al detectar internet.`);
        setShowProvisionalModal(false);
        setProvisionalForm({ name: '', phone: '', addressReference: '' });
        setTimeout(() => setProvisionalSuccess(''), 10000);
      }
    } catch (err) {
      setProvisionalError(err instanceof Error ? err.message : 'Error al registrar cliente provisional.');
    } finally {
      setProvisionalLoading(false);
    }
  };

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
  const postSaleLendMutation = useMutation({
    mutationFn: () => {
      if (!confirmedSaleModal) throw new Error('No hay venta confirmada');
      return apiRequest('/jugs/events', {
        method: 'POST',
        body: JSON.stringify({
          customerId: confirmedSaleModal.customerId,
          routeId: confirmedSaleModal.routeId,
          saleId: confirmedSaleModal.sale.id,
          eventType: 'LENT',
          quantity: Number(postSaleJugQty),
          notes: `Préstamo automático en venta ${confirmedSaleModal.sale.documentNumber}`,
        }),
      });
    },
    onSuccess: () => {
      setPostSaleJugLentSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ['jugs'] });
    },
    onError: (err: Error) => setPostSaleJugError(err.message || 'Error al registrar el préstamo.'),
  });

  const handleDismissConfirmedSale = () => {
    setConfirmedSaleModal(null);
    setPostSaleJugLentSuccess(false);
    setPostSaleJugError('');
    setPostSaleJugQty(1);
    setCustomerId('');
    setItems([{ presentationId: '', quantity: 1 }]);
    setPayments([newPayment()]);
    setShowSaleJugReturn(false);
    setShowSaleAbono(false);
    navigate('/');
  };

  function isJugPresentation(pres?: { code?: string; name?: string; product?: { code?: string; name?: string } }): boolean {
    if (!pres) return false;
    const target = `${pres.code || ''} ${pres.name || ''} ${pres.product?.code || ''} ${pres.product?.name || ''}`.toLowerCase();
    return target.includes('garraf') || target.includes('gar-') || target.includes('jug') || target.includes('20l') || target.includes('19l');
  }

  const presentations = products.data?.filter(product => product.active && product.controlsInventory)
    .flatMap(product => product.presentations.filter(item => item.active).map(item => ({ ...item, product }))) ?? [];

  const create = useMutation({
    mutationFn: (location: GeoLocationSnapshot) => apiRequest<Sale>('/sales', {
      method: 'POST',
      body: JSON.stringify({ clientReference: crypto.randomUUID(), routeId, customerId, items,
        payments: payments.map(payment => ({ ...payment, amount: payment.amount === '' ? null : Number(payment.amount) })), location })
    }),
    onSuccess: async (sale) => {
      const cust = availableCustomers.find(c => c.id === customerId);
      // Contar únicamente las unidades vendidas de presentaciones que son garrafones
      const jugUnits = items.reduce((acc, it) => {
        const pres = presentations.find(p => p.id === it.presentationId);
        if (pres && isJugPresentation(pres)) {
          return acc + (Number(it.quantity) || 0);
        }
        return acc;
      }, 0);
      const suggestedQty = Math.round(jugUnits);
      setConfirmedSaleModal({
        sale,
        customerName: cust?.name ?? sale.customerName ?? 'Cliente',
        routeId,
        customerId,
        suggestedJugQty: suggestedQty,
      });
      setPostSaleJugQty(0);
      setPostSaleJugLentSuccess(false);
      setPostSaleJugError('');
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['route-loads'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['jugs'] });
      await queryClient.invalidateQueries({ queryKey: ['credit'] });
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
  const serverCustomers = customers.data?.filter(customer => customer.status === 'ACTIVE' && customer.routeId === routeId) ?? [];
  const serverCustomerIds = new Set(serverCustomers.map(c => c.id));
  const availableCustomers = [
    ...serverCustomers,
    ...localProvisionalCustomers.filter(c => c.routeId === routeId && !serverCustomerIds.has(c.id)),
  ];
  const selectedCustomer = availableCustomers.find(customer => customer.id === customerId);
  const isCreditAuthorized = Boolean(
    selectedCustomer?.creditAllowed ||
    saleCreditBalance.data?.creditAllowed ||
    (saleCreditBalance.data && Number(saleCreditBalance.data.availableCredit ?? 0) > 0) ||
    (saleCreditBalance.data && Number(saleCreditBalance.data.creditLimit ?? 0) > 0)
  );
  const allowedPaymentMethods = ['CASH', 'TRANSFER', ...(isCreditAuthorized ? ['CREDIT'] : [])];
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
    <PageHeader 
      eyebrow="Operación en ruta" 
      title="Ventas" 
      description={
        currentView === 'create' 
          ? 'Los precios, conversiones, totales, correlativos e inventario se calculan y confirman en el servidor.'
          : 'Ventas confirmadas registradas en el sistema.'
      }
      actions={
        canSell ? (
          <button 
            type="button" 
            className="secondary" 
            onClick={() => navigate(currentView === 'create' ? '/sales/list' : '/sales')}
          >
            {currentView === 'create' ? 'Ver ventas registradas' : 'Nueva venta'}
          </button>
        ) : undefined
      }
    />

    {currentView === 'create' && (
      <>

    {isSeller && assignedRoute && (
      <div className="assigned-route-card" style={{
        margin: '0.75rem 0 1.25rem 0',
        padding: '0.75rem 1rem',
        background: '#f0fdf4',
        border: '1px solid #86efac',
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#166534',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '0.45rem',
          background: '#dcfce7',
          color: '#15803d'
        }}>
          <MapPin size={20} strokeWidth={2.2} />
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#15803d', fontWeight: 700, display: 'block' }}>
            Ruta asignada
          </span>
          <strong style={{ fontSize: '1.05rem', color: '#14532d' }}>
            {assignedRoute.code} · {assignedRoute.name}
          </strong>
        </div>
      </div>
    )}

    {isSeller && !assignedRoute && !routes.isLoading && (
      <div className="alert warning" style={{ margin: '0.75rem 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertTriangle size={18} strokeWidth={2} style={{ color: '#b45309', flexShrink: 0 }} />
        <div>
          <strong>Sin ruta asignada:</strong> No tienes una ruta activa asignada para el día de hoy. Comunícate con administración para que te asignen tu ruta operativa.
        </div>
      </div>
    )}

    {canSell && <form className="panel section-panel" onSubmit={submit}>
      <h2>Nueva venta</h2>
      <div className="form-grid compact-grid">
        {!isSeller && (
          <label>Ruta<select required value={routeId} onChange={event => { setRouteId(event.target.value); setCustomerId(''); setPayments([newPayment()]); setShowSaleJugReturn(false); setShowSaleAbono(false); }}>
            <option value="">Seleccionar</option>{routes.data?.filter(route => route.status === 'ACTIVE').map(route => <option key={route.id} value={route.id}>{route.code} · {route.name}</option>)}
          </select></label>
        )}
        <div style={isSeller ? { gridColumn: '1 / -1' } : undefined}>
          <CustomerCombobox
            id="sale-customer-select"
            label="Cliente"
            required
            disabled={!routeId}
            customers={availableCustomers}
            selectedId={customerId}
            onSelect={selected => {
              setCustomerId(selected);
              setPayments([newPayment()]);
              setShowSaleJugReturn(false);
              setShowSaleAbono(false);
            }}
          />
          {routeId && (
            <button
              type="button"
              className="secondary"
              style={{
                marginTop: '0.4rem',
                fontSize: '0.82rem',
                padding: '0.35rem 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                width: 'fit-content'
              }}
              onClick={() => {
                setProvisionalError('');
                setShowProvisionalModal(true);
              }}
            >
              <span>➕</span> Cliente nuevo en ruta (Provisional)
            </button>
          )}
        </div>
      </div>

      {provisionalSuccess && (
        <div className="alert success" style={{ margin: '0.65rem 0', fontSize: '0.88rem' }}>
          {provisionalSuccess}
        </div>
      )}

      {/* ── Banner contextual de garrafones + crédito ───────────────────────── */}
      <CustomerContextBanner
        customerId={customerId}
        customer={selectedCustomer}
        jugBalance={saleJugBalance.data}
        creditBalance={saleCreditBalance.data}
        jugLoading={saleJugBalance.isFetching}
        creditLoading={saleCreditBalance.isFetching}
        onToggleJugReturn={() => { setShowSaleJugReturn(v => !v); setShowSaleAbono(false); }}
        onToggleAbono={() => { setShowSaleAbono(v => !v); setShowSaleJugReturn(false); }}
        isJugReturnOpen={showSaleJugReturn}
        isAbonoOpen={showSaleAbono}
      />

      {showSaleJugReturn && (
        <InlineJugReturnForm
          customerId={customerId}
          routeId={routeId}
          customerName={selectedCustomer?.name}
          maxReturnable={saleJugBalance.data?.jugsOutstanding}
          onDone={() => setShowSaleJugReturn(false)}
          onSuccessToast={setSuccessToast}
        />
      )}

      {showSaleAbono && (
        <InlineAbonoForm
          customerId={customerId}
          routeId={routeId}
          customerName={selectedCustomer?.name}
          onDone={() => setShowSaleAbono(false)}
          onSuccessToast={setSuccessToast}
        />
      )}

      <h3>Productos</h3>
      <div className="data-list">{items.map((item, index) => <div className="sale-item-editor" key={index}>
        <label>Presentación<select required value={item.presentationId} onChange={event => setItems(current => current.map((row, position) => position === index ? { ...row, presentationId: event.target.value } : row))}>
          <option value="">Seleccionar</option>{presentations.map(presentation => <option key={presentation.id} value={presentation.id}>{presentation.product.code} · {presentation.product.name} · {presentation.name}</option>)}
        </select></label>
        <label>Cantidad<input required type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={event => setItems(current => current.map((row, position) => position === index ? { ...row, quantity: Number(event.target.value) } : row))} /></label>
        <ItemPriceBadge customerId={customerId} presentationId={item.presentationId} quantity={item.quantity} />
        {items.length > 1 && <button type="button" className="secondary" onClick={() => setItems(current => current.filter((_row, position) => position !== index))}>Quitar</button>}
      </div>)}</div>
      <h3>Forma de pago</h3>
      {payments.length > 1 && <p className="muted">Dividió el pago: especifique el monto para cada medio.</p>}
      <div className="data-list">{payments.map((payment, index) => <div className="payment-editor" key={index}>
        <label style={payments.length === 1 ? { gridColumn: '1 / -1' } : undefined}>Medio<select value={payment.method} onChange={event => setPayments(current => current.map((row, position) => position === index ? { ...row, method: event.target.value, reference: '', bank: '', evidenceReference: '' } : row))}>
          <option value="CASH" disabled={payments.some((row, position) => position !== index && row.method === 'CASH')}>Efectivo</option><option value="TRANSFER" disabled={payments.some((row, position) => position !== index && row.method === 'TRANSFER')}>Transferencia</option>{isCreditAuthorized && <option value="CREDIT" disabled={payments.some((row, position) => position !== index && row.method === 'CREDIT')}>Crédito</option>}
        </select></label>
        {payments.length > 1 && (
          <label>Monto<input required type="number" min="0.01" step="0.01" value={payment.amount} onChange={event => setPayments(current => current.map((row, position) => position === index ? { ...row, amount: event.target.value } : row))} /></label>
        )}
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
        {payments.length > 1 && <button type="button" className="secondary" onClick={() => setPayments(current => {
          const next = current.filter((_row, position) => position !== index);
          return next.length === 1 ? [{ ...next[0], amount: '' }] : next;
        })}>Quitar pago</button>}
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
            {!isSeller && (
              <label>Ruta
                <select required value={visitRouteId} onChange={e => { setVisitRouteId(e.target.value); setVisitCustomerId(''); setShowVisitAbono(false); setShowVisitJugReturn(false); }}>
                  <option value="">Seleccionar</option>
                  {routes.data?.filter(r => r.status === 'ACTIVE').map(r => (
                    <option key={r.id} value={r.id}>{r.code} · {r.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div style={isSeller ? { gridColumn: '1 / -1' } : undefined}>
              <CustomerCombobox
                id="visit-customer-select"
                label="Cliente"
                required
                disabled={!visitRouteId}
                customers={visitAvailableCustomers}
                selectedId={visitCustomerId}
                placeholder="Buscar cliente visitado por nombre, dirección o código..."
                onSelect={selected => {
                  setVisitCustomerId(selected);
                  setShowVisitAbono(false);
                  setShowVisitJugReturn(false);
                }}
              />
            </div>

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
                        customerName={visitAvailableCustomers.find(c => c.id === visitCustomerId)?.name}
                        maxReturnable={visitJugBalance.data?.jugsOutstanding}
                        onDone={() => setShowVisitJugReturn(false)}
                        onSuccessToast={setSuccessToast}
                      />
                    )}
                    {showVisitAbono && (
                      <InlineAbonoForm
                        customerId={visitCustomerId}
                        routeId={visitRouteId}
                        customerName={visitAvailableCustomers.find(c => c.id === visitCustomerId)?.name}
                        onDone={() => setShowVisitAbono(false)}
                        onSuccessToast={setSuccessToast}
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
    </>
    )}

    {/* ── Vista de Lista de Ventas (Agrupada por Ruta, Vendedor y Fecha) ── */}
    {currentView === 'list' && (
      <section className="panel section-panel">
        <div className="section-heading">
          <div>
            <h2>Ventas confirmadas</h2>
            <p className="muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem' }}>
              Listado estructurado y agrupado por ruta, vendedor responsable y fecha de emisión.
            </p>
          </div>
          <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700, padding: '0.35rem 0.8rem', borderRadius: '1rem', fontSize: '0.9rem' }}>
            {sales.data?.length ?? 0} ventas registradas
          </span>
        </div>

        {receiptError && <div className="alert error">{receiptError}</div>}
        {receiptMessage && <div className="alert success">{receiptMessage}</div>}
        {sales.isLoading && <p>Cargando ventas…</p>}
        {sales.error && <div className="alert error">{sales.error.message}</div>}

        {/* Barra de búsqueda y controles de plegado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', margin: '1rem 0 1.25rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, maxWidth: '460px' }}>
            <input
              type="search"
              placeholder="🔍 Buscar por cliente, código, documento, ruta o vendedor…"
              value={salesSearch}
              onChange={e => setSalesSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {salesSearch && (
              <button 
                type="button" 
                className="secondary" 
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }} 
                onClick={() => setSalesSearch('')}
              >
                Limpiar filtro
              </button>
            )}
            <button 
              type="button" 
              className="secondary" 
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }} 
              onClick={expandAllGroups}
            >
              ▲ Desplegar todas
            </button>
            <button 
              type="button" 
              className="secondary" 
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }} 
              onClick={collapseAllGroups}
            >
              ▼ Plegar todas
            </button>
          </div>
        </div>

        {/* Listado agrupado por Ruta, Vendedor y Fecha */}
        {groupedSales.length > 0 ? (
          <div className="customer-groups-container">
            {groupedSales.map(group => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);

              return (
                <article className="route-group-panel" key={group.key} style={{ marginBottom: '1.25rem' }}>
                  <div
                    className="route-group-banner"
                    onClick={() => toggleGroupCollapse(group.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleGroupCollapse(group.key); }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', cursor: 'pointer' }}
                  >
                    <div className="route-group-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.4rem' }}>🚚</span>
                      <div>
                        <h3 className="route-group-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                          {group.routeCode ? `${group.routeCode} — ` : ''}{group.routeName}
                        </h3>
                        <div className="route-group-subtitle" style={{ fontSize: '0.84rem', color: 'var(--muted)', marginTop: '0.2rem', display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                          <span>👤 Vendedor: <strong style={{ color: '#0f766e' }}>{group.sellerName}</strong></span>
                          <span>📅 Fecha: <strong style={{ color: '#334155' }}>{group.dateFormatted}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          fontWeight: 700,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '9999px',
                          fontSize: '0.88rem',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        Total: {money(group.totalAmount)}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: '#e0f2fe',
                          color: '#0369a1',
                          fontWeight: 600,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '9999px',
                          fontSize: '0.82rem',
                          border: '1px solid #bae6fd',
                        }}
                      >
                        🧾 {group.sales.length} {group.sales.length === 1 ? 'venta' : 'ventas'}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600, marginLeft: '0.25rem' }}>
                        {isCollapsed ? '▼ Desplegar' : '▲ Plegar'}
                      </span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="table-wrap sales-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '135px' }}>Documento / Hora</th>
                            <th>Cliente</th>
                            <th>Productos Vendidos</th>
                            <th>Forma de Pago</th>
                            <th style={{ width: '95px' }}>Total</th>
                            <th style={{ textAlign: 'right', minWidth: '220px' }}>Opciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.sales.map(sale => {
                            const saleTime = (() => {
                              try {
                                const d = new Date(sale.createdAt);
                                return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
                              } catch {
                                return '';
                              }
                            })();

                            return (
                              <Fragment key={sale.id}>
                                <tr>
                                  <td>
                                    <strong className="document-number" style={{ color: '#0f766e', fontSize: '0.92rem', display: 'block' }}>
                                      {sale.documentNumber}
                                    </strong>
                                    {saleTime && (
                                      <small style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                                        🕒 {saleTime}
                                      </small>
                                    )}
                                  </td>

                                  <td>
                                    <strong>{sale.customerName}</strong>
                                    <small style={{ display: 'block', color: 'var(--muted)', fontSize: '0.78rem' }}>
                                      <code>{sale.customerCode}</code>
                                    </small>
                                  </td>

                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                      {sale.items.map(item => (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.82rem' }}>
                                          <span>{item.presentationName} <span style={{ color: 'var(--muted)' }}>({Number(item.presentationQuantity)} × {money(item.unitPrice)})</span></span>
                                          <strong>{money(item.lineTotal)}</strong>
                                        </div>
                                      ))}
                                    </div>
                                  </td>

                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      {sale.payments?.map(payment => (
                                        <span
                                          key={payment.id}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            background: payment.method === 'CASH' ? '#f0fdf4' : payment.method === 'TRANSFER' ? '#eff6ff' : '#fef3c7',
                                            color: payment.method === 'CASH' ? '#166534' : payment.method === 'TRANSFER' ? '#1e40af' : '#92400e',
                                            padding: '0.15rem 0.45rem',
                                            borderRadius: '0.35rem',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            width: 'fit-content',
                                          }}
                                        >
                                          {payment.method === 'CASH' ? '💵 Efectivo' : payment.method === 'TRANSFER' ? '🏦 Transferencia' : '💳 Crédito'}: {money(payment.amount)}
                                        </span>
                                      ))}
                                      {Number(sale.pendingTransferAmount) > 0 && (
                                        <span style={{ color: '#b45309', fontSize: '0.75rem', fontWeight: 600 }}>
                                          ⚠️ Transf. pend: {money(Number(sale.pendingTransferAmount))}
                                        </span>
                                      )}
                                      {Number(sale.rejectedTransferAmount) > 0 && (
                                        <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>
                                          ❌ Rechazada: {money(Number(sale.rejectedTransferAmount))}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td>
                                    <strong style={{ fontSize: '1rem', color: '#0f766e' }}>
                                      {money(sale.total)}
                                    </strong>
                                    <small style={{ display: 'block', color: 'var(--muted)', fontSize: '0.75rem' }}>
                                      {sale.currencyCode || 'GTQ'}
                                    </small>
                                  </td>

                                  <td>
                                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        className="secondary"
                                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem', whiteSpace: 'nowrap' }}
                                        title="Descargar comprobante en PDF"
                                        onClick={() => void downloadReceipt(sale)}
                                      >
                                        📄 Descargar PDF
                                      </button>
                                      <button
                                        type="button"
                                        className="primary"
                                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem', background: '#059669', borderColor: '#059669', whiteSpace: 'nowrap' }}
                                        title="Compartir comprobante por WhatsApp"
                                        onClick={() => void shareReceipt(sale)}
                                      >
                                        📲 WhatsApp
                                      </button>
                                      {canViewLocation && (
                                        <button
                                          type="button"
                                          className="secondary"
                                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem', whiteSpace: 'nowrap' }}
                                          title="Ver coordenadas GPS de la venta"
                                          onClick={() => setLocationPanelSaleId(prev => prev === sale.id ? null : sale.id)}
                                        >
                                          {locationPanelSaleId === sale.id ? '📍 Ocultar GPS' : '📍 Ver ubicación'}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {canViewLocation && locationPanelSaleId === sale.id && (
                                  <tr key={`${sale.id}-loc`} style={{ background: '#f8fafc' }}>
                                    <td colSpan={6} style={{ padding: '0.6rem 1rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.84rem' }}>
                                          <span>📍 <strong>Ubicación registrada:</strong></span>
                                          {locationQuery.isLoading && <span className="muted">Cargando coordenadas…</span>}
                                          {locationQuery.error && <span className="alert error" style={{ padding: '0.2rem 0.5rem', margin: 0 }}>{(locationQuery.error as Error).message}</span>}
                                          {locationQuery.data && (
                                            <span>
                                              Lat: <strong>{Number(locationQuery.data.latitude).toFixed(7)}</strong>, Lon: <strong>{Number(locationQuery.data.longitude).toFixed(7)}</strong>
                                              {locationQuery.data.accuracyMeters != null && <> · Precisión: ±{Number(locationQuery.data.accuracyMeters).toFixed(1)}m</>}
                                              {locationQuery.data.capturedAt && <> · {new Date(locationQuery.data.capturedAt).toLocaleTimeString('es-GT')}</>}
                                            </span>
                                          )}
                                        </div>
                                        {locationQuery.data && (
                                          <a
                                            href={`https://www.google.com/maps?q=${Number(locationQuery.data.latitude).toFixed(8)},${Number(locationQuery.data.longitude).toFixed(8)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="secondary"
                                            style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                          >
                                            🗺️ Abrir en Google Maps
                                          </a>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          !sales.isLoading && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
              <p style={{ fontSize: '1.05rem', margin: 0, color: '#64748b' }}>
                {salesSearch ? `No se encontraron ventas que coincidan con "${salesSearch}".` : 'No hay ventas confirmadas registradas en el sistema.'}
              </p>
            </div>
          )
        )}
      </section>
    )}

    {/* ── Modal de Alta Rápida de Cliente Provisional en Ruta ── */}
    {showProvisionalModal && (
      <div className="modal-backdrop" onClick={() => !provisionalLoading && setShowProvisionalModal(false)}>
        <div className="modal-panel" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>➕ Cliente nuevo en ruta</h3>
            <button 
              type="button" 
              className="secondary" 
              style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', padding: '0.2rem' }}
              onClick={() => setShowProvisionalModal(false)}
              disabled={provisionalLoading}
            >
              ✕
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.86rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Para clientes ocasionales que compran por primera vez en la ruta. Se aplicará automáticamente precio general de lista y pago al contado o transferencia.
          </p>

          <form onSubmit={handleSaveProvisional} className="form-grid compact-grid">
            <label className="wide">
              Nombre del cliente o negocio *
              <input 
                required 
                autoFocus
                placeholder="Ej. Tienda Doña Marta / Don Carlos" 
                value={provisionalForm.name} 
                onChange={e => setProvisionalForm({ ...provisionalForm, name: e.target.value })} 
              />
            </label>

            <label className="wide">
              Dirección o punto de referencia *
              <input 
                required 
                placeholder="Ej. Frente al parque central / Casa verde" 
                value={provisionalForm.addressReference} 
                onChange={e => setProvisionalForm({ ...provisionalForm, addressReference: e.target.value })} 
              />
            </label>

            <label className="wide">
              Teléfono de contacto (opcional)
              <input 
                type="tel" 
                placeholder="Ej. 5555-1234" 
                value={provisionalForm.phone} 
                onChange={e => setProvisionalForm({ ...provisionalForm, phone: e.target.value })} 
              />
            </label>

            {provisionalError && (
              <div className="alert error wide" style={{ fontSize: '0.85rem' }}>
                {provisionalError}
              </div>
            )}

            <div className="form-actions wide" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setShowProvisionalModal(false)}
                disabled={provisionalLoading}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="primary" 
                disabled={provisionalLoading || !provisionalForm.name.trim() || !provisionalForm.addressReference.trim()}
              >
                {provisionalLoading ? 'Guardando…' : 'Guardar y Vender Ahora'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ── Modal Flotante: Venta Confirmada + Control de Garrafones ── */}
    {confirmedSaleModal && (
      <div className="floating-toast-overlay" role="dialog" aria-modal="true">
        <div className="floating-toast-card" style={{ maxWidth: '520px', textAlign: 'left', alignItems: 'stretch' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="floating-toast-icon" style={{ margin: '0 auto 0.75rem' }}>✅</div>
            <h3 style={{ margin: 0, fontSize: '1.35rem' }}>¡Venta confirmada exitosamente!</h3>
            <p style={{ margin: '0.35rem 0', color: 'var(--muted)', fontSize: '0.95rem' }}>
              Comprobante: <strong style={{ color: 'var(--text)' }}>{confirmedSaleModal.sale.documentNumber}</strong> · Total: <strong style={{ color: 'var(--primary)' }}>Q{Number(confirmedSaleModal.sale.total).toFixed(2)}</strong>
            </p>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)' }}>
              Cliente: <strong>{confirmedSaleModal.customerName}</strong>
            </p>
          </div>

          {/* Sección de Control de Garrafones en esta Venta */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '0.85rem',
            margin: '0.75rem 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🧴</span>
              <strong style={{ fontSize: '0.92rem' }}>Control de Garrafones en esta Venta</strong>
            </div>
            {postSaleJugLentSuccess ? (
              <div className="alert success" style={{ margin: 0, fontSize: '0.85rem' }}>
                ✅ Se registraron {postSaleJugQty} garrafón(es) en préstamo para {confirmedSaleModal.customerName}.
              </div>
            ) : (
              <>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  {confirmedSaleModal.suggestedJugQty > 0
                    ? `Se vendieron ${confirmedSaleModal.suggestedJugQty} garrafón(es). Si el cliente quedó debiendo envases vacíos (en préstamo), indique la cantidad:`
                    : 'Si se entregaron envases vacíos o en préstamo al cliente, indique la cantidad:'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    Cantidad a prestar:
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={postSaleJugQty === 0 ? '' : postSaleJugQty}
                      placeholder="0"
                      onChange={e => {
                        const val = e.target.value;
                        setPostSaleJugQty(val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                      }}
                      style={{ width: '4.5rem' }}
                    />
                  </label>
                  {confirmedSaleModal.suggestedJugQty > 0 && postSaleJugQty !== confirmedSaleModal.suggestedJugQty && (
                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => setPostSaleJugQty(confirmedSaleModal.suggestedJugQty)}
                    >
                      Debió todos ({confirmedSaleModal.suggestedJugQty})
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                    disabled={postSaleLendMutation.isPending || postSaleJugQty <= 0}
                    onClick={() => { setPostSaleJugError(''); postSaleLendMutation.mutate(); }}
                  >
                    {postSaleLendMutation.isPending ? 'Registrando…' : `+ Registrar ${postSaleJugQty || 0} garrafón(es) en préstamo`}
                  </button>
                </div>
                {postSaleJugError && (
                  <div className="alert error" style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>
                    {postSaleJugError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Opciones de Comprobante */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', margin: '0.2rem 0 0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '0.85rem' }}
              onClick={() => downloadReceipt(confirmedSaleModal.sale)}
            >
              📥 Descargar Comprobante PDF
            </button>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '0.85rem' }}
              onClick={() => shareReceipt(confirmedSaleModal.sale)}
            >
              📲 Compartir por WhatsApp
            </button>
          </div>

          {/* Botón OK — Ir al Panel Operativo */}
          <div className="floating-toast-actions" style={{ marginTop: '0.4rem' }}>
            <button
              type="button"
              className="primary"
              style={{ width: '100%', fontSize: '1rem', padding: '0.65rem 1.25rem' }}
              onClick={handleDismissConfirmedSale}
              autoFocus
            >
              ✅ OK — Ir al Panel Operativo
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Modal Flotante: Confirmación de Transacción Exitosa (Abonos / Devoluciones / Préstamos) ── */}
    {successToast && (
      <div className="floating-toast-overlay" role="dialog" aria-modal="true">
        <div className="floating-toast-card">
          <div className="floating-toast-icon">{successToast.icon ?? '✅'}</div>
          <div className="floating-toast-body">
            <h3>{successToast.title}</h3>
            <p>{successToast.message}</p>
          </div>
          <div className="floating-toast-actions">
            <button
              type="button"
              className="primary"
              onClick={() => setSuccessToast(null)}
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )}
  </main>;
}
