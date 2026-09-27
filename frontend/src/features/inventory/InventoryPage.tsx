import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../app/PageHeader';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';

type Balance = { productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number; version: number; updatedAt: string };
type Location = { id: string; code: string; name: string; locationType: string; routeId?: string; routeCode?: string; routeName?: string; active: boolean; createdAt: string; balances: Balance[] };
type ProductPresentation = { id: string; code: string; name: string; active: boolean; conversionFactor: number };
type Product = { id: string; code: string; name: string; active: boolean; controlsInventory: boolean; presentations?: ProductPresentation[] };
type Route = { id: string; code: string; name: string; status: string };
type Movement = { id: string; productName: string; productCode: string; movementType: string; quantityDelta: number; balanceBefore: number; balanceAfter: number; reason: string; actorUsername: string; createdAt: string };

type PriceTier = { id: string; presentationId: string; presentationCode: string; minimumBaseUnits: number; unitPrice: number };
type PriceVersion = { id: string; status: string; tiers: PriceTier[] };
type PriceList = { id: string; name: string; status: string; versions: PriceVersion[] };

export function InventoryPage({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const locations = useQuery({ queryKey: ['inventory', 'locations'], queryFn: () => apiRequest<Location[]>('/inventory/locations') });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canManage });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canManage });
  const priceLists = useQuery({ queryKey: ['pricing', 'lists'], queryFn: () => apiRequest<PriceList[]>('/pricing/lists') });

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
      body: JSON.stringify({ ...locationForm, locationType: 'WAREHOUSE', routeId: null })
    }),
    onSuccess: () => { setLocationForm({ code: '', name: '', locationType: 'WAREHOUSE', routeId: '' }); refresh(); }
  });
  const adjust = useMutation({
    mutationFn: () => apiRequest<Movement>('/inventory/adjustments', { method: 'POST', body: JSON.stringify(adjustment) }),
    onSuccess: () => { setAdjustment({ ...adjustment, quantityDelta: 0, reason: '' }); setSelectedLocation(adjustment.locationId); refresh(); }
  });
  const submitLocation = (event: FormEvent) => { event.preventDefault(); createLocation.mutate(); };
  const submitAdjustment = (event: FormEvent) => { event.preventDefault(); adjust.mutate(); };

  // Mapear precios de lista activos por presentación
  const activeVersion = priceLists.data?.flatMap(l => l.versions).find(v => v.status === 'ACTIVE');
  const presentationPriceMap = new Map<string, number>();
  if (activeVersion) {
    for (const t of activeVersion.tiers) {
      if (!presentationPriceMap.has(t.presentationId) || t.minimumBaseUnits <= 1) {
        presentationPriceMap.set(t.presentationId, Number(t.unitPrice));
      }
    }
  }

  // Obtener precio unitario estimado para un producto
  const getProductPrice = (productId: string): number => {
    const prod = products.data?.find(p => p.id === productId);
    if (!prod?.presentations) return 0;
    for (const pres of prod.presentations) {
      if (presentationPriceMap.has(pres.id)) {
        return presentationPriceMap.get(pres.id)!;
      }
    }
    return 0;
  };

  const warehouseLocations = locations.data?.filter(item => item.locationType === 'WAREHOUSE') ?? [];
  const routeLocations = locations.data?.filter(item => item.locationType === 'ROUTE') ?? [];

  return <main>
    <PageHeader eyebrow="Control físico y valorización" title="Inventario" description="Cada cambio queda registrado en unidades base. El valor monetario se calcula al precio estándar de lista general." />
    {canManage && <div className="dual-panels">
      <form className="panel form-grid compact-form" onSubmit={submitLocation}><h2 className="wide">Nueva bodega</h2>
        <label>Código<input required value={locationForm.code} onChange={event => setLocationForm({ ...locationForm, code: event.target.value })} /></label>
        <label>Nombre<input required value={locationForm.name} onChange={event => setLocationForm({ ...locationForm, name: event.target.value })} /></label>
        <p className="muted wide">El inventario se gestiona desde la bodega. Las rutas se asignan por carga diaria y no se crean como ubicaciones de stock.</p>
        {createLocation.error && <div className="alert error wide">{createLocation.error.message}</div>}
        <button className="primary" disabled={createLocation.isPending}>Crear bodega</button>
      </form>
      <form className="panel form-grid compact-form" onSubmit={submitAdjustment}><h2 className="wide">Ajuste de inventario</h2>
        <label>Ubicación<select required value={adjustment.locationId} onChange={event => setAdjustment({ ...adjustment, locationId: event.target.value })}><option value="">Seleccionar</option>{warehouseLocations.filter(item => item.active).map(item => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Producto<select required value={adjustment.productId} onChange={event => setAdjustment({ ...adjustment, productId: event.target.value })}><option value="">Seleccionar</option>{products.data?.filter(product => product.active && product.controlsInventory).map(product => <option value={product.id} key={product.id}>{product.code} · {product.name}</option>)}</select></label>
        <label>Cantidad (+ entrada / − salida)<input required type="number" step="0.0001" value={adjustment.quantityDelta} onChange={event => setAdjustment({ ...adjustment, quantityDelta: Number(event.target.value) })} /></label>
        <label>Motivo<input required value={adjustment.reason} onChange={event => setAdjustment({ ...adjustment, reason: event.target.value })} /></label>
        {adjust.error && <div className="alert error wide">{adjust.error.message}</div>}
        <button className="primary" disabled={adjust.isPending || adjustment.quantityDelta === 0}>Registrar ajuste</button>
      </form>
    </div>}

    {/* Inventario de Bodega Física */}
    <section className="panel section-panel">
      <div className="section-heading">
        <div>
          <h2>Inventario de bodega física</h2>
          <span style={{ fontSize: '0.85rem' }}>Stock almacenado en planta y valorizado a precio estándar general</span>
        </div>
        <span>{warehouseLocations.length} bodegas</span>
      </div>
      {locations.error && <div className="alert error">{locations.error.message}</div>}
      <div className="inventory-grid">
        {warehouseLocations.map(location => {
          const totalVal = location.balances.reduce((acc, b) => acc + (Number(b.quantityBaseUnits) * getProductPrice(b.productId)), 0);
          return (
            <article className="route-card" key={location.id}>
              <div className="route-card-title">
                <div><strong>{location.name}</strong><span>{location.code} · Bodega central</span></div>
                <span className={`status ${location.active ? 'active' : 'inactive'}`}>{location.active ? 'Activa' : 'Inactiva'}</span>
              </div>
              <div className="data-list">
                {location.balances.length ? location.balances.map(balance => {
                  const unitPrice = getProductPrice(balance.productId);
                  const lineTotal = Number(balance.quantityBaseUnits) * unitPrice;
                  return (
                    <div className="data-row" key={balance.productId}>
                      <span>{balance.productName}</span>
                      <strong>
                        {Number(balance.quantityBaseUnits).toLocaleString('es-GT')} {balance.baseUnitCode}
                        {unitPrice > 0 && <span style={{ fontWeight: 'normal', color: 'var(--muted)', marginLeft: '0.45rem' }}>· Q{lineTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                      </strong>
                    </div>
                  );
                }) : <span className="muted">Sin existencias registradas</span>}
              </div>
              {totalVal > 0 && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Valor comercial estimado en bodega:</span>
                  <strong style={{ fontSize: '1.15rem', color: 'var(--primary-dark)' }}>
                    Q{totalVal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              )}
              <div style={{ marginTop: '0.65rem' }}>
                <button className="secondary" onClick={() => setSelectedLocation(location.id)}>Ver movimientos</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>

    {/* Inventario en Circulación (Rutas en calle) */}
    {routeLocations.length > 0 && (
      <section className="panel section-panel">
        <div className="section-heading">
          <div>
            <h2>Inventario en circulación (Rutas en calle)</h2>
            <span style={{ fontSize: '0.85rem' }}>Producto a bordo de los camiones de reparto en jornada</span>
          </div>
          <span>{routeLocations.length} rutas</span>
        </div>
        <div className="inventory-grid">
          {routeLocations.map(location => {
            const totalRouteVal = location.balances.reduce((acc, b) => acc + (Number(b.quantityBaseUnits) * getProductPrice(b.productId)), 0);
            return (
              <article className="route-card" key={location.id}>
                <div className="route-card-title">
                  <div><strong>{location.name}</strong><span>{location.code} · Inventario de ruta</span></div>
                  <span className={`status ${location.active ? 'active' : 'inactive'}`}>{location.active ? 'Activa' : 'Inactiva'}</span>
                </div>
                <div className="data-list">
                  {location.balances.length ? location.balances.map(balance => {
                    const unitPrice = getProductPrice(balance.productId);
                    const lineTotal = Number(balance.quantityBaseUnits) * unitPrice;
                    return (
                      <div className="data-row" key={balance.productId}>
                        <span>{balance.productName}</span>
                        <strong>
                          {Number(balance.quantityBaseUnits).toLocaleString('es-GT')} {balance.baseUnitCode}
                          {unitPrice > 0 && <span style={{ fontWeight: 'normal', color: 'var(--muted)', marginLeft: '0.45rem' }}>· Q{lineTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                        </strong>
                      </div>
                    );
                  }) : <span className="muted">Sin existencias a bordo en este momento</span>}
                </div>
                {totalRouteVal > 0 && (
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Valor potencial en ruta:</span>
                    <strong style={{ color: '#087a54' }}>
                      Q{totalRouteVal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                )}
                <div style={{ marginTop: '0.65rem' }}>
                  <button className="secondary" onClick={() => setSelectedLocation(location.id)}>Ver movimientos</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    )}

    {selectedLocation && <section className="panel section-panel"><div className="section-heading"><h2>Libro de movimientos</h2><span>Solo lectura</span></div>
      {movements.error && <div className="alert error">{movements.error.message}</div>}
      <div className="data-list">{movements.data?.map(item => <div className="data-row movement-row" key={item.id}><div><strong>{item.productName}</strong><span>{item.movementType} · {item.reason} · {item.actorUsername}</span></div><div><strong className={Number(item.quantityDelta) >= 0 ? 'positive' : 'negative'}>{Number(item.quantityDelta) > 0 ? '+' : ''}{Number(item.quantityDelta).toLocaleString('es-GT')}</strong><span>{Number(item.balanceBefore).toLocaleString('es-GT')} → {Number(item.balanceAfter).toLocaleString('es-GT')}</span></div></div>)}</div>
      {movements.data?.length === 0 && <p className="muted">Aún no hay movimientos para esta ubicación.</p>}
    </section>}
  </main>;
}
