import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';
import type { Customer, Route } from '../routes/types';
import { queueReturn } from './returnOffline';

type Presentation = { id: string; code: string; name: string; conversionFactor: number; active: boolean };
type Product = { id: string; name: string; active: boolean; controlsInventory: boolean; presentations: Presentation[] };
type Location = { id: string; code: string; name: string; locationType: string; active: boolean };
type ReturnItem = { id: string; productName: string; presentationName: string; reportedBaseUnits: number; receivedBaseUnits: number };
type ReturnRecord = {
  id: string; returnType: 'UNSOLD_GOOD' | 'CUSTOMER_RETURN'; routeCode: string; routeName: string;
  customerName?: string | null; sellerName: string; status: string; reason: string;
  reportedBaseUnits: number; receivedBaseUnits: number; pendingDifferenceBaseUnits: number; items: ReturnItem[];
};

const typeLabels = { UNSOLD_GOOD: 'Producto no vendido', CUSTOMER_RETURN: 'Devolución de cliente' } as const;
const statusLabels: Record<string, string> = {
  PENDING_RECEIPT: 'Pendiente de recepción', PARTIALLY_RECEIVED: 'Recibida parcialmente',
  RECEIVED: 'Recibida', REJECTED: 'Rechazada',
};

export function ReturnsPage({ canReport, canReceive, deviceId }: {
  canReport: boolean; canReceive: boolean; deviceId: string;
}) {
  const queryClient = useQueryClient();
  const records = useQuery({ queryKey: ['returns'], queryFn: () => apiRequest<ReturnRecord[]>('/returns') });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canReport });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<Customer[]>('/customers'), enabled: canReport });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canReport });
  const locations = useQuery({ queryKey: ['inventory', 'locations'], queryFn: () => apiRequest<Location[]>('/inventory/locations'), enabled: canReceive });
  const [form, setForm] = useState({ returnType: 'UNSOLD_GOOD' as 'UNSOLD_GOOD' | 'CUSTOMER_RETURN', routeId: '', customerId: '', presentationId: '', presentationQuantity: 1, reason: '' });
  const [message, setMessage] = useState('');
  const [localRecords, setLocalRecords] = useState<Array<{ id: string; type: string }>>([]);
  const [warehouses, setWarehouses] = useState<Record<string, string>>({});
  const [received, setReceived] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const selectedRoute = routes.data?.find(route => route.id === form.routeId);
  const availableCustomers = customers.data?.filter(customer => customer.routeId === form.routeId && customer.status === 'ACTIVE') ?? [];
  const presentations = useMemo(() => products.data?.filter(product => product.active && product.controlsInventory)
    .flatMap(product => product.presentations.filter(item => item.active).map(item => ({ ...item, productName: product.name }))) ?? [], [products.data]);
  const selectedPresentation = presentations.find(item => item.id === form.presentationId);

  async function report(event: FormEvent) {
    event.preventDefault();
    if (!selectedRoute?.sellerId || !selectedPresentation) {
      setMessage('La ruta y presentación deben estar activas y la ruta necesita vendedor asignado.');
      return;
    }
    try {
      const item = await queueReturn({
        returnType: form.returnType, routeId: form.routeId, sellerId: selectedRoute.sellerId, deviceId,
        customerId: form.returnType === 'CUSTOMER_RETURN' ? form.customerId : null,
        presentationId: form.presentationId, presentationQuantity: form.presentationQuantity,
        quantityBaseUnits: form.presentationQuantity * Number(selectedPresentation.conversionFactor), reason: form.reason,
      });
      setLocalRecords(current => [{ id: item.localReturnId, type: item.returnType }, ...current]);
      setForm(current => ({ ...current, customerId: '', presentationId: '', presentationQuantity: 1, reason: '' }));
      setMessage('Devolución guardada en el teléfono y pendiente de sincronización.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible guardar la devolución.');
    }
  }

  const receipt = useMutation({
    mutationFn: (record: ReturnRecord) => apiRequest<ReturnRecord>(`/returns/${record.id}/receipt`, {
      method: 'POST',
      body: JSON.stringify({
        warehouseLocationId: warehouses[record.id],
        notes: notes[record.id] || 'Recepción física verificada en bodega',
        items: record.items.map(item => ({ itemId: item.id, receivedBaseUnits: Number(received[item.id] ?? item.reportedBaseUnits) })),
      }),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['returns'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  return <main>
    <PageHeader eyebrow="Control de retorno" title="Devoluciones" description="Producto en buen estado pendiente de recepción física. No se registra como merma ni modifica inventario hasta que bodega lo confirme." />

    {canReport && <form className="panel section-panel" onSubmit={report}>
      <h2>Reportar retorno de producto</h2>
      <div className="form-grid compact-grid">
        <label>Concepto<select value={form.returnType} onChange={event => setForm({ ...form, returnType: event.target.value as typeof form.returnType, customerId: '' })}><option value="UNSOLD_GOOD">Producto no vendido</option><option value="CUSTOMER_RETURN">Devolución de cliente</option></select></label>
        <label>Ruta<select required value={form.routeId} onChange={event => setForm({ ...form, routeId: event.target.value, customerId: '' })}><option value="">Seleccionar</option>{routes.data?.filter(route => route.status === 'ACTIVE').map(route => <option value={route.id} key={route.id}>{route.code} · {route.name}</option>)}</select></label>
        {form.returnType === 'CUSTOMER_RETURN' && <label>Cliente<select required value={form.customerId} onChange={event => setForm({ ...form, customerId: event.target.value })}><option value="">Seleccionar</option>{availableCustomers.map(customer => <option value={customer.id} key={customer.id}>{customer.code} · {customer.name}</option>)}</select></label>}
        <label>Presentación<select required value={form.presentationId} onChange={event => setForm({ ...form, presentationId: event.target.value })}><option value="">Seleccionar</option>{presentations.map(item => <option value={item.id} key={item.id}>{item.productName} · {item.name} · {Number(item.conversionFactor)} unidades</option>)}</select></label>
        <label>Cantidad de presentaciones<input required type="number" min="0.0001" step="0.0001" value={form.presentationQuantity} onChange={event => setForm({ ...form, presentationQuantity: Number(event.target.value) })} /></label>
        <label className="full-width">Motivo<textarea required value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /></label>
      </div>
      <button className="primary">Guardar offline</button>
      {message && <div className="alert">{message}</div>}
      {localRecords.map(item => <p className="status-note" key={item.id}>{typeLabels[item.type as keyof typeof typeLabels]} · LOCAL_PENDING</p>)}
    </form>}

    <section className="section-panel">
      <div className="section-heading"><h2>Retornos reportados</h2><span>{records.data?.length ?? 0}</span></div>
      {records.error && <div className="alert error">{records.error.message}</div>}
      <div className="sales-grid">{records.data?.map(record => <article className="panel sale-card" key={record.id}>
        <div className="section-heading"><div><strong>{typeLabels[record.returnType]} · {record.routeCode}</strong><span>{record.sellerName}{record.customerName ? ` · ${record.customerName}` : ''}</span></div><span className="status-pill">{statusLabels[record.status] ?? record.status}</span></div>
        <p>{record.reason}</p>
        {record.items.map(item => <div className="data-row" key={item.id}><span>{item.productName} · {item.presentationName}</span><strong>Reportadas {Number(item.reportedBaseUnits)} · recibidas {Number(item.receivedBaseUnits)}</strong></div>)}
        <p className="status-note">Recibidas: {Number(record.receivedBaseUnits)} · Diferencia pendiente: {Number(record.pendingDifferenceBaseUnits)}</p>
        {canReceive && record.status === 'PENDING_RECEIPT' && <div className="review-box">
          <label>Bodega<select required aria-label={`Bodega para ${record.id}`} value={warehouses[record.id] ?? ''} onChange={event => setWarehouses(current => ({ ...current, [record.id]: event.target.value }))}><option value="">Seleccionar</option>{locations.data?.filter(item => item.active && item.locationType === 'WAREHOUSE').map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
          {record.items.map(item => <label key={item.id}>Unidades recibidas de {item.productName}<input type="number" min="0" max={item.reportedBaseUnits} step="0.0001" value={received[item.id] ?? String(item.reportedBaseUnits)} onChange={event => setReceived(current => ({ ...current, [item.id]: event.target.value }))} /></label>)}
          <label>Notas<input value={notes[record.id] ?? ''} onChange={event => setNotes(current => ({ ...current, [record.id]: event.target.value }))} /></label>
          <button className="primary" disabled={!warehouses[record.id] || receipt.isPending} onClick={() => receipt.mutate(record)}>Confirmar recepción física</button>
        </div>}
      </article>)}</div>
    </section>
  </main>;
}
