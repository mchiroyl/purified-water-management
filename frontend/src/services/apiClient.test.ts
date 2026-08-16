import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, setAccessToken } from './apiClient';

describe('apiClient', () => {
  beforeEach(() => setAccessToken('expired-token'));
  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
  });

  it('renueva una sola vez el access token y reintenta una solicitud 401', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: 'renewed-token',
        user: { id: 'u1', username: 'admin', displayName: 'Administrador', deviceId: 'd1', roles: ['ADMINISTRADOR'], mustChangePassword: false },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);

    await expect(apiRequest<{ ok: boolean }>('/dashboard')).resolves.toEqual({ ok: true });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toContain('/auth/refresh');
    const retriedHeaders = fetcher.mock.calls[2][1]?.headers as Headers;
    expect(retriedHeaders.get('Authorization')).toBe('Bearer renewed-token');
  });

  it('publica éxito de conectividad para la respuesta 401 antes de renovar y para 204', async () => {
    const fetcher = vi.fn();
    const callsAtSuccess: number[] = [];
    const success = vi.fn(() => callsAtSuccess.push(fetcher.mock.calls.length));
    window.addEventListener('agua-pura:request-success', success);
    fetcher
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'renewed-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(apiRequest<{ ok: boolean }>('/dashboard')).resolves.toEqual({ ok: true });
    expect(success).toHaveBeenCalledTimes(3);
    expect(callsAtSuccess).toEqual([1, 2, 3]);

    await expect(apiRequest<void>('/sync')).resolves.toBeUndefined();
    expect(success).toHaveBeenCalledTimes(4);
    window.removeEventListener('agua-pura:request-success', success);
  });

  it('publica fallo de conectividad para respuestas 5xx', async () => {
    const failure = vi.fn();
    window.addEventListener('agua-pura:request-failure', failure);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(apiRequest('/dashboard')).rejects.toMatchObject({ status: 503 });

    expect(failure).toHaveBeenCalledTimes(1);
    window.removeEventListener('agua-pura:request-failure', failure);
  });

  it('publica éxito cuando la renovación responde 400 y conserva la expiración de sesión', async () => {
    const success = vi.fn();
    const expired = vi.fn();
    window.addEventListener('agua-pura:request-success', success);
    window.addEventListener('agua-pura:session-expired', expired);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 400 })));

    await expect(apiRequest('/dashboard')).rejects.toThrow('La sesión ya no está vigente.');

    expect(success).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener('agua-pura:request-success', success);
    window.removeEventListener('agua-pura:session-expired', expired);
  });

  it('publica éxito cuando la renovación responde 204 aunque no entregue token', async () => {
    const success = vi.fn();
    window.addEventListener('agua-pura:request-success', success);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })));

    await expect(apiRequest('/dashboard')).rejects.toThrow();

    expect(success).toHaveBeenCalledTimes(2);
    window.removeEventListener('agua-pura:request-success', success);
  });

  it('publica fallo y conserva la sesión cuando la renovación responde 5xx', async () => {
    const failure = vi.fn();
    const expired = vi.fn();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    window.addEventListener('agua-pura:request-failure', failure);
    window.addEventListener('agua-pura:session-expired', expired);
    vi.stubGlobal('fetch', fetcher);

    await expect(apiRequest('/dashboard')).rejects.toThrow();
    expect(failure).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();

    await expect(apiRequest<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true });
    const preservedHeaders = fetcher.mock.calls[2][1]?.headers as Headers;
    expect(preservedHeaders.get('Authorization')).toBe('Bearer expired-token');
    window.removeEventListener('agua-pura:request-failure', failure);
    window.removeEventListener('agua-pura:session-expired', expired);
  });

  it('publica fallo y conserva la sesión cuando la renovación pierde transporte', async () => {
    const failure = vi.fn();
    const expired = vi.fn();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    window.addEventListener('agua-pura:request-failure', failure);
    window.addEventListener('agua-pura:session-expired', expired);
    vi.stubGlobal('fetch', fetcher);

    await expect(apiRequest('/dashboard')).rejects.toThrow('network unavailable');
    expect(failure).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();

    await expect(apiRequest<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true });
    const preservedHeaders = fetcher.mock.calls[2][1]?.headers as Headers;
    expect(preservedHeaders.get('Authorization')).toBe('Bearer expired-token');
    window.removeEventListener('agua-pura:request-failure', failure);
    window.removeEventListener('agua-pura:session-expired', expired);
  });

  it('comparte la renovación cuando varias solicitudes vencen juntas', async () => {
    let refreshCalls = 0;
    let refreshed = false;
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        refreshed = true;
        return Promise.resolve(new Response(JSON.stringify({ accessToken: 'shared-token' }), { status: 200 }));
      }
      return Promise.resolve(refreshed
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }));
    });
    vi.stubGlobal('fetch', fetcher);

    await expect(Promise.all([
      apiRequest<{ ok: boolean }>('/dashboard'),
      apiRequest<{ ok: boolean }>('/products'),
    ])).resolves.toEqual([{ ok: true }, { ok: true }]);

    expect(refreshCalls).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});
