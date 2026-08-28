const STORAGE_KEY = 'agua-pura.device-suffix';
const KNOWN_DEVICE_KEY = 'agua-pura.known-device-id';

function platform(): string {
  if (typeof navigator === 'undefined') return 'Navegador';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iPhone/iPad';
  if (/android/.test(ua)) return 'Android';
  if (/windows/.test(ua)) return 'Windows';
  if (/mac os/.test(ua)) return 'macOS';
  if (/linux/.test(ua)) return 'Linux';
  return 'Navegador';
}

function browser(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  return 'Web';
}

function suffix(): string {
  if (typeof window === 'undefined') return '';
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return current;
    const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
    const value = random.toUpperCase();
    window.localStorage.setItem(STORAGE_KEY, value);
    return value;
  } catch {
    return '';
  }
}

export function getDeviceName(): string {
  const id = suffix();
  return `${platform()} · ${browser()}${id ? ` · ${id}` : ''}`;
}

export function getKnownDeviceId(): string | null {
  try { return window.localStorage.getItem(KNOWN_DEVICE_KEY); } catch { return null; }
}

export function saveKnownDeviceId(deviceId: string): void {
  try { window.localStorage.setItem(KNOWN_DEVICE_KEY, deviceId); } catch { /* almacenamiento no disponible */ }
}
