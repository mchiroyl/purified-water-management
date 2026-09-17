import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';
import { RouteMapPanel, type RouteMapData } from './RouteMapPanel';

type Route = { id: string; code: string; name: string };
type SellerOption = { id: string; code: string; displayName: string };
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

function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function RouteHistoryPage() {
  const routes = useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes') });
  const sellers = useQuery({ queryKey: ['sellers'], queryFn: () => apiRequest<SellerOption[]>('/routes/sellers') });
  const [routeId, setRouteId] = useState<string>('');
  const [sellerFilter, setSellerFilter] = useState<string>('');
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toLocalDateString(d);
  });
  const [to, setTo] = useState<string>(() => {
    return toLocalDateString(new Date());
  });

  const history = useQuery({
    queryKey: ['route-history', routeId, from, to],
    queryFn: () => {
      const fromInstant = new Date(`${from}T00:00:00`).toISOString();
      const toInstant = new Date(`${to}T23:59:59.999`).toISOString();
      return apiRequest<RouteHistoryDay[]>(`/routes/${routeId}/route-history?from=${fromInstant}&to=${toInstant}`);
    },
    enabled: !!routeId && !!from && !!to,
  });

  const [compareDayA, setCompareDayA] = useState<RouteHistoryDay | null>(null);
  const [compareDayB, setCompareDayB] = useState<RouteHistoryDay | null>(null);
  const [mapDay, setMapDay] = useState<RouteHistoryDay | null>(null);

  const routeMapQuery = useQuery({
    queryKey: ['route-map', mapDay?.loadId],
    queryFn: () => apiRequest<RouteMapData>(`/loads/${mapDay?.loadId}/route-map`),
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

  const setDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const today = new Date();
    const todayStr = toLocalDateString(today);
    if (preset === 'today') {
      setFrom(todayStr);
      setTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = toLocalDateString(y);
      setFrom(yStr);
      setTo(yStr);
    } else if (preset === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setFrom(toLocalDateString(w));
      setTo(todayStr);
    } else if (preset === 'month') {
      const m = new Date();
      m.setDate(m.getDate() - 30);
      setFrom(toLocalDateString(m));
      setTo(todayStr);
    }
  };

  const filteredData = (history.data || []).filter(day =>
    !sellerFilter || day.sellerName.toLowerCase().includes(sellerFilter.toLowerCase())
  );

  return (
    <main>
      <PageHeader eyebrow="Control y seguimiento" title="Historial Geográfico de Rutas" description="Analice la cobertura física de las rutas, compare el rendimiento geográfico entre días y visualice los recorridos reales en el mapa." />

      <section className="panel section-panel">
        <form className="form-grid" onSubmit={e => e.preventDefault()}>
          <div className="field">
            <label>Ruta</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)} required>
              <option value="">-- Seleccionar ruta --</option>
              {routes.data?.map(r => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Filtrar por Vendedor</label>
            <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}>
              <option value="">-- Todos los vendedores --</option>
              {sellers.data?.map(s => <option key={s.id} value={s.displayName}>{s.code} · {s.displayName}</option>)}
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

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: '0.85rem', alignSelf: 'center', marginRight: '0.25rem' }}>Accesos rápidos:</span>
          <button type="button" className="secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }} onClick={() => setDatePreset('today')}>Hoy</button>
          <button type="button" className="secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }} onClick={() => setDatePreset('yesterday')}>Ayer</button>
          <button type="button" className="secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }} onClick={() => setDatePreset('week')}>Últimos 7 días</button>
          <button type="button" className="secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }} onClick={() => setDatePreset('month')}>Últimos 30 días</button>
        </div>
      </section>

      {history.isLoading && <p>Cargando historial...</p>}
      {history.error && <div className="alert error">{(history.error as Error).message}</div>}

      {history.data && filteredData.length > 0 && (
        <section className="panel section-panel">
          <div className="section-heading"><h2>Jornadas de Ruta</h2><span>{filteredData.length} registros</span></div>
          <p className="muted" style={{ marginBottom: '1rem' }}>Seleccione dos días para compararlos, o haga clic en 🗺 para ver el mapa interactivo con paradas cronológicas.</p>
          <div className="data-list">
            <div className="data-row header-row" style={{ fontWeight: 'bold' }}>
              <span>Comp.</span>
              <span>Fecha</span>
              <span>Vendedor</span>
              <span>Inicio / Fin</span>
              <span>Duración</span>
              <span>Puntos GPS</span>
              <span>Dist. Est.</span>
              <span>Mapa</span>
            </div>
            {filteredData.map(day => (
              <div className="data-row" key={day.loadId} style={{ backgroundColor: isSelectedA(day) ? '#e6f7ff' : isSelectedB(day) ? '#f6ffed' : 'transparent' }}>
                <span>
                  <input type="checkbox" checked={isSelectedA(day) || isSelectedB(day)} onChange={() => handleCompareClick(day)} />
                </span>
                <span>{new Date(day.date).toLocaleDateString('es-GT', { timeZone: 'UTC' })}</span>
                <span><strong>{day.sellerName}</strong></span>
                <span>{new Date(day.startTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })} - {new Date(day.endTime).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{Math.floor(day.durationMinutes / 60)}h {day.durationMinutes % 60}m</span>
                <span>{day.pointCount}</span>
                <span>{Number(day.estimatedDistanceKm).toFixed(1)} km</span>
                <span>
                  <button type="button" className="secondary" onClick={() => setMapDay(prev => prev?.loadId === day.loadId ? null : day)}>
                    {mapDay?.loadId === day.loadId ? '✕ Cerrar' : '🗺 Ver mapa'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.data && filteredData.length === 0 && (
        <p className="muted">No se encontraron recorridos para los filtros seleccionados.</p>
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
                <td>Puntos GPS registrados</td>
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
            <h2>🗺 Mapa de Ruta — {new Date(mapDay.date).toLocaleDateString('es-GT', { timeZone: 'UTC' })}</h2>
            <button type="button" className="secondary" onClick={() => setMapDay(null)}>✕ Cerrar Mapa</button>
          </div>
          <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.88rem' }}>
            {mapDay.sellerName} · {Math.floor(mapDay.durationMinutes / 60)}h {mapDay.durationMinutes % 60}m · {Number(mapDay.estimatedDistanceKm).toFixed(1)} km estimados
          </p>

          {routeMapQuery.isLoading && <p>Cargando mapa...</p>}
          {routeMapQuery.error && <p className="alert error">{(routeMapQuery.error as Error).message}</p>}

          {routeMapQuery.data && (
            <RouteMapPanel data={routeMapQuery.data} height="500px" />
          )}
        </section>
      )}
    </main>
  );
}
