import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, Fragment, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';
import { calendarOnlyProps, currentMonthDateBounds } from '../../utils/dateInput';
import { captureCurrentLocation } from '../../services/geolocation';
import { RouteMapPanel, type RouteMapData } from '../routes/RouteMapPanel';

type LoadItem = { id: string; productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type Correction = { id: string; productId: string; productName: string; quantityDelta: number; reason: string; actorUsername: string; createdAt: string };
type RouteLoad = { id: string; loadNumber: string; routeId: string; routeCode: string; routeName: string; sourceLocationId: string; sourceLocationName: string; targetLocationId: string; targetLocationName: string; plannedDate: string; loadType: 'INITIAL' | 'REPLENISHMENT'; notes: string; status: string; createdByUsername: string; warehouseConfirmedByUsername?: string; warehouseConfirmedDeviceId?: string; warehouseConfirmedAt?: string; sellerReceivedByUsername?: string; sellerReceivedDeviceId?: string; sellerReceivedAt?: string; startedByUsername?: string; startedDeviceId?: string; startedAt?: string; items: LoadItem[]; corrections: Correction[] };
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
const statusLabel: Record<string, string> = { PREPARED: 'Preparada', WAREHOUSE_CONFIRMED: 'Entregada por bodega', RECEIVED: 'Recibida', STARTED: 'Recorrido iniciado', SETTLED: 'Liquidada' };

type RouteLoadsPageProps = {
  canPrepare: boolean;
  canConfirmWarehouse: boolean;
  canReceive: boolean;
  canStart: boolean;
  canCorrect: boolean;
  view?: 'create' | 'list';
};

export function RouteLoadsPage({
  canPrepare,
  canConfirmWarehouse,
  canReceive,
  canStart,
  canCorrect,
  view = 'create',
}: RouteLoadsPageProps) {
  const dateBounds = currentMonthDateBounds();
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

  const loads = useQuery({ queryKey: ['route-loads'], queryFn: () => apiRequest<RouteLoad[]>('/loads') });
  const company = useQuery({ queryKey: ['company-configuration'], queryFn: () => apiRequest<{ timezone: string }>('/company-configuration') });
  const locations = useQuery({ queryKey: ['inventory', 'locations'], queryFn: () => apiRequest<Location[]>('/inventory/locations'), enabled: canPrepare });
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes'), enabled: canPrepare });
  const products = useQuery({ queryKey: ['products'], queryFn: () => apiRequest<Product[]>('/products'), enabled: canPrepare || canCorrect });
  const [form, setForm] = useState({ routeId: '', sourceLocationId: '', plannedDate: dateInZone(), loadType: 'INITIAL' as 'INITIAL' | 'REPLENISHMENT', notes: '' });
  const [items, setItems] = useState<ItemForm[]>([{ productId: '', quantityBaseUnits: 1 }]);
  const [locationError, setLocationError] = useState('');
  const [locationProgress, setLocationProgress] = useState('');
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [activeLoadId, setActiveLoadId] = useState<string | null>(null);
  const [correctingLoad, setCorrectingLoad] = useState<RouteLoad | null>(null);
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>({ productId: '', quantityDelta: 0, reason: '' });

  const refresh = () => void client.invalidateQueries({ queryKey: ['route-loads'] });
  const [mapLoadId, setMapLoadId] = useState<string | null>(null);
  const routeMapQuery = useQuery({
    queryKey: ['route-map', mapLoadId],
    queryFn: () => apiRequest<RouteMapData>(`/loads/${mapLoadId}/route-map`),
    enabled: !!mapLoadId,
  });

  const create = useMutation({
    mutationFn: () => apiRequest<RouteLoad>(form.loadType === 'REPLENISHMENT' ? '/loads/replenishments' : '/loads', { method: 'POST', body: JSON.stringify({ ...form, items }) }),
    onSuccess: () => {
      setForm({ routeId: '', sourceLocationId: '', plannedDate: dateInZone(company.data?.timezone), loadType: 'INITIAL', notes: '' });
      setItems([{ productId: '', quantityBaseUnits: 1 }]);
      refresh();
      navigate('/loads/list');
    }
  });

  const transition = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: unknown }) => apiRequest<RouteLoad>(`/loads/${id}/${action}`, {
      method: 'POST', body: body === undefined ? undefined : JSON.stringify(body),
    }),
    onSuccess: () => {
      setActiveLoadId(null);
      refresh();
    },
    onError: () => {
      refresh();
    }
  });

  const correct = useMutation({
    mutationFn: ({ id, value }: { id: string; value: CorrectionForm }) => apiRequest<RouteLoad>(`/loads/${id}/corrections`, { method: 'POST', body: JSON.stringify(value) }),
    onSuccess: () => {
      setCorrectingLoad(null);
      setCorrectionForm({ productId: '', quantityDelta: 0, reason: '' });
      refresh();
    }
  });

  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };

  const submitCorrection = (event: FormEvent) => {
    event.preventDefault();
    if (correctingLoad) {
      correct.mutate({ id: correctingLoad.id, value: correctionForm });
    }
  };

  const confirmReceipt = async (load: RouteLoad) => {
    setLocationError('');
    setActiveLoadId(load.id);
    if (load.loadType === 'REPLENISHMENT') {
      transition.mutate({ id: load.id, action: 'receipt', body: {} });
      return;
    }
    setIsCapturingLocation(true);
    setLocationProgress('Buscando GPS…');
    try {
      const location = await captureCurrentLocation('registrar la recepción de la carga', {
        onProgress: (p) => {
          if (p.accuracyMeters !== null) {
            setLocationProgress(p.accuracyMeters <= 10 ? '¡Precisión alcanzada!' : `GPS: ±${Math.round(p.accuracyMeters)}m (buscando ≤10m) [${p.elapsedSeconds}s]`);
          } else {
            setLocationProgress(`Buscando GPS (${p.elapsedSeconds}s)…`);
          }
        },
      });
      setLocationProgress('');
      transition.mutate({ id: load.id, action: 'receipt', body: { location } });
    } catch (error) {
      setLocationProgress('');
      setLocationError(error instanceof Error ? error.message : 'No fue posible obtener la ubicación.');
    } finally {
      setIsCapturingLocation(false);
    }
  };

  useEffect(() => {
    if (company.data?.timezone) setForm(current => ({ ...current, plannedDate: dateInZone(company.data.timezone) }));
  }, [company.data?.timezone]);

  // Si el usuario no puede preparar cargas (ej. vendedor), ve directamente las cargas registradas
  const effectiveView = canPrepare ? view : 'list';

  return (
    <main>
      <PageHeader
        eyebrow="Despacho y reparto"
        title="Cargas de ruta"
        description="Bodega confirma la entrega y el vendedor confirma la recepción desde su propio dispositivo."
        actions={
          canPrepare ? (
            <button
              type="button"
              className="primary"
              onClick={() => navigate(effectiveView === 'create' ? '/loads/list' : '/loads')}
            >
              {effectiveView === 'create' ? 'Ver Cargas registradas' : 'Preparar nueva carga'}
            </button>
          ) : undefined
        }
      />

      {/* ── Vista de Creación: Formulario de Preparar Carga ── */}
      {effectiveView === 'create' && canPrepare && (
        <form className="panel section-panel" onSubmit={submit}>
          <h2>{form.loadType === 'REPLENISHMENT' ? 'Nueva recarga de ruta' : 'Nueva carga inicial'}</h2>
          <p className="muted">
            {form.loadType === 'REPLENISHMENT'
              ? 'Una recarga repone producto al vendedor durante el recorrido (requiere que la ruta ya tenga un recorrido iniciado).'
              : 'Carga inicial con la que el camión o vendedor sale de bodega para iniciar su jornada de reparto.'}
          </p>
          <div className="form-grid compact-form">
            <label>
              Tipo de operación
              <select value={form.loadType} onChange={event => setForm({ ...form, loadType: event.target.value as 'INITIAL' | 'REPLENISHMENT' })}>
                <option value="INITIAL">Carga inicial</option>
                <option value="REPLENISHMENT">Recarga de ruta</option>
              </select>
            </label>
            <label>
              Ruta
              <select required value={form.routeId} onChange={event => setForm({ ...form, routeId: event.target.value })}>
                <option value="">Seleccionar</option>
                {routes.data?.filter(route => route.status === 'ACTIVE').map(route => (
                  <option value={route.id} key={route.id}>{route.code} · {route.name}</option>
                ))}
              </select>
            </label>
            <label>
              Bodega origen
              <select required value={form.sourceLocationId} onChange={event => setForm({ ...form, sourceLocationId: event.target.value })}>
                <option value="">Seleccionar</option>
                {locations.data?.filter(item => item.active && item.locationType === 'WAREHOUSE').map(item => (
                  <option value={item.id} key={item.id}>{item.code} · {item.name}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha planificada
              <input required type="date" min={dateBounds.min} max={dateBounds.max} {...calendarOnlyProps()} value={form.plannedDate} onChange={event => setForm({ ...form, plannedDate: event.target.value })} />
            </label>
            <label>
              Notas
              <input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
            </label>
          </div>
          <h3>Productos en unidades base</h3>
          <div className="data-list">
            {items.map((item, index) => (
              <div className="tier-editor" key={index}>
                <label>
                  Producto
                  <select required value={item.productId} onChange={event => setItems(items.map((row, rowIndex) => rowIndex === index ? { ...row, productId: event.target.value } : row))}>
                    <option value="">Seleccionar</option>
                    {products.data?.filter(product => product.active && product.controlsInventory).map(product => (
                      <option value={product.id} key={product.id}>{product.code} · {product.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad
                  <input required type="number" min="0.0001" step="0.0001" value={item.quantityBaseUnits} onChange={event => setItems(items.map((row, rowIndex) => rowIndex === index ? { ...row, quantityBaseUnits: Number(event.target.value) } : row))} />
                </label>
                {items.length > 1 && (
                  <button type="button" className="secondary" onClick={() => setItems(items.filter((_row, rowIndex) => rowIndex !== index))}>
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setItems([...items, { productId: '', quantityBaseUnits: 1 }])}>
              Agregar producto
            </button>
            <button className="primary" disabled={create.isPending}>
              Preparar carga
            </button>
          </div>
          {create.error && (
            <div className="alert error">
              <div>{create.error.message}</div>
              {create.error.message.includes('La recarga requiere una ruta con recorrido iniciado') && (
                <div style={{ marginTop: '0.45rem', fontSize: '0.88rem', fontWeight: 500, color: '#991b1b' }}>
                  👉 <strong>Solución:</strong> En el campo <strong>&quot;Tipo de operación&quot;</strong>, cambie a <strong>&quot;Carga inicial&quot;</strong>. La &quot;Recarga de ruta&quot; solo se usa cuando el vendedor ya está en ruta y necesita reposición adicional durante el día.
                </div>
              )}
            </div>
          )}
        </form>
      )}

      {/* ── Vista de Lista: Cargas Registradas en Tabla Compacta Profesional ── */}
      {effectiveView === 'list' && (
        <section className="section-panel">
          <div className="section-heading">
            <h2>Cargas registradas</h2>
            <span>{loads.data?.length ?? 0} cargas</span>
          </div>
          {loads.error && <div className="alert error">{loads.error.message}</div>}

          {loads.data && loads.data.length > 0 ? (
            <div className="table-wrap loads-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '170px' }}>No. Carga / Tipo</th>
                    <th style={{ width: '220px' }}>Ruta y Trayecto</th>
                    <th>Productos Cargados</th>
                    <th style={{ width: '240px' }}>Flujo y Auditoría</th>
                    <th style={{ width: '130px' }}>Estado</th>
                    <th style={{ width: '180px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loads.data.map(load => (
                    <Fragment key={load.id}>
                      <tr>
                        <td>
                          <strong>{load.loadNumber}</strong>
                          <small style={{ display: 'block', color: 'var(--muted)', marginTop: '0.2rem' }}>
                            {load.loadType === 'REPLENISHMENT' ? 'Recarga' : 'Carga inicial'} · {load.plannedDate}
                          </small>
                        </td>
                        <td>
                          <strong>{load.routeCode} · {load.routeName}</strong>
                          <small style={{ display: 'block', color: 'var(--muted)', marginTop: '0.2rem' }}>
                            {load.sourceLocationName} → {load.targetLocationName}
                          </small>
                        </td>
                        <td>
                          <div className="inventory-balances-cell">
                            {load.items.map(item => (
                              <span className="inventory-balance-chip" key={item.id}>
                                <span>{item.productName}:</span>
                                <strong>
                                  {Number(item.quantityBaseUnits).toLocaleString('es-GT')} {item.baseUnitCode}
                                </strong>
                              </span>
                            ))}
                          </div>
                          {load.corrections.length > 0 && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#b45309', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {load.corrections.map(c => (
                                <span key={c.id} style={{ background: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                  ⚠️ {c.productName}: {Number(c.quantityDelta) > 0 ? '+' : ''}{Number(c.quantityDelta).toLocaleString('es-GT')} ({c.reason})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                            <span>
                              Entrega: {load.warehouseConfirmedByUsername ?? 'pendiente'} · Recepción: {load.sellerReceivedByUsername ?? 'pendiente'} · Inicio: {load.startedByUsername ?? 'pendiente'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`status ${load.status === 'STARTED' ? 'active' : ''}`}>
                            {statusLabel[load.status] ?? load.status}
                          </span>
                        </td>
                        <td>
                          <div className="loads-actions-cell" style={{ alignItems: 'center' }}>
                            {load.status === 'PREPARED' && canConfirmWarehouse && (
                              <button
                                type="button"
                                className="primary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', width: '100%' }}
                                onClick={() => transition.mutate({ id: load.id, action: 'warehouse-confirmation' })}
                              >
                                Confirmar entrega
                              </button>
                            )}
                            {load.status === 'PREPARED' && !canConfirmWarehouse && (
                              <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
                                ⏳ Espera entrega bodega
                              </span>
                            )}
                            {load.status === 'WAREHOUSE_CONFIRMED' && canReceive && (
                              <button
                                type="button"
                                className="primary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', width: '100%' }}
                                disabled={isCapturingLocation || transition.isPending}
                                onClick={() => void confirmReceipt(load)}
                              >
                                {isCapturingLocation ? (locationProgress || 'Obteniendo GPS…') : 'Confirmar recepción'}
                              </button>
                            )}
                            {load.status === 'RECEIVED' && canStart && load.loadType !== 'REPLENISHMENT' && (
                              <button
                                type="button"
                                className="primary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', width: '100%' }}
                                disabled={transition.isPending && activeLoadId === load.id}
                                onClick={() => {
                                  setLocationError('');
                                  setActiveLoadId(load.id);
                                  transition.mutate({ id: load.id, action: 'start' });
                                }}
                              >
                                {transition.isPending && activeLoadId === load.id ? 'Iniciando…' : 'Iniciar recorrido'}
                              </button>
                            )}
                            {load.status === 'STARTED' && (
                              <button
                                type="button"
                                className="secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', width: '100%' }}
                                onClick={() => setMapLoadId(prev => prev === load.id ? null : load.id)}
                              >
                                🗺 {mapLoadId === load.id ? 'Ocultar mi ruta' : 'Ver mi ruta'}
                              </button>
                            )}
                            {canCorrect && ['RECEIVED', 'STARTED'].includes(load.status) && (
                              <button
                                type="button"
                                className="secondary"
                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', width: '100%', marginTop: '0.2rem' }}
                                onClick={() => {
                                  setCorrectingLoad(load);
                                  setCorrectionForm({ productId: load.items[0]?.productId ?? '', quantityDelta: 0, reason: '' });
                                }}
                              >
                                ✏️ Corrección
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Fila expandible de error para esta carga si aplica */}
                      {activeLoadId === load.id && (locationError || transition.error) && (
                        <tr key={`${load.id}-error`}>
                          <td colSpan={6} style={{ padding: '0.5rem 0.85rem', background: '#fef2f2' }}>
                            <div className="alert error" style={{ margin: 0, fontSize: '0.85rem' }}>
                              <div>❌ <strong>Error:</strong> {locationError || transition.error?.message}</div>
                              {transition.error?.message?.includes('Stock insuficiente') && (
                                <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#991b1b', lineHeight: 1.4 }}>
                                  👉 <strong>Causa:</strong> No hay suficientes existencias en bodega física para despachar esta carga.
                                </div>
                              )}
                              {transition.error?.message?.includes('distinto de quien entregó') && (
                                <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#991b1b', lineHeight: 1.4 }}>
                                  👉 <strong>Doble confirmación obligatoria:</strong> La entrega física fue registrada por <strong>{load.warehouseConfirmedByUsername}</strong>. El vendedor de la ruta debe confirmar la recepción iniciando sesión con su propia cuenta.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Fila expandible de mapa si está seleccionado */}
                      {mapLoadId === load.id && (
                        <tr key={`${load.id}-map`}>
                          <td colSpan={6} style={{ padding: '1rem', background: '#f8fafc' }}>
                            {routeMapQuery.isLoading && <p className="muted">Cargando mapa de ruta…</p>}
                            {routeMapQuery.error && <p className="alert error">{(routeMapQuery.error as Error).message}</p>}
                            {routeMapQuery.data && <RouteMapPanel data={routeMapQuery.data} height="360px" />}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Aún no hay cargas registradas.</p>
          )}

          {!activeLoadId && (locationError || transition.error || correct.error) && (
            <div className="alert error" style={{ marginTop: '1rem' }}>
              <div>{locationError || (transition.error ?? correct.error)?.message}</div>
              {transition.error?.message?.includes('Stock insuficiente') && (
                <div style={{ marginTop: '0.45rem', fontSize: '0.88rem', fontWeight: 500, color: '#991b1b' }}>
                  👉 <strong>Causa:</strong> No hay suficientes existencias en bodega física para despachar esta carga. Bodega debe registrar la producción o ajuste de entrada en el sistema antes de que el camión pueda salir.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Modal de Corrección Compensatoria ── */}
      {correctingLoad && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submitCorrection} aria-modal="true" role="dialog">
            <h2>Corrección compensatoria</h2>
            <p className="muted" style={{ margin: '0 0 1rem' }}>
              Carga <strong>{correctingLoad.loadNumber}</strong> · {correctingLoad.routeCode} ({correctingLoad.routeName})
            </p>
            <div className="form-grid compact-grid">
              <label>
                Producto
                <select
                  required
                  aria-label={`Producto corrección ${correctingLoad.loadNumber}`}
                  value={correctionForm.productId}
                  onChange={e => setCorrectionForm({ ...correctionForm, productId: e.target.value })}
                >
                  <option value="">Seleccionar producto</option>
                  {correctingLoad.items.map(item => (
                    <option value={item.productId} key={item.id}>{item.productName}</option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad delta (+ entrada / − salida)
                <input
                  required
                  aria-label={`Cantidad corrección ${correctingLoad.loadNumber}`}
                  type="number"
                  step="0.0001"
                  value={correctionForm.quantityDelta}
                  onChange={e => setCorrectionForm({ ...correctionForm, quantityDelta: Number(e.target.value) })}
                />
              </label>
              <label className="wide">
                Motivo obligatorio
                <input
                  required
                  aria-label={`Motivo corrección ${correctingLoad.loadNumber}`}
                  placeholder="Motivo obligatorio"
                  value={correctionForm.reason}
                  onChange={e => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                />
              </label>
            </div>
            {correct.error && <div className="alert error" style={{ marginTop: '0.75rem' }}>{correct.error.message}</div>}
            <div className="form-actions" style={{ marginTop: '1.25rem' }}>
              <button type="button" className="secondary" onClick={() => setCorrectingLoad(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                className="primary"
                disabled={correct.isPending || !correctionForm.productId || correctionForm.quantityDelta === 0 || !correctionForm.reason}
              >
                {correct.isPending ? 'Guardando…' : 'Registrar corrección'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
