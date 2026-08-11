import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';

type AuditEvent = { id: string; username: string; deviceName: string; action: string; entityType: string;
  entityId?: string; beforeData?: Record<string, unknown>; afterData?: Record<string, unknown>;
  correlationId: string; ipAddress?: string; occurredAt: string };
type Page = { content: AuditEvent[]; totalElements: number; page: number; size: number; hasNext: boolean };
type Filters = { from: string; to: string; action: string; entityType: string; user: string; correlationId: string };

const today = new Date().toISOString().slice(0, 10);
const initial: Filters = { from: today, to: today, action: '', entityType: '', user: '', correlationId: '' };

function parameters(filters: Filters, page: number) {
  return new URLSearchParams({ ...filters, page: String(page), size: '25' }).toString();
}

export function AuditPage() {
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(0);
  const query = useMemo(() => parameters(filters, page), [filters, page]);
  const events = useQuery({ queryKey: ['audit', query], queryFn: () => apiRequest<Page>(`/audit?${query}`) });
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(0); setFilters({ ...draft }); };
  return <main>
    <p className="eyebrow">Trazabilidad inmutable</p><h1>Auditoría</h1>
    <p className="muted">Cada consulta también queda auditada. Contraseñas, tokens y credenciales se eliminan antes de almacenar o mostrar datos.</p>
    <form className="panel audit-filters" onSubmit={submit}>
      <label>Desde<input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} required /></label>
      <label>Hasta<input type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} required /></label>
      <label>Acción<input value={draft.action} onChange={event => setDraft({ ...draft, action: event.target.value })} placeholder="CREATE_SALE" /></label>
      <label>Entidad<input value={draft.entityType} onChange={event => setDraft({ ...draft, entityType: event.target.value })} placeholder="SALE" /></label>
      <label>Usuario<input value={draft.user} onChange={event => setDraft({ ...draft, user: event.target.value })} /></label>
      <label className="wide">Correlation ID<input value={draft.correlationId} onChange={event => setDraft({ ...draft, correlationId: event.target.value })} /></label>
      <button className="primary" type="submit">Aplicar filtros</button>
    </form>
    {events.isLoading && <section className="panel">Consultando auditoría…</section>}
    {events.error && <div className="alert error">{events.error.message}</div>}
    {events.data && <section className="audit-list">
      <div className="section-heading"><div><h2>Eventos</h2><span>{events.data.totalElements} registros</span></div></div>
      {events.data.content.length === 0 ? <article className="panel"><p>No hay eventos para los filtros seleccionados.</p></article> :
        events.data.content.map(item => <article className="panel audit-event" key={item.id}>
          <div className="section-heading"><div><strong>{item.action}</strong><span>{item.entityType}{item.entityId ? ` · ${item.entityId}` : ''}</span></div>
            <time>{new Date(item.occurredAt).toLocaleString()}</time></div>
          <p>{item.username} · {item.deviceName || 'Sin dispositivo'} · IP {item.ipAddress || 'no disponible'}</p>
          <p className="audit-line">Correlation ID: {item.correlationId}</p>
          <div className="audit-data"><div><strong>Antes</strong><code>{JSON.stringify(item.beforeData ?? {})}</code></div>
            <div><strong>Después</strong><code>{JSON.stringify(item.afterData ?? {})}</code></div></div>
        </article>)}
      <div className="report-pagination"><button className="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page + 1}</span><button className="secondary" disabled={!events.data.hasNext} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
    </section>}
  </main>;
}
