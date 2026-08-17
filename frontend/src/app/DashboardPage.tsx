import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../services/apiClient';
import { PageHeader } from './PageHeader';

type DashboardAlert = { code: string; severity: string; title: string; count: number };
type Dashboard = {
  generatedAt: string; timezone: string; currencyCode: string;
  salesToday: number; expectedCash: number; deliveredCash: number; transfers: number; credit: number;
  monetaryDifferences: number; inventoryDifferences: number; approvedWasteUnits: number;
  pendingWastes: number; provisionalCustomers: number; pendingTransfers: number;
  activeRoutes: number; completedRoutes: number; pendingOfflineOperations: number;
  pendingReturns: number; pendingAuthorizations: number; openIncidents: number; alerts: DashboardAlert[];
};

function money(value: number, currency: string): string {
  return `${currency === 'GTQ' ? 'Q' : `${currency} `}${Number(value).toFixed(2)}`;
}

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<Dashboard>('/dashboard'),
    refetchInterval: 60_000
  });
  const data = dashboard.data;
  return <main>
    <PageHeader eyebrow="Resumen oficial" title="Panel operativo" description={`Indicadores calculados por el servidor para el día operativo en ${data?.timezone ?? 'la zona configurada'}.`} />
    {dashboard.isLoading && <div className="panel">Calculando indicadores…</div>}
    {dashboard.error && <div className="alert error">{dashboard.error.message}</div>}
    {data && <>
      <div className="metric-grid">
        <article><span>Ventas de hoy</span><strong>{money(data.salesToday, data.currencyCode)}</strong></article>
        <article><span>Efectivo esperado</span><strong>{money(data.expectedCash, data.currencyCode)}</strong></article>
        <article><span>Efectivo entregado</span><strong>{money(data.deliveredCash, data.currencyCode)}</strong></article>
        <article><span>Transferencias</span><strong>{money(data.transfers, data.currencyCode)}</strong></article>
        <article><span>Crédito</span><strong>{money(data.credit, data.currencyCode)}</strong></article>
        <article><span>Diferencia monetaria</span><strong>{money(data.monetaryDifferences, data.currencyCode)}</strong></article>
        <article><span>Diferencia de inventario</span><strong>{Number(data.inventoryDifferences).toFixed(2)}</strong></article>
        <article><span>Merma aprobada</span><strong>{Number(data.approvedWasteUnits).toFixed(2)}</strong></article>
        <article><span>Rutas activas</span><strong>{data.activeRoutes}</strong></article>
        <article><span>Rutas finalizadas hoy</span><strong>{data.completedRoutes}</strong></article>
        <article><span>Clientes provisionales</span><strong>{data.provisionalCustomers}</strong></article>
        <article><span>Incidencias abiertas</span><strong>{data.openIncidents}</strong></article>
      </div>
      <section className="panel">
        <div className="section-heading"><div><h2>Pendientes operativos</h2><span>Requieren seguimiento antes del cierre</span></div></div>
        <div className="dashboard-pending">
          <span>{data.pendingOfflineOperations} operaciones offline</span>
          <span>{data.pendingTransfers} transferencias</span>
          <span>{data.pendingWastes} mermas</span>
          <span>{data.pendingReturns} devoluciones</span>
          <span>{data.pendingAuthorizations} autorizaciones</span>
        </div>
      </section>
      <section className="panel">
        <h2>Alertas</h2>
        {data.alerts.length === 0 ? <p className="alert success">No hay alertas operativas abiertas.</p> :
          <div className="dashboard-alerts">{data.alerts.map(alert => <article key={alert.code} className={`alert ${alert.severity === 'CRITICAL' ? 'error' : ''}`}>
            <strong>{alert.title}</strong><span>{alert.count}</span>
          </article>)}</div>}
      </section>
    </>}
  </main>;
}
