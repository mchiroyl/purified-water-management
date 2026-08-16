import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureCurrentLocation } from './geolocation';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('captureCurrentLocation', () => {
  it('obtiene una posición única y la convierte al contrato de ubicación', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: 14.6349, longitude: -90.5069, accuracy: 4.2 },
    } as GeolocationPosition));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T18:30:00.000Z'));

    await expect(captureCurrentLocation('confirmar la venta')).resolves.toEqual({
      latitude: 14.6349,
      longitude: -90.5069,
      accuracyMeters: 4.2,
      capturedAt: '2026-08-16T18:30:00.000Z',
    });
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });

  it('explica cómo resolver un permiso de ubicación denegado', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => failure({
      code: 1,
    } as GeolocationPositionError));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    await expect(captureCurrentLocation('registrar la recepción de la carga')).rejects.toThrow(
      'Se requiere permitir el acceso a la ubicación para registrar la recepción de la carga. Active el permiso e intente nuevamente.',
    );
  });
});
