import { useNavigate } from 'react-router-dom';
import { useConnection } from './ConnectionContext';
import { useSyncOptional } from '../../offline/SyncContext';
import { APP_VERSION } from '../../config/version';

export function ConnectionIndicator() {
  const { manager, snapshot } = useConnection();
  const syncContext = useSyncOptional();
  const navigate = useNavigate();
  const isForceOffline = snapshot.mode === 'FORCE_OFFLINE';

  const unfinishedCount = syncContext?.operations.filter(op =>
    op.status === 'PENDING' || op.status === 'SYNCING' || op.status === 'FAILED_RETRYABLE'
  ).length ?? 0;
  const isSyncing = syncContext?.snapshot.state === 'SYNCING' || syncContext?.snapshot.state === 'CHECKING_CONNECTION';

  const label = snapshot.state === 'ONLINE'
    ? 'En línea'
    : snapshot.state === 'OFFLINE'
      ? (isForceOffline ? 'Modo local' : 'Sin conexión')
      : snapshot.state === 'DEGRADED'
        ? 'Conexión limitada'
        : snapshot.state === 'UNKNOWN'
          ? 'Estado desconocido'
          : 'Comprobando';

  const badgeText = snapshot.state === 'ONLINE'
    ? 'Estado: Red Activa'
    : snapshot.state === 'OFFLINE'
      ? (isForceOffline ? 'Estado: Modo Local' : 'Estado: Sin Señal')
      : snapshot.state === 'DEGRADED'
        ? 'Estado: Red Inestable'
        : 'Estado: Comprobando';

  const badgeClass = snapshot.state === 'ONLINE'
    ? 'active-net'
    : snapshot.state === 'DEGRADED'
      ? 'degraded-net'
      : 'local-mode';

  return (
    <div className="network-control-container" role="region" aria-label="Control de red y sincronización">
      {/* Selector de Modo: Online vs Offline (exacto al diagrama) */}
      <div className="mode-toggle-group" role="radiogroup" aria-label="Modo de conexión">
        <button
          type="button"
          role="radio"
          aria-checked={!isForceOffline}
          className={`mode-btn ${!isForceOffline ? 'active-online' : ''}`}
          onClick={() => {
            manager.setMode('AUTO');
            if (snapshot.state !== 'ONLINE') {
              void manager.manualCheck();
            }
          }}
          title="Modo normal: comunica con el servidor cuando hay cobertura"
        >
          Conectado (Online)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isForceOffline}
          className={`mode-btn ${isForceOffline ? 'active-offline' : ''}`}
          onClick={() => manager.setMode('FORCE_OFFLINE')}
          title="Modo local forzado: guarda todo en el teléfono para zonas sin señal o con 1-2 barritas"
        >
          Sin Señal (Offline)
        </button>
      </div>

      {/* Indicador de Estado único interactivo (elimina duplicidad) */}
      <button
        type="button"
        role="button"
        className={`connection status-pill ${snapshot.state.toLowerCase()} ${badgeClass}`}
        disabled={snapshot.state === 'CHECKING' || isForceOffline}
        onClick={() => void manager.manualCheck()}
        title={isForceOffline ? 'Modo local activado' : 'Toca para comprobar conexión'}
        aria-label={label}
        aria-live="polite"
      >
        <span className="status-dot" aria-hidden="true" />
        <span className="status-text">{badgeText}</span>
      </button>

      {/* Indicador de Versión oficial */}
      <span
        className="app-version-badge"
        title={`Versión oficial del sistema: ${APP_VERSION}`}
        aria-label={`Versión ${APP_VERSION}`}
      >
        {APP_VERSION}
      </span>

      {/* Badge/Botón de operaciones pendientes: lleva a la pantalla de pendientes */}
      {unfinishedCount > 0 && (
        <button
          type="button"
          className="pending-sync-badge"
          onClick={() => navigate('/pending')}
          title={isForceOffline
            ? `${unfinishedCount} operación(es) guardadas en el teléfono. Toca para ver detalle.`
            : `${unfinishedCount} operación(es) pendientes. Toca para ver detalle y sincronizar.`}
        >
          {isSyncing ? '🔄 Sincronizando…' : `⏳ ${unfinishedCount} pendiente${unfinishedCount > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
