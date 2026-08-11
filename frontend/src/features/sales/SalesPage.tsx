import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiBlob, apiRequest } from '../../services/apiClient';

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

export function SalesPage({ canSell }: { canSell: boolean }) {
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
  const create = useMutation({
    mutationFn: () => apiRequest<Sale>('/sales', {
      method: 'POST',
      body: JSON.stringify({ clientReference: crypto.randomUUID(), routeId, customerId, items,
        payments: payments.map(payment => ({ ...payment, amount: payment.amount === '' ? null : Number(payment.amount) })) })
    }),
    onSuccess: async () => {
      setCustomerId('');
      setItems([{ presentationId: '', quantity: 1 }]);
      setPayments([newPayment()]);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
  });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };
  const presentations = products.data?.filter(product => product.active && product.controlsInventory)
    .flatMap(product => product.presentations.filter(item => item.active).map(item => ({ ...item, product }))) ?? [];
  const availableCustomers = customers.data?.filter(customer => customer.status === 'ACTIVE' && customer.routeId === routeId) ?? [];
  const selectedCustomer = availableCustomers.find(customer => customer.id === customerId);
  const allowedPaymentMethods = ['CASH', 'TRANSFER', ...(selectedCustomer?.customerType === 'PERMANENT' && selectedCustomer.creditAllowed ? ['CREDIT'] : [])];
  const nextPaymentMethod = allowedPaymentMethods.find(method => !payments.some(payment => payment.method === method));
  const downloadReceipt = async (sale: Sale) => {
    setReceiptError('');
    try {
      const blob = await apiBlob(`/sales/${sale.id}/receipt`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `comprobante-${sale.documentNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'No fue posible descargar el comprobante.');
    }
  };

  return <main>
    <p className="eyebrow">Operación en ruta</p>
    <h1>Ventas</h1>
    <p className="muted">Los precios, conversiones, totales, correlativos e inventario se calculan y confirman en el servidor.</p>

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
      <div className="form-actions"><button type="button" className="secondary" onClick={() => setItems(current => [...current, { presentationId: '', quantity: 1 }])}>Agregar producto</button><button className="primary" disabled={create.isPending}>{create.isPending ? 'Confirmando…' : 'Confirmar venta'}</button></div>
      {create.error && <div className="alert error">{create.error.message}</div>}
    </form>}

    <section className="section-panel"><div className="section-heading"><h2>Ventas confirmadas</h2><span>{sales.data?.length ?? 0} ventas</span></div>
      {receiptError && <div className="alert error">{receiptError}</div>}
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
        <button type="button" className="secondary" onClick={() => void downloadReceipt(sale)}>Descargar PDF</button>
      </article>)}</div>
    </section>
  </main>;
}
