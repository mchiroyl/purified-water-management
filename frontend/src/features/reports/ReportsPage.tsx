import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { apiFile, apiRequest } from '../../services/apiClient';

type ReportType = 'sales' | 'wastes' | 'settlements';
type Page<T> = { content: T[]; totalElements: number; page: number; size: number; hasNext: boolean };
type SalesRow = { saleId: string; documentNumber: string; occurredAt: string; sellerCode: string; sellerName: string;
  routeCode: string; routeName: string; customerCode: string; customerName: string; productCode: string; productName: string;
  presentationCode: string; presentationName: string; presentationQuantity: number; baseUnits: number; unitPrice: number;
  lineTotal: number; saleTotal: number; currencyCode: string; paymentMethods: string; cashAmount: number;
  transferAmount: number; creditAmount: number; saleStatus: string };
type WasteRow = { wasteId: string; occurredAt: string; sellerName: string; routeName: string; productName: string;
  presentationName: string; wasteType: string; reportedUnits: number; approvedUnits: number; status: string; reason: string };
type SettlementRow = { settlementId: string; occurredAt: string; sellerName: string; routeName: string; loadNumber: number;
  salesTotal: number; expectedCash: number; deliveredCash: number; transfers: number; credit: number;
  monetaryDifference: number; inventoryDifference: number; status: string };
type Filters = { from: string; to: string; seller: string; route: string; customer: string; product: string;
  presentation: string; paymentMethod: string; differenceOnly: boolean };

const today = new Date().toISOString().slice(0, 10);
const initialFilters: Filters = { from: today, to: today, seller: '', route: '', customer: '', product: '',
  presentation: '', paymentMethod: '', differenceOnly: false };
const money = (value: number) => `Q${Number(value).toFixed(2)}`;

function parameters(filters: Filters, page: number): string {
  const result = new URLSearchParams({ from: filters.from, to: filters.to, seller: filters.seller,
    route: filters.route, customer: filters.customer, product: filters.product,
    presentation: filters.presentation, paymentMethod: filters.paymentMethod,
    differenceOnly: String(filters.differenceOnly), page: String(page), size: '25' });
  return result.toString();
}

export function ReportsPage() {
  const [type, setType] = useState<ReportType>('sales');
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(0);
  const [exportError, setExportError] = useState('');
  const queryString = useMemo(() => parameters(filters, page), [filters, page]);
  const report = useQuery({
    queryKey: ['reports', type, queryString],
    queryFn: () => apiRequest<Page<SalesRow | WasteRow | SettlementRow>>(`/reports/${type}?${queryString}`)
  });
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(0); setFilters({ ...draft }); };
  const changeType = (next: ReportType) => { setType(next); setPage(0); };
  const exportCsv = async () => {
    setExportError('');
    try {
      const blob = await apiFile(`/reports/${type}.csv?${parameters(filters, 0)}`, 'text/csv');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${type}.csv`; link.click();
      URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : 'No fue posible exportar.'); }
  };

  return <main>
    <p className="eyebrow">Análisis autorizado</p><h1>Reportes</h1>
    <p className="muted">Las cifras provienen de PostgreSQL y el servidor limita los resultados según el rol y las rutas asignadas.</p>
    <div className="report-tabs" role="tablist" aria-label="Tipo de reporte">
      <button className={type === 'sales' ? 'primary' : 'secondary'} onClick={() => changeType('sales')}>Ventas</button>
      <button className={type === 'wastes' ? 'primary' : 'secondary'} onClick={() => changeType('wastes')}>Mermas</button>
      <button className={type === 'settlements' ? 'primary' : 'secondary'} onClick={() => changeType('settlements')}>Liquidaciones</button>
    </div>
    <form className="panel report-filters" onSubmit={submit}>
      <label>Desde<input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} required /></label>
      <label>Hasta<input type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} required /></label>
      <label>Vendedor<input value={draft.seller} onChange={event => setDraft({ ...draft, seller: event.target.value })} placeholder="Código o nombre" /></label>
      <label>Ruta<input value={draft.route} onChange={event => setDraft({ ...draft, route: event.target.value })} placeholder="Código o nombre" /></label>
      {type === 'sales' && <label>Cliente<input value={draft.customer} onChange={event => setDraft({ ...draft, customer: event.target.value })} placeholder="Código o nombre" /></label>}
      {type !== 'settlements' && <>
        <label>Producto<input value={draft.product} onChange={event => setDraft({ ...draft, product: event.target.value })} placeholder="Código o nombre" /></label>
        <label>Presentación<input value={draft.presentation} onChange={event => setDraft({ ...draft, presentation: event.target.value })} placeholder="Código o nombre" /></label>
      </>}
      {type === 'sales' && <label>Forma de pago<select value={draft.paymentMethod} onChange={event => setDraft({ ...draft, paymentMethod: event.target.value })}>
        <option value="">Todas</option><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="CREDIT">Crédito</option>
      </select></label>}
      {type === 'settlements' && <label className="checkbox"><input type="checkbox" checked={draft.differenceOnly} onChange={event => setDraft({ ...draft, differenceOnly: event.target.checked })} />Solo con diferencias</label>}
      <div className="report-actions"><button className="primary" type="submit">Aplicar filtros</button>
        <button className="secondary" type="button" onClick={() => void exportCsv()}>Exportar {type === 'sales' ? 'ventas' : type === 'wastes' ? 'mermas' : 'liquidaciones'} CSV</button></div>
    </form>
    {report.isLoading && <section className="panel">Generando reporte…</section>}
    {report.error && <div className="alert error">{report.error.message}</div>}
    {exportError && <div className="alert error">{exportError}</div>}
    {report.data && <section className="panel report-results">
      <div className="section-heading"><div><h2>Resultados</h2><span>{report.data.totalElements} filas autorizadas</span></div></div>
      {report.data.content.length === 0 ? <p>No hay registros para los filtros seleccionados.</p> :
        <div className="report-table-wrap"><table><thead>{type === 'sales' ? <tr><th>Documento</th><th>Fecha</th><th>Vendedor / Ruta</th><th>Cliente</th><th>Producto / Presentación</th><th>Cantidad</th><th>Total línea</th><th>Pago</th><th>Estado</th></tr> :
          type === 'wastes' ? <tr><th>Fecha</th><th>Vendedor / Ruta</th><th>Producto / Presentación</th><th>Tipo</th><th>Reportado</th><th>Aprobado</th><th>Estado</th></tr> :
            <tr><th>Fecha</th><th>Vendedor / Ruta</th><th>Carga</th><th>Ventas</th><th>Efectivo</th><th>Diferencia monetaria</th><th>Diferencia inventario</th><th>Estado</th></tr>}</thead>
          <tbody>{report.data.content.map((raw, index) => type === 'sales' ? <SalesReportRowView key={`${(raw as SalesRow).saleId}-${index}`} row={raw as SalesRow} /> :
            type === 'wastes' ? <WasteReportRowView key={`${(raw as WasteRow).wasteId}-${index}`} row={raw as WasteRow} /> :
              <SettlementReportRowView key={(raw as SettlementRow).settlementId} row={raw as SettlementRow} />)}</tbody></table></div>}
      <div className="report-pagination"><button className="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page + 1}</span><button className="secondary" disabled={!report.data.hasNext} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
    </section>}
  </main>;
}

function SalesReportRowView({ row }: { row: SalesRow }) {
  return <tr><td>{row.documentNumber}</td><td>{new Date(row.occurredAt).toLocaleString()}</td><td>{row.sellerName}<br />{row.routeCode} · {row.routeName}</td>
    <td>{row.customerCode} · {row.customerName}</td><td>{row.productName}<br />{row.presentationCode} · {row.presentationName}</td>
    <td>{row.presentationQuantity}</td><td>{money(row.lineTotal)}</td><td>{row.paymentMethods}</td><td>{row.saleStatus}</td></tr>;
}
function WasteReportRowView({ row }: { row: WasteRow }) {
  return <tr><td>{new Date(row.occurredAt).toLocaleString()}</td><td>{row.sellerName}<br />{row.routeName}</td><td>{row.productName}<br />{row.presentationName}</td>
    <td>{row.wasteType}</td><td>{row.reportedUnits}</td><td>{row.approvedUnits}</td><td>{row.status}</td></tr>;
}
function SettlementReportRowView({ row }: { row: SettlementRow }) {
  return <tr><td>{new Date(row.occurredAt).toLocaleString()}</td><td>{row.sellerName}<br />{row.routeName}</td><td>{row.loadNumber}</td><td>{money(row.salesTotal)}</td>
    <td>{money(row.deliveredCash)} / {money(row.expectedCash)}</td><td>{money(row.monetaryDifference)}</td><td>{row.inventoryDifference}</td><td>{row.status}</td></tr>;
}
