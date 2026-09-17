import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureCurrentLocation } from './geolocation';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('captureCurrentLocation', () => {
  it('resuelve inmediatamente cuando la primera lectura alcanza la precisión objetivo (<=20 m)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T18:30:00.000Z'));
    let positionCallback: PositionCallback | null = null;
    const watchPosition = vi.fn((success: PositionCallback) => {
      positionCallback = success;
      return 1;
    });
    const clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });

    const promise = captureCurrentLocation('confirmar la venta');
    positionCallback!({ coords: { latitude: 14.6349, longitude: -90.5069, accuracy: 15 } } as GeolocationPosition);

    await expect(promise).resolves.toEqual({
      latitude: 14.6349,
      longitude: -90.5069,
      accuracyMeters: 15,
      capturedAt: '2026-08-16T18:30:00.000Z',
    });
    expect(clearWatch).toHaveBeenCalledWith(1);
  });

  it('conserva la lectura más precisa y espera hasta que se cumple el objetivo', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T18:30:00.000Z'));
    let positionCallback: PositionCallback | null = null;
    const watchPosition = vi.fn((success: PositionCallback) => {
      positionCallback = success;
      return 2;
    });
    const clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });

    const promise = captureCurrentLocation('confirmar la venta');
    // Primera lectura: baja precisión (WiFi/celular)
    positionCallback!({ coords: { latitude: 14.6349, longitude: -90.5069, accuracy: 250 } } as GeolocationPosition);
    // Segunda lectura: mejor pero aún fuera del objetivo
    positionCallback!({ coords: { latitude: 14.6350, longitude: -90.5070, accuracy: 45 } } as GeolocationPosition);
    // Tercera lectura: alcanza objetivo GPS
    positionCallback!({ coords: { latitude: 14.63505, longitude: -90.50705, accuracy: 8 } } as GeolocationPosition);

    await expect(promise).resolves.toMatchObject({ accuracyMeters: 8 });
    expect(clearWatch).toHaveBeenCalledWith(2);
  });

  it('resuelve con la mejor lectura disponible al agotar el tiempo', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T18:30:00.000Z'));
    let positionCallback: PositionCallback | null = null;
    const watchPosition = vi.fn((success: PositionCallback) => {
      positionCallback = success;
      return 3;
    });
    const clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });

    const promise = captureCurrentLocation('confirmar la venta');
    // Solo se recibe una lectura imprecisa
    positionCallback!({ coords: { latitude: 14.6349, longitude: -90.5069, accuracy: 120 } } as GeolocationPosition);

    // Avanzar 30 s para disparar el timeout
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({ accuracyMeters: 120 });
    expect(clearWatch).toHaveBeenCalledWith(3);
  });

  it('rechaza si el timeout expira sin ninguna lectura', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: vi.fn(() => 4),
        clearWatch: vi.fn(),
      },
    });

    const promise = captureCurrentLocation('confirmar la venta');
    const assertion = expect(promise).rejects.toThrow('No fue posible obtener la ubicación para confirmar la venta');
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('explica cómo resolver un permiso de ubicación denegado', async () => {
    let errorCallback: PositionErrorCallback | null = null;
    const watchPosition = vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => {
      errorCallback = failure;
      return 5;
    });
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch: vi.fn() } });

    const promise = captureCurrentLocation('registrar la recepción de la carga');
    errorCallback!({ code: 1 } as GeolocationPositionError);

    await expect(promise).rejects.toThrow(
      'Se requiere permitir el acceso a la ubicación para registrar la recepción de la carga. Active el permiso e intente nuevamente.',
    );
  });

  it('rechaza cuando el dispositivo no soporta geolocalización', async () => {
    vi.stubGlobal('navigator', { geolocation: undefined });
    await expect(captureCurrentLocation('confirmar la venta')).rejects.toThrow(
      'Este dispositivo no permite obtener la ubicación',
    );
  });
});
