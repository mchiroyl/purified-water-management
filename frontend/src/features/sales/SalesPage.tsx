import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../app/PageHeader';
import { useState, type FormEvent } from 'react';
import { apiBlob, apiRequest } from '../../services/apiClient';
import { openMobileDatabase, type GeoLocationSnapshot } from '../../offline/mobileDatabase';
import { captureCurrentLocation } from '../../services/geolocation';
import { cacheReceipt, findCachedReceipt, markReceiptPending } from './receiptOffline';
import { downloadReceiptFile, shareReceiptFile } from './receiptSharing';

type Route = { id: string; code: string; name: string; status: string };
type Customer = { id: string; code: string; name: string; status: string; routeId?: string; customerType: string; creditAllowed: boolean; creditLimit: number; currentBalance: number };
type Presentation = { id: string; code: string; name: string; active: boolean };
type Product = { id: string; code: string; name: string; active: boolean; controlsInventory: boolean; presentations: Presentation[] };
type SaleItem = { id: string; productName: string; presentationName: string; presentationQuantity: number; quantityBaseUnits: number; unitPrice: number; lineTotal: number; priceSource: string };
type Payment = { id: string; method: string; amount: number; status: string; reference: string; bank: string };
type Sale = { id: string; documentNumber: string; routeCode: string; routeName: string; sellerName: string; customerCode: string; customerName: string; status: string; subtotal: number; total: number; currencyCode: string; createdAt: string; items: SaleItem[]; payments?: Payment[]; pendingTransferAmount?: number; rejectedTransferAmount?: number; creditAmount?: number };
type ItemForm = { presentationId: string; quantity: number };
type PaymentForm = { method: string; amount: string; reference: string; bank: string; evidenceReference: string };

const money = (value: number) => `Q${Number(value).toFixed(2)}`;
const newPayment = (method = 'CASH'): PaymentForm => ({ method, amount: '', reference: '', bank: '', evidenceReference: '' });

type SaleLocation = { latitude: number; longitude: number; accuracyMeters: number | null; capturedAt: string; persistedAt: string };

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
    onSuccess: async () => {
      setCustomerId('');
      setItems([{ presentationId: '', quantity: 1 }]);
      setPayments([newPayment()]);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
  });
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
        {payment.method === 'CREDIT' && selectedCustomer && <p className="credit-available">Disponible: {money(Number(selectedCustomer.creditLimit) - Number(selectedCustomer.currentBalance))}</p>}
        {payments.length > 1 && <button type="button" className="secondary" onClick={() => setPayments(current => current.filter((_row, position) => position !== index))}>Quitar pago</button>}
      </div>)}</div>
      <button type="button" className="secondary add-payment" disabled={!nextPaymentMethod} onClick={() => nextPaymentMethod && setPayments(current => [...current, newPayment(nextPaymentMethod)])}>Dividir pago</button>
      <div className="form-actions"><button type="button" className="secondary" onClick={() => setItems(current => [...current, { presentationId: '', quantity: 1 }])}>Agregar producto</button><button className="primary" disabled={isCapturingLocation || create.isPending}>{isCapturingLocation ? 'Refinando precisión GPS…' : create.isPending ? 'Confirmando…' : 'Confirmar venta'}</button></div>
      {isCapturingLocation && <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Buscando señal GPS de alta precisión. Puede tomar hasta 30 segundos.</p>}
      {(locationError || create.error) && <div className="alert error">{locationError || create.error?.message}</div>}
    </form>}

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
