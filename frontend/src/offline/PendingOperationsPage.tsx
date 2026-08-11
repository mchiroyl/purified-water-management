import { useSync } from './SyncContext';
import type { SyncStatus } from './mobileDatabase';

const statusLabels: Record<SyncStatus, string> = {
  PENDING: 'Pendiente',
  SYNCING: 'Sincronizando',
  SYNCED: 'Sincronizada',
  FAILED_RETRYABLE: 'Reintento pendiente',
  CONFLICT: 'En conflicto',
  REJECTED: 'Rechazada',
};

export function PendingOperationsPage() {
  const { snapshot, operations, syncNow } = useSync();
  const unfinished = operations.filter((operation) => operation.status !== 'SYNCED');
  const isRunning = snapshot.state === 'CHECKING_CONNECTION' || snapshot.state === 'SYNCING';

  return (
    <>
      <p className="eyebrow">Sincronización</p>
      <div className="section-heading">
        <div>
          <h1>Operaciones pendientes</h1>
          <p className="muted">Cada registro conserva su resultado independiente y sus dependencias.</p>
        </div>
        <button className="primary" type="button" disabled={isRunning} onClick={() => void syncNow()}>
          {isRunning ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
      </div>

      <section className="metric-grid sync-metrics" aria-label="Resumen de sincronización">
        <article><span>Pendientes</span><strong>{unfinished.length}</strong></article>
        <article><span>Sincronizadas</span><strong>{operations.filter((item) => item.status === 'SYNCED').length}</strong></article>
        <article><span>Conflictos</span><strong>{operations.filter((item) => item.status === 'CONFLICT').length}</strong></article>
        <article><span>Rechazadas</span><strong>{operations.filter((item) => item.status === 'REJECTED').length}</strong></article>
      </section>

      {snapshot.state === 'BLOCKED' && <div className="alert error">No hay conexión confirmada. Las operaciones permanecen guardadas en el dispositivo.</div>}
      {snapshot.state === 'ERROR' && <div className="alert error">La sincronización se interrumpió. Puede reintentar sin duplicar operaciones.</div>}
      {operations.length === 0 && <section className="panel"><h2>Todo al día</h2><p>No existen operaciones locales por enviar.</p></section>}

      <section className="sync-operation-list">
        {operations.map((operation) => (
          <article className="panel sync-operation" key={operation.clientOperationId}>
            <div className="section-heading">
              <div><strong>{operation.entityType}</strong><span>{operation.operationType}</span></div>
              <span className={`status ${operation.status.toLowerCase()}`}>{statusLabels[operation.status]}</span>
            </div>
            <code>{operation.clientOperationId}</code>
            <p className="audit-line">Creada: {new Date(operation.createdAtLocal).toLocaleString('es-GT')} · Reintentos: {operation.retryCount}</p>
            {operation.dependencies.length > 0 && <p className="audit-line">Depende de {operation.dependencies.length} operación(es).</p>}
            {operation.lastErrorMessage && <div className="alert error">{operation.lastErrorCode}: {operation.lastErrorMessage}</div>}
          </article>
        ))}
      </section>
    </>
  );
}
