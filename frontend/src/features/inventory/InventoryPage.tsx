import { useState, useMemo, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

type Movement = {
  id: string;
  productId?: string;
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

type RouteLoad = {
  id: string;
  loadNumber: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  targetLocationId: string;
  status: string;
};

type InventoryPageProps = {
  canManage: boolean;
  view?: 'create' | 'list';
};

export function InventoryPage({ canManage, view = 'create' }: InventoryPageProps) {
  const client = useQueryClient();

  // Safe navigation fallback for isolated testing without Router
  let navigate: (to: string) => void = () => {};
  try {
    navigate = useNavigate();
  } catch {
    navigate = (to: string) => {
      window.location.pathname = to;
    };
  }

  const locations = useQuery({
    queryKey: ['inventory', 'locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  });

  const loads = useQuery({
    queryKey: ['route-loads'],
    queryFn: () => apiRequest<RouteLoad[]>('/loads'),
  });

  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => apiRequest<Product[]>('/products'),
    enabled: canManage,
  });

  const priceLists = useQuery({
    queryKey: ['pricing', 'lists'],
    queryFn: () => apiRequest<PriceList[]>('/pricing/lists'),
  });

  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState('ALL');
  const [showOnlyStreetActiveRoutes, setShowOnlyStreetActiveRoutes] = useState(true);

  const movements = useQuery({
    queryKey: ['inventory', 'movements', selectedLocation],
    queryFn: () => apiRequest<Movement[]>(`/inventory/locations/${selectedLocation}/movements`),
    enabled: Boolean(selectedLocation),
  });

  const [locationForm, setLocationForm] = useState({ code: '', name: '', locationType: 'WAREHOUSE', routeId: '' });
  const [adjustment, setAdjustment] = useState({ locationId: '', productId: '', quantityDelta: 0, reason: '' });
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const refresh = () => void client.invalidateQueries({ queryKey: ['inventory'] });

  const createLocation = useMutation({
    mutationFn: () =>
      apiRequest<Location>('/inventory/locations', {
        method: 'POST',
        body: JSON.stringify({ ...locationForm, locationType: 'WAREHOUSE', routeId: null }),
      }),
    onSuccess: (data) => {
      setLocationForm({ code: '', name: '', locationType: 'WAREHOUSE', routeId: '' });
      refresh();
      setActionSuccessMessage(`Bodega "${data.name}" creada con éxito.`);
    },
  });

  const adjust = useMutation({
    mutationFn: () => apiRequest<Movement>('/inventory/adjustments', { method: 'POST', body: JSON.stringify(adjustment) }),
    onSuccess: () => {
      setAdjustment({ ...adjustment, quantityDelta: 0, reason: '' });
      setSelectedLocation(adjustment.locationId);
      refresh();
      setActionSuccessMessage('Ajuste de inventario registrado correctamente.');
    },
  });

  const submitLocation = (event: FormEvent) => {
    event.preventDefault();
    setActionSuccessMessage(null);
    createLocation.mutate();
  };

  const submitAdjustment = (event: FormEvent) => {
    event.preventDefault();
    setActionSuccessMessage(null);
    adjust.mutate();
  };

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

  // Mapear estado operativo de la carga para cada ruta
  const getRouteOperationalStatus = (location: Location): { code: string; label: string; isOnStreet: boolean } => {
    if (!loads.data || loads.data.length === 0) {
      const hasStock = location.balances.some(b => Number(b.quantityBaseUnits) > 0);
      return {
        code: hasStock ? 'STOCK_ON_STREET' : 'NO_STOCK',
        label: hasStock ? 'En calle' : 'Sin stock',
        isOnStreet: hasStock && location.active,
      };
    }

    const matchingLoads = loads.data.filter(
      l => (location.routeId && l.routeId === location.routeId) || l.targetLocationId === location.id
    );

    if (matchingLoads.length === 0) {
      const hasStock = location.balances.some(b => Number(b.quantityBaseUnits) > 0);
      return {
        code: 'WITHOUT_LOAD',
        label: hasStock ? 'En calle (Carga previa)' : 'Sin jornada hoy',
        isOnStreet: hasStock && location.active,
      };
    }

    // Priorizar estado activo en calle: STARTED > RECEIVED
    const started = matchingLoads.find(l => l.status === 'STARTED');
    if (started) {
      return { code: 'STARTED', label: 'En recorrido', isOnStreet: true };
    }

    const received = matchingLoads.find(l => l.status === 'RECEIVED');
    if (received) {
      return { code: 'RECEIVED', label: 'Recibida (En calle)', isOnStreet: true };
    }

    const confirmed = matchingLoads.find(l => l.status === 'WAREHOUSE_CONFIRMED');
    if (confirmed) {
      return { code: 'WAREHOUSE_CONFIRMED', label: 'Despachada en planta', isOnStreet: false };
    }

    const settled = matchingLoads.find(l => l.status === 'SETTLED');
    if (settled) {
      return { code: 'SETTLED', label: 'Cerrada / Liquidada', isOnStreet: false };
    }

    return { code: matchingLoads[0].status, label: matchingLoads[0].status, isOnStreet: false };
  };

  // Filtrar rutas: por defecto SOLO las que están en la calle (no cerradas)
  const routeLocations = useMemo(() => {
    const allRoutes = locations.data?.filter(item => item.locationType === 'ROUTE') ?? [];
    if (!showOnlyStreetActiveRoutes) return allRoutes;

    return allRoutes.filter(location => {
      const op = getRouteOperationalStatus(location);
      return op.isOnStreet;
    });
  }, [locations.data, loads.data, showOnlyStreetActiveRoutes]);

  const activeLocationObj = useMemo(() => {
    return locations.data?.find(l => l.id === selectedLocation);
  }, [locations.data, selectedLocation]);

  const uniqueProductsInMovements = useMemo(() => {
    if (!movements.data) return [];
    const map = new Map<string, string>();
    for (const m of movements.data) {
      const key = m.productCode || m.productName;
      map.set(key, m.productName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [movements.data]);

  const filteredMovements = useMemo(() => {
    if (!movements.data) return [];
    if (selectedProductFilter === 'ALL') return movements.data;
    return movements.data.filter(m => (m.productCode || m.productName) === selectedProductFilter);
  }, [movements.data, selectedProductFilter]);

  const getMovementMeta = (movementType: string) => {
    switch (movementType) {
      case 'LOAD_IN':
        return { label: 'Entrada por carga', badgeClass: 'active' };
      case 'LOAD_OUT':
        return { label: 'Despacho de bodega', badgeClass: 'inactive' };
      case 'SALE_OUT':
        return { label: 'Salida por venta', badgeClass: 'neutral' };
      case 'ADJUSTMENT_IN':
        return { label: 'Ajuste positivo', badgeClass: 'active' };
      case 'ADJUSTMENT_OUT':
        return { label: 'Ajuste negativo', badgeClass: 'inactive' };
      case 'TRANSFER_IN':
        return { label: 'Entrada transferencia', badgeClass: 'active' };
      case 'TRANSFER_OUT':
        return { label: 'Salida transferencia', badgeClass: 'inactive' };
      case 'RETURN_IN':
        return { label: 'Devolución recibida', badgeClass: 'active' };
      case 'RETURN_OUT':
        return { label: 'Devolución entregada', badgeClass: 'inactive' };
      case 'WASTE_OUT':
        return { label: 'Merma aprobada', badgeClass: 'inactive' };
      default:
        return { label: movementType, badgeClass: 'neutral' };
    }
  };

  const formatMovementDateTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-GT', {
        timeZone: 'America/Guatemala',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Si el usuario no tiene permisos de gestión, siempre ve la lista de inventario
  const effectiveView = canManage ? view : 'list';

  return (
    <main>
      <PageHeader
        eyebrow="Control físico y valorización"
        title="Inventario"
        description="Cada cambio queda registrado en unidades base. El valor monetario se calcula al precio estándar de lista general."
        actions={
          canManage ? (
            <button
              type="button"
              className="primary"
              onClick={() => navigate(effectiveView === 'create' ? '/inventory/list' : '/inventory')}
            >
              {effectiveView === 'create' ? 'Ver inventario' : 'Nueva bodega / Ajuste'}
            </button>
          ) : undefined
        }
      />

      {/* ── Vista de Registro / Creación (Formularios originales completos) ── */}
      {effectiveView === 'create' && canManage && (
        <>
          {actionSuccessMessage && (
            <div className="alert success" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✓ {actionSuccessMessage}</span>
              <button
                type="button"
                className="secondary"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.85rem' }}
                onClick={() => navigate('/inventory/list')}
              >
                Ir a ver inventario
              </button>
            </div>
          )}

          <div className="dual-panels">
            {/* Formulario 1: Nueva bodega */}
            <form className="panel form-grid compact-form" onSubmit={submitLocation}>
              <h2 className="wide">Nueva bodega</h2>
              <label>
                Código
                <input
                  required
                  value={locationForm.code}
                  onChange={event => setLocationForm({ ...locationForm, code: event.target.value })}
                />
              </label>
              <label>
                Nombre
                <input
                  required
                  value={locationForm.name}
                  onChange={event => setLocationForm({ ...locationForm, name: event.target.value })}
                />
              </label>
              <p className="muted wide">
                El inventario se gestiona desde la bodega. Las rutas se asignan por carga diaria y no se crean como ubicaciones de stock.
              </p>
              {createLocation.error && <div className="alert error wide">{createLocation.error.message}</div>}
              <button className="primary" disabled={createLocation.isPending}>
                Crear bodega
              </button>
            </form>

            {/* Formulario 2: Ajuste de inventario */}
            <form className="panel form-grid compact-form" onSubmit={submitAdjustment}>
              <h2 className="wide">Ajuste de inventario</h2>
              <label>
                Ubicación
                <select
                  required
                  value={adjustment.locationId}
                  onChange={event => setAdjustment({ ...adjustment, locationId: event.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {warehouseLocations
                    .filter(item => item.active)
                    .map(item => (
                      <option value={item.id} key={item.id}>
                        {item.code} · {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Producto
                <select
                  required
                  value={adjustment.productId}
                  onChange={event => setAdjustment({ ...adjustment, productId: event.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {products.data
                    ?.filter(product => product.active && product.controlsInventory)
                    .map(product => (
                      <option value={product.id} key={product.id}>
                        {product.code} · {product.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Cantidad (+ entrada / − salida)
                <input
                  required
                  type="number"
                  step="0.0001"
                  value={adjustment.quantityDelta}
                  onChange={event => setAdjustment({ ...adjustment, quantityDelta: Number(event.target.value) })}
                />
              </label>
              <label>
                Motivo
                <input
                  required
                  value={adjustment.reason}
                  onChange={event => setAdjustment({ ...adjustment, reason: event.target.value })}
                />
              </label>
              {adjust.error && <div className="alert error wide">{adjust.error.message}</div>}
              <button className="primary" disabled={adjust.isPending || adjustment.quantityDelta === 0}>
                Registrar ajuste
              </button>
            </form>
          </div>
        </>
      )}

      {/* ── Vista de Listas de Inventario Registrado (Tablas compactas y profesionales) ── */}
      {effectiveView === 'list' && (
        <>
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
            {warehouseLocations.length > 0 ? (
              <div className="table-wrap inventory-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Código</th>
                      <th style={{ width: '220px' }}>Bodega</th>
                      <th>Existencias y Detalle de Stock</th>
                      <th style={{ textAlign: 'right', width: '170px' }}>Valor Comercial</th>
                      <th style={{ width: '100px' }}>Estado</th>
                      <th style={{ textAlign: 'center', width: '150px' }}>Opciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseLocations.map(location => {
                      const totalVal = location.balances.reduce(
                        (acc, b) => acc + Number(b.quantityBaseUnits) * getProductPrice(b.productId),
                        0,
                      );
                      return (
                        <tr key={location.id}>
                          <td><strong>{location.code}</strong></td>
                          <td>
                            <strong>{location.name}</strong>
                            <small style={{ display: 'block', color: 'var(--muted)' }}>Almacén central</small>
                          </td>
                          <td>
                            {location.balances.length ? (
                              <div className="inventory-balances-cell">
                                {location.balances.map(balance => {
                                  const unitPrice = getProductPrice(balance.productId);
                                  const lineTotal = Number(balance.quantityBaseUnits) * unitPrice;
                                  return (
                                    <span className="inventory-balance-chip" key={balance.productId}>
                                      <span>{balance.productName}:</span>
                                      <strong>
                                        {Number(balance.quantityBaseUnits).toLocaleString('es-GT')} {balance.baseUnitCode}
                                      </strong>
                                      {unitPrice > 0 && (
                                        <span className="chip-price">
                                          · Q{lineTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="muted">Sin existencias registradas</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '1rem', color: 'var(--primary-dark)' }}>
                              Q{totalVal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </td>
                          <td>
                            <span className={`status ${location.active ? 'active' : 'inactive'}`}>
                              {location.active ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                              onClick={() => {
                                setSelectedLocation(location.id);
                                setSelectedProductFilter('ALL');
                              }}
                            >
                              Ver movimientos
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No hay bodegas registradas.</p>
            )}
          </section>

          {/* Inventario en Circulación (Rutas en calle) */}
          <section className="panel section-panel">
            <div className="section-heading" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2>Inventario en circulación (Rutas en calle)</h2>
                <span style={{ fontSize: '0.85rem' }}>
                  {showOnlyStreetActiveRoutes
                    ? 'Producto a bordo de camiones en recorrido activo en la calle'
                    : 'Listado completo de rutas registradas'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={showOnlyStreetActiveRoutes}
                    onChange={e => setShowOnlyStreetActiveRoutes(e.target.checked)}
                    style={{ width: '1rem', minHeight: 'auto', margin: 0 }}
                  />
                  <span>Solo rutas en la calle</span>
                </label>
                <span
                  style={{
                    background: routeLocations.length > 0 ? '#ecfdf3' : '#f2f4f7',
                    color: routeLocations.length > 0 ? 'var(--success)' : 'var(--muted)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                  }}
                >
                  {routeLocations.length} {showOnlyStreetActiveRoutes ? 'en calle' : 'rutas'}
                </span>
              </div>
            </div>

            {routeLocations.length > 0 ? (
              <div className="table-wrap inventory-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Código</th>
                      <th style={{ width: '240px' }}>Ruta de Reparto</th>
                      <th>Existencias a Bordo en Calle</th>
                      <th style={{ textAlign: 'right', width: '170px' }}>Valor en Ruta</th>
                      <th style={{ width: '130px' }}>Estado Operativo</th>
                      <th style={{ textAlign: 'center', width: '150px' }}>Opciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeLocations.map(location => {
                      const totalRouteVal = location.balances.reduce(
                        (acc, b) => acc + Number(b.quantityBaseUnits) * getProductPrice(b.productId),
                        0,
                      );
                      const op = getRouteOperationalStatus(location);
                      return (
                        <tr key={location.id}>
                          <td><strong>{location.code}</strong></td>
                          <td>
                            <strong>{location.name}</strong>
                            <small style={{ display: 'block', color: 'var(--muted)' }}>Inventario de ruta</small>
                          </td>
                          <td>
                            {location.balances.length ? (
                              <div className="inventory-balances-cell">
                                {location.balances.map(balance => {
                                  const unitPrice = getProductPrice(balance.productId);
                                  const lineTotal = Number(balance.quantityBaseUnits) * unitPrice;
                                  return (
                                    <span className="inventory-balance-chip" key={balance.productId}>
                                      <span>{balance.productName}:</span>
                                      <strong>
                                        {Number(balance.quantityBaseUnits).toLocaleString('es-GT')} {balance.baseUnitCode}
                                      </strong>
                                      {unitPrice > 0 && (
                                        <span className="chip-price">
                                          · Q{lineTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="muted">Sin existencias a bordo en este momento</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '1rem', color: '#087a54' }}>
                              Q{totalRouteVal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </td>
                          <td>
                            <span
                              className={`status ${op.isOnStreet ? 'active' : 'inactive'}`}
                              title={`Estado: ${op.label}`}
                            >
                              {op.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                              onClick={() => {
                                setSelectedLocation(location.id);
                                setSelectedProductFilter('ALL');
                              }}
                            >
                              Ver movimientos
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  background: '#f8fafc',
                  borderRadius: '0.75rem',
                  border: '1px dashed var(--line)',
                  marginTop: '0.75rem',
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink)' }}>
                  No hay rutas en circulación en la calle en este momento.
                </p>
                <small style={{ display: 'block', marginTop: '0.35rem' }}>
                  Las rutas ya completaron su liquidación/cierre o aún no han iniciado su jornada diaria de reparto.
                </small>
              </div>
            )}
          </section>

          {/* Libro de movimientos */}
          {selectedLocation && (
            <section className="panel section-panel" style={{ marginTop: '1.25rem' }}>
              <div className="section-heading" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    Libro de movimientos
                    {activeLocationObj && (
                      <span className="badge" style={{ fontSize: '0.85rem', fontWeight: 600, background: '#eff6ff', color: '#1d4ed8' }}>
                        {activeLocationObj.name}
                      </span>
                    )}
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {activeLocationObj?.locationType === 'ROUTE'
                      ? `Kardex oficial de la ruta: ${activeLocationObj.routeName || activeLocationObj.routeCode || activeLocationObj.name}`
                      : 'Historial de entradas y salidas de la bodega física'}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
                  onClick={() => {
                    setSelectedLocation('');
                    setSelectedProductFilter('ALL');
                  }}
                >
                  Cerrar movimientos
                </button>
              </div>

              {/* Filtro por producto */}
              {uniqueProductsInMovements.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)' }}>Filtrar producto:</span>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={selectedProductFilter === 'ALL' ? 'primary' : 'secondary'}
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
                      onClick={() => setSelectedProductFilter('ALL')}
                    >
                      Todos ({movements.data?.length ?? 0})
                    </button>
                    {uniqueProductsInMovements.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={selectedProductFilter === p.id ? 'primary' : 'secondary'}
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
                        onClick={() => setSelectedProductFilter(p.id)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {movements.error && <div className="alert error">{movements.error.message}</div>}

              {filteredMovements.length > 0 ? (
                <>
                  {/* Vista Tarjetas para Móvil (auto-contenida, sin scroll horizontal) */}
                  <div className="movement-cards-list">
                    {filteredMovements.map(item => {
                      const meta = getMovementMeta(item.movementType);
                      const isPositive = Number(item.quantityDelta) >= 0;
                      return (
                        <div key={item.id} className="movement-card">
                          <div className="movement-card-header">
                            <div className="movement-card-type-date">
                              <span className={`status ${meta.badgeClass}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}>
                                {meta.label}
                              </span>
                              <span className="movement-card-date">{formatMovementDateTime(item.createdAt)}</span>
                            </div>
                            <strong className={`movement-card-delta ${isPositive ? 'positive' : 'negative'}`}>
                              {isPositive ? '+' : ''}
                              {Number(item.quantityDelta).toLocaleString('es-GT')}
                            </strong>
                          </div>

                          <div className="movement-card-body">
                            <div className="movement-card-product">
                              <strong>{item.productName}</strong>
                              <span className="movement-card-reason">{item.reason || 'Sin motivo especificado'}</span>
                            </div>
                          </div>

                          <div className="movement-card-footer">
                            <span className="movement-card-actor">
                              Por: <strong>{item.actorUsername || 'Sistema'}</strong>
                            </span>
                            <div className="movement-card-balance">
                              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Saldo: </span>
                              <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                                {Number(item.balanceBefore).toLocaleString('es-GT')} →{' '}
                              </span>
                              <strong style={{ color: 'var(--ink)' }}>{Number(item.balanceAfter).toLocaleString('es-GT')}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Vista Tabla para Desktop */}
                  <div className="table-wrap movement-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha y Hora</th>
                          <th>Producto</th>
                          <th>Tipo y Motivo</th>
                          <th>Responsable</th>
                          <th style={{ textAlign: 'right' }}>Variación</th>
                          <th style={{ textAlign: 'right' }}>Saldo (Antes → Después)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMovements.map(item => {
                          const meta = getMovementMeta(item.movementType);
                          return (
                            <tr key={item.id}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--muted)' }}>
                                {formatMovementDateTime(item.createdAt)}
                              </td>
                              <td><strong>{item.productName}</strong></td>
                              <td>
                                <span className={`status ${meta.badgeClass}`} style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', marginRight: '0.4rem' }}>
                                  {meta.label}
                                </span>
                                <small style={{ display: 'block', color: 'var(--muted)', marginTop: '0.15rem' }}>{item.reason || 'Sin motivo'}</small>
                              </td>
                              <td>{item.actorUsername || 'Sistema'}</td>
                              <td style={{ textAlign: 'right' }}>
                                <strong className={Number(item.quantityDelta) >= 0 ? 'positive' : 'negative'}>
                                  {Number(item.quantityDelta) > 0 ? '+' : ''}
                                  {Number(item.quantityDelta).toLocaleString('es-GT')}
                                </strong>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                                  {Number(item.balanceBefore).toLocaleString('es-GT')} →{' '}
                                </span>
                                <strong>{Number(item.balanceAfter).toLocaleString('es-GT')}</strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ padding: '1rem 0' }}>
                  {selectedProductFilter !== 'ALL'
                    ? 'No hay movimientos para el producto seleccionado.'
                    : 'Aún no hay movimientos registrados para esta ubicación.'}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
