import { Link } from 'react-router-dom';
import { PageHeader } from '../PageHeader';

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

type ProductPresentation = { id: string; code: string; name: string; active: boolean };
type Product = { id: string; code: string; name: string; presentations?: ProductPresentation[] };
type PriceTier = { id: string; presentationId: string; minimumBaseUnits: number; unitPrice: number };
type PriceVersion = { id: string; status: string; tiers: PriceTier[] };
type PriceList = { id: string; status: string; versions: PriceVersion[] };

function money(value: number, currency = 'GTQ'): string {
  return `${currency === 'GTQ' ? 'Q' : `${currency} `}${Number(value || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface AdminDashboardProps {
  data: Dashboard;
  loads: RouteLoad[];
  locations: Location[];
  sales: Sale[];
  products: Product[];
  priceLists: PriceList[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function AdminDashboard({
  data,
  loads,
  locations,
  sales,
  products,
  priceLists,
  isRefreshing,
  onRefresh,
}: AdminDashboardProps) {
  // Filtrar cargas de hoy o que estén en curso
  const activeOrTodayLoads = loads.filter(l => 
    l.status === 'STARTED' || l.status === 'RECEIVED' || l.status === 'PREPARED' || l.status === 'WAREHOUSE_CONFIRMED'
  );

  // Bodega Central
  const centralWarehouse = locations.find(l => l.locationType === 'WAREHOUSE');
  // Rutas con inventario
  const routeLocations = locations.filter(l => l.locationType === 'ROUTE');

  // Consolidar existencias en calle
  const streetStockMap = new Map<string, { productName: string; baseUnitCode: string; totalQty: number }>();
  for (const loc of routeLocations) {
    for (const b of loc.balances) {
      const current = streetStockMap.get(b.productId) ?? { productName: b.productName, baseUnitCode: b.baseUnitCode, totalQty: 0 };
      current.totalQty += Number(b.quantityBaseUnits || 0);
      streetStockMap.set(b.productId, current);
    }
  }

  // Mapeo de precios estándar (lista general) para valorización de inventario
  const presentationPriceMap = new Map<string, number>();
  const activePriceList = priceLists.find(l => l.status === 'ACTIVE') ?? priceLists[0];
  const activeVersion = activePriceList?.versions?.find(v => v.status === 'ACTIVE') ?? activePriceList?.versions?.[0];
  if (activeVersion?.tiers) {
    for (const t of activeVersion.tiers) {
      if (!presentationPriceMap.has(t.presentationId) || t.minimumBaseUnits <= 1) {
        presentationPriceMap.set(t.presentationId, Number(t.unitPrice));
      }
    }
  }

  const getProductPrice = (productId: string): number => {
    const prod = products.find(p => p.id === productId);
    if (!prod?.presentations) return 0;
    for (const pres of prod.presentations) {
      if (presentationPriceMap.has(pres.id)) {
        return presentationPriceMap.get(pres.id)!;
      }
    }
    return 0;
  };

  const centralBalances = centralWarehouse?.balances ?? [];
  const centralWarehouseValue = centralBalances.reduce((acc, b) => acc + (Number(b.quantityBaseUnits || 0) * getProductPrice(b.productId)), 0);
  const streetStockValue = Array.from(streetStockMap.entries()).reduce((acc, [productId, item]) => {
    return acc + (Number(item.totalQty || 0) * getProductPrice(productId));
  }, 0);
  const companyTotalValue = centralWarehouseValue + streetStockValue;

  const allCompanyProductIds = new Set<string>();
  centralBalances.forEach(b => allCompanyProductIds.add(b.productId));
  streetStockMap.forEach((_, pid) => allCompanyProductIds.add(pid));

  // Últimas 5 ventas del día
  const recentSales = sales.slice(0, 5);

  return (
    <div>
      <div className="section-heading" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <PageHeader 
          eyebrow="Centro de control" 
          title="Panel operativo" 
          description={`Indicadores y monitoreo en vivo para la jornada en ${data?.timezone ?? 'America/Guatemala'}.`} 
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <span className="live-indicator">
            <span className="live-dot" aria-hidden="true" />
            En vivo
          </span>
          <button 
            className="secondary" 
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
          >
            {isRefreshing ? 'Actualizando…' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      {/* Barra de accesos directos ejecutivos */}
      <div className="quick-actions-bar">
        <Link to="/sales" className="quick-action-btn">
          <span>🛒</span> Registrar Venta
        </Link>
        <Link to="/loads" className="quick-action-btn">
          <span>📦</span> Despachar Carga
        </Link>
        <Link to="/settlements" className="quick-action-btn">
          <span>🧾</span> Liquidar Ruta
        </Link>
        <Link to="/inventory" className="quick-action-btn">
          <span>🏢</span> Ajuste de Bodega
        </Link>
        <Link to="/reports" className="quick-action-btn">
          <span>📊</span> Ver Reportes
        </Link>
      </div>

      {/* Indicadores Clave (KPIs) Financieros y de Rutas */}
      <div className="dashboard-kpis">
        <article className="kpi-card">
          <div className="kpi-header">
            <span>Ventas de hoy</span>
            <span className="kpi-icon" aria-hidden="true">💰</span>
          </div>
          <strong className="kpi-value">{money(data.salesToday, data.currencyCode)}</strong>
          <div className="kpi-subtext">
            Efec: {money(data.expectedCash)} · Transf: {money(data.transfers)} · Créd: {money(data.credit)}
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-header">
            <span>Efectivo entregado / en caja</span>
            <span className="kpi-icon" aria-hidden="true">💵</span>
          </div>
          <strong className="kpi-value" style={{ color: '#087a54' }}>{money(data.deliveredCash, data.currencyCode)}</strong>
          <div className="kpi-subtext">
            Esperado al cierre: {money(data.expectedCash, data.currencyCode)}
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-header">
            <span>Rutas en operación</span>
            <span className="kpi-icon" aria-hidden="true">🚚</span>
          </div>
          <strong className="kpi-value">{data.activeRoutes}</strong>
          <div className="kpi-subtext">
            {data.completedRoutes} rutas finalizadas hoy
          </div>
        </article>

        <article className={`kpi-card ${data.monetaryDifferences !== 0 || data.inventoryDifferences !== 0 ? 'kpi-alert' : ''}`}>
          <div className="kpi-header">
            <span>Diferencias y alertas</span>
            <span className="kpi-icon" aria-hidden="true">⚠️</span>
          </div>
          <strong className="kpi-value" style={{ color: data.monetaryDifferences !== 0 || data.inventoryDifferences !== 0 ? '#b23a48' : '#087a54' }}>
            {data.monetaryDifferences !== 0 ? money(data.monetaryDifferences, data.currencyCode) : 'Q0.00'}
          </strong>
          <div className="kpi-subtext">
            Dif. inventario: <strong>{Number(data.inventoryDifferences).toFixed(2)}</strong> · Merma: {Number(data.approvedWasteUnits).toFixed(2)}
          </div>
        </article>
      </div>

      {/* 1. MONITOR DE RUTAS Y VENDEDORES EN VIVO */}
      <section className="panel section-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="section-heading">
          <div>
            <h2>🚚 Rutas y vendedores en calle</h2>
            <span style={{ fontSize: '0.9rem' }}>Supervisión de producto despachado, vendido y disponible a bordo</span>
          </div>
          <Link to="/loads" className="secondary" style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            Ver todas las cargas
          </Link>
        </div>

        {activeOrTodayLoads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)' }}>
            <p style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>No hay camiones en ruta actualmente.</p>
            <Link to="/loads" className="primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.5rem 1.2rem', marginTop: '0.5rem' }}>
              Despachar primera carga del día
            </Link>
          </div>
        ) : (
          <div className="dashboard-routes-grid" style={{ marginTop: '1rem' }}>
            {activeOrTodayLoads.map(load => {
              const totalLoadedUnits = load.items.reduce((acc, it) => acc + Number(it.quantityBaseUnits || 0), 0);
              const firstItem = load.items[0];
              const unitLabel = firstItem?.baseUnitCode ?? 'unidades';

              const routeSales = sales.filter(s => s.routeId === load.routeId || s.routeCode === load.routeCode);
              const totalSalesQ = routeSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
              const totalSoldUnits = routeSales.reduce((acc, s) => {
                return acc + (s.items?.reduce((iAcc, item) => iAcc + Number(item.quantityBaseUnits || 0), 0) || 0);
              }, 0);

              const routeLoc = locations.find(l => l.routeId === load.routeId || (l.locationType === 'ROUTE' && l.name?.includes(load.routeName)));
              const remainingOnTruck = routeLoc?.balances?.reduce((acc, b) => acc + Number(b.quantityBaseUnits || 0), 0) 
                ?? Math.max(0, totalLoadedUnits - totalSoldUnits);

              const progressPct = totalLoadedUnits > 0 ? Math.min(100, Math.round((totalSoldUnits / totalLoadedUnits) * 100)) : 0;

              const isStarted = load.status === 'STARTED';
              const isReceived = load.status === 'RECEIVED';
              const isPrepared = load.status === 'PREPARED' || load.status === 'WAREHOUSE_CONFIRMED';

              return (
                <article className="route-monitor-card" key={load.id}>
                  <div className="route-monitor-header">
                    <div>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
                        {load.routeName || load.routeCode}
                      </strong>
                      <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                        👤 Vendedor: <strong>{load.sellerReceivedByUsername || load.createdByUsername || 'Por asignar'}</strong> · Carga {load.loadNumber}
                      </span>
                    </div>
                    <span className={`route-badge ${isStarted ? 'active' : isReceived ? 'prepared' : isPrepared ? 'prepared' : 'closed'}`}>
                      {isStarted ? '🟢 En ruta' : isReceived ? '⏱️ Por salir' : isPrepared ? '🏭 En bodega' : load.status}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)' }}>
                      <span>Progreso de venta</span>
                      <strong>{progressPct}% vendido ({totalSoldUnits} de {totalLoadedUnits} {unitLabel})</strong>
                    </div>
                    <div className="route-progress-track">
                      <div className="route-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  <div className="route-stats-row">
                    <div className="route-stats-item">
                      <span>Se llevó</span>
                      <strong>{totalLoadedUnits} {unitLabel}</strong>
                    </div>
                    <div className="route-stats-item">
                      <span>Ha vendido</span>
                      <strong style={{ color: '#087a54' }}>{totalSoldUnits} {unitLabel}</strong>
                    </div>
                    <div className="route-stats-item">
                      <span>Le queda</span>
                      <strong style={{ color: remainingOnTruck <= 10 && remainingOnTruck > 0 ? '#b54708' : 'var(--text)' }}>
                        {remainingOnTruck} {unitLabel}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px dashed var(--line)', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Total vendido en ruta:</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--primary-dark)' }}>{money(totalSalesQ)}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <Link to="/settlements" className="secondary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '0.45rem', fontSize: '0.82rem' }}>
                      Ir a liquidación
                    </Link>
                    <Link to="/loads" className="secondary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '0.45rem', fontSize: '0.82rem' }}>
                      Recargar ruta
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. RADIOGRAFÍA DE STOCK: BODEGA VS CAMIONES EN CALLE */}
      <section className="panel section-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="section-heading">
          <div>
            <h2>🏭 Existencias: Bodega física vs. Camiones en calle</h2>
            <span style={{ fontSize: '0.9rem' }}>Distribución de todo el producto de la purificadora en tiempo real</span>
          </div>
          <Link to="/inventory" className="secondary" style={{ textDecoration: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            Gestionar inventario
          </Link>
        </div>

        <div className="stock-comparison-grid" style={{ marginTop: '1rem' }}>
          {/* Tarjeta Bodega Central */}
          <article className="stock-card">
            <h3><span>🏢</span> Bodega Central ({centralWarehouse?.name ?? 'GENERAL'})</h3>
            {centralBalances.length > 0 ? (
              <div>
                {centralBalances.map(b => {
                  const uPrice = getProductPrice(b.productId);
                  const lTotal = Number(b.quantityBaseUnits || 0) * uPrice;
                  return (
                    <div className="stock-item" key={b.productId}>
                      <span>{b.productName}</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.05rem', display: 'block' }}>
                          {Number(b.quantityBaseUnits).toLocaleString('es-GT')} {b.baseUnitCode}
                        </strong>
                        {uPrice > 0 && (
                          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                            {money(lTotal, data.currencyCode)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Valor comercial en bodega:</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--primary-dark)' }}>
                    {money(centralWarehouseValue, data.currencyCode)}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ padding: '0.75rem 0' }}>Sin existencias registradas en bodega central.</p>
            )}
          </article>

          {/* Tarjeta En Circulación / Camiones */}
          <article className="stock-card">
            <h3><span>🚚</span> En Circulación (Camiones en calle)</h3>
            {streetStockMap.size > 0 ? (
              <div>
                {Array.from(streetStockMap.entries()).map(([productId, item]) => {
                  const uPrice = getProductPrice(productId);
                  const lTotal = Number(item.totalQty || 0) * uPrice;
                  return (
                    <div className="stock-item" key={productId}>
                      <span>{item.productName}</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#087a54', display: 'block' }}>
                          {Number(item.totalQty).toLocaleString('es-GT')} {item.baseUnitCode}
                        </strong>
                        {uPrice > 0 && (
                          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                            {money(lTotal, data.currencyCode)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Total potencial en calle:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#087a54' }}>
                    {money(streetStockValue, data.currencyCode)}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ padding: '0.75rem 0' }}>No hay producto cargado en rutas en este momento.</p>
            )}
          </article>

          {/* Tarjeta Total Empresa */}
          <article className="stock-card" style={{ background: '#f8fafc' }}>
            <h3><span>📦</span> Stock Total de la Empresa</h3>
            {allCompanyProductIds.size > 0 ? (
              <div>
                {Array.from(allCompanyProductIds).map(pid => {
                  const inWarehouse = Number(centralBalances.find(b => b.productId === pid)?.quantityBaseUnits || 0);
                  const onStreet = Number(streetStockMap.get(pid)?.totalQty || 0);
                  const totalCompany = inWarehouse + onStreet;
                  const productName = centralBalances.find(b => b.productId === pid)?.productName ?? streetStockMap.get(pid)?.productName ?? 'Producto';
                  const unitCode = centralBalances.find(b => b.productId === pid)?.baseUnitCode ?? streetStockMap.get(pid)?.baseUnitCode ?? 'unidades';
                  const uPrice = getProductPrice(pid);
                  const lTotal = totalCompany * uPrice;
                  return (
                    <div className="stock-item" key={pid}>
                      <span><strong>{productName}</strong></span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.15rem', color: 'var(--primary-dark)', display: 'block' }}>
                          {totalCompany.toLocaleString('es-GT')} {unitCode}
                        </strong>
                        {uPrice > 0 && (
                          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                            {money(lTotal, data.currencyCode)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '2px solid var(--primary-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>Valor global consolidado:</span>
                  <strong style={{ fontSize: '1.18rem', color: 'var(--primary-dark)' }}>
                    {money(companyTotalValue, data.currencyCode)}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ padding: '0.75rem 0' }}>Calculando existencias globales…</p>
            )}
          </article>
        </div>
      </section>

      {/* 3. VENTAS RECIENTES Y ALERTAS */}
      <div className="dual-panels" style={{ marginBottom: '1.5rem' }}>
        {/* Ventas Recientes */}
        <section className="panel section-panel">
          <div className="section-heading">
            <h2>💰 Últimas ventas en calle</h2>
            <Link to="/sales" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>
              Ver todas
            </Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="muted" style={{ padding: '1rem 0' }}>Aún no se registran ventas en la jornada de hoy.</p>
          ) : (
            <div className="data-list" style={{ marginTop: '0.75rem' }}>
              {recentSales.map(sale => (
                <article className="data-row" key={sale.id}>
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>{sale.customerName}</strong>
                    <span style={{ fontSize: '0.8rem' }}>
                      {sale.routeName || sale.routeCode} · 👤 {sale.sellerName} · {new Date(sale.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                      {sale.items.map(it => `${it.presentationQuantity}x ${it.productName}`).join(', ')}
                    </div>
                  </div>
                  <strong style={{ fontSize: '1.1rem', color: '#087a54' }}>
                    {money(sale.total)}
                  </strong>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Alertas y Pendientes Operativos */}
        <section className="panel section-panel">
          <h2>⚠️ Alertas y pendientes de cierre</h2>
          <div className="dashboard-pending" style={{ marginTop: '0.75rem' }}>
            <span className={data.pendingOfflineOperations > 0 ? 'status-pill' : ''}>{data.pendingOfflineOperations} operaciones offline</span>
            <span className={data.pendingTransfers > 0 ? 'status-pill' : ''}>{data.pendingTransfers} transferencias por verificar</span>
            <span className={data.pendingWastes > 0 ? 'status-pill' : ''}>{data.pendingWastes} mermas reportadas</span>
            <span>{data.pendingReturns} devoluciones</span>
            <span>{data.pendingAuthorizations} autorizaciones</span>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem', color: 'var(--muted)' }}>Estado de alertas</h3>
            {data.alerts.length === 0 ? (
              <p className="alert success" style={{ margin: 0, padding: '0.65rem 1rem' }}>✅ Todas las operaciones cuadran sin novedades.</p>
            ) : (
              <div className="dashboard-alerts">
                {data.alerts.map(alert => (
                  <article key={alert.code} className={`alert ${alert.severity === 'CRITICAL' ? 'error' : ''}`}>
                    <strong>{alert.title}</strong>
                    <span>{alert.count}</span>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
