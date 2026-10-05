import type { GeoLocationSnapshot } from '../offline/mobileDatabase';

/** Precisión objetivo en metros (rango 5 a 10 metros para máxima certeza). Si se obtiene <= 10 m se resuelve de inmediato. */
const TARGET_ACCURACY_METERS = 10;
/** Tiempo máximo de espera en milisegundos antes de resolver con la mejor lectura obtenida. */
const MAX_WAIT_MS = 25_000;

function locationError(label: string, error: GeolocationPositionError) {
  if (error.code === 1) {
    return `Se requiere permitir el acceso a la ubicación para ${label}. Active el permiso e intente nuevamente.`;
  }
  return `No fue posible obtener la ubicación para ${label}. Verifique la señal GPS e intente nuevamente.`;
}

export interface CaptureLocationProgress {
  elapsedSeconds: number;
  accuracyMeters: number | null;
}

export interface CaptureLocationOptions {
  targetAccuracyMeters?: number;
  maxWaitMs?: number;
  onProgress?: (progress: CaptureLocationProgress) => void;
}

/**
 * Captura la ubicación actual con la máxima precisión posible (5 a 10 metros).
 *
 * Estrategia:
 * 1. Activa `watchPosition` con `enableHighAccuracy: true` y `maximumAge: 10_000`.
 * 2. Cada lectura recibida se compara con la mejor anterior; se conserva la de menor accuracy.
 * 3. Si la precisión alcanza <= TARGET_ACCURACY_METERS (10 m), se resuelve de inmediato.
 * 4. Tras maxWaitMs (25 s) se resuelve con la mejor lectura obtenida.
 * 5. Si expira sin ninguna lectura válida, rechaza con mensaje descriptivo.
 */
export function captureCurrentLocation(
  label: string,
  options?: CaptureLocationOptions,
): Promise<GeoLocationSnapshot> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(
      new Error(`Este dispositivo no permite obtener la ubicación para ${label}. Use un dispositivo compatible e intente nuevamente.`),
    );
  }

  const targetAccuracy = options?.targetAccuracyMeters ?? TARGET_ACCURACY_METERS;
  const maxWait = options?.maxWaitMs ?? MAX_WAIT_MS;

  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let best: GeoLocationSnapshot | null = null;
    let settled = false;
    let tickerId: ReturnType<typeof setInterval> | null = null;
    let elapsedSeconds = 0;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timeoutId) clearTimeout(timeoutId);
      if (tickerId) clearInterval(tickerId);
    };

    const finish = (snapshot: GeoLocationSnapshot) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(snapshot);
    };

    tickerId = setInterval(() => {
      elapsedSeconds += 1;
      options?.onProgress?.({
        elapsedSeconds,
        accuracyMeters: best?.accuracyMeters ?? null,
      });
    }, 1000);

    const timeoutId = setTimeout(() => {
      if (settled) return;
      if (best) {
        finish(best);
      } else {
        settled = true;
        cleanup();
        reject(new Error(`No fue posible obtener la ubicación para ${label}. Verifique la señal GPS e intente nuevamente.`));
      }
    }, maxWait);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const snapshot: GeoLocationSnapshot = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          capturedAt: new Date().toISOString(),
        };

        // Conservar la lectura más precisa
        if (
          best === null ||
          (snapshot.accuracyMeters !== null &&
            (best.accuracyMeters === null || snapshot.accuracyMeters < best.accuracyMeters))
        ) {
          best = snapshot;
        }

        options?.onProgress?.({
          elapsedSeconds,
          accuracyMeters: best.accuracyMeters,
        });

        // Resolver inmediatamente si se alcanzó la precisión objetivo (<= 10 m)
        if (snapshot.accuracyMeters !== null && snapshot.accuracyMeters <= targetAccuracy) {
          finish(best);
        }
      },
      (error) => {
        // Si ocurrió timeout de watchPosition pero ya tenemos una lectura previa aceptable, usarla
        if (best && (error.code === 3 || error.code === 2)) {
          finish(best);
          return;
        }
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(locationError(label, error)));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: maxWait },
    );
  });
}
