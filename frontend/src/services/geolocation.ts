import type { GeoLocationSnapshot } from '../offline/mobileDatabase';

/** Precisión objetivo en metros. El sistema resuelve inmediatamente al obtener <= 10 m;
 *  lecturas de 5 m o mejores se prefieren al conservar siempre la más precisa. */
const TARGET_ACCURACY_METERS = 10;
/** Tiempo máximo de espera en milisegundos antes de aceptar la mejor lectura disponible. */
const MAX_WAIT_MS = 30_000;

function locationError(label: string, error: GeolocationPositionError) {
  if (error.code === 1) {
    return `Se requiere permitir el acceso a la ubicación para ${label}. Active el permiso e intente nuevamente.`;
  }
  return `No fue posible obtener la ubicación para ${label}. Verifique la señal GPS e intente nuevamente.`;
}

/**
 * Captura la ubicación actual con la máxima precisión posible.
 *
 * Estrategia:
 * 1. Activa `watchPosition` con `enableHighAccuracy: true` y `maximumAge: 0`.
 * 2. Cada lectura recibida se compara con la mejor anterior; se conserva la de menor accuracy.
 * 3. Si la precisión alcanza <= TARGET_ACCURACY_METERS (10 m) se resuelve de inmediato.
 * 4. Tras MAX_WAIT_MS (30 s) se resuelve con la mejor lectura obtenida, aunque no haya
 *    alcanzado el objetivo (rango deseado: 5–10 m).
 * 5. Si transcurre el tiempo sin ninguna lectura válida se rechaza con mensaje descriptivo.
 */
export function captureCurrentLocation(label: string): Promise<GeoLocationSnapshot> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(
      new Error(`Este dispositivo no permite obtener la ubicación para ${label}. Use un dispositivo compatible e intente nuevamente.`),
    );
  }

  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let best: GeoLocationSnapshot | null = null;
    let settled = false;

    const finish = (snapshot: GeoLocationSnapshot) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      resolve(snapshot);
    };

    const timeoutId = setTimeout(() => {
      if (settled) return;
      if (best) {
        finish(best);
      } else {
        settled = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        reject(new Error(`No fue posible obtener la ubicación para ${label}. Verifique la señal GPS e intente nuevamente.`));
      }
    }, MAX_WAIT_MS);

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

        // Resolver inmediatamente si se alcanzó la precisión objetivo
        if (snapshot.accuracyMeters !== null && snapshot.accuracyMeters <= TARGET_ACCURACY_METERS) {
          clearTimeout(timeoutId);
          finish(best);
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        if (settled) return;
        settled = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        reject(new Error(locationError(label, error)));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT_MS },
    );
  });
}
