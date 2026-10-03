import { Link } from 'react-router-dom';
import {
  Warehouse,
  Truck,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Package,
  CheckCircle2,
  Clock,
  Boxes,
} from 'lucide-react';
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

  const warehouseLoads = loads.filter(l => 
    l.status === 'PREPARED' || l.status === 'WAREHOUSE_CONFIRMED' || l.status === 'RECEIVED' || l.status === 'STARTED'
  );

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', paddingBottom: '2.5rem' }}>
      {/* Encabezado Personalizado */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1.25rem 0 1rem',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: '#f1f5f9',
              color: '#334155',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.55rem',
              borderRadius: '0.375rem',
              letterSpacing: '0.025em'
            }}>
              <Warehouse size={13} strokeWidth={2} />
              ENCARGADO DE BODEGA
            </span>
          </div>
          <h1 style={{ margin: '0.25rem 0', fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>
            {user.displayName || user.username}
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Control de planta, preparación de cargas de camión y recepción de envases
          </p>
        </div>

        <button 
          type="button"
          onClick={onRefresh} 
          disabled={isRefreshing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.82rem',
            fontWeight: 500,
            padding: '0.45rem 0.85rem',
            background: '#ffffff',
            color: '#334155',
            border: '1px solid #cbd5e1',
            borderRadius: '0.45rem',
            cursor: isRefreshing ? 'wait' : 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} strokeWidth={2} />
          {isRefreshing ? 'Actualizando…' : 'Sincronizar'}
        </button>
      </div>

      {/* Acciones Rápidas de Bodega B2B */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.65rem',
        marginBottom: '1.25rem'
      }}>
        <Link to="/inventory" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.75rem 0.9rem',
          background: '#0f172a',
          color: '#ffffff',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          boxShadow: '0 1px 3px rgba(15,23,42,0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '0.375rem',
            background: 'rgba(255,255,255,0.15)'
          }}>
            <Boxes size={15} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Inventario</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ajuste y conteo</div>
          </div>
        </Link>

        <Link to="/loads" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.75rem 0.9rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          textDecoration: 'none'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '0.375rem',
            background: '#f1f5f9',
            color: '#475569'
          }}>
            <Truck size={15} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cargas</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Despacho a camión</div>
          </div>
        </Link>

        <Link to="/wastes" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.75rem 0.9rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          textDecoration: 'none'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '0.375rem',
            background: '#f1f5f9',
            color: '#475569'
          }}>
            <AlertTriangle size={15} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mermas</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Envases o rotura</div>
          </div>
        </Link>

        <Link to="/returns" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.75rem 0.9rem',
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          textDecoration: 'none'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '0.375rem',
            background: '#f1f5f9',
            color: '#475569'
          }}>
            <RotateCcw size={15} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Devoluciones</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Reingreso a planta</div>
          </div>
        </Link>
      </div>

      {/* 1. Existencias Físicas en Bodega Central */}
      <section style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        marginBottom: '1.25rem',
        overflow: 'hidden'
      }}>
        <div style={{
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
              Stock Físico en Bodega Central ({centralWarehouse?.name ?? 'GENERAL'})
            </h2>
          </div>
          <Link to="/inventory" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>
            Libro de movimientos
          </Link>
        </div>

        {balances.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            padding: '1.15rem'
          }}>
            {balances.map(b => (
              <article key={b.productId} style={{
                border: '1px solid #e2e8f0',
                borderRadius: '0.55rem',
                padding: '1rem',
                background: '#ffffff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{b.productName}</h4>
                  <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.15rem 0.45rem', borderRadius: '0.35rem', fontWeight: 600 }}>
                    En planta
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Unidades Disponibles</span>
                  <strong style={{ fontSize: '1.65rem', color: '#0f172a', display: 'block', fontFeatureSettings: '"tnum"', marginTop: '0.2rem' }}>
                    {Number(b.quantityBaseUnits).toLocaleString('es-GT')} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>{b.baseUnitCode}</span>
                  </strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', margin: 0 }}>
            Sin existencias registradas en la bodega central.
          </p>
        )}
      </section>

      {/* 2. Cargas del Día y Despachos de Camiones */}
      <section style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        marginBottom: '1.25rem',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1.15rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={17} strokeWidth={2} style={{ color: '#475569' }} />
            <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
              Despachos y Cargas del Día
            </h2>
          </div>
          <Link to="/loads" className="secondary" style={{ textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>
            Ver todas las cargas
          </Link>
        </div>

        {warehouseLoads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <p style={{ margin: '0 0 0.5rem' }}>No hay cargas de camiones activas para hoy.</p>
            <Link to="/loads" className="primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.45rem 1rem', fontSize: '0.82rem', marginTop: '0.35rem' }}>
              Preparar nueva carga
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {warehouseLoads.map((load, idx) => {
              const totalUnits = load.items.reduce((acc, it) => acc + Number(it.quantityBaseUnits || 0), 0);
              const isStarted = load.status === 'STARTED';
              const isReceived = load.status === 'RECEIVED';
              const isConfirmed = load.status === 'WAREHOUSE_CONFIRMED';
              const isPrepared = load.status === 'PREPARED';

              return (
                <article key={load.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1.15rem',
                  borderBottom: idx === warehouseLoads.length - 1 ? 'none' : '1px solid #f1f5f9'
                }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{load.routeName || load.routeCode}</strong>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                      Carga: <strong>#{load.loadNumber}</strong> · Vendedor: {load.sellerReceivedByUsername || 'Por asignar'} · Fecha: {load.plannedDate}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.2rem' }}>
                      {load.items.map(it => `${it.quantityBaseUnits} ${it.baseUnitCode} de ${it.productName}`).join(', ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginBottom: '0.35rem',
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
                      {isStarted ? 'En ruta' : isReceived ? 'Recibido por vendedor' : isConfirmed ? 'Salida confirmada' : isPrepared ? 'Preparada' : load.status}
                    </span>
                    <strong style={{ display: 'block', fontSize: '1rem', fontFeatureSettings: '"tnum"', color: '#0f172a' }}>
                      {totalUnits} unidades
                    </strong>
                    <Link to="/loads" className="secondary" style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem', textDecoration: 'none', display: 'inline-block', marginTop: '0.25rem' }}>
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
      <section style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        padding: '1.15rem'
      }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
          Novedades y Pendientes de Planta
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ padding: '0.35rem 0.65rem', borderRadius: '0.375rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155' }}>
            {dashboard.pendingWastes} mermas pendientes de autorizar
          </span>
          <span style={{ padding: '0.35rem 0.65rem', borderRadius: '0.375rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155' }}>
            {dashboard.pendingReturns} devoluciones por verificar
          </span>
          <span style={{ padding: '0.35rem 0.65rem', borderRadius: '0.375rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155' }}>
            {dashboard.approvedWasteUnits} unidades de merma aprobadas hoy
          </span>
        </div>
      </section>
    </div>
  );
}
