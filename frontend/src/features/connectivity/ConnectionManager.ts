import { registerOfflineCheck, resolveApiUrl } from '../../services/apiClient';

export type ConnectionState = 'UNKNOWN' | 'CHECKING' | 'OFFLINE' | 'DEGRADED' | 'ONLINE';
export type OperationalMode = 'AUTO' | 'FORCE_OFFLINE';
export type ConnectionCheckReason =
  | 'STARTUP'
  | 'FOREGROUND'
  | 'ONLINE_EVENT'
  | 'OFFLINE_EVENT'
  | 'BEFORE_SYNC'
  | 'REQUEST_FAILURE'
  | 'REQUEST_SUCCESS'
  | 'MANUAL'
  | 'RETRY';

export type ConnectionSnapshot = {
  state: ConnectionState;
  reason: ConnectionCheckReason | null;
  checkedAt: string | null;
  serverTime: string | null;
  retryCount: number;
  mode: OperationalMode;
};

type ConnectionManagerOptions = {
  endpoint?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  minimumIntervalMs?: number;
  retryBaseMs?: number;
  retryMaximumMs?: number;
  lifecycleTarget?: EventTarget;
  visibilityTarget?: EventTarget & Partial<Pick<Document, 'visibilityState'>>;
  now?: () => number;
  setTimer?: typeof window.setTimeout;
  clearTimer?: typeof window.clearTimeout;
};

const initialSnapshot: ConnectionSnapshot = {
  state: 'UNKNOWN',
  reason: null,
  checkedAt: null,
  serverTime: null,
  retryCount: 0,
  mode: 'AUTO',
};

export class ConnectionManager {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly minimumIntervalMs: number;
  private readonly retryBaseMs: number;
  private readonly retryMaximumMs: number;
  private readonly lifecycleTarget?: EventTarget;
  private readonly visibilityTarget?: EventTarget & Partial<Pick<Document, 'visibilityState'>>;
  private readonly now: () => number;
  private readonly setTimer: typeof window.setTimeout;
  private readonly clearTimer: typeof window.clearTimeout;
  private readonly listeners = new Set<(snapshot: ConnectionSnapshot) => void>();
  private snapshot: ConnectionSnapshot = initialSnapshot;
  private mode: OperationalMode = 'AUTO';
  private inFlight?: Promise<ConnectionSnapshot>;
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private retryTimer?: number;
  private retryCount = 0;
  private requestSuccessGeneration = 0;
  private activeAbort?: AbortController;
  private started = false;

  constructor(options: ConnectionManagerOptions = {}) {
    this.endpoint = options.endpoint ?? resolveApiUrl('/connectivity');
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 7_000;
    this.minimumIntervalMs = options.minimumIntervalMs ?? 1_000;
    this.retryBaseMs = options.retryBaseMs ?? 2_000;
    this.retryMaximumMs = options.retryMaximumMs ?? 20_000;
    this.lifecycleTarget = options.lifecycleTarget ?? (typeof window !== 'undefined' ? window : undefined);
    this.visibilityTarget = options.visibilityTarget ?? (typeof document !== 'undefined' ? document : undefined);
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? window.setTimeout.bind(window);
    this.clearTimer = options.clearTimer ?? window.clearTimeout.bind(window);
  }

  getSnapshot = () => this.snapshot;

  getMode = () => this.mode;

  isForceOffline = () => this.mode === 'FORCE_OFFLINE';

  setMode = (mode: OperationalMode) => {
    if (this.mode === mode) {
      if (mode === 'AUTO' && this.snapshot.state !== 'ONLINE') {
        void this.manualCheck();
      }
      return;
    }
    this.mode = mode;
    this.activeAbort?.abort();
    this.activeAbort = undefined;
    this.inFlight = undefined;
    this.clearRetry();
    this.retryCount = 0;
    this.lastStartedAt = Number.NEGATIVE_INFINITY;

    if (mode === 'FORCE_OFFLINE') {
      this.publish({
        ...this.snapshot,
        state: 'OFFLINE',
        mode: 'FORCE_OFFLINE',
        reason: 'MANUAL',
        checkedAt: new Date(this.now()).toISOString(),
      });
    } else {
      const isBrowserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.publish({
        ...this.snapshot,
        mode: 'AUTO',
        state: isBrowserOnline ? 'CHECKING' : 'OFFLINE',
        reason: 'MANUAL',
        checkedAt: new Date(this.now()).toISOString(),
      });
      void this.check('MANUAL', true);
    }
  };

  toggleMode = (): OperationalMode => {
    const next: OperationalMode = this.mode === 'FORCE_OFFLINE' ? 'AUTO' : 'FORCE_OFFLINE';
    this.setMode(next);
    return next;
  };

  subscribe = (listener: (snapshot: ConnectionSnapshot) => void) => {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  };

  start() {
    if (this.started) return;
    this.started = true;
    this.lifecycleTarget?.addEventListener('online', this.handleOnline);
    this.lifecycleTarget?.addEventListener('offline', this.handleOffline);
    this.lifecycleTarget?.addEventListener('focus', this.handleFocus);
    this.lifecycleTarget?.addEventListener('agua-pura:request-failure', this.handleRequestFailure);
    this.lifecycleTarget?.addEventListener('agua-pura:request-success', this.handleRequestSuccess);
    this.visibilityTarget?.addEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.mode !== 'FORCE_OFFLINE') {
      void this.check('STARTUP', true);
    }
  }

  stop() {
    this.started = false;
    this.lifecycleTarget?.removeEventListener('online', this.handleOnline);
    this.lifecycleTarget?.removeEventListener('offline', this.handleOffline);
    this.lifecycleTarget?.removeEventListener('focus', this.handleFocus);
    this.lifecycleTarget?.removeEventListener('agua-pura:request-failure', this.handleRequestFailure);
    this.lifecycleTarget?.removeEventListener('agua-pura:request-success', this.handleRequestSuccess);
    this.visibilityTarget?.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.activeAbort?.abort();
    this.activeAbort = undefined;
    this.inFlight = undefined;
    this.lastStartedAt = Number.NEGATIVE_INFINITY;
    this.clearRetry();
  }

  manualCheck() {
    if (this.mode === 'FORCE_OFFLINE') return Promise.resolve(this.snapshot);
    this.clearRetry();
    this.retryCount = 0;
    return this.check('MANUAL', true);
  }

  beforeSync() {
    if (this.mode === 'FORCE_OFFLINE') return Promise.resolve(this.snapshot);
    return this.check('BEFORE_SYNC', true);
  }

  afterRequestFailure() {
    if (this.mode === 'FORCE_OFFLINE') return Promise.resolve(this.snapshot);
    return this.check('REQUEST_FAILURE');
  }

  check(reason: ConnectionCheckReason, force = false): Promise<ConnectionSnapshot> {
    if (this.mode === 'FORCE_OFFLINE') return Promise.resolve(this.snapshot);
    if (this.inFlight) return this.inFlight;
    const startedAt = this.now();
    if (!force && startedAt - this.lastStartedAt < this.minimumIntervalMs) return Promise.resolve(this.snapshot);
    this.lastStartedAt = startedAt;
    this.publish({ ...this.snapshot, state: 'CHECKING', reason });
    const generation = this.requestSuccessGeneration;
    const flight = this.performCheck(reason, startedAt, generation);
    this.inFlight = flight;
    void flight.finally(() => {
      if (this.inFlight === flight) this.inFlight = undefined;
    });
    return flight;
  }

  private readonly handleOnline = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    this.clearRetry();
    this.retryCount = 0;
    void this.check('ONLINE_EVENT', true);
  };

  private readonly handleFocus = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    if (this.snapshot.state !== 'ONLINE') {
      this.clearRetry();
      this.retryCount = 0;
      void this.check('MANUAL', true);
    }
  };

  private readonly handleOffline = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    this.publish({
      ...this.snapshot,
      state: 'OFFLINE',
      reason: 'OFFLINE_EVENT',
      checkedAt: new Date(this.now()).toISOString(),
      serverTime: null,
    });
    this.scheduleRetry();
  };

  private readonly handleRequestFailure = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    void this.afterRequestFailure();
  };

  private readonly handleRequestSuccess = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    this.requestSuccessGeneration += 1;
    this.retryCount = 0;
    this.clearRetry();
    this.publish({
      ...this.snapshot,
      state: 'ONLINE',
      reason: 'REQUEST_SUCCESS',
      checkedAt: new Date(this.now()).toISOString(),
      serverTime: null,
      retryCount: 0,
    });
  };

  private readonly handleVisibilityChange = () => {
    if (this.mode === 'FORCE_OFFLINE') return;
    if (this.visibilityTarget?.visibilityState === 'visible') {
      this.clearRetry();
      this.retryCount = 0;
      void this.check('FOREGROUND');
    }
  };

  private async performCheck(reason: ConnectionCheckReason, startedAt: number, generation: number) {
    const controller = new AbortController();
    this.activeAbort = controller;
    const timeout = this.setTimer(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(this.endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
      if (!response.ok) {
        return this.markUnavailable('DEGRADED', reason, startedAt);
      }
      const payload = await response.json().catch(() => ({})) as { serverTime?: string };
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
      this.retryCount = 0;
      this.clearRetry();
      const online: ConnectionSnapshot = {
        state: 'ONLINE',
        reason,
        checkedAt: new Date(startedAt).toISOString(),
        serverTime: payload.serverTime ?? null,
        retryCount: 0,
        mode: this.mode,
      };
      this.publish(online);
      return online;
    } catch {
      if (generation !== this.requestSuccessGeneration) return this.snapshot;
      return this.markUnavailable('OFFLINE', reason, startedAt);
    } finally {
      this.clearTimer(timeout);
      if (this.activeAbort === controller) this.activeAbort = undefined;
    }
  }

  private markUnavailable(state: 'DEGRADED' | 'OFFLINE', reason: ConnectionCheckReason, checkedAt: number) {
    const unavailable: ConnectionSnapshot = {
      state,
      reason,
      checkedAt: new Date(checkedAt).toISOString(),
      serverTime: null,
      retryCount: this.retryCount,
      mode: this.mode,
    };
    this.publish(unavailable);
    this.scheduleRetry();
    return unavailable;
  }

  private scheduleRetry() {
    if (this.retryTimer !== undefined) return;
    const delay = Math.min(this.retryBaseMs * 2 ** this.retryCount, this.retryMaximumMs);
    this.retryCount += 1;
    this.publish({ ...this.snapshot, retryCount: this.retryCount });
    this.retryTimer = this.setTimer(() => {
      this.retryTimer = undefined;
      void this.check('RETRY', true);
    }, delay);
  }

  private clearRetry() {
    if (this.retryTimer !== undefined) this.clearTimer(this.retryTimer);
    this.retryTimer = undefined;
  }

  private publish(snapshot: ConnectionSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const connectionManager = new ConnectionManager();
registerOfflineCheck(() => connectionManager.isForceOffline());
