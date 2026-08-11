import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../../services/apiClient';

type Transfer = { id: string; saleId: string; documentNumber: string; routeCode: string; routeName: string; sellerName: string; customerCode: string; customerName: string; amount: number; currencyCode: string; status: string; reference: string; bank: string; evidenceReference: string; registeredByUsername: string; verifiedByUsername?: string; rejectionReason?: string; createdAt: string };
const statusLabel: Record<string, string> = { PENDING_VERIFICATION: 'Pendiente', VERIFIED: 'Verificada', REJECTED: 'Rechazada' };

export function TransfersPage() {
  const client = useQueryClient();
  const transfers = useQuery({ queryKey: ['payments', 'transfers'], queryFn: () => apiRequest<Transfer[]>('/payments/transfers') });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const decision = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => apiRequest<Transfer>(`/payments/transfers/${id}/decision`, {
      method: 'POST', body: JSON.stringify({ approve, rejectionReason: approve ? '' : reasons[id] ?? '' })
    }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['payments', 'transfers'] })
  });

  return <main>
    <p className="eyebrow">Segregación de funciones</p><h1>Transferencias</h1>
    <p className="muted">La persona que registró la transferencia no puede verificarla. Toda decisión queda identificada y fechada por el servidor.</p>
    {transfers.error && <div className="alert error">{transfers.error.message}</div>}
    <section className="transfer-grid">{transfers.data?.map(item => <article className="panel transfer-card" key={item.id}>
      <div className="section-heading"><div><strong>{item.reference}</strong><span>{item.documentNumber} · {item.customerCode} · {item.customerName}</span></div><span className={`status ${item.status === 'VERIFIED' ? 'active' : item.status === 'REJECTED' ? 'rejected' : ''}`}>{statusLabel[item.status] ?? item.status}</span></div>
      <strong className="transfer-amount">Q{Number(item.amount).toFixed(2)} {item.currencyCode}</strong>
      <p>{item.bank || 'Banco no indicado'} · {item.evidenceReference || 'Sin evidencia adjunta'}</p>
      <p className="audit-line">{item.routeCode} · {item.routeName} · Vendedor: {item.sellerName} · Registró: {item.registeredByUsername}</p>
      {item.status === 'PENDING_VERIFICATION' && <div className="transfer-decision">
        <label>Motivo si se rechaza<input value={reasons[item.id] ?? ''} onChange={event => setReasons({ ...reasons, [item.id]: event.target.value })} /></label>
        <button className="primary" disabled={decision.isPending} onClick={() => decision.mutate({ id: item.id, approve: true })}>Verificar transferencia</button>
        <button className="secondary danger-button" disabled={decision.isPending || !(reasons[item.id]?.trim())} onClick={() => decision.mutate({ id: item.id, approve: false })}>Rechazar transferencia</button>
      </div>}
      {item.status === 'REJECTED' && <p className="alert error">Motivo: {item.rejectionReason}</p>}
    </article>)}</section>
    {decision.error && <div className="alert error">{decision.error.message}</div>}
  </main>;
}
