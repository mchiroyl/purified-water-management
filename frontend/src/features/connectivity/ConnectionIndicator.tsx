import { useConnection } from './ConnectionContext';

export function ConnectionIndicator() {
  const { manager, snapshot } = useConnection();
  const label = snapshot.state === 'ONLINE'
    ? 'En línea'
    : snapshot.state === 'OFFLINE'
      ? 'Sin conexión'
      : snapshot.state === 'DEGRADED'
        ? 'Conexión limitada'
        : snapshot.state === 'UNKNOWN'
          ? 'Estado desconocido'
          : 'Comprobando';

  return (
    <button
      type="button"
      className={`connection ${snapshot.state.toLowerCase()}`}
      disabled={snapshot.state === 'CHECKING'}
      onClick={() => void manager.manualCheck()}
      title="Comprobar conexión ahora"
      aria-live="polite"
    >
      {label}
    </button>
  );
}
