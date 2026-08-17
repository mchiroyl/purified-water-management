import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '../../app/PageHeader';
import { apiRequest } from '../../services/apiClient';

type Sale = { id: string; documentNumber: string; customerName: string; total: number };
type Effect = {
  effectType: string;
  paymentMethod?: string;
  amount?: number;
  productName?: string;
  quantityBaseUnits?: number;
};
type Annulment = {
  id: string;
  saleId: string;
  documentNumber: string;
  routeCode: string;
  routeName: string;
  customerName: string;
  saleTotal: number;
  status: string;
  reason: string;
  requestedByUsername: string;
  decidedByUsername?: string;
  decisionNotes?: string;
  effects: Effect[];
};

const statusLabels: Record<string, string> = {
  REQUESTED: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};
const money = (value: number) =>
  `Q${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AnnulmentsPage({ canRequest, canDecide }: { canRequest: boolean; canDecide: boolean }) {
  const client = useQueryClient();
  const sales = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiRequest<Sale[]>('/sales'),
    enabled: canRequest,
  });
  const annulments = useQuery({
    queryKey: ['annulments'],
    queryFn: () => apiRequest<Annulment[]>('/annulments'),
  });
  const [form, setForm] = useState({ saleId: '', reason: '' });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['annulments'] });
    await client.invalidateQueries({ queryKey: ['sales'] });
    await client.invalidateQueries({ queryKey: ['inventory'] });
  };
  const request = useMutation({
    mutationFn: () => apiRequest<Annulment>('/annulments', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setForm({ saleId: '', reason: '' });
      await refresh();
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) =>
      apiRequest<Annulment>(`/annulments/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          notes: notes[id] || `${decision === 'APPROVE' ? 'Anulación comprobada' : 'Solicitud rechazada'} por revisor`,
        }),
      }),
    onSuccess: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    request.mutate();
  };
  const requestedSales = new Set(annulments.data?.map((item) => item.saleId) ?? []);

  return (
    <main>
      <PageHeader eyebrow="Corrección compensatoria" title="Anulaciones" description="La venta original nunca se elimina. Una aprobación crea reversiones de inventario, pago y crédito exactamente una vez." />
      {canRequest && (
        <form className="panel section-panel" onSubmit={submit}>
          <h2>Solicitar anulación</h2>
          <div className="form-grid compact-grid">
            <label>
              Venta
              <select required value={form.saleId} onChange={(event) => setForm({ ...form, saleId: event.target.value })}>
                <option value="">Seleccionar</option>
                {sales.data
                  ?.filter((sale) => !requestedSales.has(sale.id))
                  .map((sale) => (
                    <option value={sale.id} key={sale.id}>
                      {sale.documentNumber} · {sale.customerName} · {money(sale.total)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="full-width">
              Motivo
              <textarea required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
            </label>
          </div>
          <button className="primary">Enviar solicitud</button>
        </form>
      )}
      <section className="section-panel">
        <div className="section-heading">
          <h2>Solicitudes registradas</h2>
          <span>{annulments.data?.length ?? 0}</span>
        </div>
        {(annulments.error || request.error || decide.error) && (
          <div className="alert error">{(annulments.error ?? request.error ?? decide.error)?.message}</div>
        )}
        <div className="sales-grid">
          {annulments.data?.map((item) => (
            <article className="panel sale-card" key={item.id}>
              <div className="section-heading">
                <div>
                  <strong>Venta original {item.documentNumber}</strong>
                  <span>{item.routeCode} · {item.customerName} · {money(item.saleTotal)}</span>
                </div>
                <span className="status-pill">{statusLabels[item.status] ?? item.status}</span>
              </div>
              <p>{item.reason}</p>
              <p className="status-note">Solicitó: {item.requestedByUsername} · Decidió: {item.decidedByUsername ?? 'pendiente'}</p>
              <div className="data-list">
                {item.effects.map((effect, index) => (
                  <div className="data-row" key={`${effect.effectType}:${index}`}>
                    {effect.effectType === 'PAYMENT_REVERSAL' ? (
                      <span>Reversión {effect.paymentMethod} · {money(Number(effect.amount))}</span>
                    ) : (
                      <span>Inventario restaurado · {effect.productName} · {Number(effect.quantityBaseUnits)} unidades</span>
                    )}
                  </div>
                ))}
              </div>
              {canDecide && item.status === 'REQUESTED' && (
                <div className="review-box">
                  <label>
                    Notas
                    <input value={notes[item.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} />
                  </label>
                  <div className="form-actions">
                    <button className="secondary" onClick={() => decide.mutate({ id: item.id, decision: 'REJECT' })}>Rechazar</button>
                    <button className="primary" onClick={() => decide.mutate({ id: item.id, decision: 'APPROVE' })}>Aprobar y compensar</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
