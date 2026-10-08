import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const UPDATE_CHECK_INTERVAL_MS = 45_000;

export function PwaLifecycle() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [updating, setUpdating] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdates = async () => {
        if (registration.installing) return;
        if ('onLine' in navigator && !navigator.onLine) return;
        try {
          await registration.update();
          if (registration.waiting) {
            setNeedRefresh(true);
          }
        } catch {
          // Fallo de red o verificación silencioso
        }
      };

      // Sondeo periódico cada 45 segundos para detectar despliegues mientras la app esté abierta
      window.setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);

      // Verificación inmediata al reenfocar o volver visible la pestaña
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          void checkForUpdates();
        }
      };
      const handleFocus = () => void checkForUpdates();
      const handleOnline = () => void checkForUpdates();

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('online', handleOnline);

      // Si ya hay un service worker en espera, notificar de inmediato
      if (registration.waiting) {
        setNeedRefresh(true);
      } else {
        window.setTimeout(() => void checkForUpdates(), 3000);
      }
    }
  });

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const handleApplyUpdate = async () => {
    setUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch {
      window.location.reload();
    }
  };

  if (!offlineReady && !needRefresh && !installPrompt) return null;
  return (
    <aside className="pwa-lifecycle" aria-live="polite">
      {offlineReady && (
        <div className="pwa-toast pwa-toast-offline">
          <span>La aplicación está lista para trabajar sin conexión.</span>
          <button type="button" className="text-button" aria-label="Cerrar aviso offline" onClick={() => setOfflineReady(false)}>
            ×
          </button>
        </div>
      )}
      {needRefresh && (
        <div className="pwa-toast pwa-toast-update" role="alert">
          <div className="pwa-toast-body">
            <span className="pwa-toast-icon" aria-hidden="true">🔄</span>
            <div>
              <strong>Actualización disponible</strong>
              <p>Hay una versión nueva disponible. Actualice para aplicar los últimos cambios.</p>
            </div>
          </div>
          <div className="pwa-toast-actions">
            <button
              type="button"
              className="primary"
              disabled={updating}
              onClick={() => void handleApplyUpdate()}
            >
              {updating ? 'Actualizando...' : 'Actualizar ahora'}
            </button>
            <button
              type="button"
              className="text-button"
              aria-label="Posponer actualización"
              disabled={updating}
              onClick={() => setNeedRefresh(false)}
            >
              Más tarde
            </button>
          </div>
        </div>
      )}
      {installPrompt && (
        <div className="pwa-toast pwa-toast-install">
          <span>Instale la aplicación para acceso rápido desde este dispositivo.</span>
          <button type="button" className="secondary" onClick={() => void install()}>
            Instalar aplicación
          </button>
        </div>
      )}
    </aside>
  );
}
