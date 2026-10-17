import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';
import { calendarOnlyProps, currentMonthDateBounds } from '../../utils/dateInput';
import { localDate, type Route, type Seller, type Vehicle } from './types';
import { RoutePlanTemplatePanel } from './RoutePlanTemplatePanel';
import { ListOrdered, Layers } from 'lucide-react';

export function RoutesPage({ canManage, view = 'create' }: { canManage: boolean; view?: 'create' | 'list' }) {
  const dateBounds = currentMonthDateBounds();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes') });
  const vehicles = useQuery({ queryKey: ['routes', 'vehicles'], queryFn: () => apiRequest<Vehicle[]>('/routes/vehicles'), enabled: canManage });
  const sellers = useQuery({ queryKey: ['routes', 'sellers'], queryFn: () => apiRequest<Seller[]>('/routes/sellers'), enabled: canManage });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => apiRequest<any[]>('/customers'), enabled: canManage });
  const [subTab, setSubTab] = useState<'routes' | 'templates'>('routes');
  const [routeForm, setRouteForm] = useState({ name: '', description: '' });
  const [vehicleForm, setVehicleForm] = useState({ licensePlate: '', description: '' });
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [assigningRoute, setAssigningRoute] = useState<Route | null>(null);
  const [assignForm, setAssignForm] = useState({ sellerId: '', vehicleId: '', validFrom: localDate() });
  const [searchQuery, setSearchQuery] = useState('');
  const createRoute = useMutation({
    mutationFn: () => apiRequest<Route>('/routes', { method: 'POST', body: JSON.stringify(routeForm) }),
    onSuccess: () => { setRouteForm({ name: '', description: '' }); void queryClient.invalidateQueries({ queryKey: ['routes'] }); }
  });
  const createVehicle = useMutation({
    mutationFn: () => apiRequest<Vehicle>('/routes/vehicles', { method: 'POST', body: JSON.stringify(vehicleForm) }),
    onSuccess: () => { setVehicleForm({ licensePlate: '', description: '' }); void queryClient.invalidateQueries({ queryKey: ['routes', 'vehicles'] }); }
  });
  const updateRoute = useMutation({ mutationFn: () => apiRequest<Route>(`/routes/${editingRoute?.id}`, { method: 'PUT', body: JSON.stringify({ name: editingRoute?.name, description: editingRoute?.description }) }), onSuccess: () => { setEditingRoute(null); void queryClient.invalidateQueries({ queryKey: ['routes'] }); } });
  const updateVehicle = useMutation({ mutationFn: () => apiRequest<Vehicle>(`/routes/vehicles/${editingVehicle?.id}`, { method: 'PUT', body: JSON.stringify({ licensePlate: editingVehicle?.licensePlate ?? '', description: editingVehicle?.description ?? '' }) }), onSuccess: () => { setEditingVehicle(null); void queryClient.invalidateQueries({ queryKey: ['routes', 'vehicles'] }); } });
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const assign = useMutation({
    mutationFn: ({ routeId, sellerId, vehicleId, validFrom }: { routeId: string; sellerId: string; vehicleId: string; validFrom: string }) =>
      apiRequest<Route>(`/routes/${routeId}/assignment`, { method: 'POST', body: JSON.stringify({ sellerId, vehicleId: vehicleId || null, validFrom }) }),
    onSuccess: () => {
      setAssigningRoute(null);
      setActionNotice('Asignación guardada exitosamente.');
      void queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
  const unassign = useMutation({
    mutationFn: (routeId: string) => apiRequest<Route>(`/routes/${routeId}/assignment`, { method: 'DELETE' }),
    onSuccess: (_, routeId) => {
      queryClient.setQueryData(['routes'], (old: Route[] | undefined) => {
        if (!old) return old;
        return old.map(r => r.id === routeId ? {
          ...r,
          sellerId: null,
          sellerCode: null,
          sellerName: null,
          vehicleId: null,
          vehicleCode: null,
          licensePlate: null,
          assignmentValidFrom: null
        } : r);
      });
      setActionNotice('Ruta liberada exitosamente. El vendedor y vehículo están disponibles para nueva asignación.');
      void queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
  const routeSubmit = (event: FormEvent) => { event.preventDefault(); createRoute.mutate(); };
  const vehicleSubmit = (event: FormEvent) => { event.preventDefault(); createVehicle.mutate(); };

  // Sort descending: highest / newest route code first down to lowest
  const sortedRoutes = (routes.data ?? []).slice().sort((a, b) => {
    return b.code.localeCompare(a.code, undefined, { numeric: true });
  });

  const filteredRoutes = sortedRoutes.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      (r.sellerName && r.sellerName.toLowerCase().includes(q)) ||
      (r.vehicleCode && r.vehicleCode.toLowerCase().includes(q))
    );
  });

  return <main>
    <PageHeader eyebrow="Operación de reparto" title="Rutas" description="Cree rutas y gestione sus asignaciones." actions={<button type="button" className="secondary" onClick={() => navigate(view === 'create' ? '/routes/list' : '/routes')}>{view === 'create' ? 'Ver rutas registradas' : 'Nueva ruta'}</button>} />
    {canManage && view === 'create' && <div className="dual-panels">
      <form className="panel form-grid compact-form" onSubmit={routeSubmit}><h2 className="wide">Nueva ruta</h2>
        <p className="muted wide">El código de ruta se asigna automáticamente al guardar (RUT-000001).</p>
        <label>Nombre<input required value={routeForm.name} onChange={event => setRouteForm({ ...routeForm, name: event.target.value })} /></label>
        <label className="wide">Descripción<textarea value={routeForm.description} onChange={event => setRouteForm({ ...routeForm, description: event.target.value })} /></label>
        {createRoute.error && <div className="alert error wide">{createRoute.error.message}</div>}<button className="primary">Crear ruta</button>
      </form>
    </div>}
    {view === 'list' && (
      <>
        {canManage && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={subTab === 'routes' ? 'primary' : 'secondary'}
              onClick={() => setSubTab('routes')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: '44px' }}
            >
              <Layers size={16} />
              Rutas y Asignaciones
            </button>
            <button
              type="button"
              className={subTab === 'templates' ? 'primary' : 'secondary'}
              onClick={() => setSubTab('templates')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: '44px' }}
            >
              <ListOrdered size={16} />
              Plantillas y Orden de Recorrido (1..N)
            </button>
          </div>
        )}

        {subTab === 'templates' && canManage ? (
          <RoutePlanTemplatePanel
            routes={sortedRoutes.map(r => ({ id: r.id, code: r.code, name: r.name }))}
            customers={(customers.data ?? []).map((c: any) => ({
              id: c.id,
              code: c.code,
              name: c.name,
              addressReference: c.addressReference || '',
              routeId: c.routeId || null,
            }))}
          />
        ) : (
          <section className="panel section-panel">
            <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Rutas registradas</h2>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {sortedRoutes.length} rutas (de la más reciente a la primera)
                </span>
              </div>
              <div>
                <input
                  type="search"
                  placeholder="Buscar ruta o vendedor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '220px' }}
                />
              </div>
            </div>

            {actionNotice && <div className="alert success" style={{ marginBottom: '1rem', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>{actionNotice}</div>}
            {(routes.error || assign.error || unassign.error) && <div className="alert error">{(routes.error ?? assign.error ?? unassign.error)?.message}</div>}

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>Código</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Nombre de Ruta</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Vendedor Asignado</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Vehículo</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Clientes</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Vigencia</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No se encontraron rutas registradas.
                      </td>
                    </tr>
                  ) : (
                    filteredRoutes.map((route) => {
                      const hasAssignment = Boolean(route.sellerId || route.vehicleId);
                      const isUnassigningThis = unassign.isPending && unassign.variables === route.id;
                      return (
                        <tr key={route.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace', fontFeatureSettings: '"tnum"' }}>
                              {route.code}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <strong style={{ color: '#0f172a' }}>{route.name}</strong>
                            {route.description ? (
                              <div className="muted" style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {route.description}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            {route.sellerName ? (
                              <div>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>{route.sellerName}</span>
                                <span className="muted" style={{ fontSize: '0.75rem', marginLeft: '4px' }}>({route.sellerCode})</span>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Sin vendedor</span>
                            )}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            {route.vehicleCode ? (
                              <span>
                                {route.vehicleCode} {route.licensePlate ? `· ${route.licensePlate}` : ''}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Sin vehículo</span>
                            )}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontFeatureSettings: '"tnum"' }}>
                            <span style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem' }}>
                              {route.customerCount}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {hasAssignment && route.assignmentValidFrom ? (
                              <span style={{ color: route.assignmentValidFrom > localDate() ? '#d97706' : '#0369a1', fontWeight: 500 }}>
                                {route.assignmentValidFrom}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                            <span className={`status ${route.status === 'ACTIVE' ? 'active' : 'inactive'}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                              {route.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              {canManage && (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => setSubTab('templates')}
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '4px', minHeight: '32px' }}
                                  title="Configurar orden de paradas y publicar recorrido"
                                >
                                  <ListOrdered size={13} style={{ color: '#0284c7' }} />
                                  Paradas
                                </button>
                              )}

                              {canManage && (
                                <button
                                  type="button"
                                  className={hasAssignment ? 'secondary' : 'primary'}
                                  onClick={() => {
                                    setAssigningRoute(route);
                                    setAssignForm({
                                      sellerId: route.sellerId || '',
                                      vehicleId: route.vehicleId || '',
                                      validFrom: route.assignmentValidFrom || localDate(),
                                    });
                                  }}
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem', minHeight: '32px' }}
                                >
                                  {hasAssignment ? 'Reasignar' : 'Asignar'}
                                </button>
                              )}

                              {canManage && !hasAssignment && (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => setEditingRoute(route)}
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', minHeight: '32px' }}
                                >
                                  Editar
                                </button>
                              )}

                              {canManage && hasAssignment && (
                                <button
                                  type="button"
                                  className="secondary"
                                  disabled={unassign.isPending}
                                  onClick={() => {
                                    setActionNotice(null);
                                    unassign.mutate(route.id);
                                  }}
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', minHeight: '32px' }}
                                  title="Liberar asignación de esta ruta"
                                >
                                  {isUnassigningThis ? '...' : 'Liberar'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>
    )}

    {/* Assignment Modal */}
    {assigningRoute && (
      <div className="modal-backdrop" role="presentation">
        <form
          className="modal-panel"
          onSubmit={(e) => {
            e.preventDefault();
            assign.mutate({
              routeId: assigningRoute.id,
              sellerId: assignForm.sellerId,
              vehicleId: assignForm.vehicleId,
              validFrom: assignForm.validFrom,
            });
          }}
          aria-modal="true"
          role="dialog"
        >
          <h2>Asignar o Reprogramar Ruta</h2>
          <p className="muted" style={{ margin: '0 0 1rem' }}>
            <strong>{assigningRoute.name}</strong> ({assigningRoute.code})
          </p>

          <label>
            Vendedor asignado *
            <select
              required
              aria-label={`Vendedor de ${assigningRoute.name}`}
              value={assignForm.sellerId}
              onChange={(e) => setAssignForm({ ...assignForm, sellerId: e.target.value })}
            >
              <option value="">Seleccionar vendedor</option>
              {sellers.data?.map((seller) => (
                <option value={seller.id} key={seller.id}>
                  {seller.code} · {seller.displayName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vehículo
            <select
              aria-label={`Vehículo de ${assigningRoute.name}`}
              value={assignForm.vehicleId}
              onChange={(e) => setAssignForm({ ...assignForm, vehicleId: e.target.value })}
            >
              <option value="">Sin vehículo</option>
              {vehicles.data?.map((vehicle) => (
                <option value={vehicle.id} key={vehicle.id}>
                  {vehicle.code}{vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vigencia desde
            <input
              type="date"
              required
              min={dateBounds.min}
              max={dateBounds.max}
              {...calendarOnlyProps()}
              value={assignForm.validFrom}
              onChange={(e) => setAssignForm({ ...assignForm, validFrom: e.target.value })}
            />
          </label>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="secondary" onClick={() => setAssigningRoute(null)}>
              Cancelar
            </button>
            <button className="primary" disabled={!assignForm.sellerId || assign.isPending}>
              {assign.isPending ? 'Guardando...' : 'Guardar asignación'}
            </button>
          </div>
        </form>
      </div>
    )}
    {editingRoute && <div className="modal-backdrop" role="presentation"><form className="modal-panel" onSubmit={event => { event.preventDefault(); updateRoute.mutate(); }} aria-modal="true" role="dialog"><h2>Modificar ruta</h2><p className="muted">{editingRoute.code}. Solo disponible mientras no esté asignada.</p><label>Nombre<input required value={editingRoute.name} onChange={event => setEditingRoute({ ...editingRoute, name: event.target.value })} /></label><label>Descripción<textarea value={editingRoute.description} onChange={event => setEditingRoute({ ...editingRoute, description: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setEditingRoute(null)}>Cancelar</button><button className="primary" disabled={updateRoute.isPending}>Guardar cambios</button></div>{updateRoute.error && <div className="alert error">{updateRoute.error.message}</div>}</form></div>}
    {editingVehicle && <div className="modal-backdrop" role="presentation"><form className="modal-panel" onSubmit={event => { event.preventDefault(); updateVehicle.mutate(); }} aria-modal="true" role="dialog"><h2>Modificar vehículo</h2><p className="muted">{editingVehicle.code}. Solo disponible mientras no esté asignado.</p><label>Placa<input value={editingVehicle.licensePlate ?? ''} onChange={event => setEditingVehicle({ ...editingVehicle, licensePlate: event.target.value.toUpperCase() })} /></label><label>Descripción<textarea value={editingVehicle.description} onChange={event => setEditingVehicle({ ...editingVehicle, description: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setEditingVehicle(null)}>Cancelar</button><button className="primary" disabled={updateVehicle.isPending}>Guardar cambios</button></div>{updateVehicle.error && <div className="alert error">{updateVehicle.error.message}</div>}</form></div>}
  </main>;
}
