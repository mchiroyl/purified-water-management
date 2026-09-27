import { Link } from 'react-router-dom';
import type { SessionUser } from '../../features/auth/types';

type DashboardAlert = { code: string; severity: string; title: string; count: number };
type Dashboard = {
  generatedAt: string; timezone: string; currencyCode: string;
  salesToday: number; expectedCash: number; deliveredCash: number; transfers: number; credit: number;
  monetaryDifferences: number; inventoryDifferences: number; approvedWasteUnits: number;
  pendingWastes: number; provisionalCustomers: number; pendingTransfers: number;
  activeRoutes: number; completedRoutes: number; pendingOfflineOperations: number;
  pendingReturns: number; pendingAuthorizations: number; openIncidents: number; alerts: DashboardAlert[];
};

type RouteLoadItem = { id: string; productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type RouteLoad = {
  id: string; loadNumber: string; routeId: string; routeCode: string; routeName: string;
  sourceLocationId: string; sourceLocationName: string; targetLocationId: string; targetLocationName: string;
  plannedDate: string; loadType: 'INITIAL' | 'REPLENISHMENT'; status: string;
  sellerReceivedByUsername?: string; createdByUsername: string; items: RouteLoadItem[];
};

type Balance = { productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type Location = {
  id: string; code: string; name: string; locationType: string; routeId?: string; routeCode?: string; routeName?: string;
  active: boolean; balances: Balance[];
};

interface WarehouseDashboardProps {
  user: SessionUser;
  dashboard: Dashboard;
  loads: RouteLoad[];
  locations: Location[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function WarehouseDashboard({
  user,
  dashboard,
  loads,
  locations,
  isRefreshing,
  onRefresh,
}: WarehouseDashboardProps) {
  const centralWarehouse = locations.find(l => l.locationType === 'WAREHOUSE');
  const balances = centralWarehouse?.balances ?? [];

  // Cargas relevantes para bodega: preparadas, confirmadas, o en curso hoy
  const warehouseLoads = loads.filter(l => 
    l.status === 'PREPARED' || l.status === 'WAREHOUSE_CONFIRMED' || l.status === 'RECEIVED' || l.status === 'STARTED'
  );

  return (
    <div>
      {/* Encabezado Personalizado */}
      <div className="role-hero-header">
        <div className="role-hero-title">
          <h1>¡Hola, {user.displayName || user.username}! 👋</h1>
          <p>Control físico de planta, despachos de camiones y recepciones</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="role-pill">
            <span>🏭</span> Encargado de Bodega
          </span>
          <button 
            className="secondary" 
            onClick={onRefresh} 
            disabled={isRefreshing}
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
          >
            {isRefreshing ? 'Actualizando…' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      {/* Acciones Rápidas de Bodega */}
      <div className="seller-actions-grid">
        <Link to="/inventory" className="seller-action-card primary-action">
          <div className="action-icon">📦</div>
          <span>Ajustes de Inventario</span>
          <small>Entrada, salida y conteo físico</small>
        </Link>
        <Link to="/loads" className="seller-action-card secondary-action">
          <div className="action-icon">🚚</div>
          <span>Despachar Cargas</span>
          <small>Confirmar salida de camiones</small>
        </Link>
        <Link to="/waste" className="seller-action-card secondary-action">
          <div className="action-icon">⚠️</div>
          <span>Registrar Merma</span>
          <small>Envases o producto dañado</small>
        </Link>
        <Link to="/returns" className="seller-action-card secondary-action">
          <div className="action-icon">🔄</div>
          <span>Recepcionar Devolución</span>
          <small>Reingreso de producto de ruta</small>
        </Link>
      </div>

      {/* 1. Existencias Físicas en Bodega Central */}
      <section className="panel section-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="section-heading">
          <div>
            <h2>🏢 Stock Físico en Bodega Central ({centralWarehouse?.name ?? 'GENERAL'})</h2>
            <span style={{ fontSize: '0.9rem' }}>Existencias disponibles en planta para llenado y despacho</span>
          </div>
          <Link to="/inventory" className="secondary" style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            Libro de movimientos
          </Link>
        </div>

        {balances.length > 0 ? (
          <div className="truck-product-grid" style={{ marginTop: '1rem' }}>
            {balances.map(b => (
              <article className="truck-product-card" key={b.productId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>{b.productName}</h4>
                  <span className="status active">En planta</span>
                </div>
                <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'block' }}>Unidades Disponibles</span>
                  <strong style={{ fontSize: '1.8rem', color: 'var(--primary-dark)', display: 'block', marginTop: '0.2rem' }}>
                    {Number(b.quantityBaseUnits).toLocaleString('es-GT')} {b.baseUnitCode}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>
            Sin existencias registradas en la bodega central.
          </p>
        )}
      </section>

      {/* 2. Cargas del Día y Despachos de Camiones */}
      <section className="panel section-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="section-heading">
          <div>
            <h2>🚚 Despachos y Cargas del Día</h2>
            <span style={{ fontSize: '0.9rem' }}>Camiones en preparación, confirmación o en recorrido</span>
          </div>
          <Link to="/loads" className="secondary" style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            Ver todas las cargas
          </Link>
        </div>

        {warehouseLoads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)' }}>
            <p style={{ margin: '0 0 0.5rem' }}>No hay cargas de camiones activas para hoy.</p>
            <Link to="/loads" className="primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.5rem 1.2rem', marginTop: '0.5rem' }}>
              Preparar nueva carga
            </Link>
          </div>
        ) : (
          <div className="data-list" style={{ marginTop: '1rem' }}>
            {warehouseLoads.map(load => {
              const totalUnits = load.items.reduce((acc, it) => acc + Number(it.quantityBaseUnits || 0), 0);
              const isStarted = load.status === 'STARTED';
              const isReceived = load.status === 'RECEIVED';
              const isConfirmed = load.status === 'WAREHOUSE_CONFIRMED';
              const isPrepared = load.status === 'PREPARED';

              return (
                <article className="data-row" key={load.id}>
                  <div>
                    <strong style={{ fontSize: '1.02rem' }}>{load.routeName || load.routeCode}</strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      Carga: <strong>{load.loadNumber}</strong> · Vendedor: {load.sellerReceivedByUsername || 'Por asignar'} · Fecha: {load.plannedDate}
                    </span>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {load.items.map(it => `${it.quantityBaseUnits} ${it.baseUnitCode} de ${it.productName}`).join(', ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`route-badge ${isStarted ? 'active' : isReceived || isConfirmed || isPrepared ? 'prepared' : 'closed'}`} style={{ display: 'inline-block', marginBottom: '0.4rem' }}>
                      {isStarted ? '🟢 En ruta' : isReceived ? '⏱️ Recibido por vendedor' : isConfirmed ? '✅ Salida confirmada' : isPrepared ? '📦 Preparada' : load.status}
                    </span>
                    <strong style={{ display: 'block', fontSize: '1.1rem' }}>
                      {totalUnits} unidades
                    </strong>
                    <Link to="/loads" className="secondary" style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', textDecoration: 'none', display: 'inline-block', marginTop: '0.35rem' }}>
                      Gestionar despacho
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Novedades y Pendientes de Planta */}
      <section className="panel section-panel">
        <h2>⚠️ Novedades y Pendientes de Planta</h2>
        <div className="dashboard-pending" style={{ marginTop: '0.75rem' }}>
          <span className={dashboard.pendingWastes > 0 ? 'status-pill' : ''}>
            {dashboard.pendingWastes} mermas pendientes de autorizar
          </span>
          <span className={dashboard.pendingReturns > 0 ? 'status-pill' : ''}>
            {dashboard.pendingReturns} devoluciones por verificar
          </span>
          <span>
            {dashboard.approvedWasteUnits} unidades de merma aprobadas hoy
          </span>
        </div>
      </section>
    </div>
  );
}
