import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';
import { calendarOnlyProps, currentMonthDateBounds } from '../../utils/dateInput';
import { localDate, type Route, type Seller, type Vehicle } from './types';

export function RoutesPage({ canManage, view = 'create' }: { canManage: boolean; view?: 'create' | 'list' }) {
  const dateBounds = currentMonthDateBounds();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes') });
  const vehicles = useQuery({ queryKey: ['routes', 'vehicles'], queryFn: () => apiRequest<Vehicle[]>('/routes/vehicles'), enabled: canManage });
  const sellers = useQuery({ queryKey: ['routes', 'sellers'], queryFn: () => apiRequest<Seller[]>('/routes/sellers'), enabled: canManage });
  const [routeForm, setRouteForm] = useState({ name: '', description: '' });
  const [vehicleForm, setVehicleForm] = useState({ licensePlate: '', description: '' });
  const [assignments, setAssignments] = useState<Record<string, { sellerId: string; vehicleId: string; validFrom: string }>>({});
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
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
    onSuccess: (_, variables) => {
      setAssignments(prev => {
        const next = { ...prev };
        delete next[variables.routeId];
        return next;
      });
      setActionNotice('Asignación guardada exitosamente.');
      void queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
  const unassign = useMutation({
    mutationFn: (routeId: string) => apiRequest<Route>(`/routes/${routeId}/assignment`, { method: 'DELETE' }),
    onSuccess: (_, routeId) => {
      setAssignments(prev => {
        const next = { ...prev };
        delete next[routeId];
        return next;
      });
      setActionNotice('Ruta liberada exitosamente. El vendedor y vehículo están disponibles para nueva asignación.');
      void queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });
  const routeSubmit = (event: FormEvent) => { event.preventDefault(); createRoute.mutate(); };
  const vehicleSubmit = (event: FormEvent) => { event.preventDefault(); createVehicle.mutate(); };

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
    {view === 'list' && <section className="panel section-panel"><div className="section-heading"><h2>Rutas registradas</h2><span>{routes.data?.length ?? 0} rutas</span></div>
      {actionNotice && <div className="alert success" style={{ marginBottom: '1rem', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>{actionNotice}</div>}
      {(routes.error || assign.error || unassign.error) && <div className="alert error">{(routes.error ?? assign.error ?? unassign.error)?.message}</div>}
      <div className="route-grid">{routes.data?.map(route => {
        const selection = assignments[route.id] ?? { sellerId: '', vehicleId: '', validFrom: localDate() };
        const hasAssignment = Boolean(route.sellerId || route.vehicleId);
        const canEditRoute = !hasAssignment;
        const isUnassigningThis = unassign.isPending && unassign.variables === route.id;
        const isAssigningThis = assign.isPending && assign.variables?.routeId === route.id;
        return <article className="route-card" key={route.id}><div className="route-card-title"><div><strong>{route.name}</strong><span>{route.code}</span></div><span className={`status ${route.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{route.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</span></div>
          <p>
            <strong>Vendedor:</strong> {route.sellerName ? `${route.sellerName} (${route.sellerCode})` : 'Sin vendedor'}<br />
            <strong>Vehículo:</strong> {route.vehicleCode ? `${route.vehicleCode}${route.licensePlate ? ` · ${route.licensePlate}` : ''}` : 'Sin vehículo'}<br />
            {route.assignmentValidFrom && <><small style={{ color: '#0369a1', fontWeight: 600 }}>{route.assignmentValidFrom > localDate() ? `Programada desde: ${route.assignmentValidFrom}` : `Vigente desde: ${route.assignmentValidFrom}`}</small><br /></>}
            {route.customerCount} clientes
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {canManage && canEditRoute && <button type="button" className="secondary" onClick={() => setEditingRoute(route)}>Modificar ruta</button>}
            {canManage && hasAssignment && (
              <button
                type="button"
                className="secondary"
                disabled={unassign.isPending}
                onClick={() => {
                  setActionNotice(null);
                  setAssignments(prev => {
                    const next = { ...prev };
                    delete next[route.id];
                    return next;
                  });
                  unassign.mutate(route.id);
                }}
                style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}
                title="Libera el vendedor y vehículo de esta ruta inmediatamente"
              >
                {isUnassigningThis ? 'Liberando...' : 'Liberar ruta (Desasignar)'}
              </button>
            )}
          </div>
          {canManage && <div className="assignment-form">
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563' }}>Asignar o reprogramar ruta:</label>
            <select aria-label={`Vendedor de ${route.name}`} value={selection.sellerId} onChange={event => setAssignments({ ...assignments, [route.id]: { ...selection, sellerId: event.target.value } })}><option value="">Seleccionar vendedor</option>{sellers.data?.map(seller => <option value={seller.id} key={seller.id}>{seller.code} · {seller.displayName}</option>)}</select>
            <select aria-label={`Vehículo de ${route.name}`} value={selection.vehicleId} onChange={event => setAssignments({ ...assignments, [route.id]: { ...selection, vehicleId: event.target.value } })}><option value="">Sin vehículo</option>{vehicles.data?.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.code}{vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ''}</option>)}</select>
            <input aria-label={`Vigencia de ${route.name}`} type="date" min={dateBounds.min} max={dateBounds.max} {...calendarOnlyProps()} value={selection.validFrom} onChange={event => setAssignments({ ...assignments, [route.id]: { ...selection, validFrom: event.target.value } })} />
            <button className="primary" disabled={!selection.sellerId || isAssigningThis} onClick={() => { setActionNotice(null); assign.mutate({ routeId: route.id, ...selection }); }}>
              {isAssigningThis ? 'Guardando...' : 'Guardar asignación'}
            </button>
          </div>}
        </article>;
      })}</div>
    </section>}
    {editingRoute && <div className="modal-backdrop" role="presentation"><form className="modal-panel" onSubmit={event => { event.preventDefault(); updateRoute.mutate(); }} aria-modal="true" role="dialog"><h2>Modificar ruta</h2><p className="muted">{editingRoute.code}. Solo disponible mientras no esté asignada.</p><label>Nombre<input required value={editingRoute.name} onChange={event => setEditingRoute({ ...editingRoute, name: event.target.value })} /></label><label>Descripción<textarea value={editingRoute.description} onChange={event => setEditingRoute({ ...editingRoute, description: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setEditingRoute(null)}>Cancelar</button><button className="primary" disabled={updateRoute.isPending}>Guardar cambios</button></div>{updateRoute.error && <div className="alert error">{updateRoute.error.message}</div>}</form></div>}
    {editingVehicle && <div className="modal-backdrop" role="presentation"><form className="modal-panel" onSubmit={event => { event.preventDefault(); updateVehicle.mutate(); }} aria-modal="true" role="dialog"><h2>Modificar vehículo</h2><p className="muted">{editingVehicle.code}. Solo disponible mientras no esté asignado.</p><label>Placa<input value={editingVehicle.licensePlate ?? ''} onChange={event => setEditingVehicle({ ...editingVehicle, licensePlate: event.target.value.toUpperCase() })} /></label><label>Descripción<textarea value={editingVehicle.description} onChange={event => setEditingVehicle({ ...editingVehicle, description: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setEditingVehicle(null)}>Cancelar</button><button className="primary" disabled={updateVehicle.isPending}>Guardar cambios</button></div>{updateVehicle.error && <div className="alert error">{updateVehicle.error.message}</div>}</form></div>}
  </main>;
}
