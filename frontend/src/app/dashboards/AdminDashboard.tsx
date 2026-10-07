import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Wallet,
  Receipt,
  CreditCard,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Truck,
  Warehouse,
  User,
  RefreshCw,
  CheckCircle2,
  FileText,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '../PageHeader';
import { SalesRankingChart, DebtorChart, LoanedGarrafonsChart } from './GerentialCharts';
import type { ChartSale, RouteBalance } from './GerentialCharts';

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

export type SettlementItem = {
  id: string;
  productName: string;
  loadedUnits?: number;
  soldUnits?: number;
  physicalDifference?: number;
};

export type Settlement = {
  id: string;
  routeLoadId: string;
  loadNumber: number | string;
  routeId?: string;
  routeCode: string;
  routeName: string;
  sellerName?: string;
  status: string;
  salesTotal?: number;
  salesCash?: number;
  expectedCash?: number;
  deliveredCash?: number;
  monetaryDifference?: number;
  physicalDifferenceTotal?: number;
  items?: SettlementItem[];
};

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
  settlements?: Settlement[];
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
  settlements = [],
  isRefreshing,
  onRefresh,
}: AdminDashboardProps) {
  // 1. Catálogo de precios para valorización de inventarios
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

  // 2. Inventario valorizado: Bodega vs Calle
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

  const centralBalances = centralWarehouse?.balances ?? [];
  const centralWarehouseValue = centralBalances.reduce((acc, b) => acc + (Number(b.quantityBaseUnits || 0) * getProductPrice(b.productId)), 0);
  const streetStockValue = Array.from(streetStockMap.entries()).reduce((acc, [productId, item]) => {
    return acc + (Number(item.totalQty || 0) * getProductPrice(productId));
  }, 0);
  const companyTotalValue = centralWarehouseValue + streetStockValue;

  const allCompanyProductIds = new Set<string>();
  centralBalances.forEach(b => allCompanyProductIds.add(b.productId));
  streetStockMap.forEach((_, pid) => allCompanyProductIds.add(pid));

  // 3. Ventas de hoy
  const todaySales = sales.filter(s => {
    if (!s.createdAt) return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    return s.createdAt.slice(0, 10) === todayStr;
  });
  const todaySalesCount = todaySales.length || sales.length;
  const avgTicket = todaySalesCount > 0 ? (data.salesToday / todaySalesCount) : 0;

  // 4. Auditoría de Liquidaciones y Descuadres (Identificación de responsables)
  const safeSettlements = Array.isArray(settlements) ? settlements : [];
  const problematicSettlements = useMemo(() => {
    return safeSettlements.filter(s => {
      const monDiff = Number(s.monetaryDifference || 0);
      const physDiff = Number(s.physicalDifferenceTotal || 0);
      return Math.abs(monDiff) > 0.01 || Math.abs(physDiff) > 0.01;
    });
  }, [safeSettlements]);

  // Rutas activas o del día
  const activeOrTodayLoads = loads.filter(l => 
    l.status === 'STARTED' || l.status === 'RECEIVED' || l.status === 'PREPARED' || l.status === 'WAREHOUSE_CONFIRMED'
  );

  // 5. Métricas de efectividad de recaudación
  const cashRecPct = data.expectedCash > 0 ? Math.min(100, Math.round((data.deliveredCash / data.expectedCash) * 100)) : 100;
  const creditPct = data.salesToday > 0 ? Math.round((data.credit / data.salesToday) * 100) : 0;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Encabezado Gerencial */}
      <div className="section-heading" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <PageHeader 
            title="Panel Operativo y Gerencial" 
            description={`Control Contable, Tesorería, Cartera y Rentabilidad de Operaciones · ${data?.timezone ?? 'America/Guatemala'}`} 
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <span className="live-indicator" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
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
              gap: '0.45rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem'
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} strokeWidth={2.5} />
            {isRefreshing ? 'Actualizando…' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* 1. BARRA DE ACCESOS DIRECTOS GERENCIALES (NO BOTONES DE CHOFER) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <Link to="/settlements" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.75rem 1rem',
          background: '#0f172a',
          color: '#ffffff',
          borderRadius: '0.55rem',
          textDecoration: 'none',
          fontSize: '0.84rem',
          fontWeight: 600,
          boxShadow: '0 2px 4px rgba(15,23,42,0.1)'
        }}>
          <Receipt size={17} strokeWidth={2} style={{ color: '#38bdf8' }} />
          <div>
            <div style={{ lineHeight: 1.2 }}>Arqueo de Liquidaciones</div>
            <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Conciliación de caja y faltantes</small>
          </div>
        </Link>

        <Link to="/credit" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.75rem 1rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.55rem',
          textDecoration: 'none',
          fontSize: '0.84rem',
          fontWeight: 600,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <CreditCard size={17} strokeWidth={2} style={{ color: '#0284c7' }} />
          <div>
            <div style={{ lineHeight: 1.2 }}>Cartera y Créditos (CxC)</div>
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Estados de cuenta y cobranzas</small>
          </div>
        </Link>

        <Link to="/reports" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.75rem 1rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.55rem',
          textDecoration: 'none',
          fontSize: '0.84rem',
          fontWeight: 600,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <BarChart3 size={17} strokeWidth={2} style={{ color: '#059669' }} />
          <div>
            <div style={{ lineHeight: 1.2 }}>Reportes Oficiales</div>
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Ventas, mermas y auditoría</small>
          </div>
        </Link>

        <Link to="/inventory" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.75rem 1rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.55rem',
          textDecoration: 'none',
          fontSize: '0.84rem',
          fontWeight: 600,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <Warehouse size={17} strokeWidth={2} style={{ color: '#d97706' }} />
          <div>
            <div style={{ lineHeight: 1.2 }}>Valoración de Bodega</div>
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Kardex y activos circulantes</small>
          </div>
        </Link>
      </div>

      {/* 2. FLUJO DE FONDOS Y TESORERÍA (4 KPIS FINANCIEROS DE LA JORNADA) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.5rem'
      }}>
        {/* Facturación Bruta */}
        <article style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Facturación de la Jornada</span>
            <TrendingUp size={16} strokeWidth={2.5} style={{ color: '#0284c7' }} />
          </div>
          <strong style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.35rem 0 0.2rem' }}>
            {money(data.salesToday, data.currencyCode)}
          </strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>{todaySalesCount} transacciones emitidas</span>
            <span>Prom: <strong>{money(avgTicket)}</strong></span>
          </div>
        </article>

        {/* Efectivo en Bóveda / Caja */}
        <article style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Efectivo Entregado en Caja</span>
            <Wallet size={16} strokeWidth={2.5} style={{ color: '#047857' }} />
          </div>
          <strong style={{ fontSize: '1.7rem', fontWeight: 800, color: '#047857', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.35rem 0 0.2rem' }}>
            {money(data.deliveredCash, data.currencyCode)}
          </strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>Esperado: <strong>{money(data.expectedCash)}</strong></span>
            <span style={{ color: cashRecPct >= 95 ? '#047857' : '#b45309', fontWeight: 700 }}>{cashRecPct}% recaudado</span>
          </div>
        </article>

        {/* Bancos y Transferencias */}
        <article style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Bancos y Transferencias</span>
            <DollarSign size={16} strokeWidth={2.5} style={{ color: '#0284c7' }} />
          </div>
          <strong style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.35rem 0 0.2rem' }}>
            {money(data.transfers, data.currencyCode)}
          </strong>
          <div style={{ fontSize: '0.75rem', color: data.pendingTransfers > 0 ? '#b91c1c' : '#047857', fontWeight: 600 }}>
            {data.pendingTransfers > 0
              ? `⚠️ ${data.pendingTransfers} transferencias pendientes de verificación`
              : '✅ 100% de transferencias conciliadas en banco'}
          </div>
        </article>

        {/* Cartera Otorgada al Crédito */}
        <article style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Crédito Otorgado (CxC Hoy)</span>
            <CreditCard size={16} strokeWidth={2.5} style={{ color: '#6366f1' }} />
          </div>
          <strong style={{ fontSize: '1.7rem', fontWeight: 800, color: '#6366f1', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.35rem 0 0.2rem' }}>
            {money(data.credit, data.currencyCode)}
          </strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>{creditPct}% de colocación sobre ventas</span>
            <Link to="/credit" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Ver cartera →</Link>
          </div>
        </article>

        {/* Rutas en Operación */}
        <article style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Rutas en Operación</span>
            <Truck size={16} strokeWidth={2.5} style={{ color: '#475569' }} />
          </div>
          <strong style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', fontFeatureSettings: '"tnum"', display: 'block', margin: '0.35rem 0 0.2rem' }}>
            {data.activeRoutes}
          </strong>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>{data.completedRoutes} rutas finalizadas hoy</span>
            <Link to="/loads" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>Ver cargas →</Link>
          </div>
        </article>
      </div>

      {/* 3. CONTROL ÉTICO, AUDITORÍA Y SEMÁFORO DE DESCUADRES */}
      <section style={{
        background: '#ffffff',
        border: data.monetaryDifferences !== 0 || data.inventoryDifferences !== 0 ? '1px solid #fca5a5' : '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        marginBottom: '1.5rem',
        overflow: 'hidden',
        boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.9rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: data.monetaryDifferences !== 0 || data.inventoryDifferences !== 0 ? '#fef2f2' : '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            {data.monetaryDifferences !== 0 || data.inventoryDifferences !== 0 ? (
              <ShieldAlert size={19} color="#b91c1c" strokeWidth={2.5} />
            ) : (
              <ShieldCheck size={19} color="#059669" strokeWidth={2.5} />
            )}
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: data.monetaryDifferences !== 0 ? '#b91c1c' : '#0f172a' }}>
              Control Ético, Auditoría y Transparencia Financiera
            </h2>
          </div>
          <Link to="/settlements" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
            Ver liquidaciones detalladas
          </Link>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* Alerta de faltante monetario */}
          {data.monetaryDifferences !== 0 || problematicSettlements.length > 0 ? (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.55rem',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.92rem' }}>
                  <AlertTriangle size={17} />
                  <span>ALERTA DE AUDITORÍA: Descuadres de dinero detectados en liquidaciones</span>
                </div>
                <strong style={{ fontSize: '1.15rem', color: '#b91c1c' }}>
                  Diferencia Neta: {money(data.monetaryDifferences, data.currencyCode)}
                </strong>
              </div>

              {/* Lista de rutas/vendedores con faltantes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.25rem' }}>
                {problematicSettlements.length > 0 ? (
                  problematicSettlements.map(st => (
                    <div key={st.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #fee2e2',
                      padding: '0.55rem 0.85rem',
                      borderRadius: '0.45rem',
                      fontSize: '0.82rem'
                    }}>
                      <div>
                        <strong style={{ color: '#0f172a' }}>{st.routeName || st.routeCode}</strong>
                        <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>
                          Responsable: <strong>{st.sellerName || 'Vendedor'}</strong> · Carga #{st.loadNumber}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 800,
                          color: (st.monetaryDifference ?? 0) < 0 ? '#b91c1c' : '#047857',
                          marginRight: '0.65rem'
                        }}>
                          {(st.monetaryDifference ?? 0) < 0 ? `Faltante: ${money(st.monetaryDifference ?? 0)}` : `Sobrante: +${money(st.monetaryDifference ?? 0)}`}
                        </span>
                        <Link to="/settlements" style={{ color: '#0284c7', textDecoration: 'underline', fontSize: '0.78rem' }}>
                          Auditar
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#b91c1c' }}>
                    Existe un descuadre acumulado de caja por conciliar en la base de datos de <strong>{money(data.monetaryDifferences)}</strong>.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '0.55rem',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              color: '#166534',
              fontSize: '0.86rem'
            }}>
              <CheckCircle2 size={18} color="#16a34a" strokeWidth={2.5} />
              <div>
                <strong>Cero descuadres de caja:</strong> Todas las rutas liquidadas han rendido el dinero exacto en bóveda.
              </div>
            </div>
          )}

          {/* Fila secundaria de control ético: Mermas y Diferencias físicas de producto */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.85rem'
          }}>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              padding: '0.85rem 1rem'
            }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Mermas Físicas Aprobadas
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                {Number(data.approvedWasteUnits).toFixed(1)} unidades
              </div>
              <small style={{ color: '#64748b', fontSize: '0.74rem' }}>
                Producto dañado o mermado en transporte
              </small>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              padding: '0.85rem 1rem'
            }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Diferencias Físicas en Camión
              </span>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: data.inventoryDifferences !== 0 ? '#b91c1c' : '#047857',
                margin: '0.2rem 0'
              }}>
                {Number(data.inventoryDifferences).toFixed(1)} unidades
              </div>
              <small style={{ color: '#64748b', fontSize: '0.74rem' }}>
                Discrepancia entre carga, ventas y retorno
              </small>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              padding: '0.85rem 1rem'
            }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Auditorías y Trámites Pendientes
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                {data.pendingAuthorizations + data.pendingReturns} trámites
              </div>
              <small style={{ color: '#64748b', fontSize: '0.74rem' }}>
                {data.pendingReturns} devoluciones · {data.pendingAuthorizations} autorizaciones
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* 4. DASHBOARD GERENCIAL DE GRÁFICAS DE BARRAS */}
      {(() => {
        // Build RouteBalance array from route locations
        const routeBalances: RouteBalance[] = routeLocations.map(loc => ({
          routeId: loc.id,
          routeCode: loc.routeCode ?? loc.code,
          routeName: loc.routeName ?? loc.name,
          sellerName: activeOrTodayLoads.find(l => l.routeId === loc.routeId || l.routeCode === loc.routeCode)?.sellerReceivedByUsername,
          products: (loc.balances ?? []).map(b => ({
            productName: b.productName,
            qty: Number(b.quantityBaseUnits || 0),
          })).filter(p => p.qty > 0),
        })).filter(r => r.products.length > 0);

        // Cast sales to ChartSale (compatible subset)
        const chartSales: ChartSale[] = sales.map(s => ({
          id: s.id,
          routeCode: s.routeCode,
          routeName: s.routeName,
          sellerName: s.sellerName,
          total: s.total,
          createdAt: s.createdAt,
        }));

        return (
          <div style={{ marginBottom: '1.5rem' }}>
            {/* Row 1: Ranking Vendedores + Cartera CxC */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}>
              <SalesRankingChart sales={chartSales} />
              <DebtorChart sales={chartSales} creditTotal={data.credit} />
            </div>
            {/* Row 2: Garrafones prestados — ancho completo */}
            <LoanedGarrafonsChart routes={routeBalances} />
          </div>
        );
      })()}

      {/* 5. MATRIZ GERENCIAL DE RENDIMIENTO FINANCIERO POR RUTA */}
      <section style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        marginBottom: '1.5rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.9rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={17} strokeWidth={2} style={{ color: '#475569' }} />
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Rendimiento Financiero y Liquidación por Ruta
            </h2>
          </div>
          <Link to="/loads" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
            Ver todas las cargas ({loads.length})
          </Link>
        </div>

        {activeOrTodayLoads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <p style={{ fontSize: '0.92rem', margin: 0 }}>No hay camiones en operación actualmente.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Ruta y Operador</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Carga Física vs Venta</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Facturado</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Efectividad</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeOrTodayLoads.map(load => {
                  const loadStartTime = load.startedAt || load.sellerReceivedAt || load.createdAt;
                  const routeSales = sales.filter(s => {
                    if (s.routeId !== load.routeId && s.routeCode !== load.routeCode) return false;
                    if (loadStartTime) {
                      return new Date(s.createdAt).getTime() >= new Date(loadStartTime).getTime() - 120_000;
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
                      unitLabel: it.baseUnitCode || 'GARRAFON',
                      loaded,
                      sold,
                      remaining
                    };
                  });

                  const totalLoadedUnits = itemsBreakdown.reduce((acc, it) => acc + it.loaded, 0);
                  const totalSoldUnits = itemsBreakdown.reduce((acc, it) => acc + it.sold, 0);
                  const remainingOnTruck = Math.max(0, totalLoadedUnits - totalSoldUnits);
                  const progressPct = totalLoadedUnits > 0 ? Math.min(100, Math.round((totalSoldUnits / totalLoadedUnits) * 100)) : 0;
                  const unitLabel = itemsBreakdown[0]?.unitLabel ?? 'GARRAFON';

                  const isStarted = load.status === 'STARTED';

                  return (
                    <tr key={load.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block' }}>
                          {load.routeName || load.routeCode}
                        </strong>
                        <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <User size={12} />
                          {load.sellerReceivedByUsername || load.createdByUsername || 'amartinez'} · Carga #{load.loadNumber}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: isStarted ? '#ecfdf5' : '#f8fafc',
                          color: isStarted ? '#047857' : '#64748b',
                          border: `1px solid ${isStarted ? '#a7f3d0' : '#e2e8f0'}`
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isStarted ? '#10b981' : '#94a3b8' }} />
                          {isStarted ? 'En ruta' : load.status}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                          Cargado: <strong>{totalLoadedUnits} {unitLabel}</strong> · Vendido: <strong style={{ color: '#0284c7' }}>{totalSoldUnits} {unitLabel}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          En camión: <strong style={{ color: '#047857' }}>{remainingOnTruck} {unitLabel}</strong>
                        </div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <strong style={{ fontSize: '0.98rem', color: '#0f172a', fontFeatureSettings: '"tnum"' }}>
                          {money(totalSalesQ)}
                        </strong>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          fontWeight: 700,
                          color: progressPct >= 70 ? '#047857' : '#0284c7',
                          background: '#f1f5f9',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem'
                        }}>
                          {progressPct}%
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <Link to="/settlements" className="secondary" style={{
                          textDecoration: 'none',
                          padding: '0.25rem 0.65rem',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          Liquidar <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. VALORACIÓN CONTABLE DE INVENTARIOS (CAPITAL DE TRABAJO) */}
      <section style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        marginBottom: '1.5rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.9rem 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Warehouse size={17} strokeWidth={2} style={{ color: '#475569' }} />
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Valoración Contable de Inventarios (Capital de Trabajo en Activo Circulante)
            </h2>
          </div>
          <Link to="/inventory" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
            Gestionar almacén
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          padding: '1.25rem'
        }}>
          {/* Bodega Central */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.55rem', padding: '1rem', background: '#ffffff' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Bodega Central ({centralWarehouse?.name ?? 'GENERAL'})
            </span>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'block', margin: '0.35rem 0 0.5rem' }}>
              {money(centralWarehouseValue, data.currencyCode)}
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
              {centralBalances.slice(0, 4).map(b => (
                <div key={b.productId} style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                  <span>{b.productName}:</span>
                  <strong>{Number(b.quantityBaseUnits).toLocaleString('es-GT')} {b.baseUnitCode}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* En Camiones / Calle */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.55rem', padding: '1rem', background: '#ffffff' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              En Consignación Rodante (Camiones)
            </span>
            <strong style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857', display: 'block', margin: '0.35rem 0 0.5rem' }}>
              {money(streetStockValue, data.currencyCode)}
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
              {Array.from(streetStockMap.entries()).slice(0, 4).map(([pid, it]) => (
                <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                  <span>{it.productName}:</span>
                  <strong style={{ color: '#047857' }}>{Number(it.totalQty).toLocaleString('es-GT')} {it.baseUnitCode}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Capital Global Empresa */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.55rem', padding: '1rem', background: '#f8fafc' }}>
            <span style={{ fontSize: '0.74rem', color: '#0f172a', fontWeight: 700, textTransform: 'uppercase' }}>
              Capital Comercial Total en Existencias
            </span>
            <strong style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', display: 'block', margin: '0.35rem 0 0.5rem' }}>
              {money(companyTotalValue, data.currencyCode)}
            </strong>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
              Activo realizable valorizado a precio comercial de venta.
            </p>
          </div>
        </div>
      </section>

      {/* 7. PENDIENTES DE CIERRE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>

        {/* Resumen de Pendientes de Cierre */}
        <section style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.65rem',
          padding: '1.15rem'
        }}>
          <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
            Pendientes de Cierre Contable y Operativo
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
            <h3 style={{ fontSize: '0.85rem', margin: '0 0 0.45rem', color: '#64748b' }}>Estado del Cierre</h3>
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
                <span>Todas las operaciones cuadran sin novedades pendientes de cierre.</span>
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
