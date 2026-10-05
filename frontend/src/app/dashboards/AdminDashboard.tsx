import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Inbox,
  Receipt,
  Warehouse,
  BarChart3,
  TrendingUp,
  Wallet,
  Truck,
  AlertTriangle,
  User,
  RefreshCw,
  Clock,
  CheckCircle2,
  Package,
} from 'lucide-react';
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
  sellerReceivedByUsername?: string; sellerReceivedAt?: string;
  startedByUsername?: string; startedAt?: string;
  createdByUsername: string; createdAt?: string; items: RouteLoadItem[];
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
  const activeOrTodayLoads = loads.filter(l => 
    l.status === 'STARTED' || l.status === 'RECEIVED' || l.status === 'PREPARED' || l.status === 'WAREHOUSE_CONFIRMED'
  );

  const centralWarehouse = locations.find(l => l.locationType === 'WAREHOUSE');
  const routeLocations = locations.filter(l => l.locationType === 'ROUTE');

  const streetStockMap = new Map<string, { productName: string; baseUnitCode: string; totalQty: number }>();
  for (const loc of routeLocations) {
    for (const b of loc.balances || []) {
      const existing = streetStockMap.get(b.productId);
      if (existing) {
        existing.totalQty += Number(b.quantityBaseUnits || 0);
      } else {
        streetStockMap.set(b.productId, {
          productName: b.productName,
          baseUnitCode: b.baseUnitCode,
          totalQty: Number(b.quantityBaseUnits || 0),
        });
      }
    }
  }

  const getProductPrice = (productId: string): number => {
    const prod = products.find(p => p.id === productId);
    if (!prod || !prod.presentations || prod.presentations.length === 0) return 0;
    const presId = prod.presentations[0].id;
    for (const pl of priceLists) {
      if (pl.status === 'ACTIVE') {
        const v = pl.versions?.find(ver => ver.status === 'ACTIVE');
        if (v) {
          const t = v.tiers?.find(tier => tier.presentationId === presId);
          if (t) return Number(t.unitPrice || 0);
        }
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

  const recentSales = sales.slice(0, 5);

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
      <div className="section-heading" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <PageHeader 
          title="Panel Operativo" 
          description={`Monitoreo de operaciones en vivo · ${data?.timezone ?? 'America/Guatemala'}`} 
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <span className="live-indicator">
            <span className="live-dot" aria-hidden="true" />
            En vivo
          </span>
          <button 
            type="button"
            className="secondary" 
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              fontWeight: 500,
              padding: '0.45rem 0.85rem'
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} strokeWidth={2} />
            {isRefreshing ? 'Actualizando…' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* Barra de accesos directos ejecutivos B2B */}
      <div className="quick-actions-bar" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.65rem',
        marginBottom: '1.25rem'
      }}>
        <Link to="/sales" className="quick-action-btn" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0.65rem 0.85rem',
          background: '#0f172a',
          color: '#ffffff',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 600,
          boxShadow: '0 1px 3px rgba(15,23,42,0.1)'
        }}>
          <ShoppingCart size={15} strokeWidth={2} /> Registrar Venta
        </Link>
        <Link to="/loads" className="quick-action-btn" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0.65rem 0.85rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <Inbox size={15} strokeWidth={2} /> Despachar Carga
        </Link>
        <Link to="/settlements" className="quick-action-btn" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0.65rem 0.85rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <Receipt size={15} strokeWidth={2} /> Liquidar Ruta
        </Link>
        <Link to="/inventory" className="quick-action-btn" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0.65rem 0.85rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <Warehouse size={15} strokeWidth={2} /> Ajuste de Bodega
        </Link>
        <Link to="/reports" className="quick-action-btn" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0.65rem 0.85rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <BarChart3 size={15} strokeWidth={2} /> Ver Reportes
        </Link>
      </div>

      {/* Indicadores Clave (KPIs) con Tipografía Tabular y Lucide Icons */}
      <div className="dashboard-kpis" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.5rem'
      }}>
        <article className="kpi-card" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
            <span>Ventas de hoy</span>
            <TrendingUp size={16} strokeWidth={2} style={{ color: '#0284c7' }} />
          </div>
          <strong className="kpi-value" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.35rem 0 0.2rem' }}>
            {money(data.salesToday, data.currencyCode)}
          </strong>
          <div className="kpi-subtext" style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Efec: {money(data.expectedCash)} · Transf: {money(data.transfers)} · Créd: {money(data.credit)}
          </div>
        </article>

        <article className="kpi-card" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
            <span>Efectivo entregado en caja</span>
            <Wallet size={16} strokeWidth={2} style={{ color: '#047857' }} />
          </div>
          <strong className="kpi-value" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.35rem 0 0.2rem' }}>
            {money(data.deliveredCash, data.currencyCode)}
          </strong>
          <div className="kpi-subtext" style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Esperado al cierre: {money(data.expectedCash, data.currencyCode)}
          </div>
        </article>

        <article className="kpi-card" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
            <span>Rutas en operación</span>
            <Truck size={16} strokeWidth={2} style={{ color: '#475569' }} />
          </div>
          <strong className="kpi-value" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.35rem 0 0.2rem' }}>
            {data.activeRoutes}
          </strong>
          <div className="kpi-subtext" style={{ fontSize: '0.74rem', color: '#64748b' }}>
            {data.completedRoutes} rutas finalizadas hoy
          </div>
        </article>

        <article className="kpi-card" style={{
          background: data.monetaryDifferences !== 0 || data.inventoryDifferences !== 0 ? '#fef2f2' : '#ffffff',
          border: `1px solid ${data.monetaryDifferences !== 0 || data.inventoryDifferences !== 0 ? '#fecaca' : '#e2e8f0'}`,
          borderRadius: '0.65rem',
          padding: '1rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
            <span>Diferencias y alertas</span>
            <AlertTriangle size={16} strokeWidth={2} style={{ color: data.monetaryDifferences !== 0 ? '#b91c1c' : '#64748b' }} />
          </div>
          <strong className="kpi-value" style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            color: data.monetaryDifferences !== 0 || data.inventoryDifferences !== 0 ? '#b91c1c' : '#047857',
            fontFeatureSettings: '"tnum"',
            display: 'block',
            margin: '0.35rem 0 0.2rem'
          }}>
            {data.monetaryDifferences !== 0 ? money(data.monetaryDifferences, data.currencyCode) : 'Q0.00'}
          </strong>
          <div className="kpi-subtext" style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Dif. inventario: <strong>{Number(data.inventoryDifferences).toFixed(2)}</strong> · Merma: {Number(data.approvedWasteUnits).toFixed(2)}
          </div>
        </article>
      </div>

      {/* 1. MONITOR DE RUTAS Y VENDEDORES EN VIVO */}
      <section className="panel section-panel" style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        marginBottom: '1.5rem',
        overflow: 'hidden'
      }}>
        <div className="section-heading" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1.15rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={17} strokeWidth={2} style={{ color: '#475569' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                Rutas y Vendedores en Calle
              </h2>
            </div>
          </div>
          <Link to="/loads" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>
            Ver todas las cargas
          </Link>
        </div>

        {activeOrTodayLoads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <p style={{ fontSize: '0.92rem', margin: '0 0 0.5rem' }}>No hay camiones en ruta actualmente.</p>
            <Link to="/loads" className="primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.45rem 1rem', fontSize: '0.82rem', marginTop: '0.35rem' }}>
              Despachar primera carga del día
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1rem',
            padding: '1.15rem'
          }}>
            {activeOrTodayLoads.map(load => {
              const loadStartTime = load.startedAt || load.sellerReceivedAt || load.createdAt;
              const routeSales = sales.filter(s => {
                if (s.routeId !== load.routeId && s.routeCode !== load.routeCode) return false;
                if (loadStartTime) {
                  return new Date(s.createdAt).getTime() >= new Date(loadStartTime).getTime() - 120_000;
                }
                if (load.plannedDate) {
                  return s.createdAt.slice(0, 10) === load.plannedDate || s.createdAt.startsWith(load.plannedDate);
                }
                return true;
              });
              const totalSalesQ = routeSales.reduce((acc, s) => acc + Number(s.total || 0), 0);

              const itemsBreakdown = load.items.map(it => {
                const loaded = Number(it.quantityBaseUnits || 0);
                const soldForProduct = routeSales.reduce((acc, s) => {
                  const matchingItems = s.items?.filter(si =>
                    si.productName?.toLowerCase().trim() === it.productName?.toLowerCase().trim()
                  ) ?? [];
                  return acc + matchingItems.reduce((mAcc, mi) => mAcc + Number(mi.quantityBaseUnits || 0), 0);
                }, 0);
                const sold = Math.min(loaded, soldForProduct);
                const remaining = Math.max(0, loaded - sold);
                return {
                  id: it.id,
                  productName: it.productName,
                  unitLabel: it.baseUnitCode || 'unidades',
                  loaded,
                  sold,
                  remaining
                };
              });

              const totalLoadedUnits = itemsBreakdown.reduce((acc, it) => acc + it.loaded, 0);
              const totalSoldUnits = itemsBreakdown.reduce((acc, it) => acc + it.sold, 0);
              const remainingOnTruck = Math.max(0, totalLoadedUnits - totalSoldUnits);
              const progressPct = totalLoadedUnits > 0 ? Math.min(100, Math.round((totalSoldUnits / totalLoadedUnits) * 100)) : 0;
              const unitSummary = itemsBreakdown.length === 1 ? itemsBreakdown[0].unitLabel : 'unidades';

              const isStarted = load.status === 'STARTED';
              const isReceived = load.status === 'RECEIVED';
              const isPrepared = load.status === 'PREPARED' || load.status === 'WAREHOUSE_CONFIRMED';

              return (
                <article key={load.id} style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.55rem',
                  padding: '1rem',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '1.02rem', color: '#0f172a' }}>
                        {load.routeName || load.routeCode}
                      </strong>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                        <User size={13} strokeWidth={2} />
                        <span>{load.sellerReceivedByUsername || load.createdByUsername || 'Por asignar'} · Carga #{load.loadNumber}</span>
                      </span>
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: isStarted ? '#ecfdf5' : '#f8fafc',
                      color: isStarted ? '#047857' : '#64748b',
                      border: `1px solid ${isStarted ? '#a7f3d0' : '#e2e8f0'}`
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isStarted ? '#10b981' : '#94a3b8'
                      }} />
                      {isStarted ? 'En ruta' : isReceived ? 'Por salir' : isPrepared ? 'En bodega' : load.status}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '0.3rem' }}>
                      <span>Progreso de venta</span>
                      <strong>{progressPct}% ({totalSoldUnits} de {totalLoadedUnits} {unitSummary})</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${progressPct}%`, height: '100%', background: '#0284c7' }} />
                    </div>
                  </div>

                  {itemsBreakdown.length > 1 ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      background: '#f8fafc',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.45rem',
                      fontSize: '0.78rem'
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr',
                        color: '#64748b',
                        fontWeight: 600,
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: '0.25rem'
                      }}>
                        <span>Producto</span>
                        <span style={{ textAlign: 'center' }}>Cargado</span>
                        <span style={{ textAlign: 'center' }}>Vendido</span>
                        <span style={{ textAlign: 'center' }}>En Camión</span>
                      </div>
                      {itemsBreakdown.map(b => (
                        <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center', gap: '0.2rem' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.productName}>
                            {b.productName}
                          </span>
                          <span style={{ textAlign: 'center', color: '#334155' }}>
                            {b.loaded} <small style={{ color: '#64748b', fontSize: '0.7rem' }}>{b.unitLabel}</small>
                          </span>
                          <span style={{ textAlign: 'center', color: '#0284c7', fontWeight: 600 }}>
                            {b.sold}
                          </span>
                          <span style={{ textAlign: 'center', color: b.remaining <= 10 && b.remaining > 0 ? '#b91c1c' : '#047857', fontWeight: 600 }}>
                            {b.remaining}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.5rem',
                      background: '#f8fafc',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.45rem',
                      textAlign: 'center'
                    }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>Cargado</span>
                        <strong style={{ fontSize: '0.95rem', color: '#334155', fontFeatureSettings: '"tnum"' }}>
                          {itemsBreakdown[0]?.loaded ?? 0} {itemsBreakdown[0]?.unitLabel ?? 'unidades'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>Vendido</span>
                        <strong style={{ fontSize: '0.95rem', color: '#0284c7', fontFeatureSettings: '"tnum"' }}>
                          {itemsBreakdown[0]?.sold ?? 0} {itemsBreakdown[0]?.unitLabel ?? 'unidades'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>En Camión</span>
                        <strong style={{ fontSize: '0.95rem', color: (itemsBreakdown[0]?.remaining ?? 0) <= 10 && (itemsBreakdown[0]?.remaining ?? 0) > 0 ? '#b91c1c' : '#047857', fontFeatureSettings: '"tnum"' }}>
                          {itemsBreakdown[0]?.remaining ?? 0} {itemsBreakdown[0]?.unitLabel ?? 'unidades'}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '0.82rem'
                  }}>
                    <span style={{ color: '#64748b' }}>Total vendido:</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a', fontFeatureSettings: '"tnum"' }}>{money(totalSalesQ)}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.1rem' }}>
                    <Link to="/settlements" className="secondary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '0.35rem', fontSize: '0.78rem' }}>
                      Ir a liquidación
                    </Link>
                    <Link to="/loads" className="secondary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '0.35rem', fontSize: '0.78rem' }}>
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
      <section className="panel section-panel" style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        marginBottom: '1.5rem',
        overflow: 'hidden'
      }}>
        <div className="section-heading" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1.15rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Warehouse size={17} strokeWidth={2} style={{ color: '#475569' }} />
            <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
              Existencias: Bodega física vs. Camiones en calle
            </h2>
          </div>
          <Link to="/inventory" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>
            Gestionar inventario
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          padding: '1.15rem'
        }}>
          {/* Tarjeta Bodega Central */}
          <article style={{ border: '1px solid #e2e8f0', borderRadius: '0.55rem', padding: '1rem', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 0.85rem', fontSize: '0.92rem', color: '#0f172a', fontWeight: 700 }}>
              Bodega Central ({centralWarehouse?.name ?? 'GENERAL'})
            </h3>
            {centralBalances.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {centralBalances.map(b => {
                  const uPrice = getProductPrice(b.productId);
                  const lTotal = Number(b.quantityBaseUnits || 0) * uPrice;
                  return (
                    <div key={b.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: '#334155' }}>{b.productName}</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
                          {Number(b.quantityBaseUnits).toLocaleString('es-GT')} {b.baseUnitCode}
                        </strong>
                        {uPrice > 0 && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {money(lTotal, data.currencyCode)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>Valor en bodega:</span>
                  <strong style={{ fontSize: '1rem', color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
                    {money(centralWarehouseValue, data.currencyCode)}
                  </strong>
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Sin existencias registradas en bodega central.</p>
            )}
          </article>

          {/* Tarjeta En Circulación */}
          <article style={{ border: '1px solid #e2e8f0', borderRadius: '0.55rem', padding: '1rem', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 0.85rem', fontSize: '0.92rem', color: '#0f172a', fontWeight: 700 }}>
              En Circulación (Camiones en calle)
            </h3>
            {streetStockMap.size > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {Array.from(streetStockMap.entries()).map(([productId, item]) => {
                  const uPrice = getProductPrice(productId);
                  const lTotal = Number(item.totalQty || 0) * uPrice;
                  return (
                    <div key={productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: '#334155' }}>{item.productName}</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '0.95rem', color: '#047857', fontFeatureSettings: '"tnum"' }}>
                          {Number(item.totalQty).toLocaleString('es-GT')} {item.baseUnitCode}
                        </strong>
                        {uPrice > 0 && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {money(lTotal, data.currencyCode)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>Total en calle:</span>
                  <strong style={{ fontSize: '1rem', color: '#047857', fontFeatureSettings: '"tnum"' }}>
                    {money(streetStockValue, data.currencyCode)}
                  </strong>
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>No hay producto cargado en rutas en este momento.</p>
            )}
          </article>

          {/* Tarjeta Total Empresa */}
          <article style={{ border: '1px solid #e2e8f0', borderRadius: '0.55rem', padding: '1rem', background: '#f8fafc' }}>
            <h3 style={{ margin: '0 0 0.85rem', fontSize: '0.92rem', color: '#0f172a', fontWeight: 700 }}>
              Stock Total de la Empresa
            </h3>
            {allCompanyProductIds.size > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {Array.from(allCompanyProductIds).map(pid => {
                  const inWarehouse = Number(centralBalances.find(b => b.productId === pid)?.quantityBaseUnits || 0);
                  const onStreet = Number(streetStockMap.get(pid)?.totalQty || 0);
                  const totalCompany = inWarehouse + onStreet;
                  const productName = centralBalances.find(b => b.productId === pid)?.productName ?? streetStockMap.get(pid)?.productName ?? 'Producto';
                  const unitCode = centralBalances.find(b => b.productId === pid)?.baseUnitCode ?? streetStockMap.get(pid)?.baseUnitCode ?? 'unidades';
                  const uPrice = getProductPrice(pid);
                  const lTotal = totalCompany * uPrice;
                  return (
                    <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{productName}</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1rem', color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
                          {totalCompany.toLocaleString('es-GT')} {unitCode}
                        </strong>
                        {uPrice > 0 && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {money(lTotal, data.currencyCode)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>Valor comercial global:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
                    {money(companyTotalValue, data.currencyCode)}
                  </strong>
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Calculando existencias globales…</p>
            )}
          </article>
        </div>
      </section>

      {/* 3. VENTAS RECIENTES Y ALERTAS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Ventas Recientes */}
        <section style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1.15rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
              Últimas ventas en calle
            </h2>
            <Link to="/sales/list" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
              Ver todas
            </Link>
          </div>
          {recentSales.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Aún no se registran ventas en la jornada de hoy.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentSales.map(sale => (
                <article key={sale.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.45rem',
                  border: '1px solid #f1f5f9'
                }}>
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: '#0f172a', display: 'block' }}>{sale.customerName}</strong>
                    <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                      {sale.routeName || sale.routeCode} · {sale.sellerName} · {new Date(sale.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '0.15rem' }}>
                      {sale.items.map(it => `${it.presentationQuantity}x ${it.productName}`).join(', ')}
                    </div>
                  </div>
                  <strong style={{ fontSize: '1rem', color: '#047857', fontFeatureSettings: '"tnum"' }}>
                    {money(sale.total)}
                  </strong>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Alertas y Pendientes Operativos */}
        <section style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1.15rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
            Alertas y pendientes de cierre
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <span style={{ padding: '0.3rem 0.65rem', borderRadius: '0.375rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155' }}>
              {data.pendingOfflineOperations} operaciones offline
            </span>
            <span style={{ padding: '0.3rem 0.65rem', borderRadius: '0.375rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155' }}>
              {data.pendingTransfers} transferencias por verificar
            </span>
            <span style={{ padding: '0.3rem 0.65rem', borderRadius: '0.375rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155' }}>
              {data.pendingWastes} mermas reportadas
            </span>
            <span style={{ padding: '0.3rem 0.65rem', borderRadius: '0.375rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155' }}>
              {data.pendingReturns} devoluciones
            </span>
            <span style={{ padding: '0.3rem 0.65rem', borderRadius: '0.375rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155' }}>
              {data.pendingAuthorizations} autorizaciones
            </span>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <h3 style={{ fontSize: '0.85rem', margin: '0 0 0.45rem', color: '#64748b' }}>Estado de auditoría</h3>
            {data.alerts.length === 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.45rem',
                background: '#ecfdf5',
                color: '#047857',
                fontSize: '0.82rem',
                fontWeight: 500
              }}>
                <CheckCircle2 size={16} strokeWidth={2} />
                <span>Todas las operaciones cuadran sin novedades pendientes.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {data.alerts.map(alert => (
                  <article key={alert.code} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '0.45rem',
                    background: alert.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${alert.severity === 'CRITICAL' ? '#fecaca' : '#fde68a'}`,
                    color: alert.severity === 'CRITICAL' ? '#b91c1c' : '#b45309',
                    fontSize: '0.82rem'
                  }}>
                    <strong>{alert.title}</strong>
                    <span style={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>{alert.count}</span>
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
