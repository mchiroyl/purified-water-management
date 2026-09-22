import { ApiError, type ApiErrorPayload } from '../types/api';

export const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function resolveApiUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = (baseUrl || '/api').replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (base.endsWith('/api')) {
    if (cleanPath.startsWith('/api/')) {
      return `${base}${cleanPath.slice(4)}`;
    }
    return `${base}${cleanPath}`;
  }

  if (cleanPath.startsWith('/api/')) {
    return `${base}${cleanPath}`;
  }
  return `${base}/api${cleanPath}`;
}

function isAuthEndpoint(path: string): boolean {
  return path.startsWith('/auth/');
}

function publish(name: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name));
}

class RefreshUnavailableError extends Error {
  constructor() {
    super('El servicio de renovación no está disponible.');
    this.name = 'RefreshUnavailableError';
  }
}

class RefreshRejectedError extends Error {
  constructor() {
    super('La sesión ya no está vigente.');
    this.name = 'RefreshRejectedError';
  }
}

async function refreshAccessToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (response.status < 500) publish('agua-pura:request-success');
  if (response.status >= 500) {
    publish('agua-pura:request-failure');
    throw new RefreshUnavailableError();
  }
  if (!response.ok) throw new RefreshRejectedError();
  const payload = await response.json() as { accessToken?: string };
  if (!payload.accessToken) throw new Error('El servidor no devolvió un token de sesión.');
  setAccessToken(payload.accessToken);
  return payload.accessToken;
}

async function refreshOnce(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .catch(error => {
        if (!(error instanceof RefreshRejectedError)) throw error;
        setAccessToken(null);
        publish('agua-pura:session-expired');
        throw error;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function headersFor(init: RequestInit, accept: string): Headers {
  const headers = new Headers(init.headers);
  headers.set('Accept', accept);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  else headers.delete('Authorization');
  return headers;
}

async function fetchWithRefresh(path: string, init: RequestInit, accept: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: headersFor(init, accept),
      credentials: 'include',
    });
  } catch (error) {
    publish('agua-pura:request-failure');
    throw error;
  }
  if (response.status < 500) publish('agua-pura:request-success');

  if (response.status === 401 && accessToken && !isAuthEndpoint(path)) {
    try {
      await refreshOnce();
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: headersFor(init, accept),
        credentials: 'include',
      });
      if (response.status < 500) publish('agua-pura:request-success');
    } catch (error) {
      // Transport and backend outages are surfaced as request failures without expiring the session.
      if (error instanceof TypeError) publish('agua-pura:request-failure');
      throw error;
    }
  }
  return response;
}

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  const fallback: ApiErrorPayload = {
    code: 'HTTP_ERROR',
    message: fallbackMessage,
    correlationId: response.headers.get('X-Correlation-Id') ?? 'unknown',
    timestamp: new Date().toISOString(),
  };
  const payload = await response.json().catch(() => fallback) as ApiErrorPayload;
  throw new ApiError(response.status, payload);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithRefresh(path, init, 'application/json');
  if (response.status >= 500) publish('agua-pura:request-failure');
  if (response.status === 204) return undefined as T;
  if (!response.ok) return throwApiError(response, 'No fue posible completar la solicitud.');
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  return apiFile(path, 'application/pdf', init);
}

export async function apiFile(path: string, accept = 'application/octet-stream', init: RequestInit = {}): Promise<Blob> {
  const response = await fetchWithRefresh(path, init, accept);
  if (response.status >= 500) publish('agua-pura:request-failure');
  if (!response.ok) return throwApiError(response, 'No fue posible obtener el archivo solicitado.');
  return response.blob();
}
