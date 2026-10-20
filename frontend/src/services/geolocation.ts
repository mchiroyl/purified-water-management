import type { GeoLocationSnapshot } from '../offline/mobileDatabase';

export const LAST_KNOWN_GPS_KEY = 'agua_pura:last_known_gps';

/**
 * Obtiene la última ubicación GPS válida almacenada en el dispositivo.
 */
export function getLastKnownLocation(): GeoLocationSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_KNOWN_GPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return parsed;
    }
  } catch {
    // Ignorar errores de análisis
  }
  return null;
}

/**
 * Guarda la ubicación GPS más reciente en el almacenamiento local para respaldo offline.
 */
export function saveLastKnownLocation(snapshot: GeoLocationSnapshot): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LAST_KNOWN_GPS_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignorar si la cuota de almacenamiento está llena
  }
}

/** Precisión objetivo en metros (rango 5 a 12 metros para máxima certeza). Si se obtiene <= 12 m se resuelve de inmediato. */
const TARGET_ACCURACY_METERS = 12;
/** Tiempo máximo de espera en milisegundos antes de resolver con la mejor lectura obtenida o posición previa. */
const MAX_WAIT_MS = 8_000;

function locationError(label: string, error?: GeolocationPositionError | { code?: number }) {
  if (error && error.code === 1) {
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
  fallbackLocation?: GeoLocationSnapshot | null;
}

/**
 * Captura la ubicación actual con la máxima precisión posible (5 a 10 metros).
 *
 * Estrategia offline-resilient:
 * 1. Activa `watchPosition` con `enableHighAccuracy: true` y `maximumAge: 120_000` (reutiliza fix satelital reciente).
 * 2. Cada lectura recibida se compara con la mejor anterior; se conserva la de menor accuracy y se guarda en localStorage.
 * 3. Si la precisión alcanza <= TARGET_ACCURACY_METERS (10 m), se resuelve de inmediato.
 * 4. Tras 4 s, si ya hay una lectura aceptable o getCurrentPosition devuelve fix en caché, resuelve.
 * 5. Si la señal satelital no responde (offline bajo techo) y no hay lectura activa tras la ventana, recurre
 *    a fallbackLocation (ej. coordenadas del cliente) o a la última ubicación guardada en la ruta.
 * 6. Si se deniega expresamente el permiso (código 1), siempre rechaza con mensaje de permiso.
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
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;
    let elapsedSeconds = 0;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timeoutId) clearTimeout(timeoutId);
      if (quickGraceTimeout) clearTimeout(quickGraceTimeout);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (tickerId) clearInterval(tickerId);
    };

    const finish = (snapshot: GeoLocationSnapshot) => {
      if (settled) return;
      settled = true;
      cleanup();
      saveLastKnownLocation(snapshot);
      resolve(snapshot);
    };

    const resolveFallbackOrReject = (error?: GeolocationPositionError | { code?: number }) => {
      if (settled) return;
      if (best) {
        finish(best);
        return;
      }
      if (options?.fallbackLocation) {
        finish({
          ...options.fallbackLocation,
          capturedAt: new Date().toISOString(),
        });
        return;
      }
      const cached = getLastKnownLocation();
      if (cached) {
        finish({
          ...cached,
          capturedAt: new Date().toISOString(),
        });
        return;
      }
      settled = true;
      cleanup();
      reject(new Error(locationError(label, error)));
    };

    tickerId = setInterval(() => {
      elapsedSeconds += 1;
      options?.onProgress?.({
        elapsedSeconds,
        accuracyMeters: best?.accuracyMeters ?? null,
      });
    }, 1000);

    // Si el cliente ya tiene coordenadas guardadas en el sistema (fallbackLocation),
    // darle al satélite solo 3 s para un fix preciso (<= 15m).
    // Si en 3 s no lo logra, usar inmediatamente las coordenadas registradas del cliente.
    if (options?.fallbackLocation) {
      fallbackTimeout = setTimeout(() => {
        if (settled) return;
        if (best && best.accuracyMeters !== null && best.accuracyMeters <= 15) {
          finish(best);
        } else {
          finish({
            ...options.fallbackLocation!,
            capturedAt: new Date().toISOString(),
          });
        }
      }, 3_000);
    }

    // Si pasaron 4 segundos y ya tenemos una lectura (aunque sea de 15-40m en bodega), resolver con ella
    const quickGraceTimeout = setTimeout(() => {
      if (settled) return;
      if (best) {
        finish(best);
      } else if (typeof navigator.geolocation.getCurrentPosition === 'function') {
        // Intentar lectura con caché amplio del dispositivo si el satélite puro está tardando
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (settled) return;
            const snap: GeoLocationSnapshot = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyMeters: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
              capturedAt: new Date().toISOString(),
            };
            finish(snap);
          },
          () => {
            // Si falla, dejar que continúe hasta maxWait
          },
          { enableHighAccuracy: false, timeout: 3_000, maximumAge: 300_000 },
        );
      }
    }, 4_000);

    const timeoutId = setTimeout(() => {
      resolveFallbackOrReject();
    }, maxWait);

    try {
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
            saveLastKnownLocation(snapshot);
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
          // Si el usuario denegó expresamente el permiso (código 1), rechazar de inmediato
          if (error.code === 1) {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error(locationError(label, error)));
            return;
          }

          // Si ocurrió timeout de watchPosition o señal no disponible (códigos 2 o 3)
          if (best) {
            finish(best);
            return;
          }

          // Si hay fallback configurado o última ubicación conocida, resolver
          if (options?.fallbackLocation || getLastKnownLocation()) {
            resolveFallbackOrReject(error);
            return;
          }

          // Si aún no vence el tiempo máximo, esperar a que el temporizador o reintento resuelva
          if (elapsedSeconds * 1000 >= maxWait) {
            resolveFallbackOrReject(error);
          }
        },
        { enableHighAccuracy: true, maximumAge: 120_000, timeout: maxWait },
      );
    } catch {
      resolveFallbackOrReject();
    }
  });
}
