import type { GeoLocationSnapshot } from '../offline/mobileDatabase';

function locationError(label: string, error: GeolocationPositionError) {
  if (error.code === 1) {
    return `Se requiere permitir el acceso a la ubicación para ${label}. Active el permiso e intente nuevamente.`;
  }
  return `No fue posible obtener la ubicación para ${label}. Verifique la señal GPS e intente nuevamente.`;
}

export function captureCurrentLocation(label: string): Promise<GeoLocationSnapshot> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error(`Este dispositivo no permite obtener la ubicación para ${label}. Use un dispositivo compatible e intente nuevamente.`));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        capturedAt: new Date().toISOString(),
      }),
      (error) => reject(new Error(locationError(label, error))),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
