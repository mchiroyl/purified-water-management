import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';

type Route = { id: string; code: string; name: string };
type RouteHistoryDay = {
  loadId: string;
  date: string;
  sellerName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  pointCount: number;
  estimatedDistanceKm: number;
  firstLat: number;
  firstLon: number;
  lastLat: number;
  lastLon: number;
};
type RouteMapPoint = {
  pointType: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  documentNumber: string;
  saleTotal: number;
};
type RouteMapResponse = {
  sellerName: string;
  routeName: string;
  date: string;
  salesCount: number;
  totalAmount: number;
  durationMinutes: number;
  points: RouteMapPoint[];
};

export function RouteHistoryPage() {
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes') });
  const [routeId, setRouteId] = useState<string>('');
  const [period, setPeriod] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  const history = useQuery({
    queryKey: ['route-history', routeId, period, from, to],
    queryFn: () => {
      const fromInstant = new Date(from + 'T00:00:00Z').toISOString();
      const toInstant = new Date(to + 'T00:00:00Z').toISOString();
      return apiRequest<RouteHistoryDay[]>(`/routes/${routeId}/route-history?from=${fromInstant}&to=${toInstant}`);
    },
    enabled: !!routeId && !!from && !!to,
  });

  const [compareDayA, setCompareDayA] = useState<RouteHistoryDay | null>(null);
  const [compareDayB, setCompareDayB] = useState<RouteHistoryDay | null>(null);
  const [mapDay, setMapDay] = useState<RouteHistoryDay | null>(null);

  const routeMapQuery = useQuery({
    queryKey: ['route-map', mapDay?.loadId],
    queryFn: () => apiRequest<RouteMapResponse>(`/loads/${mapDay?.loadId}/route-map`),
    enabled: !!mapDay?.loadId,
  });

  const handleCompareClick = (day: RouteHistoryDay) => {
    if (compareDayA?.loadId === day.loadId) {
      setCompareDayA(null);
    } else if (compareDayB?.loadId === day.loadId) {
      setCompareDayB(null);
    } else if (!compareDayA) {
      setCompareDayA(day);
    } else if (!compareDayB) {
      setCompareDayB(day);
    } else {
      setCompareDayA(day);
      setCompareDayB(null);
    }
  };

  const isSelectedA = (day: RouteHistoryDay) => compareDayA?.loadId === day.loadId;
  const isSelectedB = (day: RouteHistoryDay) => compareDayB?.loadId === day.loadId;

  const handleDateKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.key === 'Enter') return;
    e.preventDefault();
    alert('Por favor, selecciona la fecha utilizando el calendario.');
    try {
      e.currentTarget.showPicker();
    } catch (err) {
      // Ignore if unsupported
    }
  };

  return (
    <main>
      <PageHeader eyebrow="Control y seguimiento" title="Historial Geográfico de Rutas" description="Analice la cobertura física de las rutas, compare el rendimiento geográfico entre días y visualice los recorridos reales." />

      <section className="panel section-panel">
        <form className="form-grid" onSubmit={e => e.preventDefault()}>
          <div className="field">
            <label>Ruta</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)} required>
              <option value="">-- Seleccionar --</option>
              {routes.data?.map(r => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Desde (Fecha)</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} onKeyDown={handleDateKeydown} required />
          </div>
          <div className="field">
            <label>Hasta (Fecha)</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} onKeyDown={handleDateKeydown} required />
          </div>
        </form>
      </section>

      {history.isLoading && <p>Cargando historial...</p>}
      {history.error && <div className="alert error">{(history.error as Error).message}</div>}

      {history.data && history.data.length > 0 && (
        <section className="panel section-panel">
          <div className="section-heading"><h2>Recorridos Liquidados</h2><span>{history.data.length} días</span></div>
          <p className="muted" style={{ marginBottom: '1rem' }}>Seleccione dos días para compararlos, o haga clic en 🗺 para ver el mapa del día.</p>
          <div className="data-list">
            <div className="data-row header-row" style={{ fontWeight: 'bold' }}>
              <span>Comp.</span>
              <span>Fecha</span>
              <span>Vendedor</span>
              <span>Inicio / Fin</span>
              <span>Duración</span>
              <span>Clientes</span>
              <span>Dist. Est.</span>
              <span>Mapa</span>
            </div>
            {history.data.map(day => (
              <div className="data-row" key={day.loadId} style={{ backgroundColor: isSelectedA(day) ? '#e6f7ff' : isSelectedB(day) ? '#f6ffed' : 'transparent' }}>
                <span>
                  <input type="checkbox" checked={isSelectedA(day) || isSelectedB(day)} onChange={() => handleCompareClick(day)} />
                </span>
                <span>{new Date(day.date).toLocaleDateString('es-GT', { timeZone: 'UTC' })}</span>
                <span>{day.sellerName}</span>
                <span>{new Date(day.startTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })} - {new Date(day.endTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{Math.floor(day.durationMinutes / 60)}h {day.durationMinutes % 60}m</span>
                <span>{day.pointCount}</span>
                <span>{Number(day.estimatedDistanceKm).toFixed(1)} km</span>
                <span>
                  <button type="button" className="secondary" onClick={() => setMapDay(day)}>🗺 Ver</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.data && history.data.length === 0 && (
        <p className="muted">No se encontraron recorridos liquidados para esta ruta en el rango de fechas.</p>
      )}

      {compareDayA && compareDayB && (
        <section className="panel section-panel">
          <h2>Comparación Geográfica</h2>
          <table className="data-table" style={{ width: '100%', marginTop: '1rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Indicador</th>
                <th style={{ textAlign: 'right' }}>Día A ({new Date(compareDayA.date).toLocaleDateString('es-GT', { timeZone: 'UTC' })})</th>
                <th style={{ textAlign: 'right' }}>Día B ({new Date(compareDayB.date).toLocaleDateString('es-GT', { timeZone: 'UTC' })})</th>
                <th style={{ textAlign: 'right' }}>Δ (B - A)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Clientes visitados (puntos GPS)</td>
                <td style={{ textAlign: 'right' }}>{compareDayA.pointCount}</td>
                <td style={{ textAlign: 'right' }}>{compareDayB.pointCount}</td>
                <td style={{ textAlign: 'right', color: compareDayB.pointCount >= compareDayA.pointCount ? 'green' : 'red' }}>{compareDayB.pointCount - compareDayA.pointCount >= 0 ? '+' : ''}{compareDayB.pointCount - compareDayA.pointCount}</td>
              </tr>
              <tr>
                <td>Distancia estimada total</td>
                <td style={{ textAlign: 'right' }}>{Number(compareDayA.estimatedDistanceKm).toFixed(1)} km</td>
                <td style={{ textAlign: 'right' }}>{Number(compareDayB.estimatedDistanceKm).toFixed(1)} km</td>
                <td style={{ textAlign: 'right' }}>{(Number(compareDayB.estimatedDistanceKm) - Number(compareDayA.estimatedDistanceKm)).toFixed(1)} km</td>
              </tr>
              <tr>
                <td>Duración del recorrido</td>
                <td style={{ textAlign: 'right' }}>{Math.floor(compareDayA.durationMinutes / 60)}h {compareDayA.durationMinutes % 60}m</td>
                <td style={{ textAlign: 'right' }}>{Math.floor(compareDayB.durationMinutes / 60)}h {compareDayB.durationMinutes % 60}m</td>
                <td style={{ textAlign: 'right' }}>{compareDayB.durationMinutes - compareDayA.durationMinutes > 0 ? '+' : ''}{compareDayB.durationMinutes - compareDayA.durationMinutes} min</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {mapDay && (
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>Mapa de Ruta - {new Date(mapDay.date).toLocaleDateString('es-GT', { timeZone: 'UTC' })}</h2>
            <button type="button" className="secondary" onClick={() => setMapDay(null)}>Cerrar Mapa</button>
          </div>
          
          <div style={{ height: '400px', width: '100%', marginBottom: '1rem', border: '1px solid #ccc' }}>
            <iframe 
              width="100%" 
              height="100%" 
              frameBorder="0" 
              scrolling="no" 
              marginHeight={0} 
              marginWidth={0} 
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(mapDay.firstLon)-0.05}%2C${Number(mapDay.firstLat)-0.05}%2C${Number(mapDay.firstLon)+0.05}%2C${Number(mapDay.firstLat)+0.05}&layer=mapnik&marker=${Number(mapDay.firstLat)}%2C${Number(mapDay.firstLon)}`} 
              style={{ border: '1px solid black' }}
            ></iframe>
          </div>

          {routeMapQuery.isLoading && <p>Cargando ruta completa...</p>}
          {routeMapQuery.error && <p className="alert error">{(routeMapQuery.error as Error).message}</p>}
          
          {routeMapQuery.data && (
            <>
              <p style={{ marginBottom: '1rem' }}>
                <a 
                  href={`https://www.openstreetmap.org/directions?engine=graphhopper_car&route=${routeMapQuery.data.points.map(p => `${Number(p.latitude).toFixed(6)},${Number(p.longitude).toFixed(6)}`).slice(0, 25).join(';')}`}
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="primary button"
                >
                  Abrir ruta completa en OpenStreetMap Directions (máx 25 puntos)
                </a>
              </p>
              
              <h3>Puntos registrados ({routeMapQuery.data.points.length})</h3>
              <div className="data-list" style={{ marginTop: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {routeMapQuery.data.points.map((p, i) => (
                  <div className="data-row" key={i}>
                    <span>{i + 1}. {p.pointType === 'START' ? 'Salida Bodega' : 'Venta'}</span>
                    <span>{new Date(p.capturedAt).toLocaleTimeString('es-GT')}</span>
                    <span>{p.documentNumber || '-'}</span>
                    <span>Precisión: ±{Number(p.accuracyMeters).toFixed(1)}m</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
