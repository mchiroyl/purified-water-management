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

type SaleItem = { id: string; productName: string; presentationQuantity: number; quantityBaseUnits: number; unitPrice: number; lineTotal: number };
type Payment = { id: string; method: string; amount: number; status: string };
type Sale = {
  id: string; documentNumber: string; routeId?: string; routeCode: string; routeName: string;
  sellerName: string; customerName: string; total: number; createdAt: string;
  items: SaleItem[]; payments?: Payment[];
};

function money(value: number, currency = 'GTQ'): string {
  return `${currency === 'GTQ' ? 'Q' : `${currency} `}${Number(value || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface SellerDashboardProps {
  user: SessionUser;
  dashboard: Dashboard;
  loads: RouteLoad[];
  locations: Location[];
  sales: Sale[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function SellerDashboard({
  user,
  dashboard,
  loads,
  locations,
  sales,
  isRefreshing,
  onRefresh,
}: SellerDashboardProps) {
  // Buscar la carga activa del vendedor hoy
  const sellerLoad = loads.find(l => 
    (l.sellerReceivedByUsername === user.username || l.createdByUsername === user.username) &&
    (l.status === 'STARTED' || l.status === 'RECEIVED' || l.status === 'PREPARED' || l.status === 'WAREHOUSE_CONFIRMED')
  ) ?? loads.find(l => l.sellerReceivedByUsername === user.username || l.createdByUsername === user.username);

  // Ventas realizadas por este vendedor
  const sellerSales = sales.filter(s => 
    s.sellerName === user.displayName || 
    s.sellerName === user.username ||
    (sellerLoad && (s.routeId === sellerLoad.routeId || s.routeCode === sellerLoad.routeCode))
  );

  // Total vendido hoy
  const totalSoldUnits = sellerSales.reduce((acc, s) => {
    return acc + (s.items?.reduce((iAcc, item) => iAcc + Number(item.quantityBaseUnits || 0), 0) || 0);
  }, 0);

  // Carga total en unidades
  const totalLoadedUnits = sellerLoad?.items.reduce((acc, it) => acc + Number(it.quantityBaseUnits || 0), 0) || 0;
  const progressPct = totalLoadedUnits > 0 ? Math.min(100, Math.round((totalSoldUnits / totalLoadedUnits) * 100)) : 0;

  // Ubicación de ruta para existencias
  const routeLoc = sellerLoad ? locations.find(l => l.routeId === sellerLoad.routeId || (l.locationType === 'ROUTE' && l.name?.includes(sellerLoad.routeName))) : null;

  // Productos en el camión
  const truckItems = (sellerLoad?.items ?? []).map(item => {
    const soldQty = sellerSales.reduce((acc, s) => {
      const match = s.items?.find(it => it.productName === item.productName || it.id === item.productId);
      return acc + (Number(match?.quantityBaseUnits || 0));
    }, 0);
    const onTruck = routeLoc?.balances?.find(b => b.productId === item.productId)?.quantityBaseUnits 
      ?? Math.max(0, Number(item.quantityBaseUnits || 0) - soldQty);
    return {
      ...item,
      soldQty,
      remainingOnTruck: onTruck
    };
  });

  const remainingTotalUnits = routeLoc?.balances?.reduce((acc, b) => acc + Number(b.quantityBaseUnits || 0), 0)
    ?? Math.max(0, totalLoadedUnits - totalSoldUnits);

  // Efectivo en mano que debe entregar el vendedor
  const cashInHand = Math.max(0, Number(dashboard.expectedCash || 0) - Number(dashboard.deliveredCash || 0));

  return (
    <div>
      {/* Encabezado Personalizado */}
      <div className="role-hero-header">
        <div className="role-hero-title">
          <h1>¡Hola, {user.displayName || user.username}! 👋</h1>
          <p>Cabina de ventas y monitoreo de ruta para la jornada de hoy</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="role-pill">
            <span>🚚</span> Vendedor en Ruta
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

      {/* Acciones Rápidas Táctiles (Botones Grandes de 1 Toque) */}
      <div className="seller-actions-grid">
        <Link to="/sales" className="seller-action-card primary-action">
          <div className="action-icon">⚡</div>
          <span>Nueva Venta</span>
          <small>Venta, abonos y envases</small>
        </Link>
        <Link to="/customers" className="seller-action-card secondary-action">
          <div className="action-icon">👥</div>
          <span>Mis Clientes</span>
          <small>Directorio y altas en ruta</small>
        </Link>
        <Link to="/loads" className="seller-action-card secondary-action">
          <div className="action-icon">📦</div>
          <span>Mi Carga</span>
          <small>Existencias en camión</small>
        </Link>
        <Link to="/settlements" className="seller-action-card secondary-action">
          <div className="action-icon">💵</div>
          <span>Liquidación</span>
          <small>Cierre de turno y ventas</small>
        </Link>
      </div>

      {/* 1. Mi Camión y Carga Asignada */}
      <section className="panel section-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="section-heading">
          <div>
            <h2>🚚 Mi Camión y Existencias a Bordo</h2>
            <span style={{ fontSize: '0.9rem' }}>
              {sellerLoad ? `${sellerLoad.routeName || sellerLoad.routeCode} · Carga ${sellerLoad.loadNumber}` : 'Sin carga activa detectada'}
            </span>
          </div>
          {sellerLoad && (
            <span className={`route-badge ${sellerLoad.status === 'STARTED' ? 'active' : 'prepared'}`}>
              {sellerLoad.status === 'STARTED' ? '🟢 En ruta' : sellerLoad.status}
            </span>
          )}
        </div>

        {sellerLoad ? (
          <div style={{ marginTop: '1rem' }}>
            {/* Barra de progreso de ventas */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                <span>Progreso de venta de la carga</span>
                <strong>{progressPct}% vendido ({totalSoldUnits} de {totalLoadedUnits} unidades)</strong>
              </div>
              <div className="route-progress-track" style={{ height: '10px' }}>
                <div className="route-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {/* Tarjetas de Producto en Camión */}
            <div className="truck-product-grid">
              {truckItems.map(item => {
                const isLow = item.remainingOnTruck <= 10 && item.remainingOnTruck > 0;
                return (
                  <article className="truck-product-card" key={item.id}>
                    <h4>{item.productName}</h4>
                    <div className="truck-numbers">
                      <div className="truck-number-col">
                        <span>Cargado</span>
                        <strong>{item.quantityBaseUnits}</strong>
                      </div>
                      <div className="truck-number-col">
                        <span>Vendido</span>
                        <strong style={{ color: '#087a54' }}>{item.soldQty}</strong>
                      </div>
                      <div className="truck-number-col">
                        <span>En Camión</span>
                        <strong style={{ color: isLow ? '#b54708' : '#047857', fontSize: '1.3rem' }}>
                          {item.remainingOnTruck}
                        </strong>
                      </div>
                    </div>
                    {isLow && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b54708', fontWeight: 600, background: '#fef3f2', padding: '0.25rem 0.5rem', borderRadius: '0.4rem', textAlign: 'center' }}>
                        ⚠️ Poco stock · Solicitar recarga en ruta
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.65rem' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Total restante a bordo:</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
                {remainingTotalUnits} unidades
              </strong>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
            <p style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>No tienes una carga iniciada hoy en tu usuario.</p>
            <Link to="/loads" className="primary" style={{ textDecoration: 'none', display: 'inline-block', padding: '0.55rem 1.3rem' }}>
              Ir a Cargas de Ruta
            </Link>
          </div>
        )}
      </section>

      {/* 2. Mi Arqueo de Dinero en Mano */}
      <section className="panel section-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="section-heading">
          <div>
            <h2>💵 Mi Arqueo de Dinero de Hoy</h2>
            <span style={{ fontSize: '0.9rem' }}>Efectivo y cobros acumulados para entrega en liquidación</span>
          </div>
        </div>

        <div className="dashboard-kpis" style={{ marginTop: '1rem' }}>
          <article className="kpi-card cash-hand-card">
            <div className="kpi-header">
              <span>Efectivo en mano (A entregar)</span>
              <span className="kpi-icon" aria-hidden="true">💵</span>
            </div>
            <strong className="kpi-value" style={{ color: '#047857' }}>
              {money(cashInHand, dashboard.currencyCode)}
            </strong>
            <div className="kpi-subtext">
              Total físico a rendir en caja central
            </div>
          </article>

          <article className="kpi-card">
            <div className="kpi-header">
              <span>Total vendido hoy</span>
              <span className="kpi-icon" aria-hidden="true">💰</span>
            </div>
            <strong className="kpi-value">
              {money(dashboard.salesToday, dashboard.currencyCode)}
            </strong>
            <div className="kpi-subtext">
              Ventas acumuladas de mi ruta
            </div>
          </article>

          <article className="kpi-card">
            <div className="kpi-header">
              <span>Transferencias recibidas</span>
              <span className="kpi-icon" aria-hidden="true">📲</span>
            </div>
            <strong className="kpi-value">
              {money(dashboard.transfers, dashboard.currencyCode)}
            </strong>
            <div className="kpi-subtext">
              Verificadas o pendientes por banco
            </div>
          </article>

          <article className="kpi-card">
            <div className="kpi-header">
              <span>Ventas al crédito</span>
              <span className="kpi-icon" aria-hidden="true">📝</span>
            </div>
            <strong className="kpi-value">
              {money(dashboard.credit, dashboard.currencyCode)}
            </strong>
            <div className="kpi-subtext">
              Clientes con línea de crédito
            </div>
          </article>
        </div>
      </section>

      {/* 3. Mis Ventas Registradas Hoy */}
      <section className="panel section-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="section-heading">
          <div>
            <h2>📋 Mis Ventas Registradas Hoy</h2>
            <span style={{ fontSize: '0.9rem' }}>{sellerSales.length} ventas confirmadas en tu jornada</span>
          </div>
          <Link to="/sales" className="secondary" style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            Ir a Ventas
          </Link>
        </div>

        {sellerSales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)' }}>
            <p style={{ margin: '0 0 0.5rem' }}>Aún no has registrado ventas en esta jornada.</p>
            <Link to="/sales" className="primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.5rem 1.2rem', marginTop: '0.5rem' }}>
              Registrar primera venta
            </Link>
          </div>
        ) : (
          <div className="data-list" style={{ marginTop: '0.75rem' }}>
            {sellerSales.slice(0, 10).map(sale => (
              <article className="data-row" key={sale.id}>
                <div>
                  <strong style={{ fontSize: '0.98rem' }}>{sale.customerName}</strong>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                    Doc: <strong>{sale.documentNumber}</strong> · Hora: {new Date(sale.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                    {sale.items.map(it => `${it.quantityBaseUnits}x ${it.productName}`).join(', ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '1.15rem', color: '#087a54', display: 'block' }}>
                    {money(sale.total)}
                  </strong>
                  <Link to="/sales" className="secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', textDecoration: 'none', marginTop: '0.25rem', display: 'inline-block' }}>
                    Ver recibo
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
