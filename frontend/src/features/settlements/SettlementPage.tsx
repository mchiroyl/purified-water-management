import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '../../app/PageHeader';
import { useSync } from '../../offline/SyncContext';
import { apiRequest } from '../../services/apiClient';

type RouteLoad = { id: string; loadNumber: string; routeCode: string; routeName: string; status: string };
type SettlementItem = { id: string; productName: string; loadedUnits: number; soldUnits: number;
  returnedGoodUnits: number; customerReturnUnits: number; approvedWasteUnits: number; physicalDifference: number };
type SalePriceBreakdown = {
  productId: string;
  productCode: string;
  productName: string;
  presentationName: string;
  unitPrice: number;
  quantitySold: number;
  totalAmount: number;
};
type Settlement = { id: string; routeLoadId: string; loadNumber: number; routeCode: string; routeName: string;
  sellerName: string; loadStatus: string; status: string; salesTotal: number;
  salesCash?: number; creditCollectionsCash?: number; expectedCash: number;
  deliveredCash: number; verifiedTransfers: number; appliedCredit: number; monetaryDifference: number;
  physicalDifferenceTotal: number; blockingReasons: string[]; closeNotes?: string; items: SettlementItem[];
  cashDeliveries: Array<{ id: string; amount: number; notes: string; deliveredAt: string; deliveredByUsername?: string; receivedByUsername?: string }>;
  salesByPrice?: SalePriceBreakdown[];
};

type ToastNotification = {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  icon?: string;
};

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
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [confirmCloseLoad, setConfirmCloseLoad] = useState<Settlement | null>(null);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['settlements'] });
    await client.invalidateQueries({ queryKey: ['route-loads'] });
  };

  const calculate = useMutation({
    mutationFn: (loadId: string) => apiRequest<Settlement>(`/settlements/${loadId}/calculate`, {
      method: 'POST', body: JSON.stringify({ pendingLocalOperations }),
    }),
    onSuccess: (data) => {
      setToast({
        title: 'Cálculo actualizado',
        message: `Conciliación calculada para la Carga ${data.loadNumber}.`,
        type: 'info',
        icon: '🔄',
      });
      void refresh();
    },
    onError: (err: any) => {
      setToast({
        title: 'Error al calcular',
        message: err?.message || 'No se pudo calcular la liquidación.',
        type: 'error',
        icon: '⚠️',
      });
    },
  });

  const deliver = useMutation({
    mutationFn: (loadId: string) => {
      const amountVal = Number(cash[loadId]);
      if (!amountVal || amountVal <= 0) {
        throw new Error('Debe ingresar un monto válido de efectivo recibido.');
      }
      return apiRequest<Settlement>(`/settlements/${loadId}/cash-deliveries`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountVal,
          notes: cashNotes[loadId] || 'Efectivo contado y recibido',
        }),
      });
    },
    onSuccess: (data, loadId) => {
      const formattedAmount = money(Number(cash[loadId]));
      setToast({
        title: '¡Efectivo recibido con éxito!',
        message: `Se registraron ${formattedAmount} para la Carga ${data.loadNumber}. Diferencia actual: ${money(data.monetaryDifference)}.`,
        type: 'success',
        icon: '💵',
      });
      setCash(current => ({ ...current, [loadId]: '' }));
      void refresh();
    },
    onError: (err: any) => {
      setToast({
        title: 'Error al registrar efectivo',
        message: err?.message || 'No se pudo registrar la entrega de efectivo.',
        type: 'error',
        icon: '❌',
      });
    },
  });

  const close = useMutation({
    mutationFn: (loadId: string) => apiRequest<Settlement>(`/settlements/${loadId}/close`, {
      method: 'POST',
      body: JSON.stringify({
        pendingLocalOperations,
        notes: closeNotes[loadId] || 'Liquidación cerrada por administración',
      }),
    }),
    onSuccess: (data) => {
      setToast({
        title: 'Liquidación cerrada exitosamente',
        message: `La Carga ${data.loadNumber} · ${data.routeCode} ha sido cerrada oficialmente.`,
        type: 'success',
        icon: '🔒',
      });
      setConfirmCloseLoad(null);
      void refresh();
    },
    onError: (err: any) => {
      setToast({
        title: 'Error al cerrar liquidación',
        message: err?.message || 'No se pudo cerrar la liquidación.',
        type: 'error',
        icon: '⚠️',
      });
    },
  });

  const activeLoads = loads.data?.filter(item => item.status === 'STARTED') ?? [];

  const handleRequestClose = (item: Settlement) => {
    if (item.monetaryDifference > 0) {
      setConfirmCloseLoad(item);
    } else {
      close.mutate(item.routeLoadId);
    }
  };

  return <main>
    <PageHeader
      eyebrow="Conciliación independiente"
      title="Liquidaciones"
      description="El servidor calcula todas las fuentes oficiales. El desglose separa claramente las ventas al contado, cobros de crédito anteriores y el dinero físico a entregar."
    />

    {/* Toast Flotante */}
    {toast && (
      <aside
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          maxWidth: '420px',
          backgroundColor: toast.type === 'error' ? '#fef2f2' : toast.type === 'warning' ? '#fffbeb' : toast.type === 'info' ? '#eff6ff' : '#ecfdf5',
          border: `1.5px solid ${toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : toast.type === 'info' ? '#3b82f6' : '#10b981'}`,
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
          padding: '1rem 1.25rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
          color: toast.type === 'error' ? '#991b1b' : toast.type === 'warning' ? '#92400e' : toast.type === 'info' ? '#1e40af' : '#065f46',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <span style={{ fontSize: '1.4rem', lineHeight: '1.2' }}>{toast.icon || 'ℹ️'}</span>
        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{toast.title}</strong>
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.3' }}>{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Cerrar notificación"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.1rem',
            cursor: 'pointer',
            padding: '0 0.2rem',
            color: 'inherit',
            opacity: 0.7,
          }}
        >
          ✕
        </button>
      </aside>
    )}

    {/* Modal de Advertencia al cerrar con Faltante */}
    {confirmCloseLoad && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            borderTop: '5px solid #ef4444',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.8rem' }}>⚠️</span>
            <h3 id="confirm-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: '#991b1b' }}>
              ¿Cerrar con faltante de efectivo?
            </h3>
          </div>
          <p style={{ fontSize: '0.95rem', color: '#374151', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
            La <strong>Carga {confirmCloseLoad.loadNumber} ({confirmCloseLoad.routeCode})</strong> tiene un faltante monetario de{' '}
            <strong style={{ color: '#dc2626', fontSize: '1.1rem' }}>{money(confirmCloseLoad.monetaryDifference)}</strong>.
          </p>
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '0.85rem',
              marginBottom: '1.25rem',
              fontSize: '0.85rem',
              color: '#991b1b',
            }}
          >
            <strong>Efectivo físico esperado:</strong> {money(confirmCloseLoad.expectedCash)}<br />
            <strong>Efectivo registrado recibido:</strong> {money(confirmCloseLoad.deliveredCash)}<br />
            <strong>Diferencia faltante:</strong> {money(confirmCloseLoad.monetaryDifference)}<br />
            <em>Si ya recibió este dinero del vendedor, cancélelo e ingréselo primero en la casilla de efectivo recibido.</em>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmCloseLoad(null)}
              style={{ padding: '0.6rem 1rem' }}
            >
              Cancelar y registrar efectivo
            </button>
            <button
              type="button"
              className="primary"
              disabled={close.isPending}
              onClick={() => close.mutate(confirmCloseLoad.routeLoadId)}
              style={{
                backgroundColor: '#dc2626',
                borderColor: '#dc2626',
                color: '#ffffff',
                padding: '0.6rem 1rem',
              }}
            >
              {close.isPending ? 'Cerrando...' : `Confirmar cierre con faltante (${money(confirmCloseLoad.monetaryDifference)})`}
            </button>
          </div>
        </div>
      </div>
    )}

    {pendingLocalOperations > 0 && (
      <div className="alert error">
        Existen operaciones pendientes de sincronización ({pendingLocalOperations}). La liquidación no puede cerrarse definitivamente.{' '}
        <button className="secondary" onClick={() => void syncNow()}>Sincronizar ahora</button>
      </div>
    )}

    {/* Recorridos activos por liquidar */}
    <section className="panel section-panel">
      <div className="section-heading">
        <h2>Recorridos por liquidar</h2>
        <span>{activeLoads.length}</span>
      </div>
      <div className="data-list">
        {activeLoads.length === 0 && <p className="status-note">No hay recorridos activos pendientes de cálculo inicial.</p>}
        {activeLoads.map(load => (
          <div className="data-row" key={load.id}>
            <span>Carga {load.loadNumber} · {load.routeCode} · {load.routeName}</span>
            <button className="primary" disabled={calculate.isPending} onClick={() => calculate.mutate(load.id)}>
              {calculate.isPending ? 'Calculando...' : 'Calcular con fuentes oficiales'}
            </button>
          </div>
        ))}
      </div>
    </section>

    {/* Conciliaciones */}
    <section className="section-panel">
      <div className="section-heading">
        <h2>Conciliaciones</h2>
        <span>{settlements.data?.length ?? 0}</span>
      </div>
      {(settlements.error || calculate.error || deliver.error || close.error) && (
        <div className="alert error">
          {(settlements.error ?? calculate.error ?? deliver.error ?? close.error)?.message}
        </div>
      )}

      <div className="sales-grid">
        {settlements.data?.map(item => {
          const salesCashValue = item.salesCash ?? (item.expectedCash - (item.creditCollectionsCash ?? 0));
          const creditCollectionsCashValue = item.creditCollectionsCash ?? 0;
          const isClosed = item.loadStatus !== 'STARTED' || item.status === 'CLOSED';

          return (
            <article className="panel sale-card" key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="section-heading">
                <div>
                  <strong>Carga {item.loadNumber} · {item.routeCode} · {item.routeName}</strong>
                  <span>Vendedor: {item.sellerName}</span>
                </div>
                <span className={`status-pill ${item.status === 'BALANCED' || item.monetaryDifference === 0 ? 'status-ok' : ''}`}>
                  {statusLabels[item.status] ?? item.status}
                </span>
              </div>

              {/* Bloque 1: Desglose de Efectivo Físico (Dinero que el vendedor rinde en mano) */}
              <div
                style={{
                  border: '1.5px solid #0284c7',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, color: '#0369a1', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>💵</span>
                    <span>Flujo de Efectivo Físico en Mano</span>
                  </h4>
                  <small style={{ color: '#0284c7', fontWeight: 600 }}>Rendición de cuentas de ruta</small>
                </div>

                <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                  <article style={{ background: '#ffffff', border: '1px solid #bae6fd' }}>
                    <span title="Efectivo cobrado por ventas al contado realizadas hoy">Ventas contado (Hoy)</span>
                    <strong>{money(salesCashValue)}</strong>
                  </article>
                  <article style={{ background: '#ffffff', border: '1px solid #bae6fd' }}>
                    <span title="Abonos en efectivo cobrados hoy a clientes con crédito pendiente">Abonos cobrados (Ruta)</span>
                    <strong style={{ color: '#0284c7' }}>{money(creditCollectionsCashValue)}</strong>
                  </article>
                  <article style={{ background: '#e0f2fe', border: '2px solid #0284c7' }}>
                    <span title="Total de dinero físico que el vendedor debe entregar">Total efectivo a entregar</span>
                    <strong style={{ color: '#0369a1', fontSize: '1.15rem' }}>{money(item.expectedCash)}</strong>
                  </article>
                  <article style={{ background: '#ffffff', border: '1px solid #bae6fd' }}>
                    <span title="Efectivo contado y recibido físicamente por administración">Efectivo entregado</span>
                    <strong style={{ color: item.deliveredCash > 0 ? '#15803d' : '#6b7280' }}>{money(item.deliveredCash)}</strong>
                  </article>
                  <article
                    style={{
                      background: item.monetaryDifference === 0 ? '#ecfdf5' : '#fef2f2',
                      border: `2px solid ${item.monetaryDifference === 0 ? '#10b981' : '#ef4444'}`,
                    }}
                  >
                    <span>Diferencia monetaria</span>
                    <strong
                      style={{
                        color: item.monetaryDifference === 0 ? '#15803d' : '#dc2626',
                        fontSize: '1.15rem',
                      }}
                    >
                      {money(item.monetaryDifference)}
                    </strong>
                    <small style={{ fontSize: '0.75rem', fontWeight: 600, color: item.monetaryDifference === 0 ? '#15803d' : '#dc2626' }}>
                      {item.monetaryDifference === 0 ? '✓ Cuadrado' : item.monetaryDifference > 0 ? '⚠️ Faltante' : '🔵 Sobrante'}
                    </small>
                  </article>
                </div>
              </div>

              {/* Bloque 2: Otras Formas de Cobro y Facturación del Día */}
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '0.85rem',
                }}
              >
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#4b5563', fontSize: '0.85rem' }}>
                  Resumen de Ventas y Formas de Cobro del Día
                </h4>
                <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                  <article>
                    <span title="Ventas que se entregaron al cliente a crédito">Crédito otorgado hoy</span>
                    <strong style={{ color: '#b45309' }}>{money(item.appliedCredit)}</strong>
                  </article>
                  <article>
                    <span title="Pagos verificados por transferencia bancaria">Transferencias verificadas</span>
                    <strong>{money(item.verifiedTransfers)}</strong>
                  </article>
                  <article>
                    <span title="Total de ventas concretadas en este recorrido">Total ventas recorrido</span>
                    <strong>{money(item.salesTotal)}</strong>
                  </article>
                </div>
              </div>

              {/* Conciliación Física */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Conciliación física</h3>
                <div className="data-list">
                  {item.items.map(row => (
                    <div className="data-row" key={row.id}>
                      <span>{row.productName}</span>
                      <strong>
                        {Number(row.loadedUnits)} − {Number(row.soldUnits)} − {Number(row.returnedGoodUnits)} − {Number(row.approvedWasteUnits)} = {Number(row.physicalDifference)}
                      </strong>
                    </div>
                  ))}
                </div>
                <p className="status-note" style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                  Carga − ventas − producto bueno devuelto − merma aprobada = diferencia física. Devoluciones de cliente recibidas: {item.items.reduce((sum, row) => sum + Number(row.customerReturnUnits), 0)}.
                </p>
              </div>

              {/* Bloque: Desglose de Ventas por Producto y Precio */}
              <div
                style={{
                  border: '1.5px solid #0d9488',
                  backgroundColor: '#f0fdfa',
                  borderRadius: '8px',
                  padding: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <h4 style={{ margin: 0, color: '#0f766e', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🏷️</span>
                    <span>Productos Vendidos por Precio</span>
                  </h4>
                  <small style={{ color: '#0f766e', fontWeight: 600 }}>Detalle de tarifas aplicadas</small>
                </div>

                {(!item.salesByPrice || item.salesByPrice.length === 0) ? (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                    No se registraron ventas en este recorrido.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {Object.values(
                      item.salesByPrice.reduce<Record<string, {
                        productName: string;
                        totalQuantity: number;
                        totalAmount: number;
                        prices: Array<{ presentationName: string; unitPrice: number; quantitySold: number; totalAmount: number }>;
                      }>>((acc, row) => {
                        const key = row.productId || row.productName;
                        if (!acc[key]) {
                          acc[key] = {
                            productName: row.productName,
                            totalQuantity: 0,
                            totalAmount: 0,
                            prices: [],
                          };
                        }
                        acc[key].totalQuantity += Number(row.quantitySold);
                        acc[key].totalAmount += Number(row.totalAmount);
                        acc[key].prices.push({
                          presentationName: row.presentationName,
                          unitPrice: Number(row.unitPrice),
                          quantitySold: Number(row.quantitySold),
                          totalAmount: Number(row.totalAmount),
                        });
                        return acc;
                      }, {})
                    ).map((group, groupIndex) => (
                      <div
                        key={groupIndex}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #ccfbf1',
                          borderRadius: '6px',
                          padding: '0.6rem 0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0fdfa', paddingBottom: '0.35rem', marginBottom: '0.4rem' }}>
                          <strong style={{ fontSize: '0.9rem', color: '#134e4a' }}>
                            {group.productName}
                          </strong>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f766e', background: '#ccfbf1', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                            Total: {group.totalQuantity} und · {money(group.totalAmount)}
                          </span>
                        </div>

                        <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#64748b', fontSize: '0.76rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '0.2rem 0', fontWeight: 600 }}>Cantidad vendida</th>
                              <th style={{ padding: '0.2rem 0', fontWeight: 600 }}>Precio unitario</th>
                              <th style={{ padding: '0.2rem 0', fontWeight: 600, textAlign: 'right' }}>Total a este precio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.prices.map((p, pIndex) => (
                              <tr key={pIndex} style={{ borderBottom: pIndex < group.prices.length - 1 ? '1px dashed #f1f5f9' : 'none' }}>
                                <td style={{ padding: '0.3rem 0', fontWeight: 600, color: '#1e293b' }}>
                                  {p.quantitySold} {p.presentationName ? `(${p.presentationName})` : 'und'}
                                </td>
                                <td style={{ padding: '0.3rem 0', color: '#0f766e', fontWeight: 600 }}>
                                  a {money(p.unitPrice)} c/u
                                </td>
                                <td style={{ padding: '0.3rem 0', textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>
                                  {money(p.totalAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historial de entregas de efectivo registradas */}
              {item.cashDeliveries && item.cashDeliveries.length > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem' }}>
                  <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', color: '#334155' }}>
                    Recibos de efectivo ingresados:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#475569' }}>
                    {item.cashDeliveries.map(cd => (
                      <li key={cd.id}>
                        <strong>{money(cd.amount)}</strong> &mdash; {cd.notes} (Recibido por {cd.receivedByUsername || 'administrador'} el {new Date(cd.deliveredAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.blockingReasons.length > 0 && (
                <div className="alert error">
                  Bloqueos para cierre: {item.blockingReasons.join(', ')}
                </div>
              )}

              {/* ACCIONES PARA CARGAS ACTIVAS (STARTED) */}
              {!isClosed && (
                <>
                  {canReceiveCash && (
                    <div className="review-box" style={{ background: '#ffffff', border: '1.5px solid #0284c7', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#0369a1', fontSize: '0.9rem' }}>Ingreso de Efectivo Recibido Físicamente</strong>
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            const suggested = item.monetaryDifference > 0 ? item.monetaryDifference : item.expectedCash;
                            setCash(current => ({ ...current, [item.routeLoadId]: suggested.toFixed(2) }));
                          }}
                        >
                          Copiar esperado ({money(item.monetaryDifference > 0 ? item.monetaryDifference : item.expectedCash)})
                        </button>
                      </div>
                      <label>
                        Monto en efectivo recibido (Q)
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder={item.monetaryDifference > 0 ? item.monetaryDifference.toFixed(2) : item.expectedCash.toFixed(2)}
                          value={cash[item.routeLoadId] ?? ''}
                          onChange={event => setCash(current => ({ ...current, [item.routeLoadId]: event.target.value }))}
                        />
                      </label>
                      <label>
                        Notas de recepción
                        <input
                          placeholder="Efectivo contado y recibido"
                          value={cashNotes[item.routeLoadId] ?? ''}
                          onChange={event => setCashNotes(current => ({ ...current, [item.routeLoadId]: event.target.value }))}
                        />
                      </label>
                      <button
                        className="secondary"
                        disabled={deliver.isPending || !Number(cash[item.routeLoadId])}
                        onClick={() => deliver.mutate(item.routeLoadId)}
                        style={{ background: '#0284c7', color: '#ffffff', borderColor: '#0284c7' }}
                      >
                        {deliver.isPending ? 'Registrando...' : 'Registrar efectivo contado'}
                      </button>
                    </div>
                  )}

                  {canClose && (
                    <div className="review-box" style={{ background: '#ffffff', borderRadius: '8px' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
                        Cierre definitivo de liquidación
                      </strong>
                      {item.monetaryDifference > 0 && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                          ⚠️ Hay una diferencia de <strong>{money(item.monetaryDifference)}</strong> sin registrar. Por favor ingrese el efectivo antes de cerrar, o justifique el faltante en las notas.
                        </div>
                      )}
                      <label>
                        Notas de cierre
                        <input
                          placeholder="Revisado y conforme / Detalle de liquidación"
                          value={closeNotes[item.routeLoadId] ?? ''}
                          onChange={event => setCloseNotes(current => ({ ...current, [item.routeLoadId]: event.target.value }))}
                        />
                      </label>
                      <button
                        className="primary"
                        disabled={close.isPending || pendingLocalOperations > 0 || item.blockingReasons.length > 0 || !closeNotes[item.routeLoadId]}
                        onClick={() => handleRequestClose(item)}
                      >
                        {close.isPending ? 'Cerrando...' : 'Cerrar liquidación'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* CORRECCIÓN ADMINISTRATIVA PARA CARGAS YA CERRADAS CON FALTANTE */}
              {isClosed && canReceiveCash && item.monetaryDifference > 0 && (
                <div
                  style={{
                    border: '1.5px solid #f59e0b',
                    background: '#fffbeb',
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <strong style={{ color: '#92400e', fontSize: '0.95rem' }}>
                      Liquidación cerrada con faltante de {money(item.monetaryDifference)}
                    </strong>
                  </div>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#78350f', lineHeight: '1.4' }}>
                    Si el efectivo físico fue entregado por el vendedor y no se registró antes de dar clic en cerrar, puede asentar la entrega de efectivo a continuación para cuadrar la liquidación:
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1', minWidth: '150px' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#92400e', marginBottom: '0.2rem' }}>
                        Efectivo entregado a asentar (Q)
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder={item.monetaryDifference.toFixed(2)}
                        value={cash[item.routeLoadId] ?? ''}
                        onChange={e => setCash(prev => ({ ...prev, [item.routeLoadId]: e.target.value }))}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #d97706' }}
                      />
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setCash(prev => ({ ...prev, [item.routeLoadId]: item.monetaryDifference.toFixed(2) }))}
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      Copiar faltante ({money(item.monetaryDifference)})
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={deliver.isPending || !Number(cash[item.routeLoadId])}
                      onClick={() => deliver.mutate(item.routeLoadId)}
                      style={{ padding: '0.45rem 1rem', background: '#059669', borderColor: '#059669', color: '#ffffff' }}
                    >
                      {deliver.isPending ? 'Asentando...' : 'Asentar efectivo y cuadrar'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  </main>;
}
