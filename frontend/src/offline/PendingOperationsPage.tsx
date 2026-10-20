import { useSync } from './SyncContext';
import { PageHeader } from '../app/PageHeader';
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
  const { snapshot, operations, syncNow, discardOperation, clearRejected } = useSync();
  const pendingCount = operations.filter(
    (op) => op.status === 'PENDING' || op.status === 'SYNCING' || op.status === 'FAILED_RETRYABLE',
  ).length;
  const rejectedOps = operations.filter((op) => op.status === 'REJECTED');
  const isRunning = snapshot.state === 'CHECKING_CONNECTION' || snapshot.state === 'SYNCING';

  return (
    <>
      <PageHeader
        eyebrow="Sincronización"
        title="Operaciones pendientes"
        description="Cada registro conserva su resultado independiente y sus dependencias."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {rejectedOps.length > 0 && (
              <button className="secondary" type="button" onClick={() => void clearRejected()}>
                Limpiar rechazadas ({rejectedOps.length})
              </button>
            )}
            <button className="primary" type="button" disabled={isRunning} onClick={() => void syncNow()}>
              {isRunning ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          </div>
        }
      />

      <section className="metric-grid sync-metrics" aria-label="Resumen de sincronización">
        <article><span>Pendientes</span><strong>{pendingCount}</strong></article>
        <article><span>Sincronizadas</span><strong>{operations.filter((item) => item.status === 'SYNCED').length}</strong></article>
        <article><span>Conflictos</span><strong>{operations.filter((item) => item.status === 'CONFLICT').length}</strong></article>
        <article><span>Rechazadas</span><strong>{rejectedOps.length}</strong></article>
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
            {operation.status === 'REJECTED' && (
              <button
                type="button"
                className="secondary"
                style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                onClick={() => void discardOperation(operation.clientOperationId)}
              >
                🗑️ Descartar registro rechazado
              </button>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
