import { useMemo } from 'react';
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
  sellerReceivedByUsername?: string; sellerReceivedAt?: string;
  startedByUsername?: string; startedAt?: string;
  createdByUsername: string; createdAt?: string; items: RouteLoadItem[];
};

type Balance = { productId: string; productCode: string; productName: string; baseUnitCode: string; quantityBaseUnits: number };
type Location = {
  id: string; code: string; name: string; locationType: string; routeId?: string; routeCode?: string; routeName?: string;
  active: boolean; balances: Balance[];
};

type SaleItem = {
  id: string;
  productId?: string;
  productCode?: string;
  productName: string;
  presentationQuantity: number;
  quantityBaseUnits: number;
  unitPrice: number;
  lineTotal: number;
};
type Payment = { id: string; method: string; amount: number; status: string };
type Sale = {
  id: string; documentNumber: string; routeId?: string; routeCode: string; routeName: string;
  sellerName: string; customerName: string; total: number; createdAt: string;
  items: SaleItem[]; payments?: Payment[];
};

function money(value: number, currency = 'GTQ'): string {
  return `${currency === 'GTQ' ? 'Q' : `${currency} `}${Number(value || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type SettlementItem = { id: string; productName: string; loadedUnits: number; soldUnits: number; physicalDifference: number };
type Settlement = { id: string; routeLoadId: string; loadNumber: number; routeCode: string; routeName: string; status: string; items: SettlementItem[] };

interface SellerDashboardProps {
  user: SessionUser;
  dashboard: Dashboard;
  loads: RouteLoad[];
  locations: Location[];
  sales: Sale[];
  settlements?: Settlement[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function SellerDashboard({
  user,
  dashboard,
  loads,
  locations,
  sales,
  settlements,
  isRefreshing,
  onRefresh,
}: SellerDashboardProps) {
  // 1. Buscar si el vendedor tiene una carga activa hoy (en recorrido o recibida)
  const activeSellerLoad = loads.find(l => 
    (l.sellerReceivedByUsername === user.username || l.startedByUsername === user.username || l.createdByUsername === user.username) &&
    (l.status === 'STARTED' || l.status === 'RECEIVED')
  );

  // 2. Si no hay activa, buscar si hay una carga preparada por bodega pendiente de recepción física
  const pendingSellerLoad = !activeSellerLoad ? loads.find(l =>
    (l.sellerReceivedByUsername === user.username || l.createdByUsername === user.username) &&
    (l.status === 'PREPARED' || l.status === 'WAREHOUSE_CONFIRMED')
  ) : null;

  // 3. Si no hay activa ni pendiente, buscar si la última carga asignada ya fue liquidada
  const settledSellerLoad = !activeSellerLoad && !pendingSellerLoad ? loads.find(l =>
    (l.sellerReceivedByUsername === user.username || l.startedByUsername === user.username || l.createdByUsername === user.username) &&
    l.status === 'SETTLED'
  ) : null;

  const sellerLoad = activeSellerLoad ?? pendingSellerLoad ?? settledSellerLoad ?? null;
  const isSettled = sellerLoad?.status === 'SETTLED';
  const isPendingReceipt = sellerLoad?.status === 'PREPARED' || sellerLoad?.status === 'WAREHOUSE_CONFIRMED';
  const isActiveLoad = sellerLoad?.status === 'STARTED' || sellerLoad?.status === 'RECEIVED';

  // Buscar liquidación oficial del servidor para esta carga o ruta si ya fue calculada
  const currentSettlement = settlements?.find(st =>
    st.routeLoadId === sellerLoad?.id ||
    (sellerLoad?.loadNumber && String(st.loadNumber) === String(sellerLoad.loadNumber).replace(/\D/g, '')) ||
    (sellerLoad?.routeCode && st.routeCode === sellerLoad.routeCode)
  );

  // Momento de inicio o despacho de la carga activa
  const loadStartTime = sellerLoad?.startedAt || sellerLoad?.sellerReceivedAt || sellerLoad?.createdAt;

  // Extraer fecha local YYYY-MM-DD
  const getLocalDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const offset = d.getTimezoneOffset() * 60_000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 10);
    } catch {
      return isoStr.slice(0, 10);
    }
  };

  // Ventas de la ruta correspondientes a esta carga activa
  const sellerSales = sales.filter(s => {
    // Si la carga tiene ruta asignada, la venta debe pertenecer a la misma ruta
    if (sellerLoad?.routeId && s.routeId && s.routeId !== sellerLoad.routeId) {
      return false;
    }
    if (sellerLoad?.routeCode && s.routeCode && s.routeCode !== sellerLoad.routeCode) {
      return false;
    }

    // Filtro de temporalidad: ventas de la jornada o de la carga
    if (sellerLoad?.plannedDate) {
      const saleDate = getLocalDate(s.createdAt);
      if (saleDate === sellerLoad.plannedDate || s.createdAt.startsWith(sellerLoad.plannedDate)) {
        return true;
      }
    }
    if (loadStartTime) {
      const saleTime = new Date(s.createdAt).getTime();
      const startTime = new Date(loadStartTime).getTime() - 120_000; // 2 min de margen por sincronización
      if (saleTime >= startTime) {
        return true;
      }
    }

    return true;
  });

  // Recargas adicionales aprobadas/recibidas para esta misma ruta durante el recorrido
  const routeReplenishments = loads.filter(l => 
    sellerLoad &&
    l.routeId === sellerLoad.routeId &&
    l.loadType === 'REPLENISHMENT' &&
    (l.status === 'STARTED' || l.status === 'RECEIVED' || l.status === 'SETTLED' || l.status === 'WAREHOUSE_CONFIRMED')
  );

  // Productos en el camión basados en la carga activa y sus ventas
  const truckItems = (sellerLoad?.items ?? []).map(item => {
    // Unidades adicionales por recarga en ruta si existen
    const replenishmentUnits = routeReplenishments.reduce((acc, rep) => {
      const match = rep.items?.find(it => 
        (it.productId && item.productId && it.productId === item.productId) ||
        (it.productName && item.productName && it.productName.trim().toLowerCase() === item.productName.trim().toLowerCase()) ||
        (it.productCode && item.productCode && it.productCode.trim().toLowerCase() === item.productCode.trim().toLowerCase())
      );
      return acc + Number(match?.quantityBaseUnits || 0);
    }, 0);

    const totalItemLoaded = Number(item.quantityBaseUnits || 0) + replenishmentUnits;

    // Ventas acumuladas en vivo
    const rawSoldQty = sellerSales.reduce((acc, s) => {
      const matches = s.items?.filter(it => 
        (it.productId && item.productId && it.productId === item.productId) ||
        (it.productName && item.productName && it.productName.trim().toLowerCase() === item.productName.trim().toLowerCase()) ||
        (it.productCode && item.productCode && it.productCode.trim().toLowerCase() === item.productCode.trim().toLowerCase())
      );
      const lineSum = matches?.reduce((iAcc, it) => iAcc + Number(it.quantityBaseUnits || 0), 0) || 0;
      return acc + lineSum;
    }, 0);

    // Unidades vendidas según liquidación oficial del servidor
    const settlementItem = currentSettlement?.items?.find(it =>
      (it.productName && item.productName && it.productName.trim().toLowerCase() === item.productName.trim().toLowerCase())
    );
    const settlementSold = Number(settlementItem?.soldUnits || 0);

    // Usar la mayor cantidad de ventas verificadas
    const effectiveSold = Math.max(rawSoldQty, settlementSold);
    const soldQty = Math.min(totalItemLoaded, effectiveSold);
    // Si la carga ya fue liquidada oficialmente, a bordo ya no hay producto activo (existencias en camión = 0)
    const remainingOnTruck = isSettled ? 0 : Math.max(0, totalItemLoaded - soldQty);

    return {
      ...item,
      quantityBaseUnits: totalItemLoaded,
      soldQty,
      remainingOnTruck
    };
  });

  // Unidades vendidas en total del camión
  const totalSoldUnits = truckItems.reduce((acc, it) => acc + it.soldQty, 0);

  // Carga total en unidades (incluyendo recargas de ruta)
  const totalLoadedUnits = truckItems.reduce((acc, it) => acc + Number(it.quantityBaseUnits || 0), 0);

  // Total restante a bordo: suma exacta del stock en camión de cada producto (0 si ya liquidó)
  const remainingTotalUnits = isSettled ? 0 : truckItems.reduce((acc, it) => acc + it.remainingOnTruck, 0);

  const progressPct = totalLoadedUnits > 0 ? Math.min(100, Math.round((totalSoldUnits / totalLoadedUnits) * 100)) : 0;

  // Traducción de estados de carga al español
  const loadStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      STARTED: '🟢 En ruta',
      RECEIVED: '📦 Recibida',
      PREPARED: '🔧 Preparada',
      WAREHOUSE_CONFIRMED: '✅ Confirmada',
      SETTLED: '✔ Liquidada',
      CANCELLED: '🚫 Cancelada',
    };
    return labels[status] ?? status;
  };

  // Calcular arqueo directamente desde las ventas filtradas como fuente de verdad
  // (el dashboard.salesToday puede ser 0 si el vendedor no tiene asignación formal en route_assignment)
  const localSalesToday = sellerSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const localCash = sellerSales.reduce((acc, s) => {
    const cashPayments = (s.payments ?? []).filter(p => p.method === 'CASH' && p.status === 'CONFIRMED');
    return acc + cashPayments.reduce((pAcc, p) => pAcc + Number(p.amount || 0), 0);
  }, 0);
  const localTransfers = sellerSales.reduce((acc, s) => {
    const transferPayments = (s.payments ?? []).filter(p => p.method === 'TRANSFER' && p.status !== 'REJECTED');
    return acc + transferPayments.reduce((pAcc, p) => pAcc + Number(p.amount || 0), 0);
  }, 0);
  const localCredit = sellerSales.reduce((acc, s) => {
    const creditPayments = (s.payments ?? []).filter(p => p.method === 'CREDIT' && p.status === 'APPLIED');
    return acc + creditPayments.reduce((pAcc, p) => pAcc + Number(p.amount || 0), 0);
  }, 0);

  // Usar el mayor valor entre el dashboard del servidor y el cálculo local
  // para evitar mostrar Q0.00 cuando la ruta no está formalmente asignada
  const effectiveSalesToday = Math.max(Number(dashboard.salesToday || 0), localSalesToday);
  const effectiveCash = Math.max(Number(dashboard.expectedCash || 0), localCash);
  const effectiveTransfers = Math.max(Number(dashboard.transfers || 0), localTransfers);
  const effectiveCredit = Math.max(Number(dashboard.credit || 0), localCredit);

  // Efectivo en mano que debe entregar el vendedor (0 si la jornada ya fue liquidada oficialmente)
  const cashInHand = isSettled ? 0 : Math.max(0, effectiveCash - Number(dashboard.deliveredCash || 0));

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
              {loadStatusLabel(sellerLoad.status)}
            </span>
          )}
        </div>

        {isSettled ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
            <div style={{ fontSize: '2.6rem', marginBottom: '0.5rem' }}>✅</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#166534', fontSize: '1.25rem' }}>Jornada del día liquidada y cerrada</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 1.25rem' }}>
              La carga <strong>{sellerLoad ? `Carga ${sellerLoad.loadNumber}` : ''} ({sellerLoad?.routeName || sellerLoad?.routeCode})</strong> ya fue liquidada oficialmente ante administración. Las existencias del camión fueron descargadas/conciliadas en bodega (<strong>0 unidades a bordo</strong>).
            </p>
            <div style={{ display: 'inline-flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/settlements" className="secondary" style={{ textDecoration: 'none', padding: '0.5rem 1.1rem' }}>
                Ver liquidaciones
              </Link>
              <Link to="/loads" className="secondary" style={{ textDecoration: 'none', padding: '0.5rem 1.1rem' }}>
                Consultar cargas
              </Link>
            </div>
          </div>
        ) : isPendingReceipt ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#fffbeb', borderRadius: '0.75rem', border: '1px solid #fef08a', marginTop: '1rem' }}>
            <div style={{ fontSize: '2.6rem', marginBottom: '0.5rem' }}>📦</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#854d0e', fontSize: '1.25rem' }}>Carga preparada en bodega</h3>
            <p style={{ color: '#713f12', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 1.25rem' }}>
              Bodega ha preparado tu carga <strong>{sellerLoad ? `Carga ${sellerLoad.loadNumber}` : ''} ({sellerLoad?.routeName || sellerLoad?.routeCode})</strong>. Las existencias aún están en bodega (0 en camión). Para subirlas a tu camión e iniciar recorrido, confirma la recepción física.
            </p>
            <Link to="/loads" className="primary" style={{ textDecoration: 'none', display: 'inline-block', padding: '0.55rem 1.3rem' }}>
              Confirmar recepción en Cargas
            </Link>
          </div>
        ) : sellerLoad && isActiveLoad ? (
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
            <p style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>No tienes una carga activa hoy en tu usuario.</p>
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
              {isSettled ? 'Liquidado y entregado en caja' : 'Total físico a rendir en caja central'}
            </div>
          </article>

          <article className="kpi-card">
            <div className="kpi-header">
              <span>Total vendido hoy</span>
              <span className="kpi-icon" aria-hidden="true">💰</span>
            </div>
            <strong className="kpi-value">
              {money(effectiveSalesToday, dashboard.currencyCode)}
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
              {money(effectiveTransfers, dashboard.currencyCode)}
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
              {money(effectiveCredit, dashboard.currencyCode)}
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
                    {sale.items.map(it => `${Number(it.presentationQuantity || it.quantityBaseUnits)}x ${it.productName}`).join(', ')}
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
            {sellerSales.length > 10 && (
              <div style={{ textAlign: 'center', padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
                Mostrando las 10 ventas más recientes de {sellerSales.length} registradas. <Link to="/sales" style={{ color: 'var(--primary)' }}>Ver todas</Link>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
