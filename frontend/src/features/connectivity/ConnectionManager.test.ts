import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionManager } from './ConnectionManager';

afterEach(() => {
  vi.useRealTimers();
});

describe('ConnectionManager', () => {
  it('confirma ONLINE mediante el endpoint real y publica la hora del servidor', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ONLINE', serverTime: '2026-08-11T02:00:00Z' }), { status: 200 }));
    const manager = new ConnectionManager({ fetcher, timeoutMs: 500 });
    const states: string[] = [];
    const unsubscribe = manager.subscribe((snapshot) => states.push(snapshot.state));

    const result = await manager.check('MANUAL', true);

    expect(result).toMatchObject({ state: 'ONLINE', serverTime: '2026-08-11T02:00:00Z', reason: 'MANUAL' });
    expect(states).toEqual(['UNKNOWN', 'CHECKING', 'ONLINE']);
    expect(fetcher).toHaveBeenCalledWith('/api/connectivity', expect.objectContaining({ cache: 'no-store' }));
    unsubscribe();
    manager.stop();
  });

  it('distingue DEGRADED de OFFLINE sin usar navigator.onLine como autoridad', async () => {
    const degraded = new ConnectionManager({ fetcher: vi.fn().mockResolvedValue(new Response(null, { status: 503 })) });
    expect((await degraded.check('STARTUP', true)).state).toBe('DEGRADED');
    degraded.stop();

    const offline = new ConnectionManager({ fetcher: vi.fn().mockRejectedValue(new TypeError('network unavailable')) });
    expect((await offline.check('STARTUP', true)).state).toBe('OFFLINE');
    offline.stop();
  });

  it('vuelve a ONLINE cuando una solicitud del backend tiene éxito y cancela el reintento', async () => {
    vi.useFakeTimers();
    const lifecycle = new EventTarget();
    const fetcher = vi.fn().mockRejectedValue(new TypeError('network unavailable'));
    const manager = new ConnectionManager({
      fetcher,
      lifecycleTarget: lifecycle,
      retryBaseMs: 1_000,
    });

    manager.start();
    await manager.check('STARTUP', true);
    expect(manager.getSnapshot()).toMatchObject({ state: 'OFFLINE', retryCount: 1 });

    lifecycle.dispatchEvent(new Event('agua-pura:request-success'));

    expect(manager.getSnapshot()).toMatchObject({ state: 'ONLINE', reason: 'REQUEST_SUCCESS', retryCount: 0 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    manager.stop();
  });

  it('ignora el rechazo tardío de una comprobación iniciada antes de una solicitud exitosa', async () => {
    let rejectProbe!: (error: unknown) => void;
    const lifecycle = new EventTarget();
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>((_resolve, reject) => {
      rejectProbe = reject;
    }));
    const manager = new ConnectionManager({ fetcher, lifecycleTarget: lifecycle, timeoutMs: 60_000 });

    manager.start();
    const probe = manager.check('STARTUP', true);
    await Promise.resolve();
    lifecycle.dispatchEvent(new Event('agua-pura:request-success'));
    expect(manager.getSnapshot()).toMatchObject({ state: 'ONLINE', reason: 'REQUEST_SUCCESS' });

    rejectProbe(new TypeError('stale probe failed'));
    await probe;

    expect(manager.getSnapshot()).toMatchObject({ state: 'ONLINE', reason: 'REQUEST_SUCCESS', retryCount: 0 });
    manager.stop();
  });

  it('deduplica comprobaciones simultáneas y respeta el cooldown', async () => {
    let resolveResponse!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    let now = 1_000;
    const manager = new ConnectionManager({ fetcher, now: () => now, minimumIntervalMs: 2_000 });

    const first = manager.check('STARTUP');
    const duplicate = manager.check('FOREGROUND');
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveResponse(new Response(JSON.stringify({ status: 'ONLINE' }), { status: 200 }));
    await Promise.all([first, duplicate]);
    fetcher.mockResolvedValue(new Response(JSON.stringify({ status: 'ONLINE' }), { status: 200 }));

    now = 1_500;
    await manager.check('REQUEST_FAILURE');
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 3_100;
    await manager.check('REQUEST_FAILURE');
    expect(fetcher).toHaveBeenCalledTimes(2);
    manager.stop();
  });

  it('reacciona al ciclo de vida y expone comprobación previa a sincronizar', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ONLINE' }), { status: 200 }));
    const lifecycle = new EventTarget();
    const visibility = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
    Object.defineProperty(visibility, 'visibilityState', { value: 'visible', configurable: true });
    const manager = new ConnectionManager({ fetcher, lifecycleTarget: lifecycle, visibilityTarget: visibility, minimumIntervalMs: 0 });

    manager.start();
    await vi.waitFor(() => expect(manager.getSnapshot().state).toBe('ONLINE'));
    lifecycle.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(manager.getSnapshot().reason).toBe('ONLINE_EVENT'));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    visibility.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(manager.getSnapshot().reason).toBe('FOREGROUND'));
    expect(fetcher).toHaveBeenCalledTimes(3);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await manager.beforeSync();
    expect(fetcher).toHaveBeenCalledTimes(4);
    manager.stop();
  });

  it('aborta por timeout y programa un único reintento controlado', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
    }));
    const manager = new ConnectionManager({ fetcher, timeoutMs: 100, retryBaseMs: 1_000, retryMaximumMs: 2_000 });

    const checking = manager.check('STARTUP', true);
    await vi.advanceTimersByTimeAsync(100);
    expect((await checking).state).toBe('OFFLINE');
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    manager.stop();
  });
});
