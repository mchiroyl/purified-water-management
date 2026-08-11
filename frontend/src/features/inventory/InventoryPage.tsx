import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';

type Balance = { productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number; version: number; updatedAt: string };
type Location = { id: string; code: string; name: string; locationType: string; routeId?: string; routeCode?: string; routeName?: string; active: boolean; createdAt: string; balances: Balance[] };
type Product = { id: string; code: string; name: string; active: boolean; controlsInventory: boolean };
type Route = { id: string; code: string; name: string; status: string };
type Movement = { id: string; productName: string; productCode: string; movementType: string; quantityDelta: number; balanceBefore: number; balanceAfter: number; reason: string; actorUsername: string; createdAt: string };

export function InventoryPage({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const locations = useQuery({ queryKey: ['inventory', 'locations'], queryFn: () => apiRequest<Location[]>('/inventory/locations') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canManage });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canManage });
  const [selectedLocation, setSelectedLocation] = useState('');
  const movements = useQuery({
    queryKey: ['inventory', 'movements', selectedLocation],
    queryFn: () => apiRequest<Movement[]>(`/inventory/locations/${selectedLocation}/movements`),
    enabled: Boolean(selectedLocation)
  });
  const [locationForm, setLocationForm] = useState({ code: '', name: '', locationType: 'WAREHOUSE', routeId: '' });
  const [adjustment, setAdjustment] = useState({ locationId: '', productId: '', quantityDelta: 0, reason: '' });
  const refresh = () => void client.invalidateQueries({ queryKey: ['inventory'] });
  const createLocation = useMutation({
    mutationFn: () => apiRequest<Location>('/inventory/locations', {
      method: 'POST',
      body: JSON.stringify({ ...locationForm, routeId: locationForm.locationType === 'ROUTE' ? locationForm.routeId : null })
    }),
    onSuccess: () => { setLocationForm({ code: '', name: '', locationType: 'WAREHOUSE', routeId: '' }); refresh(); }
  });
  const adjust = useMutation({
    mutationFn: () => apiRequest<Movement>('/inventory/adjustments', { method: 'POST', body: JSON.stringify(adjustment) }),
    onSuccess: () => { setAdjustment({ ...adjustment, quantityDelta: 0, reason: '' }); setSelectedLocation(adjustment.locationId); refresh(); }
  });
  const submitLocation = (event: FormEvent) => { event.preventDefault(); createLocation.mutate(); };
  const submitAdjustment = (event: FormEvent) => { event.preventDefault(); adjust.mutate(); };

  return <main>
    <p className="eyebrow">Control físico</p><h1>Inventario</h1>
    <p className="muted">Cada cambio queda registrado en unidades base y ninguna operación puede dejar stock negativo.</p>
    {canManage && <div className="dual-panels">
      <form className="panel form-grid compact-form" onSubmit={submitLocation}><h2 className="wide">Nueva ubicación</h2>
        <label>Código<input required value={locationForm.code} onChange={event => setLocationForm({ ...locationForm, code: event.target.value })} /></label>
        <label>Nombre<input required value={locationForm.name} onChange={event => setLocationForm({ ...locationForm, name: event.target.value })} /></label>
        <label>Tipo<select value={locationForm.locationType} onChange={event => setLocationForm({ ...locationForm, locationType: event.target.value, routeId: '' })}><option value="WAREHOUSE">Bodega</option><option value="ROUTE">Ruta</option></select></label>
        {locationForm.locationType === 'ROUTE' && <label>Ruta<select required value={locationForm.routeId} onChange={event => setLocationForm({ ...locationForm, routeId: event.target.value })}><option value="">Seleccionar</option>{routes.data?.filter(route => route.status === 'ACTIVE').map(route => <option value={route.id} key={route.id}>{route.code} · {route.name}</option>)}</select></label>}
        {createLocation.error && <div className="alert error wide">{createLocation.error.message}</div>}
        <button className="primary" disabled={createLocation.isPending}>Crear ubicación</button>
      </form>
      <form className="panel form-grid compact-form" onSubmit={submitAdjustment}><h2 className="wide">Ajuste de inventario</h2>
        <label>Ubicación<select required value={adjustment.locationId} onChange={event => setAdjustment({ ...adjustment, locationId: event.target.value })}><option value="">Seleccionar</option>{locations.data?.filter(item => item.active).map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Producto<select required value={adjustment.productId} onChange={event => setAdjustment({ ...adjustment, productId: event.target.value })}><option value="">Seleccionar</option>{products.data?.filter(product => product.active && product.controlsInventory).map(product => <option value={product.id} key={product.id}>{product.code} · {product.name}</option>)}</select></label>
        <label>Cantidad (+ entrada / − salida)<input required type="number" step="0.0001" value={adjustment.quantityDelta} onChange={event => setAdjustment({ ...adjustment, quantityDelta: Number(event.target.value) })} /></label>
        <label>Motivo<input required value={adjustment.reason} onChange={event => setAdjustment({ ...adjustment, reason: event.target.value })} /></label>
        {adjust.error && <div className="alert error wide">{adjust.error.message}</div>}
        <button className="primary" disabled={adjust.isPending || adjustment.quantityDelta === 0}>Registrar ajuste</button>
      </form>
    </div>}
    <section className="panel section-panel"><div className="section-heading"><h2>Ubicaciones y saldos</h2><span>{locations.data?.length ?? 0} ubicaciones</span></div>
      {locations.error && <div className="alert error">{locations.error.message}</div>}
      <div className="inventory-grid">{locations.data?.map(location => <article className="route-card" key={location.id}>
        <div className="route-card-title"><div><strong>{location.name}</strong><span>{location.code} · {location.locationType === 'ROUTE' ? `Ruta ${location.routeCode ?? ''}` : 'Bodega'}</span></div><span className={`status ${location.active ? 'active' : 'inactive'}`}>{location.active ? 'Activa' : 'Inactiva'}</span></div>
        <div className="data-list">{location.balances.length ? location.balances.map(balance => <div className="data-row" key={balance.productId}><span>{balance.productName}</span><strong>{Number(balance.quantityBaseUnits).toLocaleString('es-GT')} {balance.baseUnitCode}</strong></div>) : <span className="muted">Sin existencias registradas</span>}</div>
        <button className="secondary" onClick={() => setSelectedLocation(location.id)}>Ver movimientos</button>
      </article>)}</div>
    </section>
    {selectedLocation && <section className="panel section-panel"><div className="section-heading"><h2>Libro de movimientos</h2><span>Solo lectura</span></div>
      {movements.error && <div className="alert error">{movements.error.message}</div>}
      <div className="data-list">{movements.data?.map(item => <div className="data-row movement-row" key={item.id}><div><strong>{item.productName}</strong><span>{item.movementType} · {item.reason} · {item.actorUsername}</span></div><div><strong className={Number(item.quantityDelta) >= 0 ? 'positive' : 'negative'}>{Number(item.quantityDelta) > 0 ? '+' : ''}{Number(item.quantityDelta).toLocaleString('es-GT')}</strong><span>{Number(item.balanceBefore).toLocaleString('es-GT')} → {Number(item.balanceAfter).toLocaleString('es-GT')}</span></div></div>)}</div>
      {movements.data?.length === 0 && <p className="muted">Aún no hay movimientos para esta ubicación.</p>}
    </section>}
  </main>;
}
