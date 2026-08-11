import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSync } from '../../offline/SyncContext';
import { apiRequest } from '../../services/apiClient';

type RouteLoad = { id: string; loadNumber: string; routeCode: string; routeName: string; status: string };
type SettlementItem = { id: string; productName: string; loadedUnits: number; soldUnits: number;
  returnedGoodUnits: number; customerReturnUnits: number; approvedWasteUnits: number; physicalDifference: number };
type Settlement = { id: string; routeLoadId: string; loadNumber: number; routeCode: string; routeName: string;
  sellerName: string; loadStatus: string; status: string; salesTotal: number; expectedCash: number;
  deliveredCash: number; verifiedTransfers: number; appliedCredit: number; monetaryDifference: number;
  physicalDifferenceTotal: number; blockingReasons: string[]; closeNotes?: string; items: SettlementItem[];
  cashDeliveries: Array<{ id: string; amount: number; notes: string; deliveredAt: string }> };

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente', READY: 'Lista', WITH_DIFFERENCE: 'Con diferencia', BALANCED: 'Cuadrada', CLOSED: 'Cerrada',
};
const money = (value: number) => `Q${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SettlementPage({ canClose, canReceiveCash }: { canClose: boolean; canReceiveCash: boolean }) {
  const client = useQueryClient();
  const { operations, syncNow } = useSync();
  const pendingLocalOperations = operations.filter(item => item.status !== 'SYNCED').length;
  const loads = useQuery({ queryKey: ['route-loads'], queryFn: () => apiRequest<RouteLoad[]>('/loads') });
  const settlements = useQuery({ queryKey: ['settlements'], queryFn: () => apiRequest<Settlement[]>('/settlements') });
  const [cash, setCash] = useState<Record<string, string>>({});
  const [cashNotes, setCashNotes] = useState<Record<string, string>>({});
  const [closeNotes, setCloseNotes] = useState<Record<string, string>>({});
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['settlements'] });
    await client.invalidateQueries({ queryKey: ['route-loads'] });
  };
  const calculate = useMutation({
    mutationFn: (loadId: string) => apiRequest<Settlement>(`/settlements/${loadId}/calculate`, {
      method: 'POST', body: JSON.stringify({ pendingLocalOperations }),
    }), onSuccess: refresh,
  });
  const deliver = useMutation({
    mutationFn: (loadId: string) => apiRequest<Settlement>(`/settlements/${loadId}/cash-deliveries`, {
      method: 'POST', body: JSON.stringify({ amount: Number(cash[loadId]),
        notes: cashNotes[loadId] || 'Efectivo contado y recibido' }),
    }), onSuccess: refresh,
  });
  const close = useMutation({
    mutationFn: (loadId: string) => apiRequest<Settlement>(`/settlements/${loadId}/close`, {
      method: 'POST', body: JSON.stringify({ pendingLocalOperations, notes: closeNotes[loadId] }),
    }), onSuccess: refresh,
  });
  const activeLoads = loads.data?.filter(item => item.status === 'STARTED') ?? [];

  return <main>
    <p className="eyebrow">Conciliación independiente</p>
    <h1>Liquidaciones</h1>
    <p className="muted">El servidor calcula todas las fuentes oficiales. La diferencia física nunca compensa un faltante de efectivo.</p>

    {pendingLocalOperations > 0 && <div className="alert error">Existen operaciones pendientes de sincronización ({pendingLocalOperations}). La liquidación no puede cerrarse definitivamente. <button className="secondary" onClick={() => void syncNow()}>Sincronizar ahora</button></div>}

    <section className="panel section-panel">
      <div className="section-heading"><h2>Recorridos por liquidar</h2><span>{activeLoads.length}</span></div>
      <div className="data-list">{activeLoads.map(load => <div className="data-row" key={load.id}>
        <span>Carga {load.loadNumber} · {load.routeCode} · {load.routeName}</span>
        <button className="primary" onClick={() => calculate.mutate(load.id)}>Calcular con fuentes oficiales</button>
      </div>)}</div>
    </section>

    <section className="section-panel">
      <div className="section-heading"><h2>Conciliaciones</h2><span>{settlements.data?.length ?? 0}</span></div>
      {(settlements.error || calculate.error || deliver.error || close.error) && <div className="alert error">{(settlements.error ?? calculate.error ?? deliver.error ?? close.error)?.message}</div>}
      <div className="sales-grid">{settlements.data?.map(item => <article className="panel sale-card" key={item.id}>
        <div className="section-heading"><div><strong>Carga {item.loadNumber} · {item.routeCode}</strong><span>{item.sellerName}</span></div><span className="status-pill">{statusLabels[item.status] ?? item.status}</span></div>
        <div className="metric-grid">
          <article><span>Ventas</span><strong>{money(item.salesTotal)}</strong></article>
          <article><span>Efectivo esperado</span><strong>{money(item.expectedCash)}</strong></article>
          <article><span>Efectivo entregado</span><strong>{money(item.deliveredCash)}</strong></article>
          <article><span>Diferencia monetaria</span><strong>{money(item.monetaryDifference)}</strong></article>
          <article><span>Transferencias verificadas</span><strong>{money(item.verifiedTransfers)}</strong></article>
          <article><span>Crédito aplicado</span><strong>{money(item.appliedCredit)}</strong></article>
        </div>
        <h3>Conciliación física</h3>
        <div className="data-list">{item.items.map(row => <div className="data-row" key={row.id}>
          <span>{row.productName}</span><strong>{Number(row.loadedUnits)} − {Number(row.soldUnits)} − {Number(row.returnedGoodUnits)} − {Number(row.approvedWasteUnits)} = {Number(row.physicalDifference)}</strong>
        </div>)}</div>
        <p className="status-note">Carga − ventas − producto bueno devuelto − merma aprobada = diferencia física. Devoluciones de cliente recibidas: {item.items.reduce((sum, row) => sum + Number(row.customerReturnUnits), 0)}.</p>
        {item.blockingReasons.length > 0 && <div className="alert error">Bloqueos: {item.blockingReasons.join(', ')}</div>}
        {canReceiveCash && item.loadStatus === 'STARTED' && <div className="review-box">
          <label>Efectivo recibido<input type="number" min="0.01" step="0.01" value={cash[item.routeLoadId] ?? ''} onChange={event => setCash(current => ({ ...current, [item.routeLoadId]: event.target.value }))} /></label>
          <label>Notas de recepción<input value={cashNotes[item.routeLoadId] ?? ''} onChange={event => setCashNotes(current => ({ ...current, [item.routeLoadId]: event.target.value }))} /></label>
          <button className="secondary" disabled={!Number(cash[item.routeLoadId])} onClick={() => deliver.mutate(item.routeLoadId)}>Registrar efectivo contado</button>
        </div>}
        {canClose && item.loadStatus === 'STARTED' && <div className="review-box">
          <label>Notas de cierre<input value={closeNotes[item.routeLoadId] ?? ''} onChange={event => setCloseNotes(current => ({ ...current, [item.routeLoadId]: event.target.value }))} /></label>
          <button className="primary" disabled={pendingLocalOperations > 0 || item.blockingReasons.length > 0 || !closeNotes[item.routeLoadId]} onClick={() => close.mutate(item.routeLoadId)}>Cerrar liquidación</button>
        </div>}
      </article>)}</div>
    </section>
  </main>;
}
