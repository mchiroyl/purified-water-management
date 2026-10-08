import { useState, type FormEvent } from 'react';
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
  const routeLocations = locations.data?.filter(item => item.locationType === 'ROUTE') ?? [];

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
              className="secondary"
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
                              onClick={() => setSelectedLocation(location.id)}
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
          {routeLocations.length > 0 && (
            <section className="panel section-panel">
              <div className="section-heading">
                <div>
                  <h2>Inventario en circulación (Rutas en calle)</h2>
                  <span style={{ fontSize: '0.85rem' }}>Producto a bordo de los camiones de reparto en jornada</span>
                </div>
                <span>{routeLocations.length} rutas</span>
              </div>
              <div className="table-wrap inventory-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Código</th>
                      <th style={{ width: '240px' }}>Ruta de Reparto</th>
                      <th>Existencias a Bordo en Calle</th>
                      <th style={{ textAlign: 'right', width: '170px' }}>Valor en Ruta</th>
                      <th style={{ width: '100px' }}>Estado</th>
                      <th style={{ textAlign: 'center', width: '150px' }}>Opciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeLocations.map(location => {
                      const totalRouteVal = location.balances.reduce(
                        (acc, b) => acc + Number(b.quantityBaseUnits) * getProductPrice(b.productId),
                        0,
                      );
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
                            <span className={`status ${location.active ? 'active' : 'inactive'}`}>
                              {location.active ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                              onClick={() => setSelectedLocation(location.id)}
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
            </section>
          )}

          {/* Libro de movimientos */}
          {selectedLocation && (
            <section className="panel section-panel">
              <div className="section-heading">
                <div>
                  <h2>Libro de movimientos</h2>
                  <span style={{ fontSize: '0.85rem' }}>Historial de entradas y salidas para la ubicación seleccionada</span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.82rem' }}
                  onClick={() => setSelectedLocation('')}
                >
                  Cerrar movimientos
                </button>
              </div>
              {movements.error && <div className="alert error">{movements.error.message}</div>}
              {movements.data && movements.data.length > 0 ? (
                <div className="table-wrap movement-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Tipo y Motivo</th>
                        <th>Responsable</th>
                        <th style={{ textAlign: 'right' }}>Variación</th>
                        <th style={{ textAlign: 'right' }}>Saldo (Antes → Después)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.data.map(item => (
                        <tr key={item.id}>
                          <td><strong>{item.productName}</strong></td>
                          <td>
                            <span>{item.movementType}</span>
                            <small style={{ display: 'block', color: 'var(--muted)' }}>{item.reason || 'Sin motivo especificado'}</small>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">Aún no hay movimientos registrados para esta ubicación.</p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
