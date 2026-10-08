import { useState, useMemo, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Warehouse,
  Truck,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  History,
  TrendingUp,
  Box,
  Layers,
} from 'lucide-react';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';

type Balance = {
  productId: string;
  productCode: string;
  productName: string;
  baseUnitCode: string;
  quantityBaseUnits: number;
  version: number;
  updatedAt: string;
};

type Location = {
  id: string;
  code: string;
  name: string;
  locationType: string;
  routeId?: string;
  routeCode?: string;
  routeName?: string;
  active: boolean;
  createdAt: string;
  balances: Balance[];
};

type ProductPresentation = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  conversionFactor: number;
};

type Product = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  controlsInventory: boolean;
  presentations?: ProductPresentation[];
};

type Route = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type Movement = {
  id: string;
  productName: string;
  productCode: string;
  movementType: string;
  quantityDelta: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  actorUsername: string;
  createdAt: string;
};

type PriceTier = {
  id: string;
  presentationId: string;
  presentationCode: string;
  minimumBaseUnits: number;
  unitPrice: number;
};

type PriceVersion = {
  id: string;
  status: string;
  tiers: PriceTier[];
};

type PriceList = {
  id: string;
  name: string;
  status: string;
  versions: PriceVersion[];
};

export function InventoryPage({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const locations = useQuery({
    queryKey: ['inventory', 'locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  });
  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => apiRequest<Product[]>('/products'),
    enabled: canManage,
  });
  const routes = useQuery({
    queryKey: ['routes'],
    queryFn: () => apiRequest<Route[]>('/routes'),
    enabled: canManage,
  });
  const priceLists = useQuery({
    queryKey: ['pricing', 'lists'],
    queryFn: () => apiRequest<PriceList[]>('/pricing/lists'),
  });

  const [selectedLocation, setSelectedLocation] = useState('');
  const [showManagePanels, setShowManagePanels] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'WAREHOUSE' | 'ROUTE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const movements = useQuery({
    queryKey: ['inventory', 'movements', selectedLocation],
    queryFn: () => apiRequest<Movement[]>(`/inventory/locations/${selectedLocation}/movements`),
    enabled: Boolean(selectedLocation),
  });

  const [locationForm, setLocationForm] = useState({ code: '', name: '', locationType: 'WAREHOUSE', routeId: '' });
  const [adjustment, setAdjustment] = useState({ locationId: '', productId: '', quantityDelta: 0, reason: '' });

  const refresh = () => void client.invalidateQueries({ queryKey: ['inventory'] });

  const createLocation = useMutation({
    mutationFn: () =>
      apiRequest<Location>('/inventory/locations', {
        method: 'POST',
        body: JSON.stringify({ ...locationForm, locationType: 'WAREHOUSE', routeId: null }),
      }),
    onSuccess: () => {
      setLocationForm({ code: '', name: '', locationType: 'WAREHOUSE', routeId: '' });
      refresh();
    },
  });

  const adjust = useMutation({
    mutationFn: () =>
      apiRequest<Movement>('/inventory/adjustments', {
        method: 'POST',
        body: JSON.stringify(adjustment),
      }),
    onSuccess: () => {
      setAdjustment({ ...adjustment, quantityDelta: 0, reason: '' });
      setSelectedLocation(adjustment.locationId);
      refresh();
    },
  });

  const submitLocation = (event: FormEvent) => {
    event.preventDefault();
    createLocation.mutate();
  };

  const submitAdjustment = (event: FormEvent) => {
    event.preventDefault();
    adjust.mutate();
  };

  // Mapear precios de lista activos por presentación
  const activeVersion = priceLists.data?.flatMap(l => l.versions).find(v => v.status === 'ACTIVE');
  const presentationPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (activeVersion) {
      for (const t of activeVersion.tiers) {
        if (!map.has(t.presentationId) || t.minimumBaseUnits <= 1) {
          map.set(t.presentationId, Number(t.unitPrice));
        }
      }
    }
    return map;
  }, [activeVersion]);

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

  // Totales valorizados
  const warehouseTotalVal = useMemo(() => {
    return warehouseLocations.reduce((acc, loc) => {
      return acc + loc.balances.reduce((bAcc, b) => bAcc + (Number(b.quantityBaseUnits) * getProductPrice(b.productId)), 0);
    }, 0);
  }, [warehouseLocations, products.data, presentationPriceMap]);

  const routeTotalVal = useMemo(() => {
    return routeLocations.reduce((acc, loc) => {
      return acc + loc.balances.reduce((bAcc, b) => bAcc + (Number(b.quantityBaseUnits) * getProductPrice(b.productId)), 0);
    }, 0);
  }, [routeLocations, products.data, presentationPriceMap]);

  const grandTotalVal = warehouseTotalVal + routeTotalVal;

  // Filtrado de ubicaciones
  const filteredLocations = useMemo(() => {
    const all = locations.data ?? [];
    return all.filter(loc => {
      if (activeFilter === 'WAREHOUSE' && loc.locationType !== 'WAREHOUSE') return false;
      if (activeFilter === 'ROUTE' && loc.locationType !== 'ROUTE') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = loc.name.toLowerCase().includes(q);
        const matchesCode = loc.code.toLowerCase().includes(q);
        const matchesProduct = loc.balances.some(b => b.productName.toLowerCase().includes(q));
        return matchesName || matchesCode || matchesProduct;
      }
      return true;
    });
  }, [locations.data, activeFilter, searchQuery]);

  return (
    <main style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ── ENCABEZADO Y BOTÓN DE ACCIÓN ── */}
      <PageHeader
        eyebrow="Control físico y valorización"
        title="Inventario"
        description="Existencias en planta central y en camiones de ruta, valorizadas a precio estándar."
        actions={
          canManage ? (
            <button
              type="button"
              className={showManagePanels ? 'secondary' : 'primary'}
              onClick={() => setShowManagePanels(v => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.84rem',
                fontWeight: 600,
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
              }}
            >
              {showManagePanels ? (
                <>
                  <ChevronUp size={16} />
                  Ocultar formularios de ajuste
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  Ajustes y Nueva Bodega
                </>
              )}
            </button>
          ) : undefined
        }
      />

      {/* ── RESUMEN GERENCIAL DE CAPITAL DE INVENTARIO ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
      }}>
        {/* Bodega Física */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Bodega Central
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Warehouse size={17} />
            </div>
          </div>
          <strong style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.3rem 0 0.1rem' }}>
            Q{warehouseTotalVal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            {warehouseLocations.length} bodega en planta
          </span>
        </div>

        {/* Camiones en Calle */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              En Circulación (Camiones)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <Truck size={17} />
            </div>
          </div>
          <strong style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.3rem 0 0.1rem' }}>
            Q{routeTotalVal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            {routeLocations.length} rutas con producto a bordo
          </span>
        </div>

        {/* Total Valorizado Empresa */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Capital Global Realizable
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
              <TrendingUp size={17} />
            </div>
          </div>
          <strong style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.3rem 0 0.1rem' }}>
            Q{grandTotalVal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Activo circulante valorizado a precio comercial
          </span>
        </div>
      </div>

      {/* ── ACORDEÓN PLEGABLE: FORMULARIOS DE NUEVA BODEGA Y AJUSTE ── */}
      {canManage && (
        <div style={{ display: showManagePanels ? 'block' : 'none' }}>
          <div className="dual-panels" style={{ marginBottom: '0.5rem' }}>
            {/* Formulario Nueva Bodega */}
            <form className="panel form-grid compact-form" onSubmit={submitLocation}>
              <h2 className="wide" style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                Nueva bodega
              </h2>
              <label>
                Código
                <input required value={locationForm.code} onChange={event => setLocationForm({ ...locationForm, code: event.target.value })} />
              </label>
              <label>
                Nombre
                <input required value={locationForm.name} onChange={event => setLocationForm({ ...locationForm, name: event.target.value })} />
              </label>
              <p className="muted wide" style={{ fontSize: '0.78rem', margin: '0.25rem 0' }}>
                El inventario se gestiona desde la bodega. Las rutas se asignan por carga diaria y no se crean como ubicaciones de stock.
              </p>
              {createLocation.error && <div className="alert error wide">{createLocation.error.message}</div>}
              <button className="primary" disabled={createLocation.isPending}>Crear bodega</button>
            </form>

            {/* Formulario Ajuste de Inventario */}
            <form className="panel form-grid compact-form" onSubmit={submitAdjustment}>
              <h2 className="wide" style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                Ajuste de inventario
              </h2>
              <label>
                Ubicación
                <select required value={adjustment.locationId} onChange={event => setAdjustment({ ...adjustment, locationId: event.target.value })}>
                  <option value="">Seleccionar</option>
                  {warehouseLocations.filter(item => item.active).map(item => (
                    <option value={item.id} key={item.id}>{item.code} · {item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Producto
                <select required value={adjustment.productId} onChange={event => setAdjustment({ ...adjustment, productId: event.target.value })}>
                  <option value="">Seleccionar</option>
                  {products.data?.filter(product => product.active && product.controlsInventory).map(product => (
                    <option value={product.id} key={product.id}>{product.code} · {product.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad (+ entrada / − salida)
                <input required type="number" step="0.0001" value={adjustment.quantityDelta} onChange={event => setAdjustment({ ...adjustment, quantityDelta: Number(event.target.value) })} />
              </label>
              <label>
                Motivo
                <input required value={adjustment.reason} onChange={event => setAdjustment({ ...adjustment, reason: event.target.value })} />
              </label>
              {adjust.error && <div className="alert error wide">{adjust.error.message}</div>}
              <button className="primary" disabled={adjust.isPending || adjustment.quantityDelta === 0}>Registrar ajuste</button>
            </form>
          </div>
        </div>
      )}

      {/* ── BARRA DE BÚSQUEDA Y FILTRO RÁPIDO ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        padding: '0.75rem 1rem',
      }}>
        {/* Pastillas de filtro */}
        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '0.45rem',
              border: 'none',
              cursor: 'pointer',
              background: activeFilter === 'ALL' ? '#0f172a' : '#f1f5f9',
              color: activeFilter === 'ALL' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Todos ({locations.data?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('WAREHOUSE')}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '0.45rem',
              border: 'none',
              cursor: 'pointer',
              background: activeFilter === 'WAREHOUSE' ? '#2563eb' : '#f1f5f9',
              color: activeFilter === 'WAREHOUSE' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Bodega Central ({warehouseLocations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('ROUTE')}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '0.45rem',
              border: 'none',
              cursor: 'pointer',
              background: activeFilter === 'ROUTE' ? '#059669' : '#f1f5f9',
              color: activeFilter === 'ROUTE' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Rutas en Calle ({routeLocations.length})
          </button>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Buscar por bodega, ruta o producto…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.75rem 0.4rem 2.2rem',
              fontSize: '0.82rem',
              borderRadius: '0.45rem',
              border: '1px solid #cbd5e1',
            }}
          />
        </div>
      </div>

      {locations.error && <div className="alert error">{locations.error.message}</div>}

      {/* ── CUADRÍCULA COMPACTA DE BODEGAS Y RUTAS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1rem',
      }}>
        {filteredLocations.map(location => {
          const isWarehouse = location.locationType === 'WAREHOUSE';
          const totalVal = location.balances.reduce((acc, b) => acc + (Number(b.quantityBaseUnits) * getProductPrice(b.productId)), 0);

          return (
            <article
              key={location.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Cabecera de la tarjeta */}
              <div style={{
                padding: '0.85rem 1.15rem',
                background: isWarehouse ? '#f8fafc' : '#fcfdfd',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '0.45rem',
                    background: isWarehouse ? '#eff6ff' : '#ecfdf5',
                    color: isWarehouse ? '#2563eb' : '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {isWarehouse ? <Warehouse size={17} /> : <Truck size={17} />}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.92rem', color: '#0f172a', display: 'block' }}>
                      {location.name}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {location.code} · {isWarehouse ? 'Bodega central' : 'Inventario de ruta'}
                    </span>
                  </div>
                </div>

                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  background: location.active ? '#ecfdf5' : '#f1f5f9',
                  color: location.active ? '#059669' : '#64748b',
                }}>
                  {location.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {/* Lista compacta de existencias */}
              <div style={{ padding: '0.85rem 1.15rem', flex: 1 }}>
                {location.balances.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {location.balances.map(balance => {
                      const unitPrice = getProductPrice(balance.productId);
                      const lineTotal = Number(balance.quantityBaseUnits) * unitPrice;

                      return (
                        <div
                          key={balance.productId}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.81rem',
                            padding: '0.25rem 0',
                            borderBottom: '1px solid #f8fafc',
                          }}
                        >
                          <span style={{ color: '#334155', fontWeight: 500 }}>
                            {balance.productName}
                          </span>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
                              {Number(balance.quantityBaseUnits).toLocaleString('es-GT')} {balance.baseUnitCode}
                            </strong>
                            {unitPrice > 0 && (
                              <small style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>
                                Q{lineTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </small>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.25rem 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                    Sin existencias registradas
                  </div>
                )}
              </div>

              {/* Pie de tarjeta con valoración y botón */}
              <div style={{
                padding: '0.75rem 1.15rem',
                borderTop: '1px solid #f1f5f9',
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>
                    {isWarehouse ? 'Valor estimado:' : 'Valor potencial:'}
                  </span>
                  <strong style={{ fontSize: '0.98rem', color: isWarehouse ? '#0f172a' : '#059669', fontFeatureSettings: '"tnum"' }}>
                    Q{totalVal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedLocation(location.id)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '0.4rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <History size={13} />
                  Ver movimientos
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredLocations.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', color: '#64748b' }}>
          No se encontraron ubicaciones de inventario con los filtros seleccionados.
        </div>
      )}

      {/* ── LIBRO DE MOVIMIENTOS SELECCIONADO ── */}
      {selectedLocation && (
        <section className="panel section-panel" style={{ marginTop: '0.5rem' }}>
          <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Libro de movimientos</h2>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Historial de auditoría para la ubicación seleccionada</span>
            </div>
            <button type="button" className="secondary" onClick={() => setSelectedLocation('')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
              Cerrar historial
            </button>
          </div>

          {movements.error && <div className="alert error">{movements.error.message}</div>}

          <div className="data-list" style={{ marginTop: '0.75rem' }}>
            {movements.data?.map(item => (
              <div className="data-row movement-row" key={item.id} style={{ padding: '0.55rem 0.75rem', fontSize: '0.82rem' }}>
                <div>
                  <strong>{item.productName}</strong>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {item.movementType} · {item.reason} · {item.actorUsername}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong className={Number(item.quantityDelta) >= 0 ? 'positive' : 'negative'} style={{ fontFeatureSettings: '"tnum"' }}>
                    {Number(item.quantityDelta) > 0 ? '+' : ''}{Number(item.quantityDelta).toLocaleString('es-GT')}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>
                    {Number(item.balanceBefore).toLocaleString('es-GT')} → {Number(item.balanceAfter).toLocaleString('es-GT')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {movements.data?.length === 0 && (
            <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
              Aún no hay movimientos registrados para esta ubicación.
            </p>
          )}
        </section>
      )}

    </main>
  );
}
