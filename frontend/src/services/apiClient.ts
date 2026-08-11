import { ApiError, type ApiErrorPayload } from '../types/api';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include'
    });
  } catch (error) {
    window.dispatchEvent(new CustomEvent('agua-pura:request-failure'));
    throw error;
  }

  if (response.status >= 500) window.dispatchEvent(new CustomEvent('agua-pura:request-failure'));

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const fallback: ApiErrorPayload = {
      code: 'HTTP_ERROR',
      message: 'No fue posible completar la solicitud.',
      correlationId: response.headers.get('X-Correlation-Id') ?? 'unknown',
      timestamp: new Date().toISOString()
    };
    const payload = await response.json().catch(() => fallback) as ApiErrorPayload;
    throw new ApiError(response.status, payload);
  }

  return response.json() as Promise<T>;
}

export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/pdf');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' });
  } catch (error) {
    window.dispatchEvent(new CustomEvent('agua-pura:request-failure'));
    throw error;
  }
  if (!response.ok) {
    const fallback: ApiErrorPayload = {
      code: 'HTTP_ERROR',
      message: 'No fue posible obtener el comprobante.',
      correlationId: response.headers.get('X-Correlation-Id') ?? 'unknown',
      timestamp: new Date().toISOString()
    };
    const payload = await response.json().catch(() => fallback) as ApiErrorPayload;
    throw new ApiError(response.status, payload);
  }
  return response.blob();
}
