import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';
import { localDate, type Route, type Seller, type Vehicle } from './types';

export function RoutesPage({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes') });
  const vehicles = useQuery({ queryKey: ['routes', 'vehicles'], queryFn: () => apiRequest<Vehicle[]>('/routes/vehicles'), enabled: canManage });
  const sellers = useQuery({ queryKey: ['routes', 'sellers'], queryFn: () => apiRequest<Seller[]>('/routes/sellers'), enabled: canManage });
  const [routeForm, setRouteForm] = useState({ code: '', name: '', description: '' });
  const [vehicleForm, setVehicleForm] = useState({ code: '', licensePlate: '', description: '' });
  const [assignments, setAssignments] = useState<Record<string, { sellerId: string; vehicleId: string; validFrom: string }>>({});
  const createRoute = useMutation({
    mutationFn: () => apiRequest<Route>('/routes', { method: 'POST', body: JSON.stringify(routeForm) }),
    onSuccess: () => { setRouteForm({ code: '', name: '', description: '' }); void queryClient.invalidateQueries({ queryKey: ['routes'] }); }
  });
  const createVehicle = useMutation({
    mutationFn: () => apiRequest<Vehicle>('/routes/vehicles', { method: 'POST', body: JSON.stringify(vehicleForm) }),
    onSuccess: () => { setVehicleForm({ code: '', licensePlate: '', description: '' }); void queryClient.invalidateQueries({ queryKey: ['routes', 'vehicles'] }); }
  });
  const assign = useMutation({
    mutationFn: ({ routeId, sellerId, vehicleId, validFrom }: { routeId: string; sellerId: string; vehicleId: string; validFrom: string }) =>
      apiRequest<Route>(`/routes/${routeId}/assignment`, { method: 'POST', body: JSON.stringify({ sellerId, vehicleId: vehicleId || null, validFrom }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['routes'] })
  });
  const routeSubmit = (event: FormEvent) => { event.preventDefault(); createRoute.mutate(); };
  const vehicleSubmit = (event: FormEvent) => { event.preventDefault(); createVehicle.mutate(); };

  return <main>
    <p className="eyebrow">Operación de reparto</p><h1>Rutas y vehículos</h1>
    <p className="muted">La asignación vigente enlaza cada ruta con vendedor y vehículo sin borrar su historial.</p>
    {canManage && <div className="dual-panels">
      <form className="panel form-grid compact-form" onSubmit={routeSubmit}><h2 className="wide">Nueva ruta</h2>
        <label>Código<input required value={routeForm.code} onChange={event => setRouteForm({ ...routeForm, code: event.target.value })} /></label>
        <label>Nombre<input required value={routeForm.name} onChange={event => setRouteForm({ ...routeForm, name: event.target.value })} /></label>
        <label className="wide">Descripción<textarea value={routeForm.description} onChange={event => setRouteForm({ ...routeForm, description: event.target.value })} /></label>
        {createRoute.error && <div className="alert error wide">{createRoute.error.message}</div>}<button className="primary">Crear ruta</button>
      </form>
      <form className="panel form-grid compact-form" onSubmit={vehicleSubmit}><h2 className="wide">Nuevo vehículo</h2>
        <label>Código<input required value={vehicleForm.code} onChange={event => setVehicleForm({ ...vehicleForm, code: event.target.value })} /></label>
        <label>Placa<input value={vehicleForm.licensePlate} onChange={event => setVehicleForm({ ...vehicleForm, licensePlate: event.target.value })} /></label>
        <label className="wide">Descripción<textarea value={vehicleForm.description} onChange={event => setVehicleForm({ ...vehicleForm, description: event.target.value })} /></label>
        {createVehicle.error && <div className="alert error wide">{createVehicle.error.message}</div>}<button className="primary">Crear vehículo</button>
      </form>
    </div>}
    <section className="panel section-panel"><div className="section-heading"><h2>Rutas registradas</h2><span>{routes.data?.length ?? 0} rutas</span></div>
      {routes.error && <div className="alert error">{routes.error.message}</div>}
      <div className="route-grid">{routes.data?.map(route => {
        const selection = assignments[route.id] ?? { sellerId: route.sellerId ?? '', vehicleId: route.vehicleId ?? '', validFrom: localDate() };
        return <article className="route-card" key={route.id}><div className="route-card-title"><div><strong>{route.name}</strong><span>{route.code}</span></div><span className={`status ${route.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{route.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</span></div>
          <p>{route.sellerName ? `${route.sellerName} (${route.sellerCode})` : 'Sin vendedor'}<br />{route.vehicleCode ? `${route.vehicleCode}${route.licensePlate ? ` · ${route.licensePlate}` : ''}` : 'Sin vehículo'}<br />{route.customerCount} clientes</p>
          {canManage && <div className="assignment-form"><select aria-label={`Vendedor de ${route.name}`} value={selection.sellerId} onChange={event => setAssignments({ ...assignments, [route.id]: { ...selection, sellerId: event.target.value } })}><option value="">Seleccionar vendedor</option>{sellers.data?.map(seller => <option value={seller.id} key={seller.id}>{seller.code} · {seller.displayName}</option>)}</select>
            <select aria-label={`Vehículo de ${route.name}`} value={selection.vehicleId} onChange={event => setAssignments({ ...assignments, [route.id]: { ...selection, vehicleId: event.target.value } })}><option value="">Sin vehículo</option>{vehicles.data?.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.code}{vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ''}</option>)}</select>
            <input aria-label={`Vigencia de ${route.name}`} type="date" value={selection.validFrom} onChange={event => setAssignments({ ...assignments, [route.id]: { ...selection, validFrom: event.target.value } })} />
            <button className="secondary" disabled={!selection.sellerId || assign.isPending} onClick={() => assign.mutate({ routeId: route.id, ...selection })}>Guardar asignación</button></div>}
        </article>;
      })}</div>{assign.error && <div className="alert error">{assign.error.message}</div>}
    </section>
  </main>;
}
