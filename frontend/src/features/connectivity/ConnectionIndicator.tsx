import { useConnection } from './ConnectionContext';

export function ConnectionIndicator() {
  const { manager, snapshot } = useConnection();
  const isForceOffline = snapshot.mode === 'FORCE_OFFLINE';

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
          onClick={() => manager.setMode('AUTO')}
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

      {/* Indicador de Estado con Luz Testigo */}
      <div className={`status-pill ${badgeClass}`} title={`Estado del enlace: ${label}`}>
        <span className="status-dot" aria-hidden="true" />
        <span className="status-text">{badgeText}</span>
      </div>

      {/* Botón de comprobación manual (conserva compatibilidad de tests y accesibilidad) */}
      <button
        type="button"
        className={`connection ${snapshot.state.toLowerCase()}`}
        disabled={snapshot.state === 'CHECKING' || isForceOffline}
        onClick={() => void manager.manualCheck()}
        title={isForceOffline ? 'Modo local activado' : 'Comprobar conexión ahora'}
        aria-live="polite"
      >
        {label}
      </button>
    </div>
  );
}
