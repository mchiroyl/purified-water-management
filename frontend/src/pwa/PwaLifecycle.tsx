import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaLifecycle() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

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

  if (!offlineReady && !needRefresh && !installPrompt) return null;
  return <aside className="pwa-lifecycle" aria-live="polite">
    {offlineReady && <div><span>La aplicación está lista para trabajar sin conexión.</span><button type="button" className="text-button" aria-label="Cerrar aviso offline" onClick={() => setOfflineReady(false)}>×</button></div>}
    {needRefresh && <div><span>Hay una versión nueva disponible.</span><button type="button" className="primary" onClick={() => void updateServiceWorker(true)}>Actualizar ahora</button><button type="button" className="text-button" aria-label="Posponer actualización" onClick={() => setNeedRefresh(false)}>Más tarde</button></div>}
    {installPrompt && <div><span>Instale la aplicación para acceso rápido desde este dispositivo.</span><button type="button" className="secondary" onClick={() => void install()}>Instalar aplicación</button></div>}
  </aside>;
}
