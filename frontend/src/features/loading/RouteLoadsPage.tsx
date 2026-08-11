import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';

type LoadItem = { id: string; productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type Correction = { id: string; productId: string; productName: string; quantityDelta: number; reason: string; actorUsername: string; createdAt: string };
type RouteLoad = { id: string; loadNumber: string; routeId: string; routeCode: string; routeName: string; sourceLocationId: string; sourceLocationName: string; targetLocationId: string; targetLocationName: string; plannedDate: string; notes: string; status: string; createdByUsername: string; warehouseConfirmedByUsername?: string; warehouseConfirmedDeviceId?: string; warehouseConfirmedAt?: string; sellerReceivedByUsername?: string; sellerReceivedDeviceId?: string; sellerReceivedAt?: string; startedByUsername?: string; startedDeviceId?: string; startedAt?: string; items: LoadItem[]; corrections: Correction[] };
type Location = { id: string; code: string; name: string; locationType: string; active: boolean };
type Route = { id: string; code: string; name: string; status: string };
type Product = { id: string; code: string; name: string; active: boolean; controlsInventory: boolean };
type ItemForm = { productId: string; quantityBaseUnits: number };
type CorrectionForm = { productId: string; quantityDelta: number; reason: string };

const dateInZone = (timezone = 'America/Guatemala') => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const statusLabel: Record<string, string> = { PREPARED: 'Preparada', WAREHOUSE_CONFIRMED: 'Entregada por bodega', RECEIVED: 'Recibida', STARTED: 'Recorrido iniciado' };

export function RouteLoadsPage({ canPrepare, canConfirmWarehouse, canReceive, canStart, canCorrect }: {
  canPrepare: boolean; canConfirmWarehouse: boolean; canReceive: boolean; canStart: boolean; canCorrect: boolean;
}) {
  const client = useQueryClient();
  const loads = useQuery({ queryKey: ['route-loads'], queryFn: () => apiRequest<RouteLoad[]>('/loads') });
  const company = useQuery({ queryKey: ['company-configuration'], queryFn: () => apiRequest<{ timezone: string }>('/company-configuration') });
  const locations = useQuery({ queryKey: ['inventory', 'locations'], queryFn: () => apiRequest<Location[]>('/inventory/locations'), enabled: canPrepare });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canPrepare });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canPrepare || canCorrect });
  const [form, setForm] = useState({ routeId: '', sourceLocationId: '', plannedDate: dateInZone(), notes: '' });
  const [items, setItems] = useState<ItemForm[]>([{ productId: '', quantityBaseUnits: 1 }]);
  const [corrections, setCorrections] = useState<Record<string, CorrectionForm>>({});
  const refresh = () => void client.invalidateQueries({ queryKey: ['route-loads'] });
  const create = useMutation({
    mutationFn: () => apiRequest<RouteLoad>('/loads', { method: 'POST', body: JSON.stringify({ ...form, items }) }),
    onSuccess: () => { setForm({ routeId: '', sourceLocationId: '', plannedDate: dateInZone(company.data?.timezone), notes: '' }); setItems([{ productId: '', quantityBaseUnits: 1 }]); refresh(); }
  });
  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiRequest<RouteLoad>(`/loads/${id}/${action}`, { method: 'POST' }),
    onSuccess: refresh
  });
  const correct = useMutation({
    mutationFn: ({ id, value }: { id: string; value: CorrectionForm }) => apiRequest<RouteLoad>(`/loads/${id}/corrections`, { method: 'POST', body: JSON.stringify(value) }),
    onSuccess: (_data, variables) => { setCorrections({ ...corrections, [variables.id]: { productId: '', quantityDelta: 0, reason: '' } }); refresh(); }
  });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };
  useEffect(() => {
    if (company.data?.timezone) setForm(current => ({ ...current, plannedDate: dateInZone(company.data.timezone) }));
  }, [company.data?.timezone]);

  return <main>
    <p className="eyebrow">Despacho y reparto</p><h1>Cargas de ruta</h1>
    <p className="muted">Bodega confirma la entrega y el vendedor confirma la recepción desde su propio dispositivo.</p>
    {canPrepare && <form className="panel section-panel" onSubmit={submit}><h2>Nueva carga</h2><div className="form-grid compact-form">
      <label>Ruta<select required value={form.routeId} onChange={event => setForm({ ...form, routeId: event.target.value })}><option value="">Seleccionar</option>{routes.data?.filter(route => route.status === 'ACTIVE').map(route => <option value={route.id} key={route.id}>{route.code} · {route.name}</option>)}</select></label>
      <label>Bodega origen<select required value={form.sourceLocationId} onChange={event => setForm({ ...form, sourceLocationId: event.target.value })}><option value="">Seleccionar</option>{locations.data?.filter(item => item.active && item.locationType === 'WAREHOUSE').map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>Fecha planificada<input required type="date" min={dateInZone(company.data?.timezone)} value={form.plannedDate} onChange={event => setForm({ ...form, plannedDate: event.target.value })} /></label>
      <label>Notas<input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
    </div><h3>Productos en unidades base</h3><div className="data-list">{items.map((item, index) => <div className="tier-editor" key={index}>
      <label>Producto<select required value={item.productId} onChange={event => setItems(items.map((row, rowIndex) => rowIndex === index ? { ...row, productId: event.target.value } : row))}><option value="">Seleccionar</option>{products.data?.filter(product => product.active && product.controlsInventory).map(product => <option value={product.id} key={product.id}>{product.code} · {product.name}</option>)}</select></label>
      <label>Cantidad<input required type="number" min="0.0001" step="0.0001" value={item.quantityBaseUnits} onChange={event => setItems(items.map((row, rowIndex) => rowIndex === index ? { ...row, quantityBaseUnits: Number(event.target.value) } : row))} /></label>
      {items.length > 1 && <button type="button" className="secondary" onClick={() => setItems(items.filter((_row, rowIndex) => rowIndex !== index))}>Quitar</button>}
    </div>)}</div><div className="form-actions"><button type="button" className="secondary" onClick={() => setItems([...items, { productId: '', quantityBaseUnits: 1 }])}>Agregar producto</button><button className="primary" disabled={create.isPending}>Preparar carga</button></div>
      {create.error && <div className="alert error">{create.error.message}</div>}
    </form>}
    <section className="section-panel"><div className="section-heading"><h2>Cargas registradas</h2><span>{loads.data?.length ?? 0} cargas</span></div>
      {loads.error && <div className="alert error">{loads.error.message}</div>}
      <div className="load-grid">{loads.data?.map(load => {
        const correction = corrections[load.id] ?? { productId: load.items[0]?.productId ?? '', quantityDelta: 0, reason: '' };
        return <article className="panel load-card" key={load.id}><div className="section-heading"><div><strong>{load.loadNumber}</strong><span>{load.routeCode} · {load.routeName} · {load.plannedDate}</span></div><span className={`status ${load.status === 'STARTED' ? 'active' : ''}`}>{statusLabel[load.status] ?? load.status}</span></div>
          <p>{load.sourceLocationName} → {load.targetLocationName}</p><div className="data-list">{load.items.map(item => <div className="data-row" key={item.id}><span>{item.productName}</span><strong>{Number(item.quantityBaseUnits).toLocaleString('es-GT')} {item.baseUnitCode}</strong></div>)}</div>
          <p className="audit-line">Entrega: {load.warehouseConfirmedByUsername ?? 'pendiente'} · Recepción: {load.sellerReceivedByUsername ?? 'pendiente'} · Inicio: {load.startedByUsername ?? 'pendiente'}</p>
          <div className="form-actions">{load.status === 'PREPARED' && canConfirmWarehouse && <button className="primary" onClick={() => transition.mutate({ id: load.id, action: 'warehouse-confirmation' })}>Confirmar entrega de bodega</button>}
            {load.status === 'WAREHOUSE_CONFIRMED' && canReceive && <button className="primary" onClick={() => transition.mutate({ id: load.id, action: 'receipt' })}>Confirmar recepción</button>}
            {load.status === 'RECEIVED' && canStart && <button className="primary" onClick={() => transition.mutate({ id: load.id, action: 'start' })}>Iniciar recorrido</button>}
          </div>
          {canCorrect && ['RECEIVED', 'STARTED'].includes(load.status) && <div className="correction-form"><h3>Corrección compensatoria</h3><select aria-label={`Producto corrección ${load.loadNumber}`} value={correction.productId} onChange={event => setCorrections({ ...corrections, [load.id]: { ...correction, productId: event.target.value } })}>{load.items.map(item => <option value={item.productId} key={item.id}>{item.productName}</option>)}</select><input aria-label={`Cantidad corrección ${load.loadNumber}`} type="number" step="0.0001" value={correction.quantityDelta} onChange={event => setCorrections({ ...corrections, [load.id]: { ...correction, quantityDelta: Number(event.target.value) } })} /><input aria-label={`Motivo corrección ${load.loadNumber}`} placeholder="Motivo obligatorio" value={correction.reason} onChange={event => setCorrections({ ...corrections, [load.id]: { ...correction, reason: event.target.value } })} /><button className="secondary" disabled={!correction.productId || correction.quantityDelta === 0 || !correction.reason} onClick={() => correct.mutate({ id: load.id, value: correction })}>Registrar corrección</button></div>}
          {load.corrections.length > 0 && <div className="data-list"><h3>Correcciones</h3>{load.corrections.map(item => <div className="data-row" key={item.id}><span>{item.productName} · {item.reason} · {item.actorUsername}</span><strong>{Number(item.quantityDelta) > 0 ? '+' : ''}{Number(item.quantityDelta).toLocaleString('es-GT')}</strong></div>)}</div>}
        </article>;
      })}</div>{(transition.error || correct.error) && <div className="alert error">{(transition.error ?? correct.error)?.message}</div>}
    </section>
  </main>;
}
